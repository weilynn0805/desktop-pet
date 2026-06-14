// 全屏休息覆盖层：只显示「专属素材 + 倒计时 + 跳过」，到点自动结束。
const timerEl = document.getElementById('timer');
const petEl = document.getElementById('pet');
const skipEl = document.getElementById('skip');

let countdown = null;
let left = 0; // 剩余秒数（模块级，便于暂停/恢复保留进度）

function toFileURL(p) { return 'file:///' + encodeURI(p.replace(/\\/g, '/')); }

// 铺满全屏渲染专属素材（图片/动图/视频；无素材 → 默认 🐾）
function renderPet(asset) {
  petEl.innerHTML = '';
  if (!asset || !asset.path) { petEl.classList.add('default'); return; }
  petEl.classList.remove('default');
  const el = document.createElement(asset.type === 'video' ? 'video' : 'img');
  el.src = toFileURL(asset.path);
  if (asset.type === 'video') { el.muted = el.loop = el.autoplay = true; el.playsInline = true; }
  petEl.appendChild(el);
}

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function stopCountdown() { clearInterval(countdown); countdown = null; }
function startCountdown() {
  stopCountdown();
  countdown = setInterval(() => {
    left -= 1;
    timerEl.textContent = fmt(Math.max(0, left));
    if (left <= 0) { stopCountdown(); window.restAPI.ack(); } // 到点自动结束
  }, 1000);
}

window.restAPI.onPet(({ asset }) => renderPet(asset));

window.restAPI.onShow(({ restSeconds, paused }) => {
  left = Math.max(1, Math.round(restSeconds || 300));
  timerEl.textContent = fmt(left);
  if (paused) stopCountdown(); else startCountdown(); // 弹出时若已有未确认提醒 → 起步即暂停
});

// 提醒打断：暂停倒计时（保留剩余秒数）；提醒确认完毕：恢复。§3.3 规则2
window.restAPI.onPause(() => stopCountdown());
window.restAPI.onResume(() => { if (left > 0) startCountdown(); });

skipEl.addEventListener('click', () => { stopCountdown(); window.restAPI.ack(); });
