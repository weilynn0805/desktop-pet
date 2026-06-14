// preload：全屏休息覆盖层的受控 API
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('restAPI', {
  onPet: (cb) => ipcRenderer.on('rest:pet', (_e, d) => cb(d)),   // 宠物形象 + 名称
  onShow: (cb) => ipcRenderer.on('rest:show', (_e, d) => cb(d)), // {minutes, restSeconds}
  ack: () => ipcRenderer.send('rest:ack'),                        // 到点自动结束 / 跳过：清零并关窗
});
