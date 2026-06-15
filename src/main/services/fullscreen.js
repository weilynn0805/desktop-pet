// 独占全屏 / 演示模式检测（决策 C / PRD §5.2）
// 用 Windows Shell 的 SHQueryUserNotificationState —— 系统判断“现在该不该弹通知”的官方依据。
// 常驻一个 PowerShell 每 3 秒上报一次状态码，主进程缓存为布尔值，到点弹窗前查询。
// 检测不到（非 Windows / 启动失败）时返回 false（不抑制），符合“不误伤正常使用”。
const { spawn } = require('child_process');

// 需要抑制弹窗的通知状态：
//   2 QUNS_BUSY（全屏应用运行/演示中）、3 QUNS_RUNNING_D3D_FULL_SCREEN（独占全屏游戏）、
//   4 QUNS_PRESENTATION_MODE（演示模式）、7 QUNS_APP（全屏应用，Win8+）
// 放行：1 NOT_PRESENT、5 ACCEPTS_NOTIFICATIONS（正常）、6 QUIET_TIME。
const SUPPRESS = new Set([2, 3, 4, 7]);

// 注意：here-string 结束符 "@ 必须顶格，C# 内的双引号在 JS 反引号模板里可原样书写。
const PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class QUNS {
  [DllImport("shell32.dll")]
  public static extern int SHQueryUserNotificationState(out int state);
}
"@
while ($true) {
  $s = 0
  [void][QUNS]::SHQueryUserNotificationState([ref]$s)
  Write-Output $s
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 3000
}
`;

let proc = null;
let busy = false;

function start() {
  if (process.platform !== 'win32' || proc) return;
  try {
    proc = spawn('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', PS_SCRIPT],
      { windowsHide: true });
    proc.stdout.on('data', (chunk) => {
      // 可能一次到多行，取最后一个数字作为当前状态
      const last = String(chunk).trim().split(/\s+/).filter(Boolean).pop();
      const n = parseInt(last, 10);
      if (Number.isFinite(n)) busy = SUPPRESS.has(n);
    });
    proc.on('exit', () => { proc = null; busy = false; });
    proc.on('error', () => { proc = null; busy = false; });
  } catch {
    proc = null;
    busy = false;
  }
}

function isBusy() { return busy; }

function stop() {
  if (proc) { try { proc.kill(); } catch {} proc = null; }
  busy = false;
}

module.exports = { start, isBusy, stop };
