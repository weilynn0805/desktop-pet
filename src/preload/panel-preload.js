// preload：把设置面板需要的能力安全暴露给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('panelAPI', {
  getInfo: () => ipcRenderer.invoke('panel:getInfo'),
});
