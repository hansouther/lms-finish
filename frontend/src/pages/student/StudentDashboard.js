import { Link } from "react-router-dom";
import { BookOpen, ClipboardList, Trophy, GraduationCap, ArrowRight, Library, CalendarCheck, Medal } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import { Loading, Empty } from "@/components/common/States";
import StudentRecommendations from "@/components/common/StudentRecommendations";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatNilai } from "@/lib/format";

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, loading } = useFetch("/student/dashboard");

  return (
    <div data-testid="student-dashboard">
      <PageHeader title={`Halo, ${user?.name?.split(" ")[0]} 👋`.replace("👋", "")} subtitle="Ringkasan aktivitas belajar dan pencapaian Anda." />

      {loading ? <Loading /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard icon={BookOpen} label="Kursus Diikuti" value={data.enrollments} accent="#0E7490" testid="stat-enrollments" />
            <StatCard icon={ClipboardList} label="Try Out Selesai" value={data.completed_tryouts} accent="#C9A227" testid="stat-completed" />
            <StatCard icon={Trophy} label="Rata-rata Nilai" value={`${data.avg_score}`} hint="dari 100" accent="#10B981" testid="stat-avg" />
            <StatCard icon={Library} label="Materi Publik" value={data.public_materials} accent="#7C3AED" testid="stat-materials" />
          </div>

          <div className="mt-8 grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl bg-[#0A1128] text-white p-8 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-[#0E7490]/40 blur-3xl" />
              <div className="relative">
                <p className="text-sm text-white/70">Siap untuk tantangan berikutnya?</p>
                <h2 className="mt-2 text-2xl font-bold">Ikuti Try Out & latihan soal CBT</h2>
                <p className="mt-2 text-white/70 max-w-md text-sm">Tersedia {data.available_tryouts} paket soal dengan penilaian otomatis dan pembahasan.</p>
                <Link to="/student/tryouts"><Button className="mt-6 rounded-full bg-white text-[#0A1128] hover:bg-[#E6F5F8]" data-testid="go-tryouts">Mulai Sekarang <ArrowRight className="h-4 w-4" /></Button></Link>
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-[#E2E8F0] p-6">
              <h3 className="font-semibold text-[#0A1128]">Akses Cepat</h3>
              <div className="mt-4 space-y-2">
                {[["Ruang Belajar", "/student/learning", Library], ["Katalog Kursus", "/student/courses", BookOpen], ["Jadwal Saya", "/student/schedule", CalendarCheck]].map(([l, to, Icon]) => (
                  <Link key={to} to={to} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[#E6F5F8] text-[#475569] hover:text-[#0E7490] transition-colors duration-200">
                    <Icon className="h-4 w-4" /> <span className="text-sm font-medium">{l}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-white border border-[#E2E8F0] p-6">
            <h3 className="font-semibold text-[#0A1128] mb-4">Hasil Try Out Terbaru</h3>
            {data.recent_attempts?.length ? (
              <div className="divide-y divide-[#E2E8F0]">
                {data.recent_attempts.map((a) => (
                  <div key={a.id} className="py-3 flex items-center justify-between" data-testid={`recent-attempt-${a.id}`}>
                    <div>
                      <p className="text-sm font-medium text-[#0A1128]">Nilai: <span className="font-mono2">{a.score}/{a.max_score}</span></p>
                      <p className="text-xs text-[#94A3B8]">{formatDateTime(a.submitted_at)}</p>
                    </div>
                    <span className="font-mono2 text-lg font-bold" style={{ color: a.percentage >= 70 ? "#10B981" : a.percentage >= 50 ? "#C9A227" : "#EF4444" }}>{formatNilai(a.percentage)}</span>
                  </div>
                ))}
              </div>
            ) : <Empty icon={Trophy} title="Belum ada hasil" desc="Kerjakan Try Out pertama Anda untuk melihat nilai di sini." />}
          </div>

          <StudentRecommendations />

          {data.badges?.length > 0 && (
            <div className="mt-8 rounded-2xl bg-white border border-[#E2E8F0] p-6" data-testid="dashboard-badges">
              <h3 className="font-semibold text-[#0A1128] mb-4 flex items-center gap-2"><Medal className="h-5 w-5 text-[#C9A227]" /> Lencana Pencapaian</h3>
              <div className="flex flex-wrap gap-3">
                {data.badges.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-full bg-[#FBF6E9] border border-[#EAD9A6] px-4 py-2" data-testid={`dash-badge-${b.code}`}>
                    <Medal className="h-4 w-4 text-[#C9A227]" />
                    <span className="text-sm font-medium text-[#0A1128]">{b.label}</span>
                    <span className="text-xs text-[#94A3B8]">· {b.course_title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
