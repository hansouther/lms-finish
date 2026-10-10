import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Trash2, ArrowLeft, HelpCircle, CheckCircle2, X, Upload, FileDown, Tag, FileSpreadsheet, Gauge, ImagePlus, Sigma, Loader2, Library } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api, { apiError } from "@/lib/api";
import { Loading, Empty } from "@/components/common/States";
import ConfirmButton from "@/components/common/ConfirmButton";
import IrtBlueprintPanel from "@/components/common/IrtBlueprintPanel";
import IrtScaleCard from "@/components/common/IrtScaleCard";
import MathText, { QuestionImage } from "@/components/common/MathText";
import TfMultiEditor, { TfLabelsEditor } from "@/components/common/TfMultiEditor";
import { TfMultiAnswer } from "@/components/common/TfMulti";
import { tfLabels, parseTfMap } from "@/lib/tf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import QuestionBankDialog from "@/components/common/QuestionBankDialog";

const TYPES = [
  { v: "single", l: "Pilihan Ganda" },
  { v: "multiple", l: "Pilihan Ganda Kompleks" },
  { v: "truefalse", l: "Benar / Salah" },
  { v: "truefalse_multi", l: "Benar / Salah Majemuk (1 teks, banyak pernyataan)" },
  { v: "essay", l: "Esai (jawaban teks)" },
];
const COMPETENCIES = [
  { v: "numerasi", l: "Numerasi" },
  { v: "literasi", l: "Literasi" },
  { v: "umum", l: "Umum" },
];
const COMP_LABEL = { numerasi: "Numerasi", literasi: "Literasi", umum: "Umum" };
const COMP_COLOR = { numerasi: "#0E7490", literasi: "#C9A227", umum: "#94A3B8" };
const DIFFICULTIES = [
  { v: "mudah", l: "Mudah" },
  { v: "sedang", l: "Sedang" },
  { v: "sulit", l: "Sulit" },
];
const DIFF_LABEL = { mudah: "Mudah", sedang: "Sedang", sulit: "Sulit" };
const DIFF_COLOR = { mudah: "#10B981", sedang: "#C9A227", sulit: "#EF4444" };
const effDiff = (q) => (q.irt_calibrated && q.irt_b != null) ? (q.irt_b < -0.5 ? "mudah" : q.irt_b > 0.5 ? "sulit" : "sedang") : (q.difficulty_label || "sedang");
const newOpts = () => [{ id: "o1", text: "" }, { id: "o2", text: "" }, { id: "o3", text: "" }, { id: "o4", text: "" }];
const EMPTY = { type: "single", text: "", points: 20, options: newOpts(), correct: [], essay: "", competency: "umum", difficulty: "sedang", image_url: null, tf_labels: ["Benar", "Salah"], tfKey: {} };

