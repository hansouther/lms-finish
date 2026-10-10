import { useEffect, useRef, useState } from "react";
import { startAlarm } from "@/lib/alarm";

const isTouch = () => {
  try { return navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches; } catch { return false; }
};
const typing = () => {
  const el = document.activeElement;
  return !!el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);
};
// Viewport much smaller than the physical screen (and not the keyboard) => split screen / pop-up window.
const isShrunk = () => {
  const s = window.screen || {};
  const sw = Math.max(s.width || 0, s.height || 0);
  const sh = Math.min(s.width || 0, s.height || 0);
  if (!sw || !sh) return false;
  const ratio = (window.innerWidth * window.innerHeight) / (sw * sh);
  return ratio < 0.6 && !typing();
};

// Detects Android split-screen / floating windows and overlays that steal focus.
export default function useSplitScreenGuard(enabled, onViolation, { ignoreRef } = {}) {
  const [split, setSplit] = useState(false);
  const cbRef = useRef(onViolation);
  cbRef.current = onViolation;

  useEffect(() => {
    if (!enabled) return;
    const touch = isTouch();
    const ignored = () => ignoreRef?.current || document.visibilityState === "hidden";
    let splitTimer = null, blurTimer = null, inSplit = false;

    const fire = () => { startAlarm(); cbRef.current(); };
    const check = () => {
      if (!touch) return;
      clearTimeout(splitTimer);
      splitTimer = setTimeout(() => {
        if (ignored()) return;
        const now = isShrunk();
        if (now && !inSplit) fire();
        inSplit = now;
        setSplit(now);
      }, 1200);
    };
    const onBlur = () => {
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (ignored() || document.hasFocus()) return;
        fire();
      }, 1500);
    };
    const onFocus = () => clearTimeout(blurTimer);

    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    window.visualViewport?.addEventListener("resize", check);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(splitTimer);
      clearTimeout(blurTimer);
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
      window.visualViewport?.removeEventListener("resize", check);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      setSplit(false);
    };
  }, [enabled, ignoreRef]);

  return split;
}
