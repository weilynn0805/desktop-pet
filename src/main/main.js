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

  const win = new BrowserWindow({
    width: WIN_SIZE,
    height: WIN_SIZE,
    x: pos?.x,
    y: pos?.y,
    transparent: true,    // 透明背景（去黑/白底）
    frame: false,         // 无边框
    alwaysOnTop: true,    // 置顶
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

  win.setAlwaysOnTop(true, 'screen-saver'); // 提升到更高置顶层级
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

// 缩放：渲染层负责改 CSS transform，这里只读/存比例
ipcMain.handle('pet:getScale', () => clampScale(store.read().petScale));
ipcMain.on('pet:setScale', (_e, s) => store.write({ petScale: clampScale(s) }));

// 渲染进程启动时获取当前素材（无则返回 null → 显示默认 CSS 宠物）
ipcMain.handle('pet:getAsset', () => store.read().petAsset || null);

// 渲染层根据指针是否在宠物上，开/关鼠标穿透
ipcMain.on('pet:setInteractive', (_e, interactive) => {
  petWin.setIgnoreMouseEvents(!interactive, { forward: true });
});

// 选择素材：弹文件对话框 → 复制进本地目录 → 持久化 → 通知渲染进程热更新
function pickAsset() {
  const result = dialog.showOpenDialogSync(petWin, {
    title: '选择宠物素材',
    properties: ['openFile'],
    filters: [
      { name: '宠物素材（图片/动图/视频）', extensions: assets.PICK_EXTENSIONS },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (!result || !result[0]) return; // 用户取消
  const asset = assets.importAsset(result[0]);
  if (!asset) {
    dialog.showMessageBox(petWin, {
      type: 'warning',
      message: '不支持的素材格式',
      detail: '支持：png/apng/gif/webp/jpg 与 mp4/webm/mov/m4v。',
    });
    return;
  }

  // 无 alpha 通道的格式（mp4/mov/jpg…）会带矩形背景，无法只显示主体 → 警告并让用户确认
  if (!assets.supportsAlpha(asset.path)) {
    const choice = dialog.showMessageBoxSync(petWin, {
      type: 'warning',
      buttons: ['仍然使用', '取消'],
      defaultId: 1,
      cancelId: 1,
      message: '该格式无法透明显示',
      detail:
        '这个素材没有透明通道，会带矩形背景显示，无法只显示主体轮廓。\n\n' +
        '想要“悬浮只显示主体”，请改用：\n' +
        '· 透明 GIF / APNG / PNG（动图/图片，最常见、效果最好）\n' +
        '· WebM（VP9 alpha）透明视频',
    });
    if (choice === 1) {
      fs.unlinkSync(asset.path); // 用户取消 → 删除刚复制进来的文件，不留垃圾
      return;
    }
  }

  store.write({ petAsset: asset });
  petWin.webContents.send('pet:assetChanged', asset);
}

// 恢复默认形象：清除素材配置 → 回到 CSS 宠物
function resetAsset() {
  store.write({ petAsset: null });
  petWin.webContents.send('pet:assetChanged', null);
}

// 右键菜单（退出只走这里，避免误触）
ipcMain.on('pet:showMenu', () => {
  const menu = Menu.buildFromTemplate([
    { label: '选择素材...', click: pickAsset },
    { label: '恢复默认形象', click: resetAsset },
    { type: 'separator' },
    { label: '打开设置...', click: openSettings },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  menu.popup({ window: petWin });
});

app.on('window-all-closed', () => app.quit());
