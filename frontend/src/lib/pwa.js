let deferred = null;
const listeners = new Set();
const emit = () => listeners.forEach((cb) => cb(!!deferred));

export function initPwa() {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; emit(); });
  window.addEventListener("appinstalled", () => { deferred = null; emit(); });
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
}

export const canPromptInstall = () => !!deferred;

export function onInstallAvailable(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const { outcome } = await deferred.userChoice.catch(() => ({ outcome: "dismissed" }));
  deferred = null;
  emit();
  return outcome === "accepted";
}
