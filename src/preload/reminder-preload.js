// preload：提醒弹窗与主进程之间的受控通道
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reminderAPI', {
  onPet: (cb) => ipcRenderer.on('reminder:pet', (_e, asset) => cb(asset)),  // 宠物当前形象（头像）
  onList: (cb) => ipcRenderer.on('reminder:list', (_e, list) => cb(list)), // 主进程推送待确认列表
  onPlay: (cb) => ipcRenderer.on('reminder:play', (_e, items) => cb(items)), // 播放刚触发的提示音
  ack: (id) => ipcRenderer.send('reminder:ack', id),                       // 确认某条
  resize: (h) => ipcRenderer.send('reminder:resize', h),                   // 内容高度自适应
});
