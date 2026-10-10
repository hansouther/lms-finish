import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Clock, ChevronLeft, ChevronRight, Send, GraduationCap, AlertTriangle, ShieldAlert } from "lucide-react";
import api, { apiError } from "@/lib/api";
import FullScreenLoader from "@/components/FullScreenLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import MathText, { QuestionImage } from "@/components/common/MathText";
import { TfMultiAnswer } from "@/components/common/TfMulti";
import { tfLabels } from "@/lib/tf";
import { toast } from "sonner";
import useTabGuard from "@/hooks/useTabGuard";
import { stopAlarm } from "@/lib/alarm";

const MAX_VIOLATIONS = 5;

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function SaveIndicator({ state }) {
  const at = state.at ? new Date(state.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  const map = {
    idle: ["text-[#94A3B8]", "Belum ada jawaban"],
    saving: ["text-[#C9A227]", "Menyimpan..."],
    saved: ["text-[#10B981]", `Tersimpan di server ${at}`],
    error: ["text-red-600", "Gagal menyimpan, mencoba lagi (aman di perangkat)"],
  };
  const [cls, label] = map[state.status] || map.idle;
  return <span className={`hidden sm:inline text-xs font-medium ${cls}`} data-testid="exam-save-status">{label}</span>;
}

export default function TryoutEngine() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tryout, setTryout] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [idx, setIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);
  const [saveState, setSaveState] = useState({ status: "idle", at: null });
  const dirtyRef = useRef(false);
  const [violations, setViolations] = useState(0);
  const [warnOpen, setWarnOpen] = useState(false);
  const answersRef = useRef({});
  answersRef.current = answers;

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
   try {
      await api.post(`/student/attempts/${attemptId}/submit`, { answers });
      
      // Bersihkan penyimpanan lokal setelah berhasil dikirim
      localStorage.removeItem(`tryout_${attemptId}_answers`);
      
      toast.success("Jawaban berhasil dikumpulkan!");
      navigate(`/student/results/${attemptId}`, { replace: true });
    } catch (e) {
      toast.error(apiError(e));
      submittedRef.current = false;
      setSubmitting(false);
    }
  }, [attemptId, answers, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const { data: t } = await api.get(`/student/tryouts/${id}`);
        const { data: att } = await api.post(`/student/tryouts/${id}/start`);
        setTryout(t);
        setAttemptId(att.id);
        // Cek riwayat jawaban di peramban siswa
        const localAnswers = JSON.parse(localStorage.getItem(`tryout_${att.id}_answers`) || "null");
        setAnswers({ ...(att.answers || {}), ...(localAnswers || {}) });
        if (localAnswers) dirtyRef.current = true;
        setSaveState({ status: att.last_saved_at ? "saved" : "idle", at: att.last_saved_at || null });
        setTimeLeft(att.remaining_seconds ?? (t.duration_minutes || 60) * 60);
        setViolations(att.tab_violations || 0);
      } catch (e) {
        toast.error(apiError(e));
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
          localStorage.removeItem(`tryout_${attemptId}_answers`);
          toast.error(apiError(e));
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

  useTabGuard(!!attemptId && tryout?.kind !== "exercise", async () => {
    if (submittedRef.current) return stopAlarm();
    try {
      const { data } = await api.post(`/student/attempts/${attemptId}/violation`, { answers: answersRef.current });
      if (data.auto_submitted) {
        submittedRef.current = true;
        stopAlarm();
        localStorage.removeItem(`tryout_${attemptId}_answers`);
        toast.error(`Anda keluar tab ${data.count} kali. Try Out otomatis dikumpulkan.`);
        navigate(`/student/results/${attemptId}`, { replace: true });
        return;
      }
      setViolations(data.count);
    } catch {
      setViolations((v) => Math.min(v + 1, MAX_VIOLATIONS - 1));
    }
    setWarnOpen(true);
  });

  const continueExam = () => { stopAlarm(); setWarnOpen(false); };
  const finishFromWarning = () => { stopAlarm(); setWarnOpen(false); doSubmit(); };

  if (!tryout) return <FullScreenLoader label="Menyiapkan soal..." />;

  const q = tryout.questions[idx];
  const val = answers[q.id] || [];
  //const setVal = (v) => setAnswers((a) => ({ ...a, [q.id]: v }));
  const setVal = (v) => {
    setAnswers((prev) => {
      const updatedAnswers = { ...prev, [q.id]: v };
      dirtyRef.current = true;
      // Simpan jawaban baru langsung ke memori peramban
      if (attemptId) {
        localStorage.setItem(`tryout_${attemptId}_answers`, JSON.stringify(updatedAnswers));
      }
      return updatedAnswers;
    });
  };
  const answeredCount = tryout.questions.filter((qq) => (answers[qq.id] || []).length > 0).length;

  const toggleMulti = (optId) => {
    setVal(val.includes(optId) ? val.filter((x) => x !== optId) : [...val, optId]);
  };

  return (
    <div className="min-h-screen bg-[#EFF6F8] flex flex-col">
      {/* Top bar */}
      <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#0E7490] flex items-center justify-center"><GraduationCap className="h-5 w-5 text-white" /></div>
          <div>
            <p className="font-semibold text-[#0A1128] text-sm leading-tight">{tryout.title}</p>
            <p className="text-xs text-[#94A3B8]">{tryout.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
        <SaveIndicator state={saveState} />
        {tryout.kind !== "exercise" && (
          <span className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${violations > 0 ? "bg-red-50 text-red-600" : "bg-[#EFF6F8] text-[#475569]"}`} title="Jumlah peringatan keluar/pindah tab" data-testid="exam-violation-counter">
            <ShieldAlert className="h-3.5 w-3.5" /> {violations}/{MAX_VIOLATIONS}
          </span>
        )}
        <div className={`flex items-center gap-2 rounded-full px-4 py-2 font-mono2 font-bold ${timeLeft < 60 ? "bg-red-50 text-red-600" : "bg-[#E6F5F8] text-[#0E7490]"}`} data-testid="exam-timer">
          <Clock className="h-4 w-4" /> {fmtTime(timeLeft)}
        </div>
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 grid lg:grid-cols-[1fr_260px] gap-6">
        {/* Question */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8" data-testid="exam-question">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-[#E6F5F8] text-[#0E7490] px-3 py-1 text-xs font-bold">Soal {idx + 1} / {tryout.questions.length}</span>
            <span className="text-xs text-[#94A3B8] font-mono2">{q.points} poin · {({ single: "Pilihan Ganda", multiple: "Pilihan Ganda Kompleks", truefalse: "Benar/Salah", truefalse_multi: "Benar/Salah Majemuk", essay: "Esai" })[q.type]}</span>
          </div>
          <MathText as="div" text={q.text} className="mt-5 block text-lg text-[#0A1128] leading-relaxed" data-testid="exam-question-text" />
          <QuestionImage src={q.image_url} className="mt-4" testid="exam-question-image" />

          <div className="mt-6 space-y-3">
            {q.type === "single" && (
              <RadioGroup value={val[0] || ""} onValueChange={(v) => setVal([v])}>
                {q.options.map((o) => (
                  <label key={o.id} className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-colors duration-200 ${val[0] === o.id ? "border-[#0E7490] bg-[#E6F5F8]" : "border-[#E2E8F0] hover:bg-[#EFF6F8]"}`} data-testid={`opt-${o.id}`}>
                    <RadioGroupItem value={o.id} /> <MathText text={o.text} className="text-sm text-[#0A1128]" />
                  </label>
                ))}
              </RadioGroup>
            )}
            {q.type === "multiple" && q.options.map((o) => (
              <label key={o.id} className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-colors duration-200 ${val.includes(o.id) ? "border-[#0E7490] bg-[#E6F5F8]" : "border-[#E2E8F0] hover:bg-[#EFF6F8]"}`} data-testid={`opt-${o.id}`}>
                <Checkbox checked={val.includes(o.id)} onCheckedChange={() => toggleMulti(o.id)} /> <MathText text={o.text} className="text-sm text-[#0A1128]" />
              </label>
            ))}
            {q.type === "truefalse" && (
              <RadioGroup value={val[0] || ""} onValueChange={(v) => setVal([v])}>
                {[["true", tfLabels(q)[0]], ["false", tfLabels(q)[1]]].map(([v, l]) => (
                  <label key={v} className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-colors duration-200 ${val[0] === v ? "border-[#0E7490] bg-[#E6F5F8]" : "border-[#E2E8F0] hover:bg-[#EFF6F8]"}`} data-testid={`opt-${v}`}>
                    <RadioGroupItem value={v} /> <span className="text-sm text-[#0A1128]">{l}</span>
                  </label>
                ))}
              </RadioGroup>
            )}
            {q.type === "truefalse_multi" && <TfMultiAnswer q={q} value={val} onChange={setVal} />}
            {q.type === "essay" && (
              <div>
                <Input value={val[0] || ""} onChange={(e) => setVal([e.target.value])} placeholder="Ketik jawaban singkat Anda..." className="h-12" data-testid="essay-input" />
                <p className="mt-2 text-xs text-[#94A3B8]">Jawaban dinilai otomatis berdasarkan kecocokan teks (huruf besar/kecil tidak berpengaruh).</p>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} className="rounded-full" data-testid="prev-question"><ChevronLeft className="h-4 w-4" /> Sebelumnya</Button>
            {idx < tryout.questions.length - 1 ? (
              <Button onClick={() => setIdx((i) => i + 1)} className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="next-question">Berikutnya <ChevronRight className="h-4 w-4" /></Button>
            ) : (
              <Button onClick={() => setConfirmOpen(true)} className="rounded-full bg-[#10B981] hover:bg-[#0ea371]" data-testid="finish-exam"><Send className="h-4 w-4" /> Selesai & Kumpulkan</Button>
            )}
          </div>
        </div>

        {/* Palette */}
        <aside className="bg-white rounded-2xl border border-[#E2E8F0] p-5 h-fit lg:sticky lg:top-24">
          <p className="text-sm font-semibold text-[#0A1128]">Navigasi Soal</p>
          <p className="text-xs text-[#94A3B8] mt-1">{answeredCount} dari {tryout.questions.length} terjawab</p>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {tryout.questions.map((qq, i) => {
              const done = (answers[qq.id] || []).length > 0;
              return (
                <button key={qq.id} onClick={() => setIdx(i)} data-testid={`palette-${i}`}
                  className={`h-9 rounded-lg text-sm font-semibold transition-colors duration-200 ${i === idx ? "bg-[#0E7490] text-white" : done ? "bg-[#ECFDF5] text-[#10B981]" : "bg-[#EFF6F8] text-[#475569] hover:bg-[#E6F5F8]"}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <Button onClick={() => setConfirmOpen(true)} className="w-full mt-5 rounded-full bg-[#10B981] hover:bg-[#0ea371]" data-testid="submit-exam-side"><Send className="h-4 w-4" /> Kumpulkan</Button>
        </aside>
      </div>

      <AlertDialog open={warnOpen}>
        <AlertDialogContent className="border-red-300" data-testid="tab-warning-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600"><ShieldAlert className="h-5 w-5" /> Peringatan {violations} dari {MAX_VIOLATIONS}: Anda meninggalkan halaman Try Out</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-[#475569]">
                <p>Sistem mendeteksi Anda berpindah atau keluar dari tab Try Out. Tindakan ini tercatat dan dapat dilihat oleh admin.</p>
                <p className="font-semibold text-red-600" data-testid="tab-warning-remaining">
                  {MAX_VIOLATIONS - violations > 1 ? `Sisa ${MAX_VIOLATIONS - violations - 1} peringatan lagi. ` : "Ini peringatan terakhir. "}
                  Jika keluar tab {MAX_VIOLATIONS} kali, Try Out akan otomatis diselesaikan & dikumpulkan.
                </p>
                <p>Apakah Anda ingin menyelesaikan Try Out sekarang atau tetap melanjutkan?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={finishFromWarning} disabled={submitting} data-testid="tab-warning-finish">Selesaikan & Kumpulkan</AlertDialogCancel>
            <AlertDialogAction onClick={continueExam} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="tab-warning-continue">Tetap Lanjutkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-[#C9A227]" /> Kumpulkan jawaban?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda telah menjawab {answeredCount} dari {tryout.questions.length} soal. Jawaban tidak dapat diubah setelah dikumpulkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doSubmit} disabled={submitting} className="bg-[#10B981] hover:bg-[#0ea371]" data-testid="confirm-submit">Ya, Kumpulkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
