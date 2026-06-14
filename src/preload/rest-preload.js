// preload：全屏休息覆盖层的受控 API
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('restAPI', {
  onPet: (cb) => ipcRenderer.on('rest:pet', (_e, d) => cb(d)),   // 宠物形象 + 名称
  onShow: (cb) => ipcRenderer.on('rest:show', (_e, d) => cb(d)), // {minutes, restSeconds, paused}
  onPause: (cb) => ipcRenderer.on('rest:pause', () => cb()),     // 提醒打断 → 暂停倒计时
  onResume: (cb) => ipcRenderer.on('rest:resume', () => cb()),   // 提醒确认完 → 恢复倒计时
  ack: () => ipcRenderer.send('rest:ack'),                        // 到点自动结束 / 跳过：清零并关窗
});
