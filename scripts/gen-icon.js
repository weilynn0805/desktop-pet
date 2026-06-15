// 用 Electron nativeImage 把 build/icon-source.png 居中裁成正方形，
// 生成多尺寸 PNG 并打包为 build/icon.ico（Windows 支持 PNG 压缩的图标条目）。
// 运行：npx electron scripts/gen-icon.js
const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'build', 'icon-source.png');
const OUT = path.join(__dirname, '..', 'build', 'icon.ico');
const SIZES = [256, 128, 64, 48, 32, 16];

// 把若干 PNG 条目组装成 .ico 容器
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // 保留
  header.writeUInt16LE(1, 2); // 类型：1=图标
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  const blobs = [];
  entries.forEach((e, i) => {
    const b = 16 * i;
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, b + 0);  // 宽（0 表示 256）
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, b + 1);  // 高
    dir.writeUInt8(0, b + 2);   // 调色板数
    dir.writeUInt8(0, b + 3);   // 保留
    dir.writeUInt16LE(1, b + 4);   // 色彩平面
    dir.writeUInt16LE(32, b + 6);  // 位深
    dir.writeUInt32LE(e.buf.length, b + 8);   // 数据字节数
    dir.writeUInt32LE(offset, b + 12);        // 数据偏移
    offset += e.buf.length;
    blobs.push(e.buf);
  });
  return Buffer.concat([header, dir, ...blobs]);
}

app.whenReady().then(() => {
  try {
    if (!fs.existsSync(SRC)) throw new Error('找不到源图片：' + SRC);
    let img = nativeImage.createFromPath(SRC);
    if (img.isEmpty()) throw new Error('源图片为空或无法解析：' + SRC);
    const { width, height } = img.getSize();
    const side = Math.min(width, height);
    img = img.crop({                                  // 居中裁正方形
      x: Math.round((width - side) / 2),
      y: Math.round((height - side) / 2),
      width: side,
      height: side,
    });
    const entries = SIZES.map((s) => ({
      size: s,
      buf: img.resize({ width: s, height: s, quality: 'best' }).toPNG(),
    }));
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, buildIco(entries));
    console.log('ICON_OK', OUT, fs.statSync(OUT).size, 'bytes', `(源 ${width}x${height} → 裁 ${side}x${side})`);
  } catch (e) {
    console.error('ICON_FAIL', e.message);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
