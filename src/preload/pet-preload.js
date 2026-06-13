// preload：只把宠物窗需要的能力安全暴露给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  getPosition: () => ipcRenderer.invoke('pet:getPosition'),
  move: (x, y) => ipcRenderer.send('pet:move', { x, y }),
  savePosition: () => ipcRenderer.send('pet:savePosition'),
  showMenu: () => ipcRenderer.send('pet:showMenu'),
});
