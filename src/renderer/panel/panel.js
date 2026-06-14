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

// ---- 事项提醒：增删改查 ----
const remList = document.getElementById('reminder-list');
const remTime = document.getElementById('rem-time');
const remText = document.getElementById('rem-text');
const remRepeat = document.getElementById('rem-repeat');
const remSave = document.getElementById('rem-save');
const remCancel = document.getElementById('rem-cancel');
const remStatus = document.getElementById('rem-status');
const remFormTitle = document.getElementById('reminder-form-title');
const remSound = document.getElementById('rem-sound');
const remTest = document.getElementById('rem-test');
const remSoundCustom = document.getElementById('rem-sound-custom');
const remPickSound = document.getElementById('rem-pick-sound');
const remSoundName = document.getElementById('rem-sound-name');
const remWeekday = document.getElementById('rem-weekday');
const remClock = document.getElementById('rem-clock');
const fieldDatetime = document.getElementById('field-datetime');
const fieldWeekday = document.getElementById('field-weekday');
const fieldClock = document.getElementById('field-clock');
let editingId = null;       // 正在编辑的提醒 id（null = 新增模式）
let customSound = null;     // 自定义提示音 {path,name}（仅 sound=custom 时有效）

// 仅当选“自定义”时显示选文件那一行
function syncSoundUI() {
  remSoundCustom.style.display = remSound.value === 'custom' ? '' : 'none';
}

// 时间字段随“重复”自适应：单次=完整日期时间；每天/工作日=只时分；每周=星期+时分
function syncTimeUI() {
  const r = remRepeat.value;
  fieldDatetime.style.display = r === 'single' ? '' : 'none';
  fieldWeekday.style.display = r === 'weekly' ? '' : 'none';
  fieldClock.style.display = r === 'single' ? 'none' : '';
}

const pad2 = (n) => String(n).padStart(2, '0');
const toLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const clockOf = (dt) => (dt || '').split('T')[1] || ''; // 'HH:mm'
const weekdayOf = (dt) => { const d = new Date(dt); return Number.isNaN(d.getTime()) ? 1 : d.getDay(); };

