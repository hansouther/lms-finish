let ctx = null;
let timer = null;
let stopAt = 0;

export function primeAlarm() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch { /* audio not supported */ }
}

function beep(freq) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.24);
}

export function startAlarm(maxMs = 15000) {
  primeAlarm();
  if (!ctx) return;
  stopAt = Date.now() + maxMs;
  if (timer) return;
  let high = true;
  timer = setInterval(() => {
    if (Date.now() > stopAt) return stopAlarm();
    beep(high ? 1046 : 784);
    high = !high;
  }, 260);
}

export function stopAlarm() {
  if (timer) clearInterval(timer);
  timer = null;
}
