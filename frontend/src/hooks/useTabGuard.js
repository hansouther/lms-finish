import { useEffect, useRef } from "react";
import { primeAlarm, startAlarm, stopAlarm } from "@/lib/alarm";

// Detects leaving the tab (not refresh): fires onReturn when the student comes back.
export default function useTabGuard(enabled, onReturn) {
  const unloadingRef = useRef(false);
  const leftRef = useRef(false);
  const cbRef = useRef(onReturn);
  cbRef.current = onReturn;

  useEffect(() => {
    if (!enabled) return;
    const onUnload = () => { unloadingRef.current = true; stopAlarm(); };
    const onVis = () => {
      if (unloadingRef.current) return;
      if (document.visibilityState === "hidden") {
        leftRef.current = true;
        startAlarm();
      } else if (leftRef.current) {
        leftRef.current = false;
        cbRef.current();
      }
    };
    window.addEventListener("pointerdown", primeAlarm);
    window.addEventListener("keydown", primeAlarm);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pointerdown", primeAlarm);
      window.removeEventListener("keydown", primeAlarm);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
      document.removeEventListener("visibilitychange", onVis);
      stopAlarm();
    };
  }, [enabled]);
}
