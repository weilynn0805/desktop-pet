// 主进程：创建透明悬浮宠物窗，处理拖动/位置持久化/素材/右键菜单
const { app, BrowserWindow, ipcMain, Menu, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const assets = require('./services/assets');

const PET_SIZE = 200; // 宠物在缩放=1 时的边长
const MIN_SCALE = 0.5, MAX_SCALE = 2.5; // 缩放范围
// 窗口固定为最大尺寸：透明窗口在 Windows 上无法可靠 resize，故窗口不动，
// 缩放只改窗口内宠物的 CSS transform。窗口够大以容纳放到最大的宠物。
const WIN_SIZE = Math.round(PET_SIZE * MAX_SCALE);
const MARGIN = Math.round((WIN_SIZE - PET_SIZE) / 2); // 宠物居中后四周的透明留白
let petWin = null;
let settingsWin = null; // 设置面板（单例）

const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s || 1));

function createPetWindow() {
  const saved = store.read();
  const pos = saved.petPosition;
  const onTop = saved.petAlwaysOnTop !== false; // 默认置顶

  const win = new BrowserWindow({
    width: WIN_SIZE,
    height: WIN_SIZE,
    x: pos?.x,
    y: pos?.y,
    transparent: true,    // 透明背景（去黑/白底）
    frame: false,         // 无边框
    alwaysOnTop: onTop,   // 置顶（可在设置面板关闭）
    skipTaskbar: true,    // 不在任务栏显示
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/pet-preload.js'),
      contextIsolation: true, // 渲染进程隔离，经 preload 暴露受控 API
      nodeIntegration: false,
      // 仅加载本地素材、无任何联网内容；关闭同源限制以便对宠物做逐像素命中检测
      webSecurity: false,
    },
  });

  if (onTop) win.setAlwaysOnTop(true, 'screen-saver'); // 提升到更高置顶层级
  win.loadFile(path.join(__dirname, '../renderer/pet/index.html'));

  // 默认整窗鼠标穿透（forward:true 仍转发 mousemove，供渲染层判断指针是否在宠物上）。
  // 只有指针落在宠物不透明像素上时，渲染层才请求临时关闭穿透。
  win.setIgnoreMouseEvents(true, { forward: true });

  // 首次启动（无记忆位置）→ 让“宠物本体”落在主屏右下角（扣掉透明留白）
  if (!pos) {
    const { workArea } = screen.getPrimaryDisplay();
    win.setPosition(
      Math.round(workArea.x + workArea.width - MARGIN - PET_SIZE - 40),
      Math.round(workArea.y + workArea.height - MARGIN - PET_SIZE - 40)
    );
  }
  return win;
}

// 打开设置面板：已存在则聚焦，否则新建（普通带边框窗口）
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 420,
    height: 560,
    title: '桌面宠物 · 设置',
    resizable: true,
    minimizable: true,
    maximizable: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/panel-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWin.setMenuBarVisibility(false); // 隐藏默认菜单栏
  settingsWin.loadFile(path.join(__dirname, '../renderer/panel/index.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

app.whenReady().then(() => {
  petWin = createPetWindow();
  petWin.webContents.once('did-finish-load', startRotation); // 窗口就绪后启动轮播定时器
});

// 渲染进程在拖动开始时获取窗口当前位置（用于计算位移）
ipcMain.handle('pet:getPosition', () => {
  const [x, y] = petWin.getPosition();
  return { x, y };
});

// 拖动过程中实时移动窗口
ipcMain.on('pet:move', (_e, { x, y }) => {
  petWin.setPosition(Math.round(x), Math.round(y));
});

// 拖动结束 → 持久化位置
ipcMain.on('pet:savePosition', () => {
  const [x, y] = petWin.getPosition();
  store.write({ petPosition: { x, y } });
});

// 设置面板：返回版本/环境信息
ipcMain.handle('panel:getInfo', () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  platform: `${process.platform} ${process.arch}`,
}));

