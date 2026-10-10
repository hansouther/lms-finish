import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Pencil, Trash2, Loader2, RefreshCw, Upload, CopyX } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const FIELDS = [
  ["type", "Tipe (single/multiple/truefalse/truefalse_multi/essay)"], ["points", "Poin"],
  ["option_a", "Opsi A"], ["option_b", "Opsi B"], ["option_c", "Opsi C"], ["option_d", "Opsi D"], ["option_e", "Opsi E"],
  ["correct", "Kunci (A / A;C / benar / B;S;B / teks|teks)"], ["competency", "Kompetensi"], ["tingkat", "Tingkat"],
  ["bidang", "Bidang"], ["materi", "Materi"], ["gambar", "Gambar soal (URL)"], ["gambar_pembahasan", "Gambar pembahasan (URL)"],
  ["label_benar", "Label benar"], ["label_salah", "Label salah"],
];

function RowEditor({ row, onCancel, onSave }) {
  const [r, setR] = useState(row);
  const set = (k) => (e) => setR((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div className="space-y-3" data-testid="import-row-editor">
      <div><Label>Teks soal</Label><Textarea value={r.text || ""} onChange={set("text")} rows={3} className="mt-1 font-mono2 text-sm" data-testid="row-edit-text" /></div>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(([k, l]) => (
          <div key={k}><Label className="text-xs">{l}</Label><Input value={r[k] || ""} onChange={set(k)} className="mt-1 h-9" data-testid={`row-edit-${k}`} /></div>
        ))}
      </div>
      <div><Label>Pembahasan</Label><Textarea value={r.pembahasan || ""} onChange={set("pembahasan")} rows={3} className="mt-1 font-mono2 text-sm" data-testid="row-edit-pembahasan" /></div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={() => onSave(r)} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="row-edit-save">Simpan & Periksa</Button>
      </div>
    </div>
  );
}

function StatusCell({ x }) {
  if (x.duplicate) return <span className="flex items-start gap-1 text-xs text-[#7C3AED]"><CopyX className="h-3.5 w-3.5 mt-0.5 shrink-0" />{x.duplicate}</span>;
  if (!x.ok) return <span className="flex items-start gap-1 text-xs text-red-600"><XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{x.error}</span>;
  if (x.warnings?.length) return <span className="flex items-start gap-1 text-xs text-[#C9A227]"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{x.warnings.join("; ")}</span>;
  return <span className="flex items-center gap-1 text-xs text-[#10B981]"><CheckCircle2 className="h-3.5 w-3.5" /> Siap diimpor</span>;
}

export default function ImportPreviewDialog({ tryoutId, preview, onClose, onImported }) {
  const [data, setData] = useState(preview);
  const [editIdx, setEditIdx] = useState(null);
  const [busy, setBusy] = useState(false);

  const revalidate = async (rows) => {
    setBusy(true);
    try { const { data: d } = await api.post("/admin/questions/import/validate", { rows }, { params: { tryout_id: tryoutId } }); setData(d); }
    catch (e) { toast.error(apiError(e)); }
    finally { setBusy(false); }
  };
  const rawRows = () => data.rows.map((x) => x.raw);
  const saveRow = (r) => { const rows = rawRows(); rows[editIdx] = r; setEditIdx(null); revalidate(rows); };
  const removeRow = (i) => revalidate(rawRows().filter((_, j) => j !== i));
  const close = () => onClose();

  const doImport = async () => {
    setBusy(true);
    try {
      const rows = data.rows.filter((x) => x.ok).map((x) => x.raw);
      const { data: res } = await api.post(`/admin/tryouts/${tryoutId}/questions/import-rows`, { rows });
      toast.success(`${res.imported} soal berhasil diimpor`);
      if (res.duplicates?.length) toast.info(`${res.duplicates.length} soal sama sudah ada, tidak dimasukkan. ${res.duplicates[0]}`);
      close(); onImported();
    } catch (e) { toast.error(apiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col" aria-describedby={undefined} data-testid="import-preview-dialog">
        <DialogHeader><DialogTitle>Pratinjau Impor Soal</DialogTitle></DialogHeader>
        {(editIdx !== null ? (
          <div className="overflow-y-auto pr-1"><p className="mb-2 text-sm text-[#475569]">Perbaiki baris {editIdx + 2}</p><RowEditor row={data.rows[editIdx].raw} onCancel={() => setEditIdx(null)} onSave={saveRow} /></div>
        ) : (<>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-[#ECFDF5] px-3 py-1 font-semibold text-[#10B981]" data-testid="import-valid-count">{data.valid} siap</span>
            <span className={`rounded-full px-3 py-1 font-semibold ${data.invalid ? "bg-red-50 text-red-600" : "bg-[#EFF6F8] text-[#94A3B8]"}`} data-testid="import-invalid-count">{data.invalid} bermasalah</span>
            {data.duplicates > 0 && <span className="rounded-full bg-[#F3E8FF] px-3 py-1 font-semibold text-[#7C3AED]" data-testid="import-duplicate-count">{data.duplicates} duplikat (dilewati)</span>}
            {busy && <Loader2 className="h-4 w-4 animate-spin text-[#0E7490]" />}
            <Button size="sm" variant="ghost" onClick={() => revalidate(rawRows())} className="ml-auto rounded-full" data-testid="import-revalidate"><RefreshCw className="h-4 w-4" /> Periksa ulang</Button>
          </div>
          <div className="flex-1 overflow-auto rounded-xl border border-[#E2E8F0]">
            <Table>
              <TableHeader><TableRow className="bg-[#EFF6F8]">
                <TableHead className="w-14">Baris</TableHead><TableHead>Soal</TableHead><TableHead>Bidang / Materi</TableHead><TableHead className="w-64">Status</TableHead><TableHead className="w-24 text-right">Aksi</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.rows.map((x, i) => (
                  <TableRow key={i} className={x.duplicate ? "bg-[#F3E8FF]/40" : x.ok ? "" : "bg-red-50/40"} data-testid={`import-row-${i}`}>
                    <TableCell className="font-mono2 text-xs">{i + 2}</TableCell>
                    <TableCell><p className="text-xs text-[#94A3B8]">{x.raw.type} · {x.raw.points || 1} poin · kunci {x.raw.correct || "-"}</p><p className="text-sm text-[#0A1128] line-clamp-2">{x.raw.text || <i className="text-red-500">(kosong)</i>}</p></TableCell>
                    <TableCell className="text-xs text-[#475569]">{x.raw.bidang || "—"} / {x.raw.materi || "—"}{x.raw.pembahasan ? <span className="block text-[#8A6D12]">+ pembahasan</span> : null}</TableCell>
                    <TableCell data-testid={`import-row-status-${i}`}><StatusCell x={x} /></TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => setEditIdx(i)} data-testid={`import-row-edit-${i}`}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => removeRow(i)} className="hover:text-red-600" data-testid={`import-row-remove-${i}`}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>Batal</Button>
            <Button onClick={doImport} disabled={!data.valid || busy} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="import-confirm">
              <Upload className="h-4 w-4" /> Impor {data.valid} soal{data.invalid + (data.duplicates || 0) ? ` (lewati ${data.invalid + (data.duplicates || 0)} baris)` : ""}
            </Button>
          </DialogFooter>
        </>))}
      </DialogContent>
    </Dialog>
  );
}
