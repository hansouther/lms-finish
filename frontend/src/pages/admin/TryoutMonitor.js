import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, RotateCcw, Send, RefreshCw, CheckCircle2, AlertTriangle, Clock, XCircle } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api, { apiError } from "@/lib/api";
import { Loading, Empty } from "@/components/common/States";
import ConfirmButton from "@/components/common/ConfirmButton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

const STATUS = {
  in_progress: ["Sedang mengerjakan", "#0E7490", "#E6F5F8"],
  expired: ["Waktu habis, belum dikumpulkan", "#C9A227", "#FBF3DC"],
  retake_pending: ["Diizinkan mengulang", "#7C3AED", "#F3E8FF"],
  submitted: ["Selesai", "#10B981", "#ECFDF5"],
};
const SCHED = { upcoming: "Belum dibuka", open: "Sedang dibuka", closed: "Sudah ditutup" };
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const ago = (iso, now) => {
  if (!iso) return null;
  const s = Math.max(0, Math.round((new Date(now) - new Date(iso)) / 1000));
  return s < 60 ? `${s} dtk lalu` : s < 3600 ? `${Math.floor(s / 60)} mnt lalu` : formatDateTime(iso);
};

function Stat({ label, value, color, testid }) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] px-4 py-3" data-testid={testid}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
      <p className="mt-1 font-mono2 text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function SaveCell({ r, now }) {
  if (r.status === "retake_pending") return <span className="text-xs text-[#94A3B8]">Menunggu siswa mulai ulang</span>;
  if (!r.last_saved_at) return <span className="flex items-center gap-1 text-xs text-[#C9A227]"><AlertTriangle className="h-3.5 w-3.5" /> Belum ada jawaban tersimpan</span>;
  const stale = r.status === "in_progress" && (new Date(now) - new Date(r.last_saved_at)) > 3 * 60 * 1000;
  return (
    <span className={`flex items-center gap-1 text-xs ${stale ? "text-[#C9A227]" : "text-[#10B981]"}`} title={formatDateTime(r.last_saved_at)}>
      {stale ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Tersimpan {ago(r.last_saved_at, now)}{stale ? " (tidak aktif)" : ""}
    </span>
  );
}

