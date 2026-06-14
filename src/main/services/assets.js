// 素材服务：识别素材类型 + 把用户选中的文件复制进本地素材目录
// （复制后只在 config 里存我们目录下的路径，避免用户移动/删除源文件导致失效）
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const IMAGE_EXTS = ['.png', '.apng', '.gif', '.webp', '.jpg', '.jpeg'];
const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.m4v'];

// 能真正透明显示的格式（自带 alpha 通道，Chromium 原生支持）：
// 透明图片/动图 + WebM(VP9/VP8 alpha)。其余(jpg、mp4、mov…)会带矩形背景。
const ALPHA_EXTS = ['.png', '.apng', '.gif', '.webp', '.webm'];

// 文件选择对话框用的扩展名（去掉点）
const PICK_EXTENSIONS = [...IMAGE_EXTS, ...VIDEO_EXTS].map((e) => e.slice(1));

// 该素材能否透明显示（决定上传时是否要警告“会带背景”）
function supportsAlpha(filePath) {
  return ALPHA_EXTS.includes(path.extname(filePath).toLowerCase());
}

// 本地素材目录：userData/assets
function assetsDir() {
  const dir = path.join(app.getPath('userData'), 'assets');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// 根据扩展名判断渲染方式：image 用 <img>，video 用 <video>
function detectType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  return null; // 不支持的类型
}

// ---- 规格检测（PRD §7/§12：单文件 ≤50MB、分辨率建议 ≤1080p；仅提示不拦截）----
const MAX_SIZE_MB = 50;
const MAX_W = 1920, MAX_H = 1080; // 1080p 建议上限

// 读取文件头若干字节（解析分辨率用，避免整文件读入内存）
function readHeader(filePath, bytes = 256 * 1024) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const len = Math.min(bytes, fs.fstatSync(fd).size);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, 0);
    return buf;
  } finally { fs.closeSync(fd); }
}

// 从文件头解析图片像素尺寸（支持 PNG/APNG、GIF、WebP、JPEG；解析不出返回 null）
function imageSize(buf) {
  if (!buf || buf.length < 24) return null;
  // PNG / APNG：IHDR 宽高在偏移 16/20（大端）
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF：逻辑屏宽高在偏移 6/8（小端）
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // WebP：RIFF....WEBP，再按 VP8/VP8L/VP8X 子块解析
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') {
    const fourcc = buf.slice(12, 16).toString('ascii');
    if (fourcc === 'VP8 ' && buf.length > 29) {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (fourcc === 'VP8L' && buf.length > 24) {
      const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      };
    }
    if (fourcc === 'VP8X' && buf.length > 29) {
      return {
        width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
        height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
      };
    }
    return null;
  }
  // JPEG：扫描 SOF 段，宽高在段内偏移（大端）
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      }
      const segLen = buf.readUInt16BE(off + 2);
      if (segLen < 2) break;
      off += 2 + segLen;
    }
  }
  return null;
}

// 检测单个文件规格：{ sizeMB, width, height }（视频/未知格式宽高为 null）
function inspect(filePath) {
  let sizeMB = 0, width = null, height = null;
  try { sizeMB = fs.statSync(filePath).size / (1024 * 1024); } catch {}
  if (detectType(filePath) === 'image') {
    try { const d = imageSize(readHeader(filePath)); if (d) { width = d.width; height = d.height; } } catch {}
  }
  return { sizeMB, width, height };
}

// 生成超规格提示行（数组，空数组=没超）。仅提示，不拦截。
function overLimitWarnings(filePath) {
  const { sizeMB, width, height } = inspect(filePath);
  const lines = [];
  if (sizeMB > MAX_SIZE_MB) lines.push(`文件 ${sizeMB.toFixed(1)}MB，超过建议上限 ${MAX_SIZE_MB}MB`);
  if (width && height && (width > MAX_W || height > MAX_H)) {
    lines.push(`分辨率 ${width}×${height}，超过建议的 1080p（1920×1080）`);
  }
  return lines;
}

// 把源文件复制进素材目录，返回 { path, type }
function importAsset(srcPath) {
  const type = detectType(srcPath);
  if (!type) return null;
  const ext = path.extname(srcPath);
  const destName = `pet-${Date.now()}${ext}`;
  const destPath = path.join(assetsDir(), destName);
  fs.copyFileSync(srcPath, destPath);
  return { path: destPath, type };
}

module.exports = { detectType, importAsset, supportsAlpha, inspect, overLimitWarnings, PICK_EXTENSIONS };
