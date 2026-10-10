import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Clock, ChevronLeft, ChevronRight, Send, GraduationCap, AlertTriangle } from "lucide-react";
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

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
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
        const localAnswers = JSON.parse(localStorage.getItem(`tryout_${att.id}_answers`));
        setAnswers(localAnswers || att.answers || {});
        
        setTimeLeft((t.duration_minutes || 60) * 60);
      } catch (e) {
        toast.error(apiError(e));
        navigate("/student/tryouts", { replace: true });
      }
    })();
  }, [id, navigate]);

  useEffect(() => {
    if (timeLeft == null) return;
    if (timeLeft <= 0) { doSubmit(); return; }
    const timer = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, doSubmit]);

  if (!tryout) return <FullScreenLoader label="Menyiapkan soal..." />;

  const q = tryout.questions[idx];
  const val = answers[q.id] || [];
  //const setVal = (v) => setAnswers((a) => ({ ...a, [q.id]: v }));
  const setVal = (v) => {
    setAnswers((prev) => {
      const updatedAnswers = { ...prev, [q.id]: v };
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
        <div className={`flex items-center gap-2 rounded-full px-4 py-2 font-mono2 font-bold ${timeLeft < 60 ? "bg-red-50 text-red-600" : "bg-[#E6F5F8] text-[#0E7490]"}`} data-testid="exam-timer">
          <Clock className="h-4 w-4" /> {fmtTime(timeLeft)}
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