export default function TryoutMonitor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, refetch } = useFetch(`/admin/tryouts/${id}/monitor`);

  useEffect(() => {
    const h = setInterval(refetch, 10000);
    return () => clearInterval(h);
  }, [refetch]);

  const act = async (fn, msg) => { try { await fn(); toast.success(msg); refetch(); } catch (e) { toast.error(apiError(e)); } };
  const reset = (r) => act(() => api.post(`/admin/tryouts/${id}/attempts/${r.attempt_id}/reset`), `Data ${r.student?.name || "siswa"} dihapus. Siswa bisa mengulang Try Out.`);
  const force = (r) => act(() => api.post(`/admin/tryouts/${id}/attempts/${r.attempt_id}/force-submit`), "Jawaban tersimpan berhasil dikumpulkan & dinilai");
  const cancel = (r) => act(() => api.delete(`/admin/tryouts/${id}/retakes/${r.student_id}`), "Izin mengulang dibatalkan");

  const t = data?.tryout;
  const s = data?.summary || {};
  return (
    <div data-testid="tryout-monitor">
      <Button variant="ghost" onClick={() => navigate("/admin/tryouts")} className="mb-3 text-[#475569] hover:text-[#0E7490] hover:bg-[#E6F5F8]"><ArrowLeft className="h-4 w-4" /> Kembali</Button>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0A1128] flex items-center gap-2"><Activity className="h-6 w-6 text-[#0E7490]" /> Pantau Peserta</h1>
          {t && (
            <p className="text-sm text-[#475569] mt-1" data-testid="monitor-schedule">
              {t.title} · {t.duration_minutes} menit · <span className="font-semibold">{SCHED[t.schedule_status]}</span>
              {(t.start_at || t.end_at) && <> · {t.start_at ? formatDateTime(t.start_at) : "kapan saja"} — {t.end_at ? formatDateTime(t.end_at) : "tanpa batas"}</>}
            </p>
          )}
          <p className="text-xs text-[#94A3B8] mt-1">Diperbarui otomatis tiap 10 detik. Jawaban siswa tersimpan ke server setiap kali mereka memilih/mengubah jawaban.</p>
        </div>
        <Button variant="outline" onClick={refetch} className="rounded-full" data-testid="monitor-refresh"><RefreshCw className="h-4 w-4" /> Muat ulang</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Sedang mengerjakan" value={s.in_progress || 0} color="#0E7490" testid="stat-in-progress" />
        <Stat label="Waktu habis" value={s.expired || 0} color="#C9A227" testid="stat-expired" />
        <Stat label="Izin mengulang" value={s.retake_pending || 0} color="#7C3AED" testid="stat-retake" />
        <Stat label="Selesai" value={s.submitted || 0} color="#10B981" testid="stat-submitted" />
      </div>

      {loading && !data ? <Loading /> : !data?.rows?.length ? (
        <Empty icon={Activity} title="Belum ada peserta" desc="Siswa yang mulai mengerjakan akan muncul di sini." />
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#EFF6F8]">
                <TableHead>Siswa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progres Jawaban</TableHead>
                <TableHead>Penyimpanan</TableHead>
                <TableHead>Sisa / Nilai</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r, i) => {
                const st = STATUS[r.status];
                const pct = r.total_questions ? Math.round((r.answered_count / r.total_questions) * 100) : 0;
                return (
                  <TableRow key={r.attempt_id || `g-${r.student_id}`} data-testid={`monitor-row-${i}`}>
                    <TableCell>
                      <p className="font-medium text-[#0A1128]">{r.student?.name || "-"}</p>
                      <p className="text-xs text-[#94A3B8]">{r.student?.email}</p>
                      {r.retake && r.status !== "retake_pending" && <span className="text-[10px] font-semibold text-[#7C3AED]">Pengulangan</span>}
                    </TableCell>
                    <TableCell><span className="rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" style={{ color: st[1], backgroundColor: st[2] }} data-testid={`monitor-status-${i}`}>{st[0]}</span></TableCell>
                    <TableCell className="min-w-[160px]">
                      <p className="font-mono2 text-sm text-[#0A1128]" data-testid={`monitor-progress-${i}`}>{r.answered_count}/{r.total_questions} soal</p>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-[#E2E8F0]"><div className="h-1.5 rounded-full bg-[#0E7490] transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
                      {r.started_at && <p className="mt-1 text-[11px] text-[#94A3B8]">Mulai {formatDateTime(r.started_at)}</p>}
                    </TableCell>
                    <TableCell data-testid={`monitor-save-${i}`}><SaveCell r={r} now={data.server_now} /></TableCell>
                    <TableCell className="font-mono2 text-sm">
                      {r.status === "in_progress" ? <span className="flex items-center gap-1 text-[#0E7490]"><Clock className="h-3.5 w-3.5" /> {mmss(r.remaining_seconds)}</span>
                        : r.status === "submitted" ? <span className="font-bold text-[#10B981]">{r.percentage}%</span> : <span className="text-[#94A3B8]">—</span>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {r.status === "retake_pending" ? (
                        <Button size="sm" variant="ghost" onClick={() => cancel(r)} className="rounded-full text-[#475569]" data-testid={`monitor-cancel-${i}`}><XCircle className="h-4 w-4" /> Batalkan izin</Button>
                      ) : (
                        <div className="flex justify-end gap-1">
                          {r.status !== "submitted" && (
                            <ConfirmButton onConfirm={() => force(r)} title="Kumpulkan jawaban tersimpan?" confirmLabel="Kumpulkan" description="Jawaban yang sudah tersimpan di server akan dinilai sekarang. Siswa tidak bisa melanjutkan lagi."
                              trigger={<Button size="sm" variant="outline" className="rounded-full" data-testid={`monitor-force-${i}`}><Send className="h-4 w-4" /> Kumpulkan</Button>} />
                          )}
                          <ConfirmButton onConfirm={() => reset(r)} title="Hapus data & izinkan mengulang?" confirmLabel="Hapus & Izinkan Ulang" description="Semua jawaban dan nilai siswa ini pada Try Out ini dihapus permanen. Siswa bisa mengerjakan ulang dari awal dengan waktu penuh, meskipun jadwal Try Out sudah ditutup."
                            trigger={<Button size="sm" variant="outline" className="rounded-full text-red-600 border-red-200 hover:bg-red-50" data-testid={`monitor-reset-${i}`}><RotateCcw className="h-4 w-4" /> Ulangi</Button>} />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