// ---- 互动文案 ----
const DEFAULT_PHRASES = [
  '你好呀～',
  '今天也要加油哦！',
  '记得起来喝口水 💧',
  '摸摸我吧～',
  '在忙什么呢？',
  '休息一下眼睛吧 👀',
  '我一直在这儿陪你 ✨',
];
function getPhrases() {
  const p = store.read().petPhrases;
  return Array.isArray(p) && p.length ? p : DEFAULT_PHRASES; // 空则回退默认
}
ipcMain.handle('phrases:get', () => getPhrases());
ipcMain.on('phrases:set', (_e, list) => {
  const clean = Array.isArray(list) ? list.map((s) => String(s).trim()).filter(Boolean) : [];
  store.write({ petPhrases: clean.length ? clean : null }); // 清空 → 存 null → 回退默认
  if (petWin && !petWin.isDestroyed()) {
    petWin.webContents.send('pet:phrasesChanged', getPhrases()); // 通知宠物热更新
  }
});

// ---- 默认文案开关：关掉后宠物只说素材专属文案（无专属则不说）----
function getDefaultPhrasesEnabled() {
  return store.read().defaultPhrasesEnabled !== false; // 默认开启
}
ipcMain.handle('defaultphrases:get', () => getDefaultPhrasesEnabled());
ipcMain.on('defaultphrases:set', (_e, on) => {
  store.write({ defaultPhrasesEnabled: !!on });
  if (petWin && !petWin.isDestroyed()) {
    petWin.webContents.send('pet:defaultPhrasesChanged', !!on);
  }
});

// ---- 被戳台词（单击宠物时的反应）----
const DEFAULT_REACTIONS = [
  '嘿嘿，好痒～',
  '别戳啦 >_<',
  '么么哒 (｡･ω･｡)',
  '干嘛呀～',
  '再戳我要害羞了',
  '哎呀！',
  '你戳到我啦',
];
function getReactions() {
  const r = store.read().petReactions;
  return Array.isArray(r) && r.length ? r : DEFAULT_REACTIONS;
}
ipcMain.handle('reactions:get', () => getReactions());
ipcMain.on('reactions:set', (_e, list) => {
  const clean = Array.isArray(list) ? list.map((s) => String(s).trim()).filter(Boolean) : [];
  store.write({ petReactions: clean.length ? clean : null }); // 清空 → 回退默认
  if (petWin && !petWin.isDestroyed()) {
    petWin.webContents.send('pet:reactionsChanged', getReactions());
  }
});

// ---- 定时主动冒泡配置（是否开启 + 间隔秒数）----
function getAutoBubble() {
  const s = store.read();
  const interval = Number(s.autoBubbleInterval);
  return {
    enabled: s.autoBubbleEnabled !== false, // 默认开启
    interval: Number.isFinite(interval) && interval > 0 ? interval : 25, // 默认 25 秒
  };
}
// ---- 开机自启（由操作系统登录项管理，OS 即真相来源）----
// 开发态(electron .)需显式指定 electron 路径与项目目录，打包后用默认即可
function loginItemOpts(extra) {
  if (app.isPackaged) return extra || {};
  return { path: process.execPath, args: [path.resolve(process.argv[1] || '.')], ...(extra || {}) };
}
ipcMain.handle('autolaunch:get', () => app.getLoginItemSettings(loginItemOpts()).openAtLogin);
ipcMain.on('autolaunch:set', (_e, enable) => {
  app.setLoginItemSettings(loginItemOpts({ openAtLogin: !!enable }));
});

ipcMain.handle('autobubble:get', () => getAutoBubble());
ipcMain.on('autobubble:set', (_e, cfg) => {
  let interval = Math.round(Number(cfg && cfg.interval));
  if (!Number.isFinite(interval)) interval = 25;
  interval = Math.min(3600, Math.max(3, interval)); // 限制 3~3600 秒
  store.write({ autoBubbleEnabled: !!(cfg && cfg.enabled), autoBubbleInterval: interval });
  if (petWin && !petWin.isDestroyed()) {
    petWin.webContents.send('pet:autoBubbleChanged', getAutoBubble());
  }
});

// 缩放：渲染层负责改 CSS transform，这里只读/存比例
ipcMain.handle('pet:getScale', () => clampScale(store.read().petScale));
ipcMain.on('pet:setScale', (_e, s) => store.write({ petScale: clampScale(s) }));
// 缩放重置为 1：写库并通知宠物窗套用
ipcMain.handle('scale:reset', () => {
  store.write({ petScale: 1 });
  if (petWin && !petWin.isDestroyed()) petWin.webContents.send('pet:scaleChanged', 1);
  return 1;
});

