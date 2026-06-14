// 设置面板骨架：目前仅展示版本信息，验证主进程 IPC 通路
window.panelAPI.getInfo().then((info) => {
  document.getElementById('about').textContent =
    `桌面宠物 v${info.version} ｜ Electron ${info.electron} ｜ ${info.platform}`;
});
