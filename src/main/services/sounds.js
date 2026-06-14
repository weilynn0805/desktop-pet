// 提示音服务：把用户选中的音频文件复制进 userData/sounds，
// 之后只存我们目录下的路径（避免源文件被移动/删除导致失效）。
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
const PICK_EXTENSIONS = AUDIO_EXTS.map((e) => e.slice(1)); // 去掉点，供对话框过滤

function isAudio(filePath) {
  return AUDIO_EXTS.includes(path.extname(filePath).toLowerCase());
}

function soundsDir() {
  const dir = path.join(app.getPath('userData'), 'sounds');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// 复制进提示音目录，返回 { path, name(原文件名) }；非音频返回 null
function importSound(srcPath) {
  if (!isAudio(srcPath)) return null;
  const ext = path.extname(srcPath);
  const destPath = path.join(soundsDir(), `snd-${Date.now()}${ext}`);
  fs.copyFileSync(srcPath, destPath);
  return { path: destPath, name: path.basename(srcPath) };
}

module.exports = { importSound, isAudio, PICK_EXTENSIONS };
