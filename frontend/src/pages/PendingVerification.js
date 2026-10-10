import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Clock, XCircle, LogOut, RefreshCw } from "lucide-react";
import { useAuth, roleHome, roleLabel } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import FullScreenLoader from "@/components/FullScreenLoader";
import { SiteLogoMark, SiteName } from "@/components/common/SiteBrand";

export default function PendingVerification() {
  const { user, logout, checkAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user === false) navigate("/login", { replace: true });
    else if (user && user.role === "admin") navigate("/admin", { replace: true });
    else if (user && (user.status === "approved" || !user.status)) navigate(roleHome(user.role), { replace: true });
  }, [user, navigate]);

  if (user === null || user === false || !user) return <FullScreenLoader label="Memeriksa status akun..." />;

  const rejected = user.status === "rejected";
  const handleLogout = async () => { await logout(); navigate("/login", { replace: true }); };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#EFF6F8]" data-testid="pending-verification">
      <div className="w-full max-w-lg">
        <Link to="/" className="flex items-center gap-2.5 mb-8 justify-center">
          <SiteLogoMark className="h-10 w-10 rounded-xl bg-[#0E7490]" iconClass="h-5 w-5 text-white" />
          <span className="font-head font-bold text-xl text-[#0A1128]"><SiteName /></span>
        </Link>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 text-center">
          <div className={`mx-auto h-16 w-16 rounded-2xl flex items-center justify-center ${rejected ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#FEF3C7] text-[#B45309]"}`}>
            {rejected ? <XCircle className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
          </div>
          <h1 className="mt-5 text-2xl font-bold text-[#0A1128]">
            {rejected ? "Pendaftaran Ditolak" : "Menunggu Verifikasi Admin"}
          </h1>
          <p className="mt-3 text-sm text-[#475569]">
            {rejected
              ? "Mohon maaf, pendaftaran akun Anda belum dapat disetujui. Silakan hubungi admin Binara LMS untuk informasi lebih lanjut."
              : `Akun ${roleLabel(user.role)} Anda telah dibuat dan sedang menunggu persetujuan admin. Anda akan bisa mengakses portal setelah akun diverifikasi.`}
          </p>

          <div className="mt-6 rounded-xl bg-[#EFF6F8] p-4 text-left text-sm space-y-1">
            <p className="text-[#0A1128]"><span className="text-[#94A3B8]">Nama:</span> <span className="font-medium">{user.name}</span></p>
            <p className="text-[#0A1128]"><span className="text-[#94A3B8]">Email:</span> <span className="font-medium">{user.email}</span></p>
            <p className="text-[#0A1128]"><span className="text-[#94A3B8]">Peran:</span> <span className="font-medium">{roleLabel(user.role)}</span></p>
            {user.school_name_text && <p className="text-[#0A1128]"><span className="text-[#94A3B8]">Sekolah:</span> <span className="font-medium">{user.school_name_text}</span></p>}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            {!rejected && (
              <Button onClick={() => checkAuth()} variant="outline" className="rounded-full border-[#CBD5E1] hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid="pending-refresh">
                <RefreshCw className="h-4 w-4" /> Periksa Status
              </Button>
            )}
            <Button onClick={handleLogout} className="rounded-full bg-[#0A1128] hover:bg-[#1a2338]" data-testid="pending-logout">
              <LogOut className="h-4 w-4" /> Keluar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
