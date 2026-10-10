import { Clock, ShieldAlert, Flag, Maximize, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import MathText from "@/components/common/MathText";
import { TfMultiAnswer } from "@/components/common/TfMulti";
import { tfLabels } from "@/lib/tf";

export const TYPE_LABEL = { single: "Pilihan Ganda", multiple: "Pilihan Ganda Kompleks", truefalse: "Benar/Salah", truefalse_multi: "Benar/Salah Majemuk", essay: "Esai" };
const LETTERS = "ABCDEFGH";

export function fmtTime(s) {
  const v = Math.max(0, s || 0);
  const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60), sec = v % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

export function SaveIndicator({ state }) {
  const at = state.at ? new Date(state.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  const map = {
    idle: ["text-[#94A3B8]", "Belum ada jawaban"],
    saving: ["text-[#C9A227]", "Menyimpan..."],
    saved: ["text-[#10B981]", `Tersimpan ${at}`],
    error: ["text-red-600", "Gagal menyimpan, mencoba lagi"],
  };
  const [cls, label] = map[state.status] || map.idle;
  return <span className={`hidden md:inline text-xs font-medium ${cls}`} data-testid="exam-save-status">{label}</span>;
}

export function ExamHeader({ tryout, timeLeft, violations, max, saveState }) {
  return (
    <header className="shrink-0 bg-[#0A1128] text-white px-3 sm:px-6 h-14 flex items-center justify-between gap-2 pt-[env(safe-area-inset-top)]" data-testid="exam-header">
      <div className="min-w-0">
        <p className="font-semibold text-sm leading-tight truncate" data-testid="exam-title">{tryout.title}</p>
        <p className="text-[11px] text-white/60 truncate">{tryout.subject}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <SaveIndicator state={saveState} />
        {max > 0 && (
          <span className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${violations > 0 ? "bg-red-500 text-white" : "bg-white/10 text-white/80"}`} title="Peringatan keluar tab / layar penuh" data-testid="exam-violation-counter">
            <ShieldAlert className="h-3.5 w-3.5" /> {violations}/{max}
          </span>
        )}
        <span className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono2 text-sm font-bold ${timeLeft < 300 ? "bg-red-500 text-white animate-pulse" : "bg-white text-[#0A1128]"}`} data-testid="exam-timer">
          <Clock className="h-4 w-4" /> {fmtTime(timeLeft)}
        </span>
      </div>
    </header>
  );
}

const optCls = (on) => `flex items-start gap-3 rounded-lg border-2 p-3 sm:p-4 cursor-pointer transition-colors duration-150 select-none ${on ? "border-[#0E7490] bg-[#E6F5F8]" : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"}`;
const Letter = ({ i, on }) => <span className={`h-7 w-7 shrink-0 rounded-full border-2 flex items-center justify-center text-xs font-bold ${on ? "bg-[#0E7490] border-[#0E7490] text-white" : "border-[#CBD5E1] text-[#475569]"}`}>{LETTERS[i]}</span>;

export function AnswerArea({ q, val, setVal }) {
  const toggle = (id) => setVal(val.includes(id) ? val.filter((x) => x !== id) : [...val, id]);
  if (q.type === "single") return (
    <RadioGroup value={val[0] || ""} onValueChange={(v) => setVal([v])} className="gap-2.5">
      {q.options.map((o, i) => (
        <label key={o.id} className={optCls(val[0] === o.id)} data-testid={`opt-${o.id}`}>
          <RadioGroupItem value={o.id} className="sr-only" /><Letter i={i} on={val[0] === o.id} />
          <MathText text={o.text} className="min-w-0 break-words text-sm sm:text-base text-[#0A1128] pt-0.5" />
        </label>
      ))}
    </RadioGroup>
  );
  if (q.type === "multiple") return (
    <div className="space-y-2.5">
      <p className="text-xs text-[#475569]">Pilih semua jawaban yang benar.</p>
      {q.options.map((o) => (
        <label key={o.id} className={optCls(val.includes(o.id))} data-testid={`opt-${o.id}`}>
          <Checkbox checked={val.includes(o.id)} onCheckedChange={() => toggle(o.id)} className="mt-1 h-5 w-5" />
          <MathText text={o.text} className="min-w-0 break-words text-sm sm:text-base text-[#0A1128]" />
        </label>
      ))}
    </div>
  );
  if (q.type === "truefalse") return (
    <RadioGroup value={val[0] || ""} onValueChange={(v) => setVal([v])} className="grid grid-cols-2 gap-2.5">
      {[["true", tfLabels(q)[0]], ["false", tfLabels(q)[1]]].map(([v, l], i) => (
        <label key={v} className={optCls(val[0] === v)} data-testid={`opt-${v}`}>
          <RadioGroupItem value={v} className="sr-only" /><Letter i={i} on={val[0] === v} /><span className="text-sm sm:text-base text-[#0A1128] pt-0.5">{l}</span>
        </label>
      ))}
    </RadioGroup>
  );
  if (q.type === "truefalse_multi") return <TfMultiAnswer q={q} value={val} onChange={setVal} />;
  return (
    <div>
      <Input value={val[0] || ""} onChange={(e) => setVal([e.target.value])} placeholder="Ketik jawaban singkat Anda..." className="h-12 text-base" autoComplete="off" autoCorrect="off" spellCheck={false} data-testid="essay-input" />
      <p className="mt-2 text-xs text-[#94A3B8]">Huruf besar/kecil tidak berpengaruh.</p>
    </div>
  );
}

export function Palette({ questions, answers, flags, idx, onPick }) {
  return (
    <div>
      <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2">
        {questions.map((qq, i) => {
          const done = (answers[qq.id] || []).length > 0;
          const cls = i === idx ? "bg-[#0E7490] text-white ring-2 ring-[#0E7490]/30" : flags[qq.id] ? "bg-[#FBBF24] text-[#0A1128]" : done ? "bg-[#10B981] text-white" : "bg-white text-[#475569] border border-[#CBD5E1]";
          return <button key={qq.id} type="button" onClick={() => onPick(i)} data-testid={`palette-${i}`} className={`h-10 rounded-md text-sm font-bold transition-colors duration-150 ${cls}`}>{i + 1}</button>;
        })}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-1.5 text-[11px] text-[#475569]">
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-[#10B981]" /> Sudah dijawab</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-[#FBBF24]" /> Ragu-ragu</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border border-[#CBD5E1] bg-white" /> Belum dijawab</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-[#0E7490]" /> Soal aktif</span>
      </div>
    </div>
  );
}

export function FlagButton({ on, onClick, className = "", testid = "flag-question" }) {
  return (
    <Button type="button" variant="outline" onClick={onClick} className={`rounded-md ${className} ${on ? "border-[#FBBF24] bg-[#FEF3C7] text-[#92400E] hover:bg-[#FDE68A]" : ""}`} data-testid={testid}>
      <Flag className="h-4 w-4" /> <span className="hidden sm:inline">Ragu-ragu</span>
    </Button>
  );
}

export function FullscreenGate({ max, onEnter, busy }) {
  return (
    <div className="fixed inset-0 z-[60] bg-[#0A1128]/95 backdrop-blur-sm flex items-center justify-center p-5" data-testid="fullscreen-gate">
      <div className="max-w-md w-full rounded-2xl bg-white p-6 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-[#E6F5F8] flex items-center justify-center"><Maximize className="h-7 w-7 text-[#0E7490]" /></div>
        <h2 className="mt-4 text-lg font-bold text-[#0A1128]">Mode Ujian Layar Penuh</h2>
        <p className="mt-2 text-sm text-[#475569]">Try Out ini wajib dikerjakan dalam layar penuh. Keluar dari layar penuh atau berpindah tab/aplikasi akan dihitung sebagai pelanggaran{max ? ` (maks ${max} kali, lalu otomatis dikumpulkan)` : ""}.</p>
        <Button onClick={onEnter} disabled={busy} className="mt-5 w-full h-12 rounded-md bg-[#0E7490] hover:bg-[#0B5C74] text-base" data-testid="fullscreen-enter">
          <Maximize className="h-5 w-5" /> Masuk Layar Penuh & Lanjutkan
        </Button>
      </div>
    </div>
  );
}

export function NoFullscreenNotice() {
  return (
    <div className="shrink-0 bg-[#FEF3C7] text-[#92400E] text-[11px] sm:text-xs px-3 py-1.5 flex items-center gap-1.5" data-testid="no-fullscreen-notice">
      <Smartphone className="h-3.5 w-3.5 shrink-0" /> Perangkat ini tidak mendukung layar penuh di browser. Jangan berpindah aplikasi/tab — tetap dihitung pelanggaran.
    </div>
  );
}

export function PseudoFullscreenGate({ max, ios, inApp, standalone, onStart }) {
  return (
    <div className="fixed inset-0 z-[60] bg-[#0A1128]/95 backdrop-blur-sm flex items-center justify-center p-5 overflow-y-auto" data-testid="pseudo-fullscreen-gate">
      <div className="max-w-md w-full rounded-2xl bg-white p-6 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-[#E6F5F8] flex items-center justify-center"><Smartphone className="h-7 w-7 text-[#0E7490]" /></div>
        <h2 className="mt-4 text-lg font-bold text-[#0A1128]">Mode Ujian (Layar Terkunci)</h2>
        <p className="mt-2 text-sm text-[#475569]">
          {standalone ? "Mode Aplikasi aktif — tampilan penuh tanpa bilah browser." : ios ? "iPhone/Safari tidak mendukung layar penuh untuk halaman web." : inApp ? "Browser di dalam aplikasi ini tidak mendukung layar penuh." : "Browser ini tidak mendukung layar penuh."} Ujian tetap berjalan dalam mode layar terkunci. Berpindah tab/aplikasi, menutup layar, atau membuka notifikasi akan dihitung pelanggaran{max ? ` (maks ${max} kali, lalu otomatis dikumpulkan)` : ""}.
        </p>
        {!standalone && <div className="mt-3 rounded-md bg-[#FEF3C7] text-[#92400E] text-xs px-3 py-2 text-left" data-testid="pseudo-fullscreen-recommend">
          Disarankan memakai <b>Google Chrome</b> di <b>Android</b> atau <b>laptop/PC</b> agar mode layar penuh aktif sepenuhnya.
          {ios ? " Di iPhone: pasang Binara ke Layar Utama & aktifkan mode Jangan Ganggu." : ""}
        </div>}
        <Button onClick={onStart} className="mt-5 w-full h-12 rounded-md bg-[#0E7490] hover:bg-[#0B5C74] text-base" data-testid="pseudo-fullscreen-start">
          <Maximize className="h-5 w-5" /> Saya Mengerti, Mulai Ujian
        </Button>
      </div>
    </div>
  );
}

export function SplitScreenOverlay() {
  return (
    <div className="fixed inset-0 z-[65] bg-[#0A1128]/95 flex items-center justify-center p-4 overflow-y-auto" data-testid="split-screen-overlay">
      <div className="max-w-sm w-full rounded-2xl bg-white p-5 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-red-50 flex items-center justify-center"><ShieldAlert className="h-6 w-6 text-red-600" /></div>
        <h2 className="mt-3 text-base font-bold text-[#0A1128]">Layar Terbagi Terdeteksi</h2>
        <p className="mt-2 text-sm text-[#475569]">Tutup layar terbagi / jendela mengambang dan kembalikan Try Out ke layar penuh untuk melanjutkan. Pelanggaran ini sudah tercatat.</p>
      </div>
    </div>
  );
}
