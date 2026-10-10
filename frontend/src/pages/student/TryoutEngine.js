import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Send, AlertTriangle, ShieldAlert, LayoutGrid } from "lucide-react";
import api, { apiError } from "@/lib/api";
import FullScreenLoader from "@/components/FullScreenLoader";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import MathText, { QuestionImage } from "@/components/common/MathText";
import { ExamHeader, AnswerArea, Palette, FlagButton, FullscreenGate, NoFullscreenNotice, PseudoFullscreenGate, TYPE_LABEL } from "@/components/exam/ExamParts";
import { toast } from "sonner";
import useTabGuard from "@/hooks/useTabGuard";
import useExamLockdown from "@/hooks/useExamLockdown";
import { isIOS, isInAppBrowser } from "@/lib/fullscreen";
import { stopAlarm } from "@/lib/alarm";
import { enterFullscreen, exitFullscreen, fsElement, fsSupported, isStandalone, onFullscreenChange, keepScreenOn } from "@/lib/fullscreen";

const blockCopy = (e) => { if (!["INPUT", "TEXTAREA"].includes(e.target?.tagName)) e.preventDefault(); };

export default function TryoutEngine() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tryout, setTryout] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [flags, setFlags] = useState({});
  const [idx, setIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);
  const [saveState, setSaveState] = useState({ status: "idle", at: null });
  const dirtyRef = useRef(false);
  const [violations, setViolations] = useState(0);
  const [warnOpen, setWarnOpen] = useState(false);
  const [isFs, setIsFs] = useState(!!fsElement());
  const [fsBusy, setFsBusy] = useState(false);
  const [fsFailed, setFsFailed] = useState(false);
  const [pseudoReady, setPseudoReady] = useState(false);
  const answersRef = useRef({});
  answersRef.current = answers;
  const scrollRef = useRef(null);

  const finishTo = useCallback((aid) => {
    localStorage.removeItem(`tryout_${aid}_answers`);
    localStorage.removeItem(`tryout_${aid}_flags`);
    stopAlarm();
    exitFullscreen();
    navigate(`/student/results/${aid}`, { replace: true });
  }, [navigate]);

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await api.post(`/student/attempts/${attemptId}/submit`, { answers: answersRef.current });
      toast.success("Jawaban berhasil dikumpulkan!");
      finishTo(attemptId);
    } catch (e) {
      toast.error(apiError(e));
      submittedRef.current = false;
      setSubmitting(false);
    }
  }, [attemptId, finishTo]);

  useEffect(() => {
    (async () => {
      try {
        const { data: t } = await api.get(`/student/tryouts/${id}`);
        const { data: att } = await api.post(`/student/tryouts/${id}/start`);
        setTryout(t);
        setAttemptId(att.id);
        let localAnswers = null, localFlags = null;
        try {
          localAnswers = JSON.parse(localStorage.getItem(`tryout_${att.id}_answers`) || "null");
          localFlags = JSON.parse(localStorage.getItem(`tryout_${att.id}_flags`) || "null");
        } catch { /* corrupted local cache */ }
        setAnswers({ ...(att.answers || {}), ...(localAnswers || {}) });
        setFlags(localFlags || {});
        if (localAnswers) dirtyRef.current = true;
        setSaveState({ status: att.last_saved_at ? "saved" : "idle", at: att.last_saved_at || null });
        setTimeLeft(att.remaining_seconds ?? (t.duration_minutes || 60) * 60);
        setViolations(att.tab_violations || 0);
      } catch (e) {
        toast.error(apiError(e));
        exitFullscreen();
        navigate("/student/tryouts", { replace: true });
      }
    })();
  }, [id, navigate]);

  useEffect(() => {
    if (!attemptId || !dirtyRef.current) return;
    const h = setTimeout(async () => {
      if (submittedRef.current) return;
      setSaveState((s) => ({ ...s, status: "saving" }));
      try {
        const { data } = await api.put(`/student/attempts/${attemptId}/progress`, { answers });
        dirtyRef.current = false;
        setSaveState({ status: "saved", at: data.saved_at });
      } catch (e) {
        if (e?.response?.status === 409 || e?.response?.status === 404) {
          submittedRef.current = true;
          toast.error(apiError(e));
          localStorage.removeItem(`tryout_${attemptId}_answers`);
          exitFullscreen();
          navigate("/student/tryouts", { replace: true });
          return;
        }
        setSaveState((s) => ({ ...s, status: "error" }));
      }
    }, 1200);
    return () => clearTimeout(h);
  }, [answers, attemptId, navigate]);

  useEffect(() => {
    if (saveState.status !== "error") return;
    const h = setTimeout(() => setAnswers((a) => ({ ...a })), 5000);
    return () => clearTimeout(h);
  }, [saveState]);

  useEffect(() => {
    if (timeLeft == null) return;
    if (timeLeft <= 0) { doSubmit(); return; }
    const timer = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, doSubmit]);

  useEffect(() => onFullscreenChange(() => setIsFs(!!fsElement())), []);
  useEffect(() => {
    let lock = null;
    const grab = async () => { lock = await keepScreenOn(); };
    grab();
    const onVis = () => document.visibilityState === "visible" && grab();
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); lock?.release?.().catch(() => {}); };
  }, []);
  useEffect(() => () => { exitFullscreen(); }, []);
  useEffect(() => { scrollRef.current?.scrollTo?.({ top: 0 }); }, [idx]);

  const MAX_VIOLATIONS = tryout?.tab_warning_limit ?? 0;
  const needFs = MAX_VIOLATIONS > 0 && fsSupported() && !isStandalone() && !fsFailed;

  useTabGuard(!!attemptId && MAX_VIOLATIONS > 0, async () => {
    if (submittedRef.current) return stopAlarm();
    try {
      const { data } = await api.post(`/student/attempts/${attemptId}/violation`, { answers: answersRef.current });
      if (data.auto_submitted) {
        submittedRef.current = true;
        toast.error(`Anda melanggar ${data.count} kali (keluar tab/layar penuh). Try Out otomatis dikumpulkan.`);
        finishTo(attemptId);
        return;
      }
      setViolations(data.count);
    } catch (e) {
      if (e?.response?.status === 409) { submittedRef.current = true; finishTo(attemptId); return; }
      setViolations((v) => Math.min(v + 1, MAX_VIOLATIONS - 1));
    }
    setWarnOpen(true);
  }, { ignoreRef: submittedRef, watchFullscreen: needFs });
  useExamLockdown(!!attemptId && MAX_VIOLATIONS > 0);
  const startPseudo = () => { setPseudoReady(true); window.scrollTo(0, 0); };

  const goFullscreen = async () => {
    setFsBusy(true);
    const ok = await enterFullscreen();
    setFsBusy(false);
    if (!ok) { setFsFailed(true); toast.info("Browser ini menolak layar penuh. Ujian tetap berjalan; jangan berpindah tab/aplikasi."); }
  };
  const continueExam = () => { stopAlarm(); setWarnOpen(false); if (needFs) goFullscreen(); };
  const finishFromWarning = () => { stopAlarm(); setWarnOpen(false); doSubmit(); };

  if (!tryout) return <FullScreenLoader label="Menyiapkan soal..." />;
  if (!tryout.questions?.length) return <FullScreenLoader label="Soal belum tersedia" />;

  const total = tryout.questions.length;
  const q = tryout.questions[Math.min(idx, total - 1)];
  const val = answers[q.id] || [];
  const setVal = (v) => {
    setAnswers((prev) => {
      const next = { ...prev, [q.id]: v };
      dirtyRef.current = true;
      try { localStorage.setItem(`tryout_${attemptId}_answers`, JSON.stringify(next)); } catch { /* storage full */ }
      return next;
    });
  };
  const toggleFlag = () => setFlags((f) => {
    const next = { ...f, [q.id]: !f[q.id] };
    try { localStorage.setItem(`tryout_${attemptId}_flags`, JSON.stringify(next)); } catch { /* storage full */ }
    return next;
  });
  const answeredCount = tryout.questions.filter((qq) => (answers[qq.id] || []).length > 0).length;
  const flaggedCount = tryout.questions.filter((qq) => flags[qq.id]).length;
  const pick = (i) => { setIdx(i); setPaletteOpen(false); };
  const isLast = idx >= total - 1;

  return (
    <div className="fixed inset-0 h-[100dvh] bg-[#E9EEF2] flex flex-col overflow-hidden select-none" onContextMenu={blockCopy} onCopy={blockCopy} onCut={blockCopy} data-testid="exam-root">
      <ExamHeader tryout={tryout} timeLeft={timeLeft} violations={violations} max={MAX_VIOLATIONS} saveState={saveState} />
      {MAX_VIOLATIONS > 0 && !needFs && <NoFullscreenNotice />}

      <div className="flex-1 min-h-0 w-full max-w-6xl mx-auto flex gap-5 p-2 sm:p-5">
        <main ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto overscroll-contain bg-white rounded-lg border border-[#D5DDE3] shadow-sm" data-testid="exam-question">
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-[#E2E8F0] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2">
            <span className="rounded-md bg-[#0E7490] text-white px-3 py-1 text-xs sm:text-sm font-bold">Soal {idx + 1} / {total}</span>
            <span className="text-[11px] sm:text-xs text-[#94A3B8] font-mono2 truncate">{q.points} poin · {TYPE_LABEL[q.type]}</span>
          </div>
          <div className="px-4 sm:px-6 py-5">
            <div className="overflow-x-auto"><MathText as="div" text={q.text} className="block text-base sm:text-lg text-[#0A1128] leading-relaxed break-words whitespace-pre-line" data-testid="exam-question-text" /></div>
            <QuestionImage src={q.image_url} className="mt-4" testid="exam-question-image" />
            <div className="mt-6"><AnswerArea q={q} val={val} setVal={setVal} /></div>
          </div>
          <div className="hidden lg:flex items-center justify-between gap-2 border-t border-[#E2E8F0] px-6 py-4">
            <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} className="rounded-md" data-testid="prev-question"><ChevronLeft className="h-4 w-4" /> Sebelumnya</Button>
            <FlagButton on={!!flags[q.id]} onClick={toggleFlag} />
            {!isLast ? (
              <Button onClick={() => setIdx((i) => i + 1)} className="rounded-md bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="next-question">Berikutnya <ChevronRight className="h-4 w-4" /></Button>
            ) : (
              <Button onClick={() => setConfirmOpen(true)} className="rounded-md bg-[#10B981] hover:bg-[#0ea371]" data-testid="finish-exam"><Send className="h-4 w-4" /> Selesai & Kumpulkan</Button>
            )}
          </div>
        </main>

        <aside className="hidden lg:flex w-[270px] shrink-0 flex-col bg-white rounded-lg border border-[#D5DDE3] shadow-sm p-4 overflow-y-auto" data-testid="exam-palette">
          <p className="text-sm font-bold text-[#0A1128]">Nomor Soal</p>
          <p className="text-xs text-[#94A3B8] mt-0.5 mb-3">{answeredCount} dari {total} terjawab{flaggedCount ? ` · ${flaggedCount} ragu` : ""}</p>
          <Palette questions={tryout.questions} answers={answers} flags={flags} idx={idx} onPick={pick} />
          <Button onClick={() => setConfirmOpen(true)} className="w-full mt-5 rounded-md bg-[#10B981] hover:bg-[#0ea371]" data-testid="submit-exam-side"><Send className="h-4 w-4" /> Kumpulkan</Button>
        </aside>
      </div>

      <nav className="lg:hidden shrink-0 bg-white border-t border-[#D5DDE3] px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] grid grid-cols-4 gap-2" data-testid="exam-mobile-nav">
        <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} className="h-11 rounded-md px-0" data-testid="m-prev-question"><ChevronLeft className="h-5 w-5" /></Button>
        <FlagButton on={!!flags[q.id]} onClick={toggleFlag} className="h-11 px-0" testid="m-flag-question" />
        <Button variant="outline" onClick={() => setPaletteOpen(true)} className="h-11 rounded-md px-0 font-bold" data-testid="m-open-palette"><LayoutGrid className="h-4 w-4" /> {answeredCount}/{total}</Button>
        {!isLast ? (
          <Button onClick={() => setIdx((i) => i + 1)} className="h-11 rounded-md px-0 bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="m-next-question"><ChevronRight className="h-5 w-5" /></Button>
        ) : (
          <Button onClick={() => setConfirmOpen(true)} className="h-11 rounded-md px-0 bg-[#10B981] hover:bg-[#0ea371]" data-testid="m-finish-exam"><Send className="h-4 w-4" /></Button>
        )}
      </nav>

      <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-2xl" data-testid="m-palette-sheet">
          <SheetHeader><SheetTitle>Nomor Soal · {answeredCount}/{total} terjawab</SheetTitle></SheetHeader>
          <div className="mt-4"><Palette questions={tryout.questions} answers={answers} flags={flags} idx={idx} onPick={pick} /></div>
          <Button onClick={() => { setPaletteOpen(false); setConfirmOpen(true); }} className="w-full mt-5 h-11 rounded-md bg-[#10B981] hover:bg-[#0ea371]" data-testid="m-submit-exam"><Send className="h-4 w-4" /> Kumpulkan</Button>
        </SheetContent>
      </Sheet>

      {MAX_VIOLATIONS > 0 && !needFs && !pseudoReady && !warnOpen && !submitting && <PseudoFullscreenGate max={MAX_VIOLATIONS} ios={isIOS()} inApp={isInAppBrowser()} onStart={startPseudo} />}
      {needFs && !isFs && !warnOpen && !submitting && <FullscreenGate max={MAX_VIOLATIONS} onEnter={goFullscreen} busy={fsBusy} />}

      <AlertDialog open={warnOpen}>
        <AlertDialogContent className="border-red-300 max-w-[92vw] sm:max-w-lg z-[70]" data-testid="tab-warning-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 text-left"><ShieldAlert className="h-5 w-5 shrink-0" /> Peringatan {violations} dari {MAX_VIOLATIONS}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-[#475569] text-left">
                <p>Sistem mendeteksi Anda keluar dari layar penuh atau berpindah tab/aplikasi. Tindakan ini tercatat dan dapat dilihat oleh admin.</p>
                <p className="font-semibold text-red-600" data-testid="tab-warning-remaining">
                  {MAX_VIOLATIONS - violations > 1 ? `Sisa ${MAX_VIOLATIONS - violations - 1} peringatan lagi. ` : "Ini peringatan terakhir. "}
                  Jika melanggar {MAX_VIOLATIONS} kali, Try Out otomatis diselesaikan & dikumpulkan.
                </p>
                <p>Selesaikan Try Out sekarang atau tetap melanjutkan?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={finishFromWarning} disabled={submitting} data-testid="tab-warning-finish">Selesaikan & Kumpulkan</AlertDialogCancel>
            <AlertDialogAction onClick={continueExam} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="tab-warning-continue">Tetap Lanjutkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-[92vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-left"><AlertTriangle className="h-5 w-5 text-[#C9A227] shrink-0" /> Kumpulkan jawaban?</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              Terjawab {answeredCount} dari {total} soal{total - answeredCount ? `, ${total - answeredCount} belum dijawab` : ""}{flaggedCount ? `, ${flaggedCount} ditandai ragu-ragu` : ""}. Jawaban tidak dapat diubah setelah dikumpulkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Periksa Lagi</AlertDialogCancel>
            <AlertDialogAction onClick={doSubmit} disabled={submitting} className="bg-[#10B981] hover:bg-[#0ea371]" data-testid="confirm-submit">Ya, Kumpulkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