// 窗口置顶（持久化，默认开启）
ipcMain.handle('alwaysontop:get', () => store.read().petAlwaysOnTop !== false);
ipcMain.on('alwaysontop:set', (_e, on) => {
  store.write({ petAlwaysOnTop: !!on });
  if (petWin && !petWin.isDestroyed()) {
    if (on) petWin.setAlwaysOnTop(true, 'screen-saver');
    else petWin.setAlwaysOnTop(false);
  }
});

// 退出应用
ipcMain.on('app:quit', () => app.quit());

// ---- 暂停 / 恢复宠物（暂停时停掉定时冒泡、动画与互动；持久化，重启保持）----
function getPaused() {
  return store.read().petPaused === true; // 默认不暂停
}
function setPaused(on) {
  store.write({ petPaused: !!on });
  if (petWin && !petWin.isDestroyed()) petWin.webContents.send('pet:pausedChanged', !!on);
}
ipcMain.handle('paused:get', () => getPaused());
ipcMain.on('paused:set', (_e, on) => setPaused(on));

// 双击宠物 → 打开设置面板（与右键菜单同一入口）
ipcMain.on('pet:openPanel', () => openSettings());

// 渲染进程启动时获取当前应显示的素材（无则返回 null → 显示默认 CSS 宠物）
ipcMain.handle('pet:getAsset', () => {
  const list = getAssets();
  return list.length ? list[Math.min(rotateIndex, list.length - 1)] : null;
});

// 渲染层根据指针是否在宠物上，开/关鼠标穿透
ipcMain.on('pet:setInteractive', (_e, interactive) => {
  petWin.setIgnoreMouseEvents(!interactive, { forward: true });
});

// ---- 多素材 + 轮播（数据：petAssets 数组；定时器集中在主进程）----
// 读取素材列表（兼容旧版单素材 petAsset → 自动迁移为单元素数组）
function getAssets() {
  const s = store.read();
  if (Array.isArray(s.petAssets)) return s.petAssets.slice();
  if (s.petAsset) return [s.petAsset];
  return [];
}
// 轮播间隔（分钟）：PRD §6.1 限制 5~60，默认 5
function getRotateMinutes() {
  const m = Number(store.read().petRotateMinutes);
  return Number.isFinite(m) && m >= 5 ? Math.min(60, Math.round(m)) : 5;
}
// 保存素材列表 → 清掉旧字段 → 通知面板 → 重建轮播
function saveAssets(list) {
  store.write({ petAssets: list, petAsset: null });
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.webContents.send('panel:assetsChanged', getAssets());
  }
  startRotation();
}

let rotateTimer = null;
let rotateIndex = 0;
// 把第 i 个素材推给宠物窗（越界自动取模；空列表 → null=默认形象）
function showAssetAt(i) {
  const list = getAssets();
  const asset = list.length ? list[((i % list.length) + list.length) % list.length] : null;
  if (petWin && !petWin.isDestroyed()) petWin.webContents.send('pet:assetChanged', asset);
}
// 重建轮播：立即显示第一个；仅当 ≥2 个素材时启动定时切换
function startRotation() {
  clearInterval(rotateTimer);
  rotateTimer = null;
  rotateIndex = 0;
  showAssetAt(0);
  const list = getAssets();
  if (list.length >= 2) {
    rotateTimer = setInterval(() => {
      const n = getAssets().length;
      if (n < 2) return;
      rotateIndex = (rotateIndex + 1) % n;
      showAssetAt(rotateIndex);
    }, getRotateMinutes() * 60 * 1000);
  }
}
// 手动切到下一个（面板“切换到下一个”按钮，便于即时验证轮播）
function rotateNext() {
  const list = getAssets();
  if (!list.length) return null;
  rotateIndex = (rotateIndex + 1) % list.length;
  showAssetAt(rotateIndex);
  return list[rotateIndex];
}

