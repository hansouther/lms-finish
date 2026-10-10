import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, PlayCircle, FileText, Youtube, ClipboardList, BookOpen, UserCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import PublicShell from "@/components/public/PublicShell";
import useSeo from "@/hooks/useSeo";
import { Loading, Empty } from "@/components/common/States";
import { formatRupiah } from "@/lib/format";
import { SiteLogoMark, SiteName } from "@/components/common/SiteBrand";

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useSeo({
    title: data ? `${data.course.title} — Kursus Binara LMS` : "Kursus — Binara LMS",
    description: data ? (data.course.description || "").slice(0, 160) : "Detail kursus Binara LMS.",
    image: data?.course?.thumbnail,
    type: "article",
  });

  useEffect(() => {
    setLoading(true); setNotFound(false);
    api.get(`/public/courses/${id}`).then((r) => setData(r.data)).catch(() => setNotFound(true)).finally(() => setLoading(false));
    window.scrollTo(0, 0);
  }, [id]);

  const lessonIcon = (t) => t === "youtube" ? Youtube : t === "document" ? FileText : PlayCircle;

  return (
    <PublicShell>
      {loading ? (
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16"><Loading /></div>
      ) : notFound || !data ? (
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16"><Empty icon={BookOpen} title="Kursus tidak ditemukan" desc="Kursus mungkin tidak aktif atau tautan tidak valid." /></div>
      ) : (
        <>
          {/* Hero */}
          <section className="bg-[#0A1128] text-white py-14" data-testid="course-detail">
            <div className="max-w-5xl mx-auto px-5 sm:px-8">
              <button onClick={() => navigate("/kursus")} className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 hover:text-white mb-6 transition-colors duration-200" data-testid="course-back">
                <ArrowLeft className="h-4 w-4" /> Semua Kursus
              </button>
              <div className="grid lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2">
                  <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{data.course.subject}</span>
                  <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold leading-tight" data-testid="course-detail-title">{data.course.title}</h1>
                  <p className="mt-3 text-white/70">{data.course.level}</p>
                  <p className="mt-4 text-white/80 max-w-2xl">{data.course.description}</p>
                  <div className="mt-6 flex flex-wrap gap-3 text-sm">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2"><PlayCircle className="h-4 w-4 text-[#0E7490]" /> {data.lesson_count} materi video/dokumen</span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2"><ClipboardList className="h-4 w-4 text-[#C9A227]" /> {data.exercise_count} latihan bernilai</span>
                  </div>
                </div>
                <div className="rounded-2xl bg-white text-[#0A1128] p-6">
                  {data.course.thumbnail && <img src={data.course.thumbnail} alt={data.course.title} className="w-full h-36 object-cover rounded-xl mb-4" />}
                  <p className="text-sm text-[#94A3B8]">Biaya kursus</p>
                  <p className="font-head font-bold text-2xl text-[#0E7490]">{formatRupiah(parseInt(data.course.price || 0, 10))}</p>
                  <Link to="/register"><span className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#C9A227] hover:bg-[#A9871C] text-[#0A1128] font-semibold px-6 py-3 transition-colors duration-200" data-testid="course-detail-cta">Daftar & Ikuti Kursus <ArrowRight className="h-4 w-4" /></span></Link>
                  <p className="mt-2 text-center text-[11px] text-[#94A3B8]">Buat akun gratis untuk mulai belajar.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Silabus + Tentor */}
          <section className="py-14 bg-[#EFF6F8]">
            <div className="max-w-5xl mx-auto px-5 sm:px-8 grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <h2 className="text-2xl font-bold text-[#0A1128] mb-5">Silabus Kursus</h2>
                {data.syllabus.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 text-sm text-[#94A3B8]">Silabus sedang disiapkan. Daftar sekarang untuk mendapat pembaruan.</div>
                ) : (
                  <div className="bg-white rounded-2xl border border-[#E2E8F0] divide-y divide-[#E2E8F0]" data-testid="course-syllabus">
                    {data.syllabus.map((l, i) => {
                      const Icon = lessonIcon(l.video_type);
                      return (
                        <div key={l.id} className="p-4 flex items-start gap-4" data-testid={`syllabus-${l.id}`}>
                          <div className="h-9 w-9 rounded-lg bg-[#E6F5F8] text-[#0E7490] flex items-center justify-center shrink-0 text-sm font-bold">{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[#0A1128] text-sm flex items-center gap-2"><Icon className="h-4 w-4 text-[#0E7490]" /> {l.title}</p>
                            {l.description && <p className="text-xs text-[#475569] mt-0.5 line-clamp-2">{l.description}</p>}
                            {l.attachment_count > 0 && <p className="text-[11px] text-[#94A3B8] mt-1 flex items-center gap-1"><FileText className="h-3 w-3" /> {l.attachment_count} lampiran</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-bold text-[#0A1128] mb-5">Tentor</h2>
                <div className="space-y-3" data-testid="course-tutors">
                  {data.tutors.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-[#ECFDF5] text-[#10B981] flex items-center justify-center"><UserCheck className="h-5 w-5" /></div>
                      <div><p className="font-semibold text-[#0A1128] text-sm">Tim Pengajar <SiteName /></p><p className="text-xs text-[#94A3B8]">Tentor berpengalaman bersertifikat</p></div>
                    </div>
                  ) : data.tutors.map((t, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 flex items-center gap-3" data-testid={`tutor-${i}`}>
                      {t.picture ? <img src={t.picture} alt={t.name} className="h-11 w-11 rounded-full object-cover" /> : <div className="h-11 w-11 rounded-full bg-[#FBF3DC] text-[#C9A227] flex items-center justify-center font-bold">{(t.name || "?")[0]}</div>}
                      <div>
                        <p className="font-semibold text-[#0A1128] text-sm">{t.name}</p>
                        <p className="text-xs text-[#94A3B8]">{(t.qualifications || []).join(", ") || "Tentor"}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl bg-white border border-[#E2E8F0] p-5">
                  <p className="text-sm font-semibold text-[#0A1128] mb-2">Yang Anda dapatkan</p>
                  <ul className="space-y-2 text-sm text-[#475569]">
                    {["Materi video & dokumen", "Latihan soal dengan penilaian otomatis", "Pantau progres & lencana pencapaian"].map((f) => (
                      <li key={f} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#10B981]" /> {f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </PublicShell>
  );
}
