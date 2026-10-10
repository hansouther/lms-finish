import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, PlayCircle, Users, BookOpen, ClipboardCheck,
  MonitorPlay, ShieldCheck, CalendarDays, Newspaper, Sparkles, LineChart,
  UserCheck, Building2, CheckCircle2, Menu,
} from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MonthCalendar from "@/components/public/MonthCalendar";
import useSeo from "@/hooks/useSeo";
import { toast } from "sonner";
import { SiteLogoMark, SiteName } from "@/components/common/SiteBrand";
import { useSite, assetUrl } from "@/lib/site";

const HERO = "https://images.unsplash.com/photo-1543269865-cbf427effbad?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBzdHVkZW50cyUyMGxlYXJuaW5nfGVufDB8fHx8MTc4NzE1MDU5OHww&ixlib=rb-4.1.0&q=85";

const PORTALS = [
  { icon: BookOpen, title: "Ruang Belajar Siswa", desc: "Materi publik & privat, CBT Try Out, dan katalog kursus dalam satu tempat.", color: "#0E7490" },
  { icon: ShieldCheck, title: "Pusat Kendali Admin", desc: "Kelola berita, kalender, kursus, jadwal, bank soal, dan broadcast.", color: "#C9A227" },
  { icon: UserCheck, title: "Dashboard Tentor", desc: "Job bidding jadwal mengajar, kalender pribadi, presensi & unggah materi.", color: "#10B981" },
  { icon: MonitorPlay, title: "Pemantau Proktor", desc: "Live monitoring, unduh laporan nilai, dan analitik tren performa.", color: "#7C3AED" },
];

const STEPS = [
  { icon: UserCheck, title: "Daftar & Masuk", desc: "Buat akun siswa atau masuk sesuai peran Anda dengan aman." },
  { icon: BookOpen, title: "Pilih Kursus & Try Out", desc: "Jelajahi katalog kursus aktif dan ikuti latihan CBT." },
  { icon: ClipboardCheck, title: "Belajar Interaktif", desc: "Akses materi dari tentor dan kerjakan soal dengan penilaian otomatis." },
  { icon: LineChart, title: "Pantau Progres", desc: "Lihat perkembangan nilai; proktor memantau performa sekolah mitra." },
];

function Header() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-colors duration-200 ${scrolled ? "bg-white/70 backdrop-blur-xl border-b border-[#E2E8F0]" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5" data-testid="landing-logo">
          <SiteLogoMark className="h-9 w-9 rounded-xl bg-[#0E7490] shadow-md shadow-[#0E7490]/30" iconClass="h-5 w-5 text-white" />
          <span className="font-head font-bold text-[#0A1128] text-lg"><SiteName /></span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#475569]">
          <a href="#cara" className="hover:text-[#0E7490] transition-colors duration-200">Cara Kerja</a>
          <a href="#portal" className="hover:text-[#0E7490] transition-colors duration-200">Portal</a>
          <Link to="/kursus" className="hover:text-[#0E7490] transition-colors duration-200" data-testid="landing-nav-kursus">Kursus</Link>
          <Link to="/kalender" className="hover:text-[#0E7490] transition-colors duration-200" data-testid="landing-nav-kalender">Kalender</Link>
          <Link to="/berita" className="hover:text-[#0E7490] transition-colors duration-200" data-testid="landing-nav-berita">Berita</Link>
          <a href="#kemitraan" className="hover:text-[#0E7490] transition-colors duration-200">Kemitraan</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login"><Button variant="ghost" className="text-[#475569] hover:text-[#0E7490] hover:bg-[#E6F5F8]" data-testid="header-login-btn">Masuk</Button></Link>
          <Link to="/register"><Button className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74] px-5" data-testid="header-register-btn">Daftar Gratis</Button></Link>
        </div>
      </div>
    </header>
  );
}

