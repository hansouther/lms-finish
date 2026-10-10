import { useEffect, useState } from "react";
import { Library, Loader2, BookMarked, Gauge, FileDown } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const ALL = "__all";
const COMP = { numerasi: "Numerasi", literasi: "Literasi", umum: "Umum" };
const DIFF = { mudah: ["Mudah", "#10B981"], sedang: ["Sedang", "#C9A227"], sulit: ["Sulit", "#EF4444"] };
const EMPTY_F = { bidang: ALL, materi: ALL, competency: ALL, difficulty: ALL };
const strip = (t) => (t || "").replace(/\s+/g, " ").slice(0, 160);

function FilterSelect({ value, onChange, placeholder, options, testid }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9" data-testid={testid}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function BankRow({ x, checked, onToggle }) {
  const [dl, dc] = DIFF[x.difficulty] || DIFF.sedang;
  return (
    <label className="flex items-start gap-2 px-3 py-2.5 border-t border-[#E2E8F0] first:border-t-0 cursor-pointer hover:bg-[#F8FAFC]" data-testid={`bank-row-${x.id}`}>
      <Checkbox checked={checked} onCheckedChange={(v) => onToggle([x.id], !!v)} className="mt-0.5" data-testid={`bank-q-${x.id}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#0A1128]">{strip(x.text)}</p>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded-full border border-[#E2E8F0] px-2 py-0.5 text-[#475569]">{x.bidang || "Tanpa bidang"}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#0A1128]/5 px-2 py-0.5 text-[#0A1128]"><BookMarked className="h-3 w-3" />{x.materi || "Tanpa materi"}</span>
          <span className="rounded-full bg-[#E6F5F8] px-2 py-0.5 text-[#0E7490]">{COMP[x.competency] || "Umum"}</span>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ color: dc, backgroundColor: `${dc}1A` }}><Gauge className="h-3 w-3" />{dl}</span>
        </div>
      </div>
    </label>
  );
}

export default function QuestionBankDialog({ tryoutId, open, onOpenChange, onCopied }) {
  const [data, setData] = useState(null);
  const [f, setF] = useState(EMPTY_F);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setPicked(new Set()); setF(EMPTY_F); setQ(""); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const params = { exclude: tryoutId, q: q || undefined };
    Object.entries(f).forEach(([k, v]) => { if (v !== ALL) params[k] = v; });
    setData(null);
    const h = setTimeout(() => api.get("/admin/question-bank", { params }).then(({ data: d }) => setData(d)).catch((e) => toast.error(apiError(e))), 250);
    return () => clearTimeout(h);
  }, [open, tryoutId, f, q]);

  const setK = (k) => (v) => setF((p) => ({ ...p, [k]: v, ...(k === "bidang" ? { materi: ALL } : {}) }));
  const toggle = (ids, on) => setPicked((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const facets = data?.facets || { bidang: [], materi: {} };
  const materiOpts = f.bidang !== ALL ? facets.materi[f.bidang] || [] : [...new Set(Object.values(facets.materi).flat())].sort();
  const items = data?.items || [];
  const allChecked = items.length > 0 && items.every((x) => picked.has(x.id));

  const [exporting, setExporting] = useState(false);
  const exportXlsx = async () => {
    setExporting(true);
    try {
      const params = { q: q || undefined };
      Object.entries(f).forEach(([k, v]) => { if (v !== ALL) params[k] = v; });
      const res = await api.get("/admin/question-bank/export", { params, responseType: "blob" });
      const name = (res.headers["content-disposition"] || "").match(/filename=([^;]+)/)?.[1] || "bank_soal.xlsx";
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Gagal mengekspor bank soal"); }
    finally { setExporting(false); }
  };

  const copy = async () => {
    setBusy(true);
    try {
      const { data: r } = await api.post(`/admin/tryouts/${tryoutId}/questions/copy`, { question_ids: [...picked] });
      toast.success(`${r.copied} soal berhasil disalin ke Try Out ini`);
      onOpenChange(false); onCopied();
    } catch (e) { toast.error(apiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" aria-describedby={undefined} data-testid="question-bank-dialog">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Library className="h-5 w-5 text-[#0E7490]" /> Bank Soal — saring berdasarkan Bidang & Materi</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <FilterSelect value={f.bidang} onChange={setK("bidang")} placeholder="Semua bidang" options={facets.bidang.map((b) => [b, b])} testid="bank-filter-bidang" />
          <FilterSelect value={f.materi} onChange={setK("materi")} placeholder="Semua materi" options={materiOpts.map((m) => [m, m])} testid="bank-filter-materi" />
          <FilterSelect value={f.competency} onChange={setK("competency")} placeholder="Semua kompetensi" options={Object.entries(COMP)} testid="bank-filter-competency" />
          <FilterSelect value={f.difficulty} onChange={setK("difficulty")} placeholder="Semua tingkat" options={Object.entries(DIFF).map(([k, v]) => [k, v[0]])} testid="bank-filter-difficulty" />
        </div>
        <Input placeholder="Cari teks soal..." value={q} onChange={(e) => setQ(e.target.value)} data-testid="question-bank-search" />
        <div className="flex items-center justify-between text-xs text-[#475569]">
          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={allChecked} onCheckedChange={(v) => toggle(items.map((x) => x.id), !!v)} data-testid="bank-select-all" /> Pilih semua hasil</label>
          <span data-testid="bank-result-count">{data ? `${items.length} soal ditemukan` : "Memuat..."}</span>
        </div>
        <div className="flex-1 min-h-[200px] overflow-y-auto rounded-xl border border-[#E2E8F0]">
          {!data ? <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#0E7490]" /></div>
            : !items.length ? <p className="py-10 text-center text-sm text-[#94A3B8]">Tidak ada soal yang cocok dengan filter.</p>
            : items.map((x) => <BankRow key={x.id} x={x} checked={picked.has(x.id)} onToggle={toggle} />)}
        </div>
        <DialogFooter className="sm:justify-between gap-2">
          <Button variant="outline" onClick={exportXlsx} disabled={exporting} className="rounded-full" data-testid="question-bank-export">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Ekspor Excel (sesuai filter, semua Try Out)
          </Button>
          <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={copy} disabled={!picked.size || busy} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="question-bank-copy">Salin {picked.size || ""} Soal</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
