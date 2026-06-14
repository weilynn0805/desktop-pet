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
    hideBubble(); // 开始拖动 → 收起气泡，避免遮挡
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

// ---- 悬停气泡文案 ----
const bubble = document.getElementById('bubble');
let PHRASES = []; // 从配置加载，可在设置面板编辑后热更新
window.petAPI.getPhrases().then((list) => { PHRASES = list; });
window.petAPI.onPhrasesChanged((list) => { PHRASES = list; });

let autoHideTimer = null; // 定时主动冒泡的自动收起计时器
// 扫描图片最顶端不透明像素，返回其占图高的比例（0=顶,1=底）。按 src 缓存。
let opaqueTopCache = { src: null, ratio: 0 };
function imageOpaqueTopRatio(img) {
  if (opaqueTopCache.src === img.src) return opaqueTopCache.ratio;
  let ratio = 0;
  try {
    const SW = Math.min(img.naturalWidth, 100);           // 缩小扫描以提速
    const SH = Math.max(1, Math.round(img.naturalHeight * (SW / img.naturalWidth)));
    const c = document.createElement('canvas');
    c.width = SW; c.height = SH;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, SW, SH);
    const data = cx.getImageData(0, 0, SW, SH).data;
    scan: for (let y = 0; y < SH; y++) {
      for (let x = 0; x < SW; x++) {
        if (data[(y * SW + x) * 4 + 3] > 16) { ratio = y / SH; break scan; }
      }
    }
  } catch { ratio = 0; }
  opaqueTopCache = { src: img.src, ratio };
  return ratio;
}

// 让气泡底边贴在宠物“可见头顶”上方固定间距处（含缩放与图片透明留白）
function positionBubble() {
  const img = pet.querySelector('img.media');
  const el = pet.querySelector('.media') || defaultBody;
  const r = el.getBoundingClientRect();
  const GAP = 20; // 气泡底边离宠物头顶的间距(px)，缩放时保持不变
  let topY = r.top; // 默认：用元素外框顶部
  if (img && img.complete && img.naturalWidth) {
    // 还原 object-fit:contain 的实际绘制区域，再加上图内主体的不透明顶部偏移
    const s = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
    const dh = img.naturalHeight * s;
    const oy = (r.height - dh) / 2;
    topY = r.top + oy + imageOpaqueTopRatio(img) * dh;
  }
  bubble.style.left = (r.left + r.width / 2) + 'px';
  bubble.style.bottom = (window.innerHeight - topY + GAP) + 'px';
}
function showBubble() {
  if (!PHRASES.length) return; // 文案未加载/被清空 → 不弹
  bubble.textContent = PHRASES[Math.floor(Math.random() * PHRASES.length)];
  positionBubble(); // 先按当前大小定位，再淡入
  bubble.classList.add('show');
}
function hideBubble() { bubble.classList.remove('show'); }

let interactive = false;
function setInteractive(on) {
  if (on === interactive) return; // 状态没变就不打扰主进程
  interactive = on;
  window.petAPI.setInteractive(on);
  if (on) {
    clearTimeout(autoHideTimer); // 悬停接管 → 取消定时气泡的自动收起
    showBubble();                // 进入宠物 → 说句话
  } else {
    hideBubble();                // 离开 → 收起
  }
}

window.addEventListener('mousemove', (e) => {
  if (dragging) return; // 拖动中始终保持可交互
  setInteractive(overPet(e.clientX, e.clientY));
});

// ---- 滚轮缩放：固定窗口，只缩放窗口内的宠物（CSS transform）----
const MIN_SCALE = 0.5, MAX_SCALE = 2.5;
let scale = 1;
function applyScale(s) {
  scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
  pet.style.transform = `scale(${scale})`; // transform-origin 居中 → 不位移
}
window.petAPI.getScale().then(applyScale); // 启动时还原上次大小

// 指针在宠物上时：上滚放大/下滚缩小。其余区域滚轮直接穿透给下层应用。
window.addEventListener('wheel', (e) => {
  if (!interactive) return;
  e.preventDefault();                              // 阻止页面本身滚动
  hideBubble();                                    // 缩放时收起气泡
  applyScale(e.deltaY < 0 ? scale * 1.1 : scale / 1.1);
  window.petAPI.setScale(scale);                   // 持久化
}, { passive: false });

// ---- 定时主动冒泡：宠物隔一会儿自己说句话，显示几秒后自动收起 ----
const AUTO_VISIBLE = 4000; // 每次显示时长(ms)
let autoTimer = null;      // 周期定时器
function autoBubble() {
  if (dragging || interactive) return; // 正在拖动/悬停 → 不打扰，让位给悬停气泡
  showBubble();
  clearTimeout(autoHideTimer);
  autoHideTimer = setTimeout(hideBubble, AUTO_VISIBLE);
}
// 按配置(开关+间隔秒数)重建定时器
function applyAutoBubble(cfg) {
  clearInterval(autoTimer);
  autoTimer = null;
  if (cfg.enabled && cfg.interval > 0) {
    autoTimer = setInterval(autoBubble, cfg.interval * 1000);
  }
}
window.petAPI.getAutoBubble().then(applyAutoBubble);
window.petAPI.onAutoBubbleChanged(applyAutoBubble);

// ---- 单击互动：随机动作动画 + 专属反应台词 ----
const REACTIONS = [
  '嘿嘿，好痒～',
  '别戳啦 >_<',
  '么么哒 (｡･ω･｡)',
  '干嘛呀～',
  '再戳我要害羞了',
  '哎呀！',
  '你戳到我啦',
];
const MOVES = ['poke', 'jump', 'wiggle']; // 三种动作动画，随机其一
let moveTimer = null;                      // 动画结束后移除动作类，恢复待机弹跳

function showReaction() {
  if (!REACTIONS.length) return;
  clearTimeout(autoHideTimer); // 反应台词常驻到鼠标离开，别被定时器收走
  bubble.textContent = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
  positionBubble();
  bubble.classList.add('show');
}

function poke() {
  const move = MOVES[Math.floor(Math.random() * MOVES.length)];
  pet.classList.remove(...MOVES);
  void pet.offsetWidth; // 强制重排以重置动画
  pet.classList.add(move);
  clearTimeout(moveTimer);
  moveTimer = setTimeout(() => pet.classList.remove(move), 600); // 动画结束后复位
  showReaction();
}
