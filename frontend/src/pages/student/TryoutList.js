import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Clock, HelpCircle, PlayCircle, Eye, CreditCard, Loader2 } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { enterFullscreen } from "@/lib/fullscreen";
import { formatRupiah, formatDateTime, formatNilai } from "@/lib/format";
import { payItem } from "@/lib/midtrans";
import InstallAppBanner from "@/components/common/InstallAppBanner";

const STATUS = {
  submitted: { label: "Selesai", color: "#10B981", bg: "#ECFDF5" },
  in_progress: { label: "Sedang Dikerjakan", color: "#C9A227", bg: "#FBF3DC" },
  null: { label: "Belum Dikerjakan", color: "#0E7490", bg: "#E6F5F8" },
};

export default function TryoutList() {
  const { data, loading, refetch } = useFetch("/student/tryouts");
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  const buy = async (t) => { setBusy(t.id); try { await payItem("tryout", t.id, { onPaid: refetch }); } finally { setBusy(null); } };

  return (
    <div data-testid="tryout-list">
      <PageHeader title="CBT / Try Out" subtitle="Kerjakan Try Out dan latihan soal dengan penilaian otomatis (pilihan ganda, kompleks, benar/salah, & esai)." />
      <InstallAppBanner />

      {loading ? <Loading /> : !data?.length ? (
        <Empty icon={ClipboardList} title="Belum ada Try Out" desc="Paket soal yang dirilis admin akan muncul di sini." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((t) => {
            const st = STATUS[t.attempt_status] || STATUS.null;
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-6 flex flex-col hover:-translate-y-1 transition-transform duration-200" data-testid={`tryout-${t.id}`}>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[#EFF6F8] px-3 py-1 text-[11px] font-semibold text-[#475569]">{t.subject}</span>
                  <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ color: st.color, backgroundColor: st.bg }}>{st.label}</span>
                </div>
                <h3 className="mt-4 font-semibold text-[#0A1128]">{t.title}</h3>
                <p className="mt-1.5 text-sm text-[#475569] line-clamp-2 flex-1">{t.description}</p>
                <div className="mt-4 flex items-center gap-4 text-xs text-[#94A3B8]">
                  <span className="flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5" /> {t.question_count} soal</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {t.duration_minutes} menit</span>
                  {t.end_at && t.schedule_status === "open" && <span className="flex items-center gap-1" data-testid={`tryout-closes-${t.id}`}>Tutup {formatDateTime(t.end_at)}</span>}
                  <span className={`ml-auto font-semibold ${t.price > 0 ? "text-[#C9A227]" : "text-[#10B981]"}`} data-testid={`tryout-price-${t.id}`}>{t.price > 0 ? formatRupiah(t.price) : "Gratis"}</span>
                </div>
                <div className="mt-5">
                  {t.attempt_status === "submitted" ? (
                    <div className="flex items-center justify-between">
                      <span className="font-mono2 text-2xl font-bold" style={{ color: t.my_percentage >= 70 ? "#10B981" : "#C9A227" }}>{formatNilai(t.my_percentage)}</span>
                      <Button variant="outline" size="sm" className="rounded-full hover:bg-[#E6F5F8] hover:text-[#0E7490]" onClick={() => navigate(`/student/results/${t.attempt_id}`)} data-testid={`view-result-${t.id}`}>
                        <Eye className="h-4 w-4" /> Lihat Hasil
                      </Button>
                    </div>
                  ) : t.attempt_status !== "in_progress" && !t.retake_granted && t.schedule_status !== "open" ? (
                    <div className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-center text-xs font-semibold text-[#475569]" data-testid={`tryout-schedule-${t.id}`}>
                      {t.schedule_status === "upcoming" ? `Dibuka ${formatDateTime(t.start_at)}` : "Try Out sudah ditutup"}
                    </div>
                  ) : !t.has_access ? (
                    <Button className="w-full rounded-full bg-[#C9A227] hover:bg-[#A9871C] text-[#0A1128] font-semibold" disabled={busy === t.id} onClick={() => buy(t)} data-testid={`buy-tryout-${t.id}`}>
                      {busy === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Beli Akses · {formatRupiah(t.price)}
                    </Button>
                  ) : (
                    <Button className="w-full rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" onClick={() => { if ((t.tab_warning_limit ?? 5) > 0) enterFullscreen(); navigate(`/student/exam/${t.id}`); }} data-testid={`start-tryout-${t.id}`}>
                      <PlayCircle className="h-4 w-4" /> {t.attempt_status === "in_progress" ? "Lanjutkan" : t.retake_granted ? "Ulangi (izin admin)" : "Mulai Kerjakan"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