export default function TryoutBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: questions, loading, refetch } = useFetch(`/admin/tryouts/${id}/questions`);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const fileRef = useRef();
  const imgRef = useRef();
  const [imgUploading, setImgUploading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkComp, setBulkComp] = useState("numerasi");
  const [bulkDiff, setBulkDiff] = useState("sedang");
  const [blueprintVersion, setBlueprintVersion] = useState(0);
  const [calibrating, setCalibrating] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const bumpBlueprint = () => setBlueprintVersion((v) => v + 1);

  const toggleSelect = (qid) => setSelected((s) => { const n = new Set(s); n.has(qid) ? n.delete(qid) : n.add(qid); return n; });
  const allIds = (questions || []).map((q) => q.id);
  const allSelected = allIds.length > 0 && selected.size === allIds.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));
  const applyBulk = async () => {
    try {
      const { data } = await api.post(`/admin/tryouts/${id}/questions/bulk-competency`, { question_ids: [...selected], competency: bulkComp });
      toast.success(`${data.updated} soal ditandai ${COMP_LABEL[bulkComp]}`);
      setSelected(new Set());
      refetch();
    } catch (e) { toast.error(apiError(e)); }
  };
  const applyBulkDiff = async () => {
    try {
      const { data } = await api.post(`/admin/tryouts/${id}/questions/bulk-difficulty`, { question_ids: [...selected], difficulty_label: bulkDiff });
      toast.success(`${data.updated} soal ditandai tingkat ${DIFF_LABEL[bulkDiff]}`);
      setSelected(new Set());
      refetch(); bumpBlueprint();
    } catch (e) { toast.error(apiError(e)); }
  };

  const calibrateIrt = async () => {
    setCalibrating(true);
    try {
      const { data } = await api.post(`/admin/tryouts/${id}/calibrate`);
      if (data.calibrated > 0) toast.success(`Kalibrasi IRT selesai: ${data.calibrated} soal terkalibrasi dari ${data.attempts_scored} hasil peserta`);
      else toast.info(`Belum cukup data jawaban untuk kalibrasi (butuh ≥ ${data.min_responses_required} responden per soal)`);
      refetch(); bumpBlueprint();
    } catch (e) { toast.error(apiError(e)); }
    finally { setCalibrating(false); }
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get("/admin/questions/template", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url; a.download = "template_soal.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Gagal mengunduh template"); }
  };
  const downloadTemplateXlsx = async () => {
    try {
      const res = await api.get("/admin/questions/template.xlsx", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url; a.download = "template_soal.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Gagal mengunduh template Excel"); }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post(`/admin/tryouts/${id}/questions/import`, fd);
      toast.success(`${data.imported} soal berhasil diimpor`);
      if (data.errors?.length) toast.error(`${data.errors.length} baris gagal. ${data.errors[0]}`);
      refetch(); bumpBlueprint();
    } catch (err) { toast.error(apiError(err)); }
    e.target.value = "";
  };

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (q) => {
    setForm({
      type: q.type, text: q.text, points: q.points,
      options: q.options?.length ? q.options : newOpts(),
      correct: q.type === "essay" ? [] : q.correct_answers,
      essay: q.type === "essay" ? (q.correct_answers || []).join(", ") : "",
      competency: q.competency || "umum",
      difficulty: q.difficulty_label || "sedang",
      image_url: q.image_url || null,
      tf_labels: tfLabels(q),
      tfKey: q.type === "truefalse_multi" ? parseTfMap(q.correct_answers) : {},
    });
    setEditId(q.id); setOpen(true);
  };

  const setOpt = (i, val) => setForm((f) => ({ ...f, options: f.options.map((o, idx) => idx === i ? { ...o, text: val } : o) }));
  const addOpt = () => setForm((f) => ({ ...f, options: [...f.options, { id: `o${f.options.length + 1}`, text: "" }] }));
  const removeOpt = (oid) => setForm((f) => ({ ...f, options: f.options.filter((o) => o.id !== oid), correct: f.correct.filter((c) => c !== oid) }));
  const toggleMulti = (oid) => setForm((f) => ({ ...f, correct: f.correct.includes(oid) ? f.correct.filter((c) => c !== oid) : [...f.correct, oid] }));

  const save = async () => {
    let correct_answers = [];
    let options = [];
    if (form.type === "single" || form.type === "multiple") {
      options = form.options.filter((o) => o.text.trim());
      correct_answers = form.correct.filter((c) => options.some((o) => o.id === c));
      if (options.length < 2) return toast.error("Minimal 2 pilihan jawaban");
      if (correct_answers.length === 0) return toast.error("Tentukan kunci jawaban");
    } else if (form.type === "truefalse") {
      if (!form.correct[0]) return toast.error("Pilih kunci Benar/Salah");
      correct_answers = [form.correct[0]];
    } else if (form.type === "truefalse_multi") {
      options = form.options.filter((o) => o.text.trim());
      if (options.length < 2) return toast.error("Minimal 2 pernyataan");
      if (options.some((o) => !form.tfKey[o.id])) return toast.error("Tentukan kunci untuk setiap pernyataan");
      correct_answers = options.map((o) => `${o.id}:${form.tfKey[o.id]}`);
    } else {
      correct_answers = form.essay.split(",").map((s) => s.trim()).filter(Boolean);
      if (!correct_answers.length) return toast.error("Isi kunci jawaban esai");
    }
    const payload = { type: form.type, text: form.text, options, correct_answers, points: parseInt(form.points || 1, 10), order: 0, competency: form.competency || "umum", difficulty_label: form.difficulty || "sedang", image_url: form.image_url || null, tf_labels: form.type.startsWith("truefalse") ? form.tf_labels.map((l, i) => l.trim() || ["Benar", "Salah"][i]) : null };
    try {
      if (editId) await api.put(`/admin/questions/${editId}`, payload);
      else await api.post(`/admin/tryouts/${id}/questions`, payload);
      toast.success("Soal tersimpan"); setOpen(false); refetch(); bumpBlueprint();
    } catch (e) { toast.error(apiError(e)); }
  };
  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Ukuran gambar maksimal 5 MB");
    const fd = new FormData();
    fd.append("file", file);
    setImgUploading(true);
    try {
      const { data } = await api.post("/questions/upload-image", fd);
      setForm((f) => ({ ...f, image_url: data.url }));
      toast.success("Gambar ditambahkan");
    } catch (err) { toast.error(apiError(err)); }
    finally { setImgUploading(false); }
  };
  const del = async (qid) => { try { await api.delete(`/admin/questions/${qid}`); toast.success("Soal dihapus"); refetch(); bumpBlueprint(); } catch (e) { toast.error(apiError(e)); } };

  const typeLabel = (t) => TYPES.find((x) => x.v === t)?.l || t;

  return (
    <div data-testid="tryout-builder">
      <Button variant="ghost" onClick={() => navigate("/admin/tryouts")} className="mb-3 text-[#475569] hover:text-[#0E7490] hover:bg-[#E6F5F8]"><ArrowLeft className="h-4 w-4" /> Kembali</Button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0A1128]">Kelola Bank Soal</h1>
          <p className="text-sm text-[#475569] mt-1">{questions?.length || 0} soal · Total {(questions || []).reduce((a, q) => a + (q.points || 0), 0)} poin</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={downloadTemplate} className="rounded-full hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid="download-template"><FileDown className="h-4 w-4" /> Template CSV</Button>
          <Button variant="outline" onClick={downloadTemplateXlsx} className="rounded-full hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid="download-template-xlsx"><FileSpreadsheet className="h-4 w-4" /> Template Excel</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="rounded-full hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid="import-questions"><Upload className="h-4 w-4" /> Impor CSV/Excel/ZIP</Button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.zip" className="hidden" onChange={onImport} data-testid="import-file" />
          <Button variant="outline" onClick={() => setBankOpen(true)} className="rounded-full hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid="open-question-bank"><Library className="h-4 w-4" /> Ambil dari Bank Soal</Button>
          <QuestionBankDialog tryoutId={id} open={bankOpen} onOpenChange={setBankOpen} onCopied={() => { refetch(); bumpBlueprint(); }} />
          <Button onClick={openNew} className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="add-question-btn"><Plus className="h-4 w-4" /> Tambah Soal</Button>
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <IrtScaleCard tryoutId={id} onSaved={bumpBlueprint} />
        <IrtBlueprintPanel tryoutId={id} version={blueprintVersion} onCalibrate={calibrateIrt} calibrating={calibrating} />
      </div>


      {loading ? <Loading /> : !questions?.length ? (
        <Empty icon={HelpCircle} title="Belum ada soal" desc="Tambahkan soal pertama untuk Try Out ini." action={<Button onClick={openNew} className="rounded-full bg-[#0E7490]"><Plus className="h-4 w-4" /> Tambah Soal</Button>} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-[#E2E8F0] p-3" data-testid="bulk-toolbar">
            <label className="flex items-center gap-2 text-sm font-medium text-[#475569] cursor-pointer">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} data-testid="select-all-questions" /> Pilih Semua
            </label>
            {selected.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <span className="text-sm font-semibold text-[#0A1128]" data-testid="bulk-count">{selected.size} soal dipilih</span>
                <span className="text-xs text-[#94A3B8]">kompetensi</span>
                <Select value={bulkComp} onValueChange={setBulkComp}>
                  <SelectTrigger className="h-9 w-32" data-testid="bulk-competency-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{COMPETENCIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" onClick={applyBulk} className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="apply-bulk-competency"><Tag className="h-4 w-4" /> Terapkan</Button>
                <span className="text-xs text-[#94A3B8] ml-1">tingkat</span>
                <Select value={bulkDiff} onValueChange={setBulkDiff}>
                  <SelectTrigger className="h-9 w-32" data-testid="bulk-difficulty-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{DIFFICULTIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" onClick={applyBulkDiff} className="rounded-full bg-[#C9A227] hover:bg-[#b08f1f] text-[#0A1128]" data-testid="apply-bulk-difficulty"><Gauge className="h-4 w-4" /> Terapkan</Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="rounded-full">Batal</Button>
              </div>
            ) : (
              <span className="ml-auto text-xs text-[#94A3B8]">Pilih beberapa soal untuk menandai kompetensi (Numerasi/Literasi) & tingkat kesulitan IRT (Mudah/Sedang/Sulit) sekaligus.</span>
            )}
          </div>
          {questions.map((q, i) => (
            <div key={q.id} className={`bg-white rounded-xl border p-5 transition-colors duration-200 ${selected.has(q.id) ? "border-[#0E7490] ring-1 ring-[#0E7490]/30" : "border-[#E2E8F0]"}`} data-testid={`question-${q.id}`}>
              <div className="flex items-start gap-3">
                <Checkbox checked={selected.has(q.id)} onCheckedChange={() => toggleSelect(q.id)} className="mt-1 shrink-0" data-testid={`select-question-${q.id}`} />
                <div className="flex-1 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#E6F5F8] text-[#0E7490] px-2.5 py-0.5 text-xs font-bold">#{i + 1}</span>
                    <span className="text-xs text-[#94A3B8]">{typeLabel(q.type)} · {q.points} poin</span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: `${COMP_COLOR[q.competency || "umum"]}1A`, color: COMP_COLOR[q.competency || "umum"] }} data-testid={`question-competency-${q.id}`}>{COMP_LABEL[q.competency || "umum"]}</span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold inline-flex items-center gap-1" style={{ backgroundColor: `${DIFF_COLOR[effDiff(q)]}1A`, color: DIFF_COLOR[effDiff(q)] }} data-testid={`question-difficulty-${q.id}`}><Gauge className="h-3 w-3" />{DIFF_LABEL[effDiff(q)]}</span>
                    {q.irt_calibrated && q.irt_b != null && (
                      <span className="rounded-full bg-[#0A1128] text-white/90 px-2 py-0.5 text-[10px] font-mono" data-testid={`question-irt-${q.id}`} title="Parameter IRT 3PL (daya pembeda a, kesulitan b, tebakan c)">IRT a={Number(q.irt_a).toFixed(2)} b={Number(q.irt_b).toFixed(2)} c={Number(q.irt_c).toFixed(2)}</span>
                    )}
                  </div>
                  <MathText as="div" text={q.text} className="mt-2 block text-[#0A1128]" data-testid={`question-text-${q.id}`} />
                  <QuestionImage src={q.image_url} className="mt-3 max-h-56" testid={`question-image-${q.id}`} />
                  <div className="mt-3 space-y-1">
                    {q.type === "essay" ? (
                      <p className="text-sm text-[#10B981]">Kunci: {q.correct_answers.join(" / ")}</p>
                    ) : q.type === "truefalse" ? (
                      <p className="text-sm text-[#10B981]">Kunci: {tfLabels(q)[q.correct_answers[0] === "true" ? 0 : 1]}</p>
                    ) : q.type === "truefalse_multi" ? (
                      q.options.map((o, i) => {
                        const k = parseTfMap(q.correct_answers)[o.id];
                        return (
                          <div key={o.id} className="text-sm flex items-center gap-2 text-[#475569]" data-testid={`question-stmt-${q.id}-${o.id}`}>
                            <span className="font-mono2 text-xs text-[#94A3B8] w-4">{i + 1}.</span> <MathText text={o.text} />
                            <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${k === "true" ? "bg-[#ECFDF5] text-[#10B981]" : "bg-red-50 text-[#EF4444]"}`}>{tfLabels(q)[k === "true" ? 0 : 1]}</span>
                          </div>
                        );
                      })
                    ) : (
                      q.options.map((o) => (
                        <div key={o.id} className={`text-sm flex items-center gap-2 ${q.correct_answers.includes(o.id) ? "text-[#10B981] font-medium" : "text-[#475569]"}`}>
                          {q.correct_answers.includes(o.id) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5 rounded-full border border-[#CBD5E1]" />} <MathText text={o.text} />
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(q)} className="hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid={`edit-question-${q.id}`}><Plus className="h-4 w-4 rotate-45" /></Button>
                  <ConfirmButton onConfirm={() => del(q.id)} trigger={<Button variant="ghost" size="icon" className="hover:bg-red-50 hover:text-red-600" data-testid={`delete-question-${q.id}`}><Trash2 className="h-4 w-4" /></Button>} />
                </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{editId ? "Edit Soal" : "Tambah Soal"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tipe Soal</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v, correct: [] }))}>
                  <SelectTrigger className="mt-1.5" data-testid="question-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Poin</Label><Input type="number" value={form.points} onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))} className="mt-1.5" data-testid="question-points" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Kompetensi (AKM)</Label>
                <Select value={form.competency} onValueChange={(v) => setForm((f) => ({ ...f, competency: v }))}>
                  <SelectTrigger className="mt-1.5" data-testid="question-competency"><SelectValue /></SelectTrigger>
                  <SelectContent>{COMPETENCIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Tingkat Kesulitan (IRT)</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm((f) => ({ ...f, difficulty: v }))}>
                  <SelectTrigger className="mt-1.5" data-testid="question-difficulty"><SelectValue /></SelectTrigger>
                  <SelectContent>{DIFFICULTIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <p className="-mt-2 text-xs text-[#94A3B8]">Kompetensi untuk laporan Numerasi vs Literasi. Tingkat kesulitan jadi acuan komposisi IRT (parameter a/b/c dikalibrasi otomatis dari jawaban peserta).</p>
            <div><Label>Pertanyaan</Label><Textarea value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} className="mt-1.5 font-mono2 text-sm" rows={4} data-testid="question-text" placeholder="Contoh: Hasil dari $\frac{1}{2} + \frac{1}{3}$ adalah ..." />
              <p className="mt-1 text-xs text-[#94A3B8] flex items-start gap-1"><Sigma className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>Rumus: tulis di antara <code>$...$</code> (sebaris) atau <code>$$...$$</code> (baris sendiri). Contoh <code>{"$x^2$"}</code>, <code>{"$\\sqrt{2}$"}</code>, <code>{"$\\frac{a}{b}$"}</code>. Ketik <code>\$</code> untuk simbol dolar biasa. Berlaku juga di pilihan jawaban.</span></p>
            </div>

            <div data-testid="question-image-field">
              <Label>Gambar Soal <span className="text-[#94A3B8] font-normal">(opsional)</span></Label>
              <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" className="hidden" onChange={onPickImage} data-testid="question-image-input" />
              {form.image_url ? (
                <div className="mt-2 flex items-start gap-3">
                  <QuestionImage src={form.image_url} className="max-h-48" testid="question-image-preview" />
                  <div className="flex flex-col gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => imgRef.current?.click()} disabled={imgUploading} className="rounded-full" data-testid="question-image-replace">{imgUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Ganti</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, image_url: null }))} className="rounded-full text-red-600 hover:bg-red-50" data-testid="question-image-remove"><X className="h-4 w-4" /> Hapus</Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="outline" onClick={() => imgRef.current?.click()} disabled={imgUploading} className="mt-1.5 w-full border-dashed rounded-xl h-16 text-[#475569] hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid="question-image-upload">
                  {imgUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {imgUploading ? "Mengunggah..." : "Tambah gambar (PNG/JPG/GIF/WEBP/SVG, maks 5 MB)"}
                </Button>
              )}
            </div>

            {(form.type === "single" || form.type === "multiple") && (
              <div>
                <Label>Pilihan Jawaban <span className="text-[#94A3B8] font-normal">(tandai kunci di kiri)</span></Label>
                <div className="mt-2 space-y-2">
                  {form.options.map((o, i) => (
                    <div key={o.id} className="flex items-center gap-2" data-testid={`opt-row-${o.id}`}>
                      {form.type === "single" ? (
                        <button type="button" onClick={() => setForm((f) => ({ ...f, correct: [o.id] }))} data-testid={`mark-correct-${o.id}`}
                          className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 ${form.correct[0] === o.id ? "border-[#10B981] bg-[#10B981]" : "border-[#CBD5E1]"}`}>
                          {form.correct[0] === o.id && <CheckCircle2 className="h-4 w-4 text-white" />}
                        </button>
                      ) : (
                        <button type="button" onClick={() => toggleMulti(o.id)} data-testid={`mark-correct-${o.id}`}
                          className={`h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 ${form.correct.includes(o.id) ? "border-[#10B981] bg-[#10B981]" : "border-[#CBD5E1]"}`}>
                          {form.correct.includes(o.id) && <CheckCircle2 className="h-4 w-4 text-white" />}
                        </button>
                      )}
                      <Input value={o.text} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Pilihan ${i + 1}`} data-testid={`opt-input-${o.id}`} />
                      {form.options.length > 2 && <Button variant="ghost" size="icon" onClick={() => removeOpt(o.id)}><X className="h-4 w-4 text-[#94A3B8]" /></Button>}
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addOpt} className="mt-2 rounded-full" data-testid="add-option"><Plus className="h-4 w-4" /> Tambah Pilihan</Button>
              </div>
            )}

            {form.type.startsWith("truefalse") && (
              <TfLabelsEditor labels={form.tf_labels} onChange={(l) => setForm((f) => ({ ...f, tf_labels: l }))} />
            )}

            {form.type === "truefalse_multi" && (
              <TfMultiEditor statements={form.options} keyMap={form.tfKey} labels={form.tf_labels}
                onStatements={(opts) => setForm((f) => ({ ...f, options: opts }))}
                onKey={(sid, v) => setForm((f) => ({ ...f, tfKey: { ...f.tfKey, [sid]: v } }))} />
            )}

            {form.type === "truefalse" && (
              <div>
                <Label>Kunci Jawaban</Label>
                <RadioGroup value={form.correct[0] || ""} onValueChange={(v) => setForm((f) => ({ ...f, correct: [v] }))} className="mt-2 flex gap-4">
                  {[["true", form.tf_labels[0] || "Benar"], ["false", form.tf_labels[1] || "Salah"]].map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer" data-testid={`tf-${v}`}><RadioGroupItem value={v} /> {l}</label>
                  ))}
                </RadioGroup>
              </div>
            )}

            {form.type === "essay" && (
              <div>
                <Label>Kunci Jawaban (pisahkan alternatif dengan koma)</Label>
                <Input value={form.essay} onChange={(e) => setForm((f) => ({ ...f, essay: e.target.value }))} placeholder="jakarta, dki jakarta" className="mt-1.5" data-testid="essay-key" />
                <p className="mt-1 text-xs text-[#94A3B8]">Penilaian mengabaikan huruf besar/kecil & spasi di awal/akhir.</p>
              </div>
            )}

            {(form.text.trim() || form.image_url) && (
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4" data-testid="question-preview">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] mb-2">Pratinjau tampilan siswa</p>
                <MathText as="div" text={form.text} className="block text-[#0A1128]" />
                <QuestionImage src={form.image_url} className="mt-3 max-h-48" />
                {form.type === "truefalse_multi" && (
                  <div className="mt-3"><TfMultiAnswer q={{ options: form.options.filter((o) => o.text.trim()), tf_labels: form.tf_labels }} value={[]} onChange={() => {}} /></div>
                )}
                {(form.type === "single" || form.type === "multiple") && (
                  <div className="mt-3 space-y-1.5">
                    {form.options.filter((o) => o.text.trim()).map((o) => (
                      <div key={o.id} className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"><MathText text={o.text} /></div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="save-question">Simpan Soal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
