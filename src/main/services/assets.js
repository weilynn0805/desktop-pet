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

module.exports = { detectType, importAsset, supportsAlpha, PICK_EXTENSIONS };
