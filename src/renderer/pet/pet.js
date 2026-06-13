// 宠物窗交互：手势状态机（区分单击 / 拖动）+ 右键菜单
const pet = document.getElementById('pet');
const THRESHOLD = 5; // 移动阈值(px)：位移超过才算拖动，否则算单击

let dragging = false;  // 左键是否按下
let moved = false;     // 本次按下是否已超过阈值
let startX = 0, startY = 0;   // 按下时的屏幕坐标
let winX = 0, winY = 0;       // 按下时的窗口左上角坐标

pet.addEventListener('pointerdown', async (e) => {
  if (e.button !== 0) return;        // 仅左键参与拖动/单击
  dragging = true;
  moved = false;
  startX = e.screenX;
  startY = e.screenY;
  const pos = await window.petAPI.getPosition();
  winX = pos.x;
  winY = pos.y;
  pet.setPointerCapture(e.pointerId); // 关键：指针移出窗口仍持续收到事件，拖动不丢
});

pet.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.screenX - startX;
  const dy = e.screenY - startY;
  if (!moved && Math.hypot(dx, dy) > THRESHOLD) {
    moved = true;
    document.body.classList.add('dragging');
  }
  if (moved) {
    window.petAPI.move(winX + dx, winY + dy); // 用初始位置+总位移，避免累积漂移
  }
});

pet.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  pet.releasePointerCapture(e.pointerId);
  document.body.classList.remove('dragging');
  if (moved) {
    window.petAPI.savePosition(); // 拖动结束 → 持久化位置
  } else {
    poke();                       // 未超过阈值 → 单击互动
  }
});

// 右键 → 主进程弹出菜单（退出只走这里）
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.petAPI.showMenu();
});

// ---- 素材渲染 ----
// 透明只认素材自带的 alpha 通道（不做任何抠图处理）：
//   图片/动图 PNG/GIF/APNG/WebP → 原生透明；WebM(VP9 alpha) 视频 → 原生透明；
//   无 alpha 的视频(MP4/MOV…)/JPG → 原样显示（带背景，上传时已警告）。
const defaultBody = pet.querySelector('.body');

// 本地绝对路径 → file:// URL（处理反斜杠与中文/空格）
function toFileURL(p) {
  return 'file:///' + encodeURI(p.replace(/\\/g, '/'));
}

function clearMedia() {
  pet.querySelectorAll('.media').forEach((n) => n.remove());
}

function renderImage(asset) {
  const img = document.createElement('img');
  img.src = toFileURL(asset.path);
  img.draggable = false;
  img.className = 'media';
  pet.appendChild(img);
}

function renderVideo(asset) {
  const v = document.createElement('video');
  v.src = toFileURL(asset.path);
  v.autoplay = v.loop = v.muted = true;
  v.playsInline = true;
  v.className = 'media';
  pet.appendChild(v);
}

function renderAsset(asset) {
  clearMedia();
  if (!asset) { defaultBody.style.display = ''; return; } // 回退默认形象
  defaultBody.style.display = 'none';
  if (asset.type === 'video') renderVideo(asset);
  else renderImage(asset);
}

// 启动时加载已保存素材；之后监听主进程的素材变更
window.petAPI.getAsset().then(renderAsset);
window.petAPI.onAssetChanged(renderAsset);

// ---- 鼠标穿透：仅当指针落在宠物“实际像素”上才拦截，其余区域穿透到下层应用 ----
const hitCanvas = document.createElement('canvas');
const hitCtx = hitCanvas.getContext('2d', { willReadFrequently: true });

// 判断屏幕坐标 (cx,cy) 处是否压在宠物身上
function overPet(cx, cy) {
  const img = pet.querySelector('img.media');
  if (img && img.complete && img.naturalWidth) {
    // 图片/动图：逐像素读 alpha，精确贴合主体轮廓
    const r = img.getBoundingClientRect();
    const x = cx - r.left, y = cy - r.top;
    if (x < 0 || y < 0 || x >= r.width || y >= r.height) return false;
    // 还原 object-fit: contain 的实际绘制区域（去掉留白）
    const scale = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    const ox = (r.width - dw) / 2, oy = (r.height - dh) / 2;
    if (x < ox || y < oy || x >= ox + dw || y >= oy + dh) return false;
    try {
      hitCanvas.width = Math.max(1, Math.round(r.width));
      hitCanvas.height = Math.max(1, Math.round(r.height));
      hitCtx.clearRect(0, 0, hitCanvas.width, hitCanvas.height);
      hitCtx.drawImage(img, ox, oy, dw, dh);
      return hitCtx.getImageData(x, y, 1, 1).data[3] > 16; // alpha 阈值
    } catch {
      return true; // 万一读不到像素，退化为包围盒命中
    }
  }
  // 视频 / 默认 CSS 宠物：用可见元素的包围盒近似
  const el = pet.querySelector('.media') || defaultBody;
  const r = el.getBoundingClientRect();
  return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
}

let interactive = false;
function setInteractive(on) {
  if (on === interactive) return; // 状态没变就不打扰主进程
  interactive = on;
  window.petAPI.setInteractive(on);
}

window.addEventListener('mousemove', (e) => {
  if (dragging) return; // 拖动中始终保持可交互
  setInteractive(overPet(e.clientX, e.clientY));
});

// 单击反应：触发一次挤压动画
function poke() {
  pet.classList.remove('poke');
  void pet.offsetWidth; // 强制重排以重置动画
  pet.classList.add('poke');
}
