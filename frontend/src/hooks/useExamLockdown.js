import { useEffect } from "react";
import { fsElement, onFullscreenChange, lockEscKey, unlockKeys } from "@/lib/fullscreen";

const BLOCKED_KEYS = new Set(["p", "s", "u", "o", "f", "r"]);

// Locks the page like a CBT client: no back button, zoom, shortcuts or page bounce while the exam runs.
export default function useExamLockdown(enabled) {
  useEffect(() => {
    if (!enabled) return;
    const html = document.documentElement;
    html.classList.add("exam-lock");

    const meta = document.querySelector('meta[name="viewport"]');
    const prevViewport = meta?.getAttribute("content");
    meta?.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");

    const pushGuard = () => { try { window.history.pushState(window.history.state, "", window.location.href); } catch { /* ignore */ } };
    pushGuard();
    const onPop = () => pushGuard();

    const noGesture = (e) => e.preventDefault();
    const noMultiTouch = (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); };
    const onKey = (e) => {
      const k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && BLOCKED_KEYS.has(k)) e.preventDefault();
      if (k === "f5" || k === "f12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k))) e.preventDefault();
    };
    const onWheel = (e) => { if (e.ctrlKey) e.preventDefault(); };
    const syncKeys = () => (fsElement() ? lockEscKey() : unlockKeys());
    syncKeys();
    const offFs = onFullscreenChange(syncKeys);
    const resetScroll = () => window.scrollTo(0, 0);
    const onDocScroll = () => { if (window.scrollY || window.scrollX) window.scrollTo(0, 0); };

    window.addEventListener("popstate", onPop);
    document.addEventListener("gesturestart", noGesture, { passive: false });
    document.addEventListener("gesturechange", noGesture, { passive: false });
    document.addEventListener("touchmove", noMultiTouch, { passive: false });
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("orientationchange", resetScroll);
    window.addEventListener("resize", resetScroll);
    window.addEventListener("scroll", onDocScroll, { passive: true });

    return () => {
      offFs();
      unlockKeys();
      html.classList.remove("exam-lock");
      if (meta && prevViewport) meta.setAttribute("content", prevViewport);
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("gesturestart", noGesture);
      document.removeEventListener("gesturechange", noGesture);
      document.removeEventListener("touchmove", noMultiTouch);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("orientationchange", resetScroll);
      window.removeEventListener("resize", resetScroll);
      window.removeEventListener("scroll", onDocScroll);
    };
  }, [enabled]);
}
