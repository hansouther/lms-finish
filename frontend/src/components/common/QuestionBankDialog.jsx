import { useEffect, useState } from "react";
import { Library, Loader2 } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const strip = (t) => (t || "").replace(/\s+/g, " ").slice(0, 140);

export default function QuestionBankDialog({ tryoutId, open, onOpenChange, onCopied }) {
  const [bank, setBank] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked(new Set()); setBank(null);
    api.get("/admin/question-bank", { params: { exclude: tryoutId } }).then(({ data }) => setBank(data)).catch((e) => toast.error(apiError(e)));
  }, [open, tryoutId]);

  const toggle = (ids, on) => setPicked((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const match = (x) => !q || x.text?.toLowerCase().includes(q.toLowerCase());

  const copy = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/tryouts/${tryoutId}/questions/copy`, { question_ids: [...picked] });
      toast.success(`${data.copied} soal berhasil disalin ke Try Out ini`);
      onOpenChange(false); onCopied();
    } catch (e) { toast.error(apiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" aria-describedby={undefined} data-testid="question-bank-dialog">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Library className="h-5 w-5 text-[#0E7490]" /> Ambil Soal dari Try Out Lain</DialogTitle></DialogHeader>
        <Input placeholder="Cari teks soal..." value={q} onChange={(e) => setQ(e.target.value)} data-testid="question-bank-search" />
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {!bank ? <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#0E7490]" /></div>
            : !bank.length ? <p className="py-8 text-center text-sm text-[#94A3B8]">Belum ada soal di Try Out lain.</p>
            : bank.map((t) => {
              const qs = t.questions.filter(match);
              if (!qs.length) return null;
              const all = qs.every((x) => picked.has(x.id));
              return (
                <div key={t.id} className="rounded-xl border border-[#E2E8F0]" data-testid={`bank-tryout-${t.id}`}>
                  <label className="flex items-center gap-2 bg-[#EFF6F8] px-3 py-2 rounded-t-xl cursor-pointer">
                    <Checkbox checked={all} onCheckedChange={(v) => toggle(qs.map((x) => x.id), !!v)} data-testid={`bank-select-all-${t.id}`} />
                    <span className="text-sm font-semibold text-[#0A1128]">{t.title}</span>
                    <span className="text-xs text-[#94A3B8]">{t.subject} · {t.kind === "exercise" ? "Latihan" : "Try Out"} · {qs.length} soal</span>
                  </label>
                  {qs.map((x) => (
                    <label key={x.id} className="flex items-start gap-2 px-3 py-2 border-t border-[#E2E8F0] cursor-pointer hover:bg-[#F8FAFC]">
                      <Checkbox checked={picked.has(x.id)} onCheckedChange={(v) => toggle([x.id], !!v)} className="mt-0.5" data-testid={`bank-q-${x.id}`} />
                      <span className="text-sm text-[#475569]">{strip(x.text)}</span>
                    </label>
                  ))}
                </div>
              );
            })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={copy} disabled={!picked.size || busy} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="question-bank-copy">Salin {picked.size || ""} Soal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
