import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Video, FileText, Youtube, Upload, Settings2, BarChart3, Loader2, Paperclip, PlayCircle, FileArchive, CheckCircle2, XCircle } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api, { apiError } from "@/lib/api";
import { uploadFile } from "@/lib/media";
import { Loading, Empty } from "@/components/common/States";
import ConfirmButton from "@/components/common/ConfirmButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const EMPTY = { title: "", description: "", video_type: "youtube", video_url: "", attachments: [] };

export default function CourseContent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, refetch } = useFetch(`/admin/courses/${id}/content`);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const [exOpen, setExOpen] = useState(false);
  const [exForm, setExForm] = useState({ title: "", duration_minutes: 15 });
  const [zipOpen, setZipOpen] = useState(false);
  const [zipImporting, setZipImporting] = useState(false);
  const [zipResult, setZipResult] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const onZipFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setZipImporting(true); setZipResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data: res } = await api.post(`/admin/courses/${id}/lessons/import-zip`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setZipResult(res);
      toast.success(`${res.created} materi diimpor`);
      refetch();
    } catch (err) { toast.error(apiError(err)); } finally { setZipImporting(false); e.target.value = ""; }
  };

  const onVideoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const res = await uploadFile(file);
      setForm((f) => ({ ...f, video_url: res.url }));
      toast.success("Video terunggah");
    } catch (err) { toast.error(apiError(err)); } finally { setUploadingVideo(false); }
  };

  const onAttFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingAtt(true);
    try {
      for (const file of files) {
        const res = await uploadFile(file);
        setForm((f) => ({ ...f, attachments: [...f.attachments, { name: res.filename, url: res.url, content_type: res.content_type }] }));
      }
      toast.success("Lampiran terunggah");
    } catch (err) { toast.error(apiError(err)); } finally { setUploadingAtt(false); }
  };

  const saveLesson = async () => {
    if (form.video_type === "youtube" && !form.video_url) return toast.error("Masukkan URL YouTube");
    if (form.video_type === "upload" && !form.video_url) return toast.error("Unggah file video terlebih dahulu");
    try {
      await api.post(`/admin/courses/${id}/lessons`, form);
      toast.success("Pelajaran ditambahkan");
      setOpen(false); setForm(EMPTY); refetch();
    } catch (e) { toast.error(apiError(e)); }
  };
  const delLesson = async (lid) => { try { await api.delete(`/admin/lessons/${lid}`); toast.success("Pelajaran dihapus"); refetch(); } catch (e) { toast.error(apiError(e)); } };

  const saveExercise = async () => {
    try {
      const { data: ex } = await api.post(`/admin/courses/${id}/exercises`, { title: exForm.title, duration_minutes: parseInt(exForm.duration_minutes || 15, 10) });
      toast.success("Latihan dibuat, tambahkan soal sekarang");
      navigate(`/admin/tryouts/${ex.id}/builder`);
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="course-content">
      <Button variant="ghost" onClick={() => navigate("/admin/courses")} className="mb-3 text-[#475569] hover:text-[#0E7490] hover:bg-[#E6F5F8]"><ArrowLeft className="h-4 w-4" /> Kembali</Button>
      {loading ? <Loading /> : (
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#0A1128]">{data.course.title}</h1>
            <p className="text-sm text-[#475569] mt-1">Kelola video pembelajaran, lampiran, dan latihan soal bernilai.</p>
          </div>

          {/* Lessons */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-[#0A1128] flex items-center gap-2"><Video className="h-5 w-5 text-[#0E7490]" /> Video Pembelajaran</h2>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setZipResult(null); setZipOpen(true); }} variant="outline" className="rounded-full border-[#CBD5E1] text-[#475569] hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid="import-zip-btn"><FileArchive className="h-4 w-4" /> Impor ZIP</Button>
              <Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="add-lesson-btn"><Plus className="h-4 w-4" /> Tambah Pelajaran</Button>
            </div>
          </div>
          {data.lessons.length === 0 ? <Empty icon={Video} title="Belum ada pelajaran" /> : (
            <div className="space-y-3 mb-10">
              {data.lessons.map((l) => (
                <div key={l.id} className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex items-center gap-4" data-testid={`lesson-${l.id}`}>
                  <div className="h-11 w-11 rounded-lg bg-[#E6F5F8] text-[#0E7490] flex items-center justify-center shrink-0">
                    {l.video_type === "youtube" ? <Youtube className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#0A1128] text-sm">{l.title}</p>
                    <p className="text-xs text-[#94A3B8]">{l.description}</p>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-[#94A3B8]">
                      <span className="uppercase">{l.video_type === "youtube" ? "YouTube" : "Video unggahan"}</span>
                      {l.attachments?.length > 0 && <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" /> {l.attachments.length} lampiran</span>}
                    </div>
                  </div>
                  <ConfirmButton onConfirm={() => delLesson(l.id)} trigger={<Button variant="ghost" size="icon" className="hover:bg-red-50 hover:text-red-600" data-testid={`delete-lesson-${l.id}`}><Trash2 className="h-4 w-4" /></Button>} />
                </div>
              ))}
            </div>
          )}

          {/* Exercises */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-[#0A1128] flex items-center gap-2"><FileText className="h-5 w-5 text-[#C9A227]" /> Latihan Soal Bernilai</h2>
            <Button onClick={() => { setExForm({ title: "", duration_minutes: 15 }); setExOpen(true); }} className="rounded-full bg-[#C9A227] hover:bg-[#A9871C] text-[#0A1128] font-semibold" data-testid="add-exercise-btn"><Plus className="h-4 w-4" /> Tambah Latihan</Button>
          </div>
          {data.exercises.length === 0 ? <Empty icon={FileText} title="Belum ada latihan" desc="Nilai siswa dihitung otomatis dari latihan ini." /> : (
            <div className="grid sm:grid-cols-2 gap-4">
              {data.exercises.map((ex) => (
                <div key={ex.id} className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid={`exercise-${ex.id}`}>
                  <h3 className="font-semibold text-[#0A1128]">{ex.title}</h3>
                  <p className="mt-1 text-xs text-[#94A3B8]">{ex.question_count} soal · {ex.attempt_count} pengerjaan · {ex.duration_minutes} menit</p>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" onClick={() => navigate(`/admin/tryouts/${ex.id}/builder`)} className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid={`ex-build-${ex.id}`}><Settings2 className="h-4 w-4" /> Kelola Soal</Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/admin/tryouts/${ex.id}/results`)} className="rounded-full hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid={`ex-results-${ex.id}`}><BarChart3 className="h-4 w-4" /> Hasil</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lesson dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Tambah Pelajaran</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Judul</Label><Input value={form.title} onChange={set("title")} className="mt-1.5" data-testid="lesson-title" /></div>
            <div><Label>Deskripsi</Label><Textarea value={form.description} onChange={set("description")} className="mt-1.5" data-testid="lesson-desc" /></div>
            <div>
              <Label>Sumber Video</Label>
              <RadioGroup value={form.video_type} onValueChange={(v) => setForm((f) => ({ ...f, video_type: v, video_url: "" }))} className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer" data-testid="video-type-youtube"><RadioGroupItem value="youtube" /> <Youtube className="h-4 w-4 text-red-500" /> YouTube</label>
                <label className="flex items-center gap-2 cursor-pointer" data-testid="video-type-upload"><RadioGroupItem value="upload" /> <Upload className="h-4 w-4 text-[#0E7490]" /> Unggah Video</label>
              </RadioGroup>
            </div>
            {form.video_type === "youtube" ? (
              <div><Label>URL YouTube</Label><Input value={form.video_url} onChange={set("video_url")} placeholder="https://www.youtube.com/watch?v=..." className="mt-1.5" data-testid="lesson-youtube-url" /></div>
            ) : (
              <div>
                <Label>File Video</Label>
                <label className="mt-1.5 flex items-center gap-3 rounded-lg border border-dashed border-[#CBD5E1] p-4 cursor-pointer hover:bg-[#EFF6F8]" data-testid="lesson-video-upload">
                  {uploadingVideo ? <Loader2 className="h-5 w-5 animate-spin text-[#0E7490]" /> : <Upload className="h-5 w-5 text-[#0E7490]" />}
                  <span className="text-sm text-[#475569]">{form.video_url ? "Video terunggah ✓ (klik untuk ganti)" : "Pilih file video (mp4/webm)"}</span>
                  <input type="file" accept="video/*" className="hidden" onChange={onVideoFile} />
                </label>
              </div>
            )}
            <div>
              <Label>Lampiran (PDF/Dokumen)</Label>
              <label className="mt-1.5 flex items-center gap-3 rounded-lg border border-dashed border-[#CBD5E1] p-4 cursor-pointer hover:bg-[#EFF6F8]" data-testid="lesson-attach-upload">
                {uploadingAtt ? <Loader2 className="h-5 w-5 animate-spin text-[#0E7490]" /> : <Paperclip className="h-5 w-5 text-[#0E7490]" />}
                <span className="text-sm text-[#475569]">Tambah lampiran (bisa beberapa)</span>
                <input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx" className="hidden" onChange={onAttFiles} />
              </label>
              {form.attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {form.attachments.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-sm rounded-lg bg-[#EFF6F8] px-3 py-2">
                      <span className="truncate flex items-center gap-2"><FileText className="h-4 w-4 text-[#0E7490]" /> {a.name}</span>
                      <button onClick={() => setForm((f) => ({ ...f, attachments: f.attachments.filter((_, idx) => idx !== i) }))} className="text-[#94A3B8] hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={saveLesson} disabled={uploadingVideo || uploadingAtt} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="save-lesson">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exercise dialog */}
      <Dialog open={exOpen} onOpenChange={setExOpen}>        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Latihan Soal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Judul Latihan</Label><Input value={exForm.title} onChange={(e) => setExForm((f) => ({ ...f, title: e.target.value }))} className="mt-1.5" data-testid="exercise-title" /></div>
            <div><Label>Durasi (menit)</Label><Input type="number" value={exForm.duration_minutes} onChange={(e) => setExForm((f) => ({ ...f, duration_minutes: e.target.value }))} className="mt-1.5" data-testid="exercise-duration" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExOpen(false)}>Batal</Button>
            <Button onClick={saveExercise} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="save-exercise">Buat & Tambah Soal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ZIP bulk import dialog */}
      <Dialog open={zipOpen} onOpenChange={setZipOpen}>
        <DialogContent data-testid="zip-import-dialog">
          <DialogHeader><DialogTitle>Impor Materi Massal (ZIP)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[#475569]">Unggah satu berkas ZIP berisi banyak video (mp4, webm, mov) dan dokumen (pdf, doc, docx, ppt, pptx). Setiap berkas otomatis menjadi satu pelajaran baru.</p>
            <label className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#CBD5E1] p-6 cursor-pointer hover:bg-[#EFF6F8]" data-testid="zip-upload">
              {zipImporting ? <Loader2 className="h-7 w-7 animate-spin text-[#0E7490]" /> : <FileArchive className="h-7 w-7 text-[#0E7490]" />}
              <span className="text-sm font-medium text-[#0A1128]">{zipImporting ? "Mengimpor materi…" : "Pilih berkas .zip"}</span>
              <span className="text-xs text-[#94A3B8]">Video & dokumen akan diproses otomatis</span>
              <input type="file" accept=".zip,application/zip" className="hidden" onChange={onZipFile} disabled={zipImporting} />
            </label>
            {zipResult && (
              <div className="rounded-lg bg-[#EFF6F8] p-4 space-y-2" data-testid="zip-result">
                <div className="flex items-center gap-2 text-sm text-[#10B981]"><CheckCircle2 className="h-4 w-4" /> {zipResult.created} materi berhasil diimpor</div>
                <div className="flex items-center gap-2 text-sm text-[#94A3B8]"><FileText className="h-4 w-4" /> {zipResult.skipped} berkas dilewati (format tidak didukung)</div>
                {zipResult.errors?.length > 0 && (
                  <div className="text-sm text-red-600 space-y-1">
                    {zipResult.errors.map((err, i) => (<div key={i} className="flex items-center gap-2"><XCircle className="h-4 w-4 shrink-0" /> {err}</div>))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZipOpen(false)} data-testid="zip-close">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
