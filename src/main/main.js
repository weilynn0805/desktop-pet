// 主进程：创建透明悬浮宠物窗，处理拖动/位置持久化/右键菜单
const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const path = require('path');
const store = require('./store');

const PET_SIZE = 200; // 宠物窗边长（含透明留白）
let petWin = null;

function createPetWindow() {
  const saved = store.read().petPosition;

  const win = new BrowserWindow({
    width: PET_SIZE,
    height: PET_SIZE,
    x: saved?.x,
    y: saved?.y,
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
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver'); // 提升到更高置顶层级
  win.loadFile(path.join(__dirname, '../renderer/pet/index.html'));

  // 首次启动（无记忆位置）→ 放到主屏右下角
  if (!saved) {
    const { workArea } = screen.getPrimaryDisplay();
    win.setPosition(
      Math.round(workArea.x + workArea.width - PET_SIZE - 40),
      Math.round(workArea.y + workArea.height - PET_SIZE - 40)
    );
  }
  return win;
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

// 右键菜单（退出只走这里，避免误触）
ipcMain.on('pet:showMenu', () => {
  const menu = Menu.buildFromTemplate([
    // 后续在此追加：打开控制面板 / 暂停宠物
    { label: '退出', click: () => app.quit() },
  ]);
  menu.popup({ window: petWin });
});

app.on('window-all-closed', () => app.quit());
