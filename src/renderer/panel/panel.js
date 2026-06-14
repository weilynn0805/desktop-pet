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
const REPEAT_LABEL = { single: '单次', daily: '每天', weekly: '每周', workday: '工作日' };
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
let editingId = null;       // 正在编辑的提醒 id（null = 新增模式）
let customSound = null;     // 自定义提示音 {path,name}（仅 sound=custom 时有效）

// 仅当选“自定义”时显示选文件那一行
function syncSoundUI() {
  remSoundCustom.style.display = remSound.value === 'custom' ? '' : 'none';
}

// 'YYYY-MM-DDTHH:mm' → 易读展示
function fmtTime(dt) {
  if (!dt) return '(未设时间)';
  const [d, t] = dt.split('T');
  return `${(d || '').replace(/-/g, '/')} ${t || ''}`.trim();
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
    sub.textContent = `${fmtTime(r.datetime)} · ${REPEAT_LABEL[r.repeat] || '单次'} · 🔔${soundLabel}${r.enabled ? '' : ' · 已停用'}`;
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
  remTime.value = r.datetime || '';
  remText.value = r.text || '';
  remRepeat.value = r.repeat || 'single';
  remSound.value = r.sound || 'ding';
  customSound = r.sound === 'custom' && r.soundSrc ? { path: r.soundSrc, name: '（已选择）' } : null;
  remSoundName.textContent = customSound ? customSound.name : '未选择';
  syncSoundUI();
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
  remSound.value = 'ding';
  customSound = null;
  remSoundName.textContent = '未选择';
  syncSoundUI();
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
  const datetime = remTime.value;
  const repeat = remRepeat.value;
  if (!text) { flashStatus('请填写提醒文案'); return; }
  if (!datetime) { flashStatus('请选择时间'); return; }
  // 单次提醒禁止选过去时间（重复类允许过去时间，会按规则推算下次）
  if (repeat === 'single' && new Date(datetime).getTime() <= Date.now()) {
    flashStatus('单次提醒不能设在过去时间'); return;
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

window.panelAPI.getReminders().then(renderReminders);
window.panelAPI.onRemindersChanged(renderReminders); // 到点触发后（单次变停用、重复推进到下次）同步列表
