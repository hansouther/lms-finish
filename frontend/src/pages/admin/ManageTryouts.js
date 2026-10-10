import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, FileText, Settings2, BarChart3, HelpCircle, Users, Activity, CalendarClock, Shuffle, ShieldAlert } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import ConfirmButton from "@/components/common/ConfirmButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import IrtScaleFields, { EMPTY_CUSTOM, toCustomPayload, SCALE_PRESETS } from "@/components/common/IrtScaleFields";
import { formatRupiah, formatDateTime, toLocalInput, fromLocalInput } from "@/lib/format";
import { toast } from "sonner";

const EMPTY = { title: "", description: "", subject: "", duration_minutes: 60, published: false, irt_scale: "snbt", irt_scale_custom: EMPTY_CUSTOM, price: 0, start_at: "", end_at: "", shuffle_questions: false, shuffle_options: false, tab_warning_limit: 5 };
const SCHED = { upcoming: ["Belum dibuka", "#C9A227", "#FBF3DC"], open: ["Dibuka", "#10B981", "#ECFDF5"], closed: ["Ditutup", "#EF4444", "#FEF2F2"] };
const scaleLabel = (t) => (SCALE_PRESETS.find((p) => p.key === (t.irt_scale || "snbt")) || SCALE_PRESETS[0]).label;

