// 全屏休息覆盖层：只显示「专属素材 + 倒计时 + 跳过」，到点自动结束。
const timerEl = document.getElementById('timer');
const petEl = document.getElementById('pet');
const skipEl = document.getElementById('skip');

let countdown = null;

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

window.restAPI.onPet(({ asset }) => renderPet(asset));

window.restAPI.onShow(({ restSeconds }) => {
  let left = Math.max(1, Math.round(restSeconds || 300));
  timerEl.textContent = fmt(left);
  clearInterval(countdown);
  countdown = setInterval(() => {
    left -= 1;
    timerEl.textContent = fmt(Math.max(0, left));
    if (left <= 0) { clearInterval(countdown); window.restAPI.ack(); } // 到点自动结束
  }, 1000);
});

skipEl.addEventListener('click', () => { clearInterval(countdown); window.restAPI.ack(); });
