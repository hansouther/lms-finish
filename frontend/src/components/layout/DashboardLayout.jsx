import { useState, useEffect } from "react";
import { NavLink, Link, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Newspaper, CalendarDays, BookOpen, CalendarClock, FileText,
  Radio, Handshake, Users, LogOut, Menu, X, ClipboardList,
  Gavel, CalendarCheck, School, BarChart3, MonitorPlay, Download, Library, Bell, UserCog, ClipboardCheck, Target, FileBarChart2, Wallet,
} from "lucide-react";
import { useAuth, roleLabel } from "@/context/AuthContext";
import api from "@/lib/api";
import { SheetTitle, SheetDescription } from "@/components/ui/sheet"; 
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SiteLogoMark, SiteName } from "@/components/common/SiteBrand";

const NAV = {
  admin: [
    { to: "/admin", label: "Ringkasan", icon: LayoutDashboard, end: true },
    { to: "/admin/news", label: "Berita & Pengumuman", icon: Newspaper },
    { to: "/admin/calendar", label: "Kalender Akademik", icon: CalendarDays },
    { to: "/admin/courses", label: "Kursus", icon: BookOpen },
    { to: "/admin/schedule", label: "Jadwal & Bidding", icon: CalendarClock },
    { to: "/admin/classes", label: "Kelola Kelas", icon: Library },
    { to: "/admin/tryouts", label: "Bank Soal & Try Out", icon: FileText },
    { to: "/admin/analysis", label: "Analisis Nilai", icon: FileBarChart2 },
    { to: "/admin/payments", label: "Pembayaran", icon: Wallet },
    { to: "/admin/broadcasts", label: "Broadcast Proktor", icon: Radio },
    { to: "/admin/partnerships", label: "Kemitraan", icon: Handshake },
    { to: "/admin/users", label: "Pengguna & Sekolah", icon: Users },
  ],
  student: [
    { to: "/student", label: "Ringkasan", icon: LayoutDashboard, end: true },
    { to: "/student/learning", label: "Ruang Belajar", icon: Library },
    { to: "/student/tryouts", label: "CBT / Try Out", icon: ClipboardList },
    { to: "/student/courses", label: "Katalog Kursus", icon: BookOpen },
    { to: "/student/schedule", label: "Jadwal Saya", icon: CalendarCheck },
    { to: "/student/payments", label: "Riwayat Pembayaran", icon: Wallet },
  ],
  tutor: [
    { to: "/tutor", label: "Ringkasan", icon: LayoutDashboard, end: true },
    { to: "/tutor/bidding", label: "Job Bidding", icon: Gavel },
    { to: "/tutor/calendar", label: "Kalender Saya", icon: CalendarCheck },
    { to: "/tutor/classes", label: "Manajemen Kelas", icon: Users },
    { to: "/tutor/materials", label: "Materi Ajar", icon: Library },
  ],
  proctor: [
    { to: "/proctor", label: "Ringkasan", icon: LayoutDashboard, end: true },
    { to: "/proctor/monitoring", label: "Live Monitoring", icon: MonitorPlay },
    { to: "/proctor/trainings", label: "Kegiatan Pelatihan", icon: Library },
    { to: "/proctor/attendance", label: "Rekap Kehadiran", icon: ClipboardCheck },
    { to: "/proctor/analytics", label: "Analitik Performa", icon: BarChart3 },
    { to: "/proctor/weakness", label: "Analisis Kelemahan", icon: Target },
    { to: "/proctor/reports", label: "Laporan Nilai", icon: Download },
  ],
};