export default function ManageTryouts() {
  const { data, loading, refetch } = useFetch("/admin/tryouts");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const openEdit = (t) => { setForm({ title: t.title, description: t.description || "", subject: t.subject, duration_minutes: t.duration_minutes, published: t.published, irt_scale: t.irt_scale || "snbt", irt_scale_custom: t.irt_scale_custom || EMPTY_CUSTOM, price: t.price || 0, start_at: toLocalInput(t.start_at), end_at: toLocalInput(t.end_at), shuffle_questions: !!t.shuffle_questions, shuffle_options: !!t.shuffle_options, tab_warning_limit: t.tab_warning_limit ?? 5 }); setEditId(t.id); setOpen(true); };

  const save = async () => {
    if (form.start_at && form.end_at && new Date(form.end_at) <= new Date(form.start_at)) return toast.error("Waktu tutup harus setelah waktu buka");
    const payload = { ...form, start_at: fromLocalInput(form.start_at), end_at: fromLocalInput(form.end_at), duration_minutes: parseInt(form.duration_minutes || 60, 10), price: Math.max(0, parseInt(form.price || 0, 10) || 0), tab_warning_limit: Math.min(20, Math.max(0, parseInt(form.tab_warning_limit, 10) || 0)), irt_scale_custom: form.irt_scale === "custom" ? toCustomPayload(form.irt_scale_custom) : null };
    try {
      if (editId) {
        const { data: res } = await api.put(`/admin/tryouts/${editId}`, payload);
        toast.success(res?.rescored ? `Try Out tersimpan · ${res.rescored} hasil peserta dihitung ulang` : "Try Out tersimpan");
      } else { await api.post("/admin/tryouts", payload); toast.success("Try Out tersimpan"); }
      setOpen(false); refetch();
    } catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { try { await api.delete(`/admin/tryouts/${id}`); toast.success("Try Out dihapus"); refetch(); } catch (e) { toast.error(apiError(e)); } };

  return (
    <div data-testid="manage-tryouts">
      <PageHeader title="Bank Soal & Try Out" subtitle="Buat paket Try Out, kelola soal & kunci jawaban, atur waktu, dan lihat hasil."
        actions={<Button onClick={openNew} className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="add-tryout-btn"><Plus className="h-4 w-4" /> Buat Try Out</Button>} />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={FileText} title="Belum ada Try Out" action={<Button onClick={openNew} className="rounded-full bg-[#0E7490]"><Plus className="h-4 w-4" /> Buat</Button>} />
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {data.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid={`tryout-${t.id}`}>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#EFF6F8] px-3 py-1 text-[11px] font-semibold text-[#475569]">{t.subject}</span>
                <span className={`text-[11px] font-semibold ${t.published ? "text-[#10B981]" : "text-[#94A3B8]"}`}>{t.published ? "Terbit" : "Draft"}</span>
              </div>
              <h3 className="mt-3 font-semibold text-[#0A1128]">{t.title}</h3>
              <div className="mt-2 flex items-center gap-4 text-xs text-[#94A3B8]">
                <span className="flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5" /> {t.question_count} soal</span>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {t.attempt_count} pengerjaan</span>
                <span>{t.duration_minutes} menit</span>
                <span className={`font-semibold ${t.price > 0 ? "text-[#C9A227]" : "text-[#10B981]"}`} data-testid={`tryout-price-badge-${t.id}`}>{t.price > 0 ? formatRupiah(t.price) : "Gratis"}</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[#475569]" data-testid={`tryout-schedule-${t.id}`}>
                <CalendarClock className="h-3.5 w-3.5 text-[#94A3B8]" />
                {t.start_at || t.end_at ? <span>{t.start_at ? formatDateTime(t.start_at) : "Kapan saja"} — {t.end_at ? formatDateTime(t.end_at) : "tanpa batas"}</span> : <span className="text-[#94A3B8]">Tanpa jadwal (selalu dibuka)</span>}
                {SCHED[t.schedule_status] && <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: SCHED[t.schedule_status][1], backgroundColor: SCHED[t.schedule_status][2] }}>{SCHED[t.schedule_status][0]}</span>}
                {t.in_progress_count > 0 && <span className="ml-1 rounded-full bg-[#E6F5F8] px-2 py-0.5 text-[10px] font-semibold text-[#0E7490]">{t.in_progress_count} sedang mengerjakan</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5"><span className="inline-flex items-center rounded-full border border-[#0E7490]/30 bg-[#E6F5F8] px-2.5 py-0.5 text-[11px] font-semibold text-[#0E7490]" data-testid={`tryout-scale-${t.id}`}>Skala IRT: {scaleLabel(t)}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] px-2.5 py-0.5 text-[11px] font-semibold text-[#475569]" data-testid={`tryout-tab-limit-badge-${t.id}`}><ShieldAlert className="h-3 w-3" /> {(t.tab_warning_limit ?? 5) > 0 ? `Maks ${t.tab_warning_limit ?? 5}x pindah tab` : "Deteksi tab nonaktif"}</span>
                {(t.shuffle_questions || t.shuffle_options) && <span className="inline-flex items-center gap-1 rounded-full border border-[#C9A227]/40 bg-[#FBF3DC] px-2.5 py-0.5 text-[11px] font-semibold text-[#8A6D12]" data-testid={`tryout-shuffle-${t.id}`}><Shuffle className="h-3 w-3" /> Acak {[t.shuffle_questions && "soal", t.shuffle_options && "pilihan"].filter(Boolean).join(" & ")}</span>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate(`/admin/tryouts/${t.id}/builder`)} className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid={`build-${t.id}`}><Settings2 className="h-4 w-4" /> Kelola Soal</Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/admin/tryouts/${t.id}/results`)} className="rounded-full hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid={`results-${t.id}`}><BarChart3 className="h-4 w-4" /> Hasil</Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/admin/tryouts/${t.id}/monitor`)} className="rounded-full hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid={`monitor-${t.id}`}><Activity className="h-4 w-4" /> Pantau Peserta</Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(t)} className="rounded-full hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid={`edit-tryout-${t.id}`}><Pencil className="h-4 w-4" /></Button>
                <ConfirmButton onConfirm={() => del(t.id)} trigger={<Button size="sm" variant="ghost" className="rounded-full hover:bg-red-50 hover:text-red-600" data-testid={`delete-tryout-${t.id}`}><Trash2 className="h-4 w-4" /></Button>} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{editId ? "Edit Try Out" : "Buat Try Out"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Judul</Label><Input value={form.title} onChange={set("title")} className="mt-1.5" data-testid="tryout-title" /></div>
            <div><Label>Deskripsi</Label><Textarea value={form.description} onChange={set("description")} className="mt-1.5" data-testid="tryout-desc" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Mata Pelajaran</Label><Input value={form.subject} onChange={set("subject")} className="mt-1.5" data-testid="tryout-subject" /></div>
              <div><Label>Durasi (menit)</Label><Input type="number" value={form.duration_minutes} onChange={set("duration_minutes")} className="mt-1.5" data-testid="tryout-duration" /></div>
            </div>
            <div className="rounded-lg border border-[#E2E8F0] p-3" data-testid="tryout-schedule-fields">
              <Label className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-[#0E7490]" /> Jadwal Try Out <span className="text-[#94A3B8] font-normal">(opsional)</span></Label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Dibuka</Label><Input type="datetime-local" value={form.start_at} onChange={set("start_at")} className="mt-1" data-testid="tryout-start-at" /></div>
                <div><Label className="text-xs">Ditutup</Label><Input type="datetime-local" value={form.end_at} onChange={set("end_at")} className="mt-1" data-testid="tryout-end-at" /></div>
              </div>
              <p className="mt-1.5 text-xs text-[#94A3B8]">Siswa hanya bisa mulai di antara waktu ini. Saat ditutup, waktu pengerjaan yang sedang berjalan ikut berakhir. Kosongkan bila tanpa batas.</p>
            </div>
            <div>
              <Label>Harga (Rp) — 0 = gratis</Label>
              <Input type="number" min="0" value={form.price} onChange={set("price")} className="mt-1.5" data-testid="tryout-price" />
              <p className="mt-1 text-xs text-[#94A3B8]">Try Out berbayar dibuka setelah siswa membayar via Midtrans (VA, QRIS, GoPay, kartu).</p>
            </div>
            <IrtScaleFields value={form.irt_scale} custom={form.irt_scale_custom} onChange={(v) => setForm((f) => ({ ...f, irt_scale: v }))} onCustomChange={(c) => setForm((f) => ({ ...f, irt_scale_custom: c }))} testIdPrefix="tryout-irt-scale" />
            <div className="rounded-lg border border-[#E2E8F0] p-3 space-y-3" data-testid="tryout-shuffle-fields">
              <Label className="flex items-center gap-1.5"><Shuffle className="h-4 w-4 text-[#0E7490]" /> Pengacakan (anti mencontek)</Label>
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-[#0A1128]">Acak urutan soal</p><p className="text-xs text-[#94A3B8]">Setiap siswa mendapat urutan soal berbeda.</p></div>
                <Switch checked={form.shuffle_questions} onCheckedChange={(v) => setForm((f) => ({ ...f, shuffle_questions: v }))} data-testid="tryout-shuffle-questions" />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-[#0A1128]">Acak urutan pilihan jawaban</p><p className="text-xs text-[#94A3B8]">Berlaku untuk Pilihan Ganda & Pilihan Ganda Kompleks.</p></div>
                <Switch checked={form.shuffle_options} onCheckedChange={(v) => setForm((f) => ({ ...f, shuffle_options: v }))} data-testid="tryout-shuffle-options" />
              </div>
            </div>
            <div className="rounded-lg border border-[#E2E8F0] p-3" data-testid="tryout-tab-limit-field">
              <Label className="flex items-center gap-1.5"><ShieldAlert className="h-4 w-4 text-[#0E7490]" /> Batas peringatan pindah tab</Label>
              <Input type="number" min="0" max="20" value={form.tab_warning_limit} onChange={set("tab_warning_limit")} className="mt-1.5 w-32" data-testid="tryout-tab-limit" />
              <p className="mt-1 text-xs text-[#94A3B8]">1–20 kali. Saat batas tercapai, Try Out otomatis dikumpulkan. Isi 0 untuk mematikan deteksi pindah tab.</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] p-3">
              <div><Label>Terbitkan untuk siswa</Label><p className="text-xs text-[#94A3B8]">Siswa hanya melihat Try Out yang terbit.</p></div>
              <Switch checked={form.published} onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))} data-testid="tryout-published" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="save-tryout">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
