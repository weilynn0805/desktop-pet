// 极简本地持久化：把配置读写到 userData/config.json
// MVP 阶段只存宠物位置；后续可平滑替换为 electron-store。
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const file = path.join(app.getPath('userData'), 'config.json');

// 读取全部配置；文件不存在或损坏时返回空对象
function read() {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

// 增量合并写入（只覆盖传入的字段）
function write(patch) {
  const next = { ...read(), ...patch };
  fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

module.exports = { read, write, file };
