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

// 单击反应：触发一次挤压动画
function poke() {
  pet.classList.remove('poke');
  void pet.offsetWidth; // 强制重排以重置动画
  pet.classList.add('poke');
}
