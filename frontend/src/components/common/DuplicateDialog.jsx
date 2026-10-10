import { useEffect, useState } from "react";
import { CopyX, Loader2, Trash2, Wand2, AlertTriangle, BookOpenCheck } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ConfirmButton from "@/components/common/ConfirmButton";
import { toast } from "sonner";

// Extras inside the same tryout (keep the first one per tryout, prefer one with explanation)
function extrasOf(groups) {
  const ids = [];
  groups.forEach((g) => {
    const per = {};
    g.items.forEach((it) => (per[it.tryout_id] ||= []).push(it));
    Object.values(per).forEach((list) => {
      if (list.length < 2) return;
      const keep = list.find((x) => x.has_explanation) || list[0];
      list.forEach((x) => x.id !== keep.id && ids.push(x.id));
    });
  });
  return ids;
}

function Group({ g, gi, picked, toggle }) {
  return (
    <div className={`rounded-xl border ${g.same_tryout ? "border-[#7C3AED]/40" : "border-[#E2E8F0]"}`} data-testid={`dup-group-${gi}`}>
      <div className="flex items-start justify-between gap-3 bg-[#F8FAFC] px-3 py-2 rounded-t-xl">
        <p className="text-sm text-[#0A1128] line-clamp-2">{g.text}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${g.same_tryout ? "bg-[#F3E8FF] text-[#7C3AED]" : "bg-[#EFF6F8] text-[#475569]"}`}>
          {g.count}x {g.same_tryout ? "· ganda di Try Out yang sama" : "· dipakai di beberapa Try Out"}
        </span>
      </div>
      {g.items.map((it) => (
        <label key={it.id} className="flex items-center gap-2 px-3 py-2 border-t border-[#E2E8F0] cursor-pointer hover:bg-[#F8FAFC] text-sm" data-testid={`dup-item-${it.id}`}>
          <Checkbox checked={picked.has(it.id)} onCheckedChange={() => toggle(it.id)} data-testid={`dup-check-${it.id}`} />
          <span className="font-medium text-[#0A1128]">{it.tryout_title}</span>
          <span className="text-xs text-[#94A3B8]">soal #{it.order || "-"} · {it.bidang || "—"} / {it.materi || "—"}</span>
          {it.has_explanation && <BookOpenCheck className="h-3.5 w-3.5 text-[#C9A227]" title="Punya pembahasan" />}
          {it.tryout_has_results && <span className="ml-auto flex items-center gap-1 text-[11px] text-[#C9A227]"><AlertTriangle className="h-3 w-3" /> Try Out sudah ada hasil</span>}
        </label>
      ))}
    </div>
  );
}

export default function DuplicateDialog({ open, onOpenChange, onChanged }) {
  const [data, setData] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);

  const load = () => { setData(null); api.get("/admin/question-bank/duplicates").then(({ data: d }) => setData(d)).catch((e) => toast.error(apiError(e))); };
  useEffect(() => { if (open) { setPicked(new Set()); load(); } }, [open]);

  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const autoPick = () => { const ids = extrasOf(data.groups); setPicked(new Set(ids)); toast.info(ids.length ? `${ids.length} soal ganda dipilih (1 soal disisakan per Try Out)` : "Tidak ada soal ganda di dalam Try Out yang sama"); };
  const remove = async () => {
    setBusy(true);
    try {
      const { data: r } = await api.post("/admin/questions/bulk-delete", { question_ids: [...picked] });
      toast.success(`${r.deleted} soal duplikat dihapus`);
      setPicked(new Set()); load(); onChanged?.();
    } catch (e) { toast.error(apiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" aria-describedby={undefined} data-testid="duplicate-dialog">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><CopyX className="h-5 w-5 text-[#7C3AED]" /> Cek Soal Duplikat</DialogTitle></DialogHeader>
        <p className="text-sm text-[#475569]">Soal dianggap sama jika teks dan pilihan jawabannya sama. Soal ganda di Try Out yang sama sebaiknya dirapikan; soal yang sama di Try Out berbeda biasanya hasil salin bank soal dan boleh dibiarkan.</p>
        {data && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-[#EFF6F8] px-3 py-1 font-semibold text-[#475569]" data-testid="dup-total">{data.total_groups} kelompok soal sama</span>
            <span className="rounded-full bg-[#F3E8FF] px-3 py-1 font-semibold text-[#7C3AED]" data-testid="dup-same-tryout">{data.same_tryout_groups} ganda di Try Out yang sama</span>
            <Button size="sm" variant="outline" onClick={autoPick} className="ml-auto rounded-full" data-testid="dup-auto-pick"><Wand2 className="h-4 w-4" /> Rapikan otomatis (sisakan 1 per Try Out)</Button>
          </div>
        )}
        <div className="flex-1 min-h-[200px] overflow-y-auto space-y-3 pr-1">
          {!data ? <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#7C3AED]" /></div>
            : !data.groups.length ? <p className="py-10 text-center text-sm text-[#94A3B8]" data-testid="dup-empty">Tidak ada soal duplikat. Bank soal sudah rapi.</p>
            : data.groups.map((g, i) => <Group key={i} g={g} gi={i} picked={picked} toggle={toggle} />)}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          <ConfirmButton onConfirm={remove} title={`Hapus ${picked.size} soal?`} confirmLabel="Hapus" description="Soal terpilih dihapus permanen dari Try Out masing-masing. Nilai siswa yang sudah dikumpulkan tidak berubah."
            trigger={<Button disabled={!picked.size || busy} className="bg-red-600 hover:bg-red-700" data-testid="dup-delete"><Trash2 className="h-4 w-4" /> Hapus {picked.size || ""} Terpilih</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
