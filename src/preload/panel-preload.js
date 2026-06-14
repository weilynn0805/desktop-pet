// preload：把设置面板需要的能力安全暴露给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('panelAPI', {
  getInfo: () => ipcRenderer.invoke('panel:getInfo'),
  // 互动文案：读取 + 保存
  getPhrases: () => ipcRenderer.invoke('phrases:get'),
  setPhrases: (list) => ipcRenderer.send('phrases:set', list),
  // 默认文案开关：读取 + 设置
  getDefaultPhrases: () => ipcRenderer.invoke('defaultphrases:get'),
  setDefaultPhrases: (on) => ipcRenderer.send('defaultphrases:set', on),
  // 被戳台词：读取 + 保存
  getReactions: () => ipcRenderer.invoke('reactions:get'),
  setReactions: (list) => ipcRenderer.send('reactions:set', list),
  // 定时主动冒泡配置：读取 + 保存
  getAutoBubble: () => ipcRenderer.invoke('autobubble:get'),
  setAutoBubble: (cfg) => ipcRenderer.send('autobubble:set', cfg),
  // 事项提醒：列表 / 增 / 改 / 删
  getReminders: () => ipcRenderer.invoke('reminders:list'),
  addReminder: (data) => ipcRenderer.invoke('reminders:add', data),
  updateReminder: (id, data) => ipcRenderer.invoke('reminders:update', { id, data }),
  removeReminder: (id) => ipcRenderer.invoke('reminders:remove', id),
  onRemindersChanged: (cb) => ipcRenderer.on('panel:remindersChanged', (_e, list) => cb(list)), // 到点触发后刷新
  pickSound: () => ipcRenderer.invoke('sound:pick'), // 选择自定义提示音 → {path,name}|null
  // 提醒形象：头像 + 名称（上传头像后固定用它，否则跟随当前素材）
  getReminderIdentity: () => ipcRenderer.invoke('reminderidentity:get'),
  setReminderName: (name) => ipcRenderer.send('reminderidentity:setName', name),
  pickReminderAvatar: () => ipcRenderer.invoke('reminderavatar:pick'),
  clearReminderAvatar: () => ipcRenderer.invoke('reminderavatar:clear'),
  // 防沉迷：读取当前计时现状 + 监听实时状态推送（usage/idle/cfg）
  getFatigue: () => ipcRenderer.invoke('fatigue:get'),
  setFatigue: (cfg) => ipcRenderer.invoke('fatigue:set', cfg), // 保存 → 回传清洗后的 cfg
  onFatigueStatus: (cb) => ipcRenderer.on('panel:fatigueStatus', (_e, s) => cb(s)),
  // 防沉迷全屏素材：读取 / 上传 / 清除（专属，独立于提醒头像）
  getFatigueAsset: () => ipcRenderer.invoke('fatigueasset:get'),
  pickFatigueAsset: () => ipcRenderer.invoke('fatigueasset:pick'),
  clearFatigueAsset: () => ipcRenderer.invoke('fatigueasset:clear'),
  // 开机自启：读取 + 设置
  getAutoLaunch: () => ipcRenderer.invoke('autolaunch:get'),
  setAutoLaunch: (on) => ipcRenderer.send('autolaunch:set', on),
  // 形象与素材（多素材 + 轮播）：列表 / 添加 / 删除 / 手动下一个 / 监听变更
  getAssets: () => ipcRenderer.invoke('assets:list'),
  addAsset: () => ipcRenderer.invoke('assets:add'),
  removeAsset: (i) => ipcRenderer.invoke('assets:remove', i),
  nextAsset: () => ipcRenderer.invoke('assets:next'),
  setAssetCaption: (index, caption) => ipcRenderer.send('assets:setCaption', { index, caption }),
  onAssetsChanged: (cb) => ipcRenderer.on('panel:assetsChanged', (_e, list) => cb(list)),
  // 轮播间隔（分钟）：读取 / 保存
  getRotate: () => ipcRenderer.invoke('rotate:get'),
  setRotate: (m) => ipcRenderer.send('rotate:set', m),
  // 行为：置顶 / 缩放 / 退出
  getAlwaysOnTop: () => ipcRenderer.invoke('alwaysontop:get'),
  setAlwaysOnTop: (on) => ipcRenderer.send('alwaysontop:set', on),
  getScale: () => ipcRenderer.invoke('pet:getScale'),
  resetScale: () => ipcRenderer.invoke('scale:reset'),
  quitApp: () => ipcRenderer.send('app:quit'),
});
