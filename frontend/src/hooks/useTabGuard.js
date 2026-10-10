import { useEffect, useRef } from "react";
import { primeAlarm, startAlarm, stopAlarm } from "@/lib/alarm";
import { fsElement, onFullscreenChange } from "@/lib/fullscreen";

// Counts leaving the tab/app (not refresh) and leaving fullscreen as one violation each.
export default function useTabGuard(enabled, onViolation, { ignoreRef, watchFullscreen = false } = {}) {
  const unloadingRef = useRef(false);
  const leftRef = useRef(false);
  const wasFsRef = useRef(false);
  const cbRef = useRef(onViolation);
  cbRef.current = onViolation;

  useEffect(() => {
    if (!enabled) return;
    const ignored = () => unloadingRef.current || ignoreRef?.current;
    const onUnload = () => { unloadingRef.current = true; stopAlarm(); };
    const onVis = () => {
      if (ignored()) return;
      if (document.visibilityState === "hidden") {
        leftRef.current = true;
        startAlarm();
      } else if (leftRef.current) {
        leftRef.current = false;
        cbRef.current();
      }
    };
    wasFsRef.current = !!fsElement();
    const onFs = () => {
      const now = !!fsElement();
      const exited = wasFsRef.current && !now;
      wasFsRef.current = now;
      if (!exited || !watchFullscreen || ignored()) return;
      setTimeout(() => {
        // leaving the app also exits fullscreen; let the visibility handler count it once
        if (ignored() || leftRef.current || document.visibilityState === "hidden") return;
        startAlarm();
        cbRef.current();
      }, 300);
    };
    const offFs = onFullscreenChange(onFs);
    window.addEventListener("pointerdown", primeAlarm);
    window.addEventListener("keydown", primeAlarm);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      offFs();
      window.removeEventListener("pointerdown", primeAlarm);
      window.removeEventListener("keydown", primeAlarm);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
      document.removeEventListener("visibilitychange", onVis);
      stopAlarm();
    };
  }, [enabled, watchFullscreen, ignoreRef]);
}
