// preload：只把宠物窗需要的能力安全暴露给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  getPosition: () => ipcRenderer.invoke('pet:getPosition'),
  move: (x, y) => ipcRenderer.send('pet:move', { x, y }),
  savePosition: () => ipcRenderer.send('pet:savePosition'),
  showMenu: () => ipcRenderer.send('pet:showMenu'),
  setInteractive: (on) => ipcRenderer.send('pet:setInteractive', on),
  getScale: () => ipcRenderer.invoke('pet:getScale'),
  setScale: (s) => ipcRenderer.send('pet:setScale', s),
  getAsset: () => ipcRenderer.invoke('pet:getAsset'),
  // 素材变化时主进程主动推送（选择/恢复默认）
  onAssetChanged: (cb) => ipcRenderer.on('pet:assetChanged', (_e, asset) => cb(asset)),
  // 互动文案：读取 + 监听变更
  getPhrases: () => ipcRenderer.invoke('phrases:get'),
  onPhrasesChanged: (cb) => ipcRenderer.on('pet:phrasesChanged', (_e, list) => cb(list)),
});