// 由“重复 + 时分(+星期)”算出首个将来触发时间（避免开局就误触发）
function computeDatetime(repeat, clock, weekday) {
  const [hh, mm] = clock.split(':').map(Number);
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
  if (repeat === 'daily') {
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  } else if (repeat === 'workday') {
    while (d.getTime() <= now.getTime() || d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  } else if (repeat === 'weekly') {
    while (d.getDay() !== weekday || d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  }
  return toLocal(d);
}

// 'YYYY-MM-DDTHH:mm' → 易读展示
function fmtTime(dt) {
  if (!dt) return '(未设时间)';
  const [d, t] = dt.split('T');
  return `${(d || '').replace(/-/g, '/')} ${t || ''}`.trim();
}

// 列表里的时间描述：重复类显示规则+时分，单次显示完整日期
const WD = ['日', '一', '二', '三', '四', '五', '六'];
function whenLabel(r) {
  const clock = clockOf(r.datetime);
  if (r.repeat === 'daily') return `每天 ${clock}`;
  if (r.repeat === 'workday') return `工作日 ${clock}`;
  if (r.repeat === 'weekly') return `每周${WD[weekdayOf(r.datetime)]} ${clock}`;
  return `${fmtTime(r.datetime)} · 单次`;
}

function renderReminders(list) {
  remList.innerHTML = '';
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = '（还没有提醒，下面添加一条吧）';
    remList.appendChild(empty);
    return;
  }
  list.forEach((r) => {
    const item = document.createElement('div');
    item.className = 'reminder-item' + (r.enabled ? '' : ' off');

    const info = document.createElement('div');
    info.className = 'rem-info';
    const top = document.createElement('div');
    top.className = 'rem-text';
    top.textContent = r.text || '(无文案)';
    const sub = document.createElement('div');
    sub.className = 'muted';
    const soundLabel = (window.SOUND_LABELS && window.SOUND_LABELS[r.sound]) || '叮';
    sub.textContent = `${whenLabel(r)} · 🔔${soundLabel}${r.enabled ? '' : ' · 已停用'}`;
    info.appendChild(top);
    info.appendChild(sub);

    const toggle = document.createElement('button');
    toggle.className = 'btn btn-ghost';
    toggle.textContent = r.enabled ? '停用' : '启用';
    toggle.addEventListener('click', async () => {
      renderReminders(await window.panelAPI.updateReminder(r.id, { enabled: !r.enabled }));
    });

    const edit = document.createElement('button');
    edit.className = 'btn btn-ghost';
    edit.textContent = '编辑';
    edit.addEventListener('click', () => startEdit(r));

    const del = document.createElement('button');
    del.className = 'btn btn-ghost';
    del.textContent = '删除';
    del.addEventListener('click', async () => {
      if (editingId === r.id) resetForm();
      renderReminders(await window.panelAPI.removeReminder(r.id));
    });

    item.appendChild(info);
    item.appendChild(toggle);
    item.appendChild(edit);
    item.appendChild(del);
    remList.appendChild(item);
  });
}

function startEdit(r) {
  editingId = r.id;
  remText.value = r.text || '';
  remRepeat.value = r.repeat || 'single';
  if (r.repeat === 'single') {
    remTime.value = r.datetime || '';
  } else {
    remClock.value = clockOf(r.datetime);          // 重复类：回填时分
    if (r.repeat === 'weekly') remWeekday.value = String(weekdayOf(r.datetime)); // 每周：回填星期
  }
  remSound.value = r.sound || 'ding';
  customSound = r.sound === 'custom' && r.soundSrc ? { path: r.soundSrc, name: '（已选择）' } : null;
  remSoundName.textContent = customSound ? customSound.name : '未选择';
  syncSoundUI();
  syncTimeUI();
  remFormTitle.textContent = '编辑提醒';
  remSave.textContent = '保存修改';
  remCancel.style.display = '';
  remText.focus();
}

function resetForm() {
  editingId = null;
  remTime.value = '';
  remText.value = '';
  remRepeat.value = 'single';
  const now = new Date();
  remClock.value = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`; // 预填当前时分
  remWeekday.value = String(now.getDay());
  remSound.value = 'ding';
  customSound = null;
  remSoundName.textContent = '未选择';
  syncSoundUI();
  syncTimeUI();
  remFormTitle.textContent = '添加提醒';
  remSave.textContent = '保存提醒';
  remCancel.style.display = 'none';
}

function flashStatus(msg) {
  remStatus.textContent = msg;
  setTimeout(() => { remStatus.textContent = ''; }, 2200);
}

remSave.addEventListener('click', async () => {
  const text = remText.value.trim();
  const repeat = remRepeat.value;
  if (!text) { flashStatus('请填写提醒文案'); return; }

  // 单次用完整日期时间且须为将来；重复类用时分(+星期)算出首个将来触发时间
  let datetime;
  if (repeat === 'single') {
    datetime = remTime.value;
    if (!datetime) { flashStatus('请选择时间'); return; }
    if (new Date(datetime).getTime() <= Date.now()) { flashStatus('单次提醒不能设在过去时间'); return; }
  } else {
    if (!remClock.value) { flashStatus('请选择时间'); return; }
    datetime = computeDatetime(repeat, remClock.value, Number(remWeekday.value));
  }
  const sound = remSound.value;
  if (sound === 'custom' && !(customSound && customSound.path)) {
    flashStatus('请选择自定义音频'); return;
  }
  const data = { text, datetime, repeat, sound, soundSrc: sound === 'custom' ? customSound.path : '' };
  const list = editingId
    ? await window.panelAPI.updateReminder(editingId, data)
    : await window.panelAPI.addReminder(data);
  resetForm();
  renderReminders(list);
  flashStatus('已保存');
});

remCancel.addEventListener('click', resetForm);
remRepeat.addEventListener('change', syncTimeUI); // 切换重复 → 时间字段自适应

// 提示音：切换显隐自定义行；选文件；试听
remSound.addEventListener('change', syncSoundUI);
remPickSound.addEventListener('click', async () => {
  const picked = await window.panelAPI.pickSound();
  if (picked && picked.path) {
    customSound = picked;
    remSoundName.textContent = picked.name || '（已选择）';
  }
});
remTest.addEventListener('click', () => {
  window.playReminderSound(remSound.value, customSound && customSound.path);
});

// ---- 提醒形象：头像（上传后固定）+ 名称 ----
const ridAvatar = document.getElementById('rid-avatar');
const ridName = document.getElementById('rid-name');
const ridPreview = document.getElementById('rid-preview');
const ridStatus = document.getElementById('rid-status');

function renderRidAvatar(p) {
  ridAvatar.innerHTML = '';
  if (p) {
    ridAvatar.classList.remove('empty');
    const img = document.createElement('img');
    img.src = toFileURL(p);
    ridAvatar.appendChild(img);
  } else {
    ridAvatar.classList.add('empty'); // 🐾 占位 = 跟随当前形象
  }
}
function flashRid(msg) { ridStatus.textContent = msg; setTimeout(() => { ridStatus.textContent = ''; }, 2000); }

window.panelAPI.getReminderIdentity().then(({ avatar, name }) => {
  ridName.value = name === '桌宠' ? '' : name; // 默认名留空，显示 placeholder
  ridPreview.textContent = name;
  renderRidAvatar(avatar);
});
ridName.addEventListener('change', () => {
  const n = ridName.value.trim();
  window.panelAPI.setReminderName(n);
  ridPreview.textContent = n || '桌宠';
  flashRid('名称已保存');
});
document.getElementById('rid-pick').addEventListener('click', async () => {
  const p = await window.panelAPI.pickReminderAvatar();
  renderRidAvatar(p);
  if (p) flashRid('头像已更新');
});
document.getElementById('rid-clear').addEventListener('click', async () => {
  renderRidAvatar(await window.panelAPI.clearReminderAvatar());
  flashRid('已恢复跟随当前形象');
});

resetForm(); // 初始化表单（预填时分/星期、按默认重复显示对应时间字段）
window.panelAPI.getReminders().then(renderReminders);
window.panelAPI.onRemindersChanged(renderReminders); // 到点触发后（单次变停用、重复推进到下次）同步列表

// ---- 防沉迷：连续使用计时实时读数（5'.1）----
const fatigueStatusEl = document.getElementById('fatigue-status');
function fmtDur(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
}
function renderFatigue(st) {
  if (!st || !st.cfg) return;
  if (!st.cfg.enabled) { fatigueStatusEl.textContent = '防沉迷计时：已关闭'; return; }
  fatigueStatusEl.textContent =
    `已连续使用 ${fmtDur(st.usage)} · 当前空闲 ${st.idle} 秒（空闲满 ${st.cfg.idle} 分钟自动清零；满 ${st.cfg.use} 分钟将提醒休息）`;
}
window.panelAPI.getFatigue().then(renderFatigue);     // 首屏立即拿一次
window.panelAPI.onFatigueStatus(renderFatigue);       // 之后每 5 秒推送刷新

// 防沉迷全屏素材：上传 / 清除（专属，独立于提醒头像）
const faThumb = document.getElementById('fa-thumb');
const faStatus = document.getElementById('fa-status');
function renderFaThumb(asset) {
  faThumb.innerHTML = '';
  if (asset && asset.path) {
    faThumb.classList.remove('empty');
    const el = document.createElement(asset.type === 'video' ? 'video' : 'img');
    el.src = toFileURL(asset.path);
    if (asset.type === 'video') { el.muted = el.loop = el.autoplay = true; el.playsInline = true; }
    faThumb.appendChild(el);
  } else {
    faThumb.classList.add('empty'); // 🐾 占位 = 用默认
  }
}
function flashFa(msg) { faStatus.textContent = msg; setTimeout(() => { faStatus.textContent = ''; }, 2000); }
window.panelAPI.getFatigueAsset().then(renderFaThumb);
document.getElementById('fa-pick').addEventListener('click', async () => {
  const a = await window.panelAPI.pickFatigueAsset();
  renderFaThumb(a);
  if (a) flashFa('已更新全屏素材');
});
document.getElementById('fa-clear').addEventListener('click', async () => {
  renderFaThumb(await window.panelAPI.clearFatigueAsset());
  flashFa('已清除');
});
