// 关于：版本信息
window.panelAPI.getInfo().then((info) => {
  document.getElementById('about').textContent =
    `桌面宠物 v${info.version} ｜ Electron ${info.electron} ｜ ${info.platform}`;
});

// ---- 形象与素材 ----
const assetThumb = document.getElementById('asset-thumb');
const assetName = document.getElementById('asset-name');
const assetType = document.getElementById('asset-type');

function toFileURL(p) { return 'file:///' + encodeURI(p.replace(/\\/g, '/')); }

function renderAsset(asset) {
  assetThumb.innerHTML = '';
  if (!asset) { // 默认 CSS 宠物
    assetThumb.classList.add('empty');
    assetName.textContent = '默认形象';
    assetType.textContent = '内置 CSS 宠物';
    return;
  }
  assetThumb.classList.remove('empty');
  assetName.textContent = asset.path.split(/[\\/]/).pop(); // 文件名
  assetType.textContent = asset.type === 'video' ? '视频' : '图片';
  const el = document.createElement(asset.type === 'video' ? 'video' : 'img');
  el.src = toFileURL(asset.path);
  if (asset.type === 'video') { el.muted = el.loop = el.autoplay = true; }
  assetThumb.appendChild(el);
}

window.panelAPI.getAsset().then(renderAsset);
window.panelAPI.onAssetChanged(renderAsset); // 右键菜单换素材时也同步

document.getElementById('pick-asset').addEventListener('click', async () => {
  renderAsset(await window.panelAPI.pickAsset());
});
document.getElementById('reset-asset').addEventListener('click', async () => {
  renderAsset(await window.panelAPI.resetAsset());
});

// 互动文案：载入到文本框（每行一句）
const ta = document.getElementById('phrases');
window.panelAPI.getPhrases().then((list) => { ta.value = list.join('\n'); });

// 保存：拆行、去空白、过滤空行 → 写入并提示
document.getElementById('save-phrases').addEventListener('click', () => {
  const list = ta.value.split('\n').map((s) => s.trim()).filter(Boolean);
  window.panelAPI.setPhrases(list);
  const status = document.getElementById('phrases-status');
  status.textContent = list.length ? `已保存 ${list.length} 条` : '已清空，恢复默认';
  setTimeout(() => { status.textContent = ''; }, 2000);
});

// 被戳台词：载入到文本框
const reactionsTa = document.getElementById('reactions');
window.panelAPI.getReactions().then((list) => { reactionsTa.value = list.join('\n'); });
document.getElementById('save-reactions').addEventListener('click', () => {
  const list = reactionsTa.value.split('\n').map((s) => s.trim()).filter(Boolean);
  window.panelAPI.setReactions(list);
  const status = document.getElementById('reactions-status');
  status.textContent = list.length ? `已保存 ${list.length} 条` : '已清空，恢复默认';
  setTimeout(() => { status.textContent = ''; }, 2000);
});

// 定时主动冒泡：载入开关 + 间隔
const autoEnabled = document.getElementById('auto-enabled');
const autoInterval = document.getElementById('auto-interval');
window.panelAPI.getAutoBubble().then((cfg) => {
  autoEnabled.checked = cfg.enabled;
  autoInterval.value = cfg.interval;
});

// 保存定时冒泡配置（间隔限制 3~3600 秒，主进程也会再夹一次）
document.getElementById('save-auto').addEventListener('click', () => {
  let interval = Math.round(Number(autoInterval.value));
  if (!Number.isFinite(interval)) interval = 25;
  interval = Math.min(3600, Math.max(3, interval));
  autoInterval.value = interval;
  window.panelAPI.setAutoBubble({ enabled: autoEnabled.checked, interval });
  const status = document.getElementById('auto-status');
  status.textContent = autoEnabled.checked ? `已保存，每 ${interval} 秒` : '已关闭';
  setTimeout(() => { status.textContent = ''; }, 2000);
});

// 行为 · 开机自启：载入当前状态，切换即时生效
const autoLaunch = document.getElementById('auto-launch');
const autoLaunchHint = document.getElementById('auto-launch-hint');
window.panelAPI.getAutoLaunch().then((on) => { autoLaunch.checked = on; });
autoLaunch.addEventListener('change', () => {
  window.panelAPI.setAutoLaunch(autoLaunch.checked);
  autoLaunchHint.textContent = autoLaunch.checked
    ? '已开启：登录系统后自动运行。'
    : '已关闭：不再随系统启动。';
});
