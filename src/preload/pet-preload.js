// preload：只把宠物窗需要的能力安全暴露给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  getPosition: () => ipcRenderer.invoke('pet:getPosition'),
  move: (x, y) => ipcRenderer.send('pet:move', { x, y }),
  savePosition: () => ipcRenderer.send('pet:savePosition'),
  showMenu: () => ipcRenderer.send('pet:showMenu'),
  openPanel: () => ipcRenderer.send('pet:openPanel'), // 双击宠物开面板
  setInteractive: (on) => ipcRenderer.send('pet:setInteractive', on),
  // 暂停 / 恢复：读取 + 监听变更
  getPaused: () => ipcRenderer.invoke('paused:get'),
  onPausedChanged: (cb) => ipcRenderer.on('pet:pausedChanged', (_e, on) => cb(on)),
  getScale: () => ipcRenderer.invoke('pet:getScale'),
  setScale: (s) => ipcRenderer.send('pet:setScale', s),
  onScaleChanged: (cb) => ipcRenderer.on('pet:scaleChanged', (_e, s) => cb(s)),
  getAsset: () => ipcRenderer.invoke('pet:getAsset'),
  // 素材变化时主进程主动推送（选择/恢复默认）
  onAssetChanged: (cb) => ipcRenderer.on('pet:assetChanged', (_e, asset) => cb(asset)),
  // 当前素材专属文案被实时编辑时推送（不重渲染素材）
  onCaptionChanged: (cb) => ipcRenderer.on('pet:captionChanged', (_e, c) => cb(c)),
  // 互动文案：读取 + 监听变更
  getPhrases: () => ipcRenderer.invoke('phrases:get'),
  onPhrasesChanged: (cb) => ipcRenderer.on('pet:phrasesChanged', (_e, list) => cb(list)),
  // 默认文案开关：读取 + 监听变更
  getDefaultPhrases: () => ipcRenderer.invoke('defaultphrases:get'),
  onDefaultPhrasesChanged: (cb) => ipcRenderer.on('pet:defaultPhrasesChanged', (_e, on) => cb(on)),
  // 定时主动冒泡配置：读取 + 监听变更
  getAutoBubble: () => ipcRenderer.invoke('autobubble:get'),
  onAutoBubbleChanged: (cb) => ipcRenderer.on('pet:autoBubbleChanged', (_e, cfg) => cb(cfg)),
  // 被戳台词：读取 + 监听变更
  getReactions: () => ipcRenderer.invoke('reactions:get'),
  onReactionsChanged: (cb) => ipcRenderer.on('pet:reactionsChanged', (_e, list) => cb(list)),
});
