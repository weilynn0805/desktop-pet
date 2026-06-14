// 提示音播放：内置音用 Web Audio 实时合成（无需音频文件），自定义用音频文件。
// 同一份逻辑供提醒窗（到点自动播）与设置面板（试听）复用。
(function () {
  let ctx = null;
  function ac() {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  // 单个正弦音：在 start 秒后响 dur 秒，带快起缓落包络
  function tone(freq, start, dur, peak) {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    o.connect(g); g.connect(c.destination);
    const t0 = c.currentTime + start;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  const BUILTIN = {
    ding: () => tone(880, 0, 0.5, 0.3),
    dingdong: () => { tone(784, 0, 0.4, 0.3); tone(587, 0.22, 0.55, 0.3); },
    chime: () => { tone(659, 0, 0.3, 0.25); tone(784, 0.16, 0.3, 0.25); tone(988, 0.32, 0.55, 0.25); },
  };

  function toFileURL(p) { return 'file:///' + encodeURI(String(p).replace(/\\/g, '/')); }

  // 播放一条提示音。sound: 'none'|'ding'|'dingdong'|'chime'|'custom'；custom 时用 src
  window.playReminderSound = function (sound, src) {
    try {
      if (!sound || sound === 'none') return;
      if (sound === 'custom') {
        if (!src) return;
        new Audio(toFileURL(src)).play().catch(() => {});
        return;
      }
      (BUILTIN[sound] || BUILTIN.ding)();
    } catch {}
  };

  window.SOUND_LABELS = { none: '无', ding: '叮', dingdong: '叮咚', chime: '三连音', custom: '自定义' };
})();