function PartnershipForm() {
  const [form, setForm] = useState({ org_name: "", contact_name: "", email: "", phone: "", org_type: "", student_count: "", message: "" });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.org_type) return toast.error("Pilih tipe organisasi terlebih dahulu");
    setLoading(true);
    try {
      await api.post("/public/partnerships", { ...form, student_count: parseInt(form.student_count || "0", 10) });
      toast.success("Pengajuan terkirim! Tim kami akan menghubungi Anda.");
      setForm({ org_name: "", contact_name: "", email: "", phone: "", org_type: "", student_count: "", message: "" });
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8 grid sm:grid-cols-2 gap-4" data-testid="partnership-form">
      <div className="sm:col-span-2">
        <Label className="text-[#0A1128]">Nama Organisasi / Sekolah</Label>
        <Input required value={form.org_name} onChange={set("org_name")} placeholder="SMA Nusantara 1" className="mt-1.5" data-testid="partner-org-name" />
      </div>
      <div>
        <Label className="text-[#0A1128]">Nama Penanggung Jawab</Label>
        <Input required value={form.contact_name} onChange={set("contact_name")} placeholder="Nama lengkap" className="mt-1.5" data-testid="partner-contact-name" />
      </div>
      <div>
        <Label className="text-[#0A1128]">Tipe Organisasi</Label>
        <Select value={form.org_type} onValueChange={set("org_type")}>
          <SelectTrigger className="mt-1.5" data-testid="partner-org-type"><SelectValue placeholder="Pilih tipe" /></SelectTrigger>
          <SelectContent>
            {["Sekolah", "Bimbingan Belajar", "Universitas", "Perusahaan", "Lainnya"].map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[#0A1128]">Email</Label>
        <Input required type="email" value={form.email} onChange={set("email")} placeholder="email@instansi.id" className="mt-1.5" data-testid="partner-email" />
      </div>
      <div>
        <Label className="text-[#0A1128]">No. Telepon</Label>
        <Input required value={form.phone} onChange={set("phone")} placeholder="0812xxxxxxx" className="mt-1.5" data-testid="partner-phone" />
      </div>
      <div className="sm:col-span-2">
        <Label className="text-[#0A1128]">Perkiraan Jumlah Siswa</Label>
        <Input required type="number" min="0" value={form.student_count} onChange={set("student_count")} placeholder="120" className="mt-1.5" data-testid="partner-student-count" />
      </div>
      <div className="sm:col-span-2">
        <Label className="text-[#0A1128]">Pesan (opsional)</Label>
        <Textarea value={form.message} onChange={set("message")} placeholder="Ceritakan kebutuhan kerja sama Anda..." className="mt-1.5" data-testid="partner-message" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={loading} className="w-full rounded-full bg-[#C9A227] hover:bg-[#A9871C] text-[#0A1128] font-semibold h-11" data-testid="partner-submit">
          {loading ? "Mengirim..." : "Ajukan Kerja Sama"} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

export default function Landing() {
  const site = useSite();
  const [news, setNews] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [serverNow, setServerNow] = useState(null);
  const [stats, setStats] = useState({ students: 0, tutors: 0, courses: 0, schools: 0 });
  const navigate = useNavigate();

  useSeo({
    title: "Binara LMS — Platform Belajar, Try Out CBT & Kursus Interaktif",
    description: "Binara LMS: satu ekosistem untuk belajar, mengajar & memantau prestasi. Try Out CBT, kursus interaktif, kalender akademik, dan analitik nilai untuk sekolah mitra.",
  });

  useEffect(() => {
    api.get("/public/news").then((r) => setNews(r.data)).catch(() => {});
    api.get("/public/calendar").then((r) => setCalendar(r.data)).catch(() => {});
    api.get("/public/time").then((r) => setServerNow(r.data.iso)).catch(() => {});
    api.get("/public/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div id="top" className="bg-white text-[#0A1128] overflow-x-hidden">
      <Header />

      {/* Hero */}
      <section className="relative pt-28 pb-20 brand-grid-bg">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#E6F5F8] text-[#0E7490] px-4 py-1.5 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" /> Platform LMS Terintegrasi 5 Portal
            </span>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] text-[#0A1128]">
              Satu ekosistem untuk <span className="text-[#0E7490]">belajar</span>, mengajar & <span className="text-[#C9A227]">memantau</span> prestasi.
            </h1>
            <p className="mt-6 text-base sm:text-lg text-[#475569] max-w-xl">
              <SiteName /> menghubungkan Admin, Siswa, Tentor, dan Proktor sekolah mitra dalam satu alur data yang mulus — dari bank soal hingga analitik nilai.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={() => navigate("/register")} className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74] h-12 px-7 text-base" data-testid="hero-cta-primary">
                Mulai Sekarang <ArrowRight className="h-4 w-4" />
              </Button>
              <a href="#cara">
                <Button variant="outline" className="rounded-full h-12 px-7 text-base border-[#CBD5E1] hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid="hero-cta-secondary">
                  <PlayCircle className="h-4 w-4" /> Lihat Cara Kerja
                </Button>
              </a>
            </div>
            <div className="mt-10 grid grid-cols-4 gap-4 max-w-lg">
              {[["Siswa", stats.students], ["Tentor", stats.tutors], ["Kursus", stats.courses], ["Sekolah", stats.schools]].map(([l, v]) => (
                <div key={l}>
                  <p className="text-2xl font-bold text-[#0A1128] font-head">{v}+</p>
                  <p className="text-xs text-[#94A3B8]">{l}</p>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }} className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-[#0E7490]/20 to-[#C9A227]/20 rounded-[2rem] blur-2xl" />
            <img src={assetUrl(site.hero_image_url) || HERO} alt={site.site_name} className="relative rounded-[1.5rem] w-full h-[440px] object-cover border border-white shadow-2xl" />
          </motion.div>
        </div>
      </section>

      {/* Cara Kerja */}
      <section id="cara" className="py-20 bg-[#EFF6F8]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold">Cara menggunakan <SiteName /></h2>
            <p className="mt-3 text-[#475569]">Empat langkah sederhana untuk mulai dari pendaftaran hingga pemantauan prestasi.</p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl border border-[#E2E8F0] p-6 hover:-translate-y-1 transition-transform duration-200">
                <div className="h-12 w-12 rounded-xl bg-[#E6F5F8] text-[#0E7490] flex items-center justify-center"><s.icon className="h-6 w-6" /></div>
                <div className="mt-4 text-xs font-bold text-[#94A3B8]">LANGKAH {i + 1}</div>
                <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-[#475569]">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Portal value proposition */}
      <section id="portal" className="py-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold">Lima portal, satu sistem terhubung</h2>
            <p className="mt-3 text-[#475569]">Setiap peran punya ruang kerjanya sendiri dengan akses berbasis peran (RBAC) yang aman.</p>
          </div>
          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PORTALS.map((p, i) => (
              <motion.div key={p.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-[#E2E8F0] p-6 hover:-translate-y-1 transition-transform duration-200">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${p.color}1A`, color: p.color }}>
                  <p.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-[#475569]">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Kalender + Berita */}
      <section className="py-20 bg-[#EFF6F8]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-10">
          <div id="kalender">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#0E7490]" /><h2 className="text-2xl sm:text-3xl font-bold">Kalender Akademik</h2></div>
              <Link to="/kalender" className="text-sm font-medium text-[#0E7490] hover:underline inline-flex items-center gap-1" data-testid="landing-calendar-more">Lihat lengkap <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
            <div data-testid="landing-calendar">
              <MonthCalendar events={calendar} initialDate={serverNow} showList={false} compact />
            </div>
          </div>
          <div id="berita">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2"><Newspaper className="h-5 w-5 text-[#0E7490]" /><h2 className="text-2xl sm:text-3xl font-bold">Berita & Pengumuman</h2></div>
              <Link to="/berita" className="text-sm font-medium text-[#0E7490] hover:underline inline-flex items-center gap-1" data-testid="landing-news-more">Semua berita <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] divide-y divide-[#E2E8F0]" data-testid="landing-news">
              {news.length === 0 && <p className="p-6 text-sm text-[#94A3B8]">Belum ada berita.</p>}
              {news.slice(0, 6).map((n) => (
                <Link key={n.id} to={`/berita/${n.id}`} data-testid={`landing-news-${n.id}`}
                  className="group flex items-start gap-3 p-4 hover:bg-[#F8FAFC] transition-colors duration-200">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-[#0E7490] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#0A1128] group-hover:text-[#0E7490] transition-colors duration-200 leading-snug">{n.title}</h3>
                    <span className="mt-1 inline-block text-[11px] font-medium text-[#0E7490] opacity-0 group-hover:opacity-100 transition-opacity duration-200">Lihat lebih lanjut →</span>
                  </div>
                  <span className="rounded-full bg-[#E6F5F8] text-[#0E7490] px-2.5 py-0.5 text-[10px] font-semibold shrink-0">{n.category}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Kemitraan */}
      <section id="kemitraan" className="py-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#FBF3DC] text-[#C9A227] px-4 py-1.5 text-xs font-semibold"><Building2 className="h-3.5 w-3.5" /> Untuk Sekolah & Institusi</span>
            <h2 className="mt-6 text-3xl sm:text-4xl font-bold">Jadilah Sekolah Mitra</h2>
            <p className="mt-4 text-[#475569]">Berikan akses pemantauan (proktor) untuk sekolah Anda: pantau kegiatan belajar, unduh laporan nilai Try Out, dan analisis tren performa setiap siswa secara langsung.</p>
            <ul className="mt-6 space-y-3">
              {["Live monitoring aktivitas siswa", "Unduh laporan nilai (CSV)", "Analitik tren performa per siswa", "Broadcast informasi dari admin"].map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-[#0A1128]"><CheckCircle2 className="h-5 w-5 text-[#10B981]" /> {f}</li>
              ))}
            </ul>
            <div className="mt-6">
              <Link to="/register/proktor"><Button className="rounded-full bg-[#10B981] hover:bg-[#0ea371]" data-testid="landing-register-proctor">Daftar Akun Proktor <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/register/tentor" className="ml-2"><Button variant="outline" className="rounded-full border-[#C9A227] text-[#C9A227] hover:bg-[#FBF3DC]" data-testid="landing-register-tutor">Daftar sebagai Tentor</Button></Link>
              <p className="mt-2 text-xs text-[#94A3B8]">Sekolah mitra & pengajar dapat membuat akun (aktif setelah verifikasi admin).</p>
            </div>
          </div>
          <PartnershipForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0A1128] text-white py-12">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <SiteLogoMark className="h-8 w-8 rounded-lg bg-[#0E7490]" iconClass="h-4 w-4 text-white" />
            <span className="font-head font-bold"><SiteName /></span>
          </div>
          <p className="text-sm text-white/60">© {new Date().getFullYear()} <SiteName />. {site.footer_text || "Learning Management System berbasis RBAC."}</p>
          <div className="flex gap-3">
            <Link to="/login"><Button variant="outline" className="rounded-full border-white/20 bg-transparent text-white hover:bg-white hover:text-[#0A1128]" data-testid="footer-login-btn">Masuk Portal</Button></Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
