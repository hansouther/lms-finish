const doc = () => document;
const root = () => document.documentElement;

export const fsElement = () => {
  const d = doc();
  return d.fullscreenElement || d.webkitFullscreenElement || d.webkitCurrentFullScreenElement || d.mozFullScreenElement || d.msFullscreenElement || null;
};

export const isStandalone = () => {
  try {
    return window.matchMedia("(display-mode: fullscreen)").matches || window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch { return false; }
};

export const fsSupported = () => {
  const d = doc();
  const el = root();
  const api = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  const enabled = d.fullscreenEnabled ?? d.webkitFullscreenEnabled ?? d.mozFullScreenEnabled ?? d.msFullscreenEnabled;
  return !!api && enabled !== false;
};

export async function enterFullscreen() {
  if (fsElement()) return true;
  if (!fsSupported()) return false;
  const el = root();
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.webkitRequestFullScreen) el.webkitRequestFullScreen();
    else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
    else if (el.msRequestFullscreen) el.msRequestFullscreen();
  } catch {
    try { if (el.requestFullscreen) await el.requestFullscreen(); } catch { return false; }
  }
  await new Promise((r) => setTimeout(r, 150));
  return !!fsElement();
}

export async function exitFullscreen() {
  const d = doc();
  if (!fsElement()) return;
  try {
    if (d.exitFullscreen) await d.exitFullscreen();
    else if (d.webkitExitFullscreen) d.webkitExitFullscreen();
    else if (d.webkitCancelFullScreen) d.webkitCancelFullScreen();
    else if (d.mozCancelFullScreen) d.mozCancelFullScreen();
    else if (d.msExitFullscreen) d.msExitFullscreen();
  } catch { /* already exited */ }
}

const EVENTS = ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"];
export function onFullscreenChange(cb) {
  EVENTS.forEach((e) => document.addEventListener(e, cb));
  return () => EVENTS.forEach((e) => document.removeEventListener(e, cb));
}

export async function keepScreenOn() {
  try { return await navigator.wakeLock?.request("screen"); } catch { return null; }
}