function SidebarContent({ items, onNavigate }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          data-testid={`nav-${item.to.replace(/\//g, "-").replace(/^-/, "")}`}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
              isActive
                ? "bg-[#0E7490] text-white shadow-sm shadow-[#0E7490]/30"
                : "text-[#475569] hover:bg-[#E6F5F8] hover:text-[#0E7490]"
            }`
          }
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 h-16 border-b border-[#E2E8F0]">
      <SiteLogoMark className="h-9 w-9 rounded-xl bg-[#0E7490] shadow-md shadow-[#0E7490]/30" iconClass="h-5 w-5 text-white" />
      <div className="leading-tight">
        <p className="font-head font-bold text-[#0A1128] text-[15px]"><SiteName /></p>
        <p className="text-[10px] uppercase tracking-widest text-[#94A3B8]">Learning System</p>
      </div>
    </div>
  );
}

function StudentBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = () => api.get("/student/notifications").then((r) => { setItems(r.data.items || []); setUnread(r.data.unread || 0); }).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const onOpen = (o) => {
    if (o && unread > 0) api.post("/student/notifications/read").then(() => setUnread(0)).catch(() => {});
  };

  return (
    <Popover onOpenChange={onOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-[#E6F5F8] text-[#475569] transition-colors duration-200" data-testid="student-bell" title="Notifikasi">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center" data-testid="student-bell-badge">{unread > 99 ? "99+" : unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="student-notifications">
        <div className="p-3 border-b border-[#E2E8F0]"><p className="font-semibold text-sm text-[#0A1128]">Notifikasi</p></div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">Belum ada notifikasi</p>
          ) : items.map((n) => (
            <div key={n.id} className={`p-3 border-b border-[#F1F5F9] ${!n.read ? "bg-[#EFF6F8]" : ""}`} data-testid={`notif-${n.id}`}>
              <p className="text-sm font-medium text-[#0A1128]">{n.title}</p>
              {n.body && <p className="text-xs text-[#475569] mt-0.5">{n.body}</p>}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AdminBell() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () => api.get("/admin/pending-count").then((r) => { if (active) setCount(r.data.count || 0); }).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { active = false; clearInterval(t); };
  }, []);

  return (
    <button onClick={() => navigate("/admin/users")} className="relative p-2 rounded-lg hover:bg-[#E6F5F8] text-[#475569] transition-colors duration-200" data-testid="admin-bell" title="Pendaftaran menunggu verifikasi">
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center" data-testid="admin-bell-badge">{count > 99 ? "99+" : count}</span>
      )}
    </button>
  );
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAV[user?.role] || [];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = (user?.name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#EFF6F8] flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-[#E2E8F0] flex-col fixed inset-y-0 z-30">
        <Brand />
        <SidebarContent items={items} />
        <div className="p-3 border-t border-[#E2E8F0] space-y-1">
          <NavLink to="/profile" data-testid="nav-profile" className={({ isActive }) => `w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${isActive ? "bg-[#E6F5F8] text-[#0E7490]" : "text-[#475569] hover:bg-[#E6F5F8] hover:text-[#0E7490]"}`}>
            <UserCog className="h-[18px] w-[18px]" /> Profil Saya
          </NavLink>
          <button
            onClick={handleLogout}
            data-testid="logout-button"
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#475569] hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex-1 lg:pl-64 min-w-0">
        {/* Top header */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="lg:hidden p-2 rounded-lg hover:bg-[#E6F5F8] text-[#475569]" data-testid="mobile-menu-button">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 flex flex-col">
                {/* Dua baris wajib untuk membersihkan peringatan konsol */}
                  <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
                  <SheetDescription className="sr-only">Tautan cepat menu utama LMS</SheetDescription>
                {/* Konten asli tautan menu sidebar Anda tetap di bawah sini... */}
                <Brand />
                <SidebarContent items={items} onNavigate={() => setMobileOpen(false)} />
                <div className="p-3 border-t border-[#E2E8F0] space-y-1">
                  <NavLink to="/profile" onClick={() => setMobileOpen(false)} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#475569] hover:bg-[#E6F5F8] hover:text-[#0E7490]">
                    <UserCog className="h-[18px] w-[18px]" /> Profil Saya
                  </NavLink>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#475569] hover:bg-red-50 hover:text-red-600"
                  >
                    <LogOut className="h-[18px] w-[18px]" /> Keluar
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            <div>
              <p className="text-xs text-[#94A3B8] font-medium">Portal {roleLabel(user?.role)}</p>
              <p className="text-sm font-semibold text-[#0A1128] hidden sm:block">Selamat datang, {user?.name?.split(" ")[0]}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user?.role === "admin" && <AdminBell />}
            {user?.role === "student" && <StudentBell />}
            <Link to="/profile" className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[#E6F5F8] transition-colors duration-200" data-testid="header-profile-link">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-[#0A1128] leading-tight">{user?.name}</p>
                <p className="text-xs text-[#94A3B8]">{user?.email}</p>
              </div>
              {user?.picture ? (
                <img src={user.picture} alt="avatar" className="h-9 w-9 rounded-full object-cover border border-[#E2E8F0]" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-[#E6F5F8] text-[#0E7490] flex items-center justify-center text-sm font-bold">
                  {initials}
                </div>
              )}
            </Link>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1400px]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