// 添加素材：可多选；统一类型校验 + 无 alpha 批量警告一次；返回新列表。
function addAssets(parentWin) {
  const owner = parentWin && !parentWin.isDestroyed() ? parentWin : petWin;
  const result = dialog.showOpenDialogSync(owner, {
    title: '添加宠物素材（可多选）',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '宠物素材（图片/动图/视频）', extensions: assets.PICK_EXTENSIONS },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (!result || !result.length) return getAssets(); // 取消

  const valid = result.filter((f) => assets.detectType(f));
  if (!valid.length) {
    dialog.showMessageBox(owner, {
      type: 'warning',
      message: '不支持的素材格式',
      detail: '支持：png/apng/gif/webp/jpg 与 mp4/webm/mov/m4v。',
    });
    return getAssets();
  }

  // 无 alpha 通道的格式会带矩形背景 → 整批确认一次
  const noAlpha = valid.filter((f) => !assets.supportsAlpha(f));
  if (noAlpha.length) {
    const choice = dialog.showMessageBoxSync(owner, {
      type: 'warning',
      buttons: ['仍然添加', '取消'],
      defaultId: 1,
      cancelId: 1,
      message: noAlpha.length === valid.length ? '所选素材无透明通道' : '部分素材无透明通道',
      detail:
        '无透明通道的素材会带矩形背景显示，无法只显示主体轮廓。\n\n' +
        '想要“悬浮只显示主体”，请改用：\n' +
        '· 透明 GIF / APNG / PNG（动图/图片，最常见、效果最好）\n' +
        '· WebM（VP9 alpha）透明视频',
    });
    if (choice === 1) return getAssets(); // 取消整批
  }

  const list = getAssets();
  for (const f of valid) {
    const a = assets.importAsset(f);
    if (a) list.push(a);
  }
  saveAssets(list);
  return list;
}

// 删除第 index 个素材：从磁盘删文件 + 从列表移除 → 返回新列表
function removeAsset(index) {
  const list = getAssets();
  if (index < 0 || index >= list.length) return list;
  const [removed] = list.splice(index, 1);
  try { if (removed && removed.path) fs.unlinkSync(removed.path); } catch {}
  saveAssets(list);
  return list;
}

// 设置第 index 个素材的专属文案（≤20 字，可清空）。
// 若改的正是当前显示的素材，单独推 caption 给宠物窗（不重渲染素材，避免闪烁）。
function setAssetCaption(index, caption) {
  const list = getAssets();
  if (index < 0 || index >= list.length) return list;
  const c = String(caption || '').trim().slice(0, 20);
  list[index] = { ...list[index], caption: c || undefined };
  store.write({ petAssets: list, petAsset: null });
  if (index === rotateIndex && petWin && !petWin.isDestroyed()) {
    petWin.webContents.send('pet:captionChanged', c);
  }
  return list;
}

// 设置面板的素材读写
ipcMain.handle('assets:list', () => getAssets());
ipcMain.handle('assets:add', () => addAssets(settingsWin));
ipcMain.handle('assets:remove', (_e, index) => removeAsset(index));
ipcMain.handle('assets:next', () => rotateNext());
ipcMain.on('assets:setCaption', (_e, { index, caption }) => setAssetCaption(index, caption));
ipcMain.handle('rotate:get', () => ({ minutes: getRotateMinutes() }));
ipcMain.on('rotate:set', (_e, minutes) => {
  let m = Math.round(Number(minutes));
  if (!Number.isFinite(m)) m = 5;
  m = Math.min(60, Math.max(5, m));
  store.write({ petRotateMinutes: m });
  startRotation(); // 间隔变了 → 重建定时器
});

// 右键菜单（退出只走这里，避免误触）
ipcMain.on('pet:showMenu', () => {
  const paused = getPaused();
  const menu = Menu.buildFromTemplate([
    { label: '打开面板...', click: openSettings },
    { label: paused ? '恢复宠物' : '暂停宠物', click: () => setPaused(!paused) },
    { type: 'separator' },
    { label: '添加素材...', click: () => addAssets(petWin) },
    { label: '清空素材（恢复默认形象）', click: () => saveAssets([]) },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  menu.popup({ window: petWin });
});

app.on('window-all-closed', () => app.quit());
