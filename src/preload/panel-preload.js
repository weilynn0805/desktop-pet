// preload：把设置面板需要的能力安全暴露给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('panelAPI', {
  getInfo: () => ipcRenderer.invoke('panel:getInfo'),
  // 互动文案：读取 + 保存
  getPhrases: () => ipcRenderer.invoke('phrases:get'),
  setPhrases: (list) => ipcRenderer.send('phrases:set', list),
  // 定时主动冒泡配置：读取 + 保存
  getAutoBubble: () => ipcRenderer.invoke('autobubble:get'),
  setAutoBubble: (cfg) => ipcRenderer.send('autobubble:set', cfg),
  // 开机自启：读取 + 设置
  getAutoLaunch: () => ipcRenderer.invoke('autolaunch:get'),
  setAutoLaunch: (on) => ipcRenderer.send('autolaunch:set', on),
});
