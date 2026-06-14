// 提醒弹窗：宠物头像 + 一组「已触发未确认」的提醒，可堆叠；每条单独“我知道了”。
const listEl = document.getElementById('list');
const avatarEl = document.getElementById('avatar');
const headTextEl = document.getElementById('head-text');
const REPEAT_LABEL = { single: '单次', daily: '每天', weekly: '每周', workday: '工作日' };

function toFileURL(p) { return 'file:///' + encodeURI(p.replace(/\\/g, '/')); }

// 头像里渲染宠物当前形象（图片/动图/视频；无素材 → 默认脸）
function renderAvatar(asset) {
  avatarEl.innerHTML = '';
  if (!asset || !asset.path) { avatarEl.classList.add('default'); return; }
  avatarEl.classList.remove('default');
  const el = document.createElement(asset.type === 'video' ? 'video' : 'img');
  el.src = toFileURL(asset.path);
  if (asset.type === 'video') { el.muted = el.loop = el.autoplay = true; el.playsInline = true; }
  avatarEl.appendChild(el);
}
window.reminderAPI.onPet(renderAvatar);

// 'YYYY-MM-DDTHH:mm' → 易读展示（今天只显示时分，跨天显示日期）
function fmt(dt) {
  if (!dt) return '';
  const [d, t] = dt.split('T');
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return d === todayStr ? (t || '') : `${(d || '').replace(/-/g, '/')} ${t || ''}`.trim();
}

function render(items) {
  headTextEl.textContent = items.length > 1 ? `桌宠提醒你（${items.length} 条）` : '桌宠提醒你';
  listEl.innerHTML = '';
  items.forEach((r) => {
    const item = document.createElement('div');
    item.className = 'item';

    const text = document.createElement('div');
    text.className = 'text';
    text.textContent = r.text || '(无内容)';

    const time = document.createElement('div');
    time.className = 'time';
    time.textContent = `${fmt(r.datetime)} · ${REPEAT_LABEL[r.repeat] || '单次'}`;

    const row = document.createElement('div');
    row.className = 'row';
    const ok = document.createElement('button');
    ok.className = 'ok';
    ok.textContent = '我知道了';
    ok.addEventListener('click', () => window.reminderAPI.ack(r.id));
    row.appendChild(ok);

    item.appendChild(text);
    item.appendChild(time);
    item.appendChild(row);
    listEl.appendChild(item);
  });

  // 内容渲染后把窗口高度自适应到内容
  requestAnimationFrame(() => {
    window.reminderAPI.resize(document.querySelector('.wrap').scrollHeight);
  });
}

window.reminderAPI.onList(render);
