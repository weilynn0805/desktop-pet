// 关于：版本信息
window.panelAPI.getInfo().then((info) => {
  document.getElementById('about').textContent =
    `桌面宠物 v${info.version} ｜ Electron ${info.electron} ｜ ${info.platform}`;
});

// ---- 形象与素材（多素材 + 轮播）----
const assetListEl = document.getElementById('asset-list');
const rotateMin = document.getElementById('rotate-min');
const rotateHint = document.getElementById('rotate-hint');

function toFileURL(p) { return 'file:///' + encodeURI(p.replace(/\\/g, '/')); }

// 列表渲染：每项 = 缩略图 + 文件名/类型 + 删除按钮；空列表给默认形象提示
function renderAssets(list) {
  assetListEl.innerHTML = '';
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = '（无素材，当前显示默认形象 🐾）';
    assetListEl.appendChild(empty);
  } else {
    list.forEach((asset, i) => {
      const item = document.createElement('div');
      item.className = 'asset-item';

      // 顶部行：缩略图 + 文件名/类型 + 删除
      const row = document.createElement('div');
      row.className = 'asset-row';

      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      const el = document.createElement(asset.type === 'video' ? 'video' : 'img');
      el.src = toFileURL(asset.path);
      if (asset.type === 'video') { el.muted = el.loop = el.autoplay = true; }
      thumb.appendChild(el);

      const info = document.createElement('div');
      info.className = 'asset-info';
      const name = document.createElement('div');
      name.className = 'asset-name';
      name.textContent = asset.path.split(/[\\/]/).pop();
      const type = document.createElement('div');
      type.className = 'muted';
      type.textContent = asset.type === 'video' ? '视频' : '图片';
      info.appendChild(name);
      info.appendChild(type);

      const del = document.createElement('button');
      del.className = 'btn btn-ghost';
      del.textContent = '删除';
      del.addEventListener('click', async () => {
        renderAssets(await window.panelAPI.removeAsset(i));
      });

      row.appendChild(thumb);
      row.appendChild(info);
      row.appendChild(del);

      // 专属文案输入（≤20 字，可留空）；失焦即保存
      const cap = document.createElement('input');
      cap.className = 'cap-input';
      cap.type = 'text';
      cap.maxLength = 20;
      cap.placeholder = '专属文案（≤20字，可留空，会与默认文案一起出现）';
      cap.value = asset.caption || '';
      cap.addEventListener('change', () => {
        window.panelAPI.setAssetCaption(i, cap.value);
      });

      item.appendChild(row);
      item.appendChild(cap);
      assetListEl.appendChild(item);
    });
  }
  // 轮播仅在 ≥2 个素材时生效
  const n = list.length;
  rotateMin.disabled = n < 2;
  rotateHint.textContent = n >= 2 ? '' : `当前 ${n} 个素材，轮播需 2 个及以上才生效。`;
}

window.panelAPI.getAssets().then(renderAssets);
window.panelAPI.onAssetsChanged(renderAssets); // 右键菜单增删素材时同步

document.getElementById('add-asset').addEventListener('click', async () => {
  renderAssets(await window.panelAPI.addAsset());
});
document.getElementById('next-asset').addEventListener('click', () => {
  window.panelAPI.nextAsset(); // 即时切到下一个，便于验证轮播
});

// 轮播间隔（分钟，5~60）
window.panelAPI.getRotate().then(({ minutes }) => { rotateMin.value = minutes; });
document.getElementById('save-rotate').addEventListener('click', () => {
  let m = Math.round(Number(rotateMin.value));
  if (!Number.isFinite(m)) m = 5;
  m = Math.min(60, Math.max(5, m));
  rotateMin.value = m;
  window.panelAPI.setRotate(m);
  const st = document.getElementById('rotate-status');
  st.textContent = `已保存，每 ${m} 分钟`;
  setTimeout(() => { st.textContent = ''; }, 2000);
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

// 启用默认文案：载入状态，切换即时生效
const defaultPhrases = document.getElementById('default-phrases');
window.panelAPI.getDefaultPhrases().then((on) => { defaultPhrases.checked = on; });
defaultPhrases.addEventListener('change', () => {
  window.panelAPI.setDefaultPhrases(defaultPhrases.checked);
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

// 行为 · 窗口置顶：载入状态，切换即时生效
const alwaysTop = document.getElementById('always-top');
window.panelAPI.getAlwaysOnTop().then((on) => { alwaysTop.checked = on; });
alwaysTop.addEventListener('change', () => window.panelAPI.setAlwaysOnTop(alwaysTop.checked));

// 行为 · 缩放：显示当前比例，一键重置 100%
const scaleVal = document.getElementById('scale-val');
const showScale = (s) => { scaleVal.textContent = Math.round(s * 100) + '%'; };
window.panelAPI.getScale().then(showScale);
document.getElementById('reset-scale').addEventListener('click', async () => {
  showScale(await window.panelAPI.resetScale());
});

// 行为 · 退出应用
document.getElementById('quit-app').addEventListener('click', () => window.panelAPI.quitApp());
