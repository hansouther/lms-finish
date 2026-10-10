import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, BadgeCheck } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import api, { apiError } from "@/lib/api";
import { useAuth, roleHome } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SiteLogoMark, SiteName } from "@/components/common/SiteBrand";

export default function RegisterTutor() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (user && user.role) {
      if (user.role === "tutor" && user.status && user.status !== "approved" && !user.cv_url) {
        navigate("/onboarding/tutor", { replace: true });
      } else if (user.status && user.status !== "approved" && user.role !== "admin") {
        navigate("/pending", { replace: true });
      } else {
        navigate(roleHome(user.role), { replace: true });
      }
    }
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register/tutor", form);
      setUser(data);
      toast.success("Akun tentor dibuat! Lengkapi CV & sertifikat Anda.");
      navigate("/onboarding/tutor", { replace: true });
    } catch (err) { toast.error(apiError(err)); } finally { setLoading(false); }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      // Kita kirim token dan juga catatan bahwa ini pendaftaran untuk tutor
      const { data } = await api.post("/auth/google/session", { 
        token: credentialResponse.credential,
        intended_role: "tutor" 
      });
      setUser(data);
      
      // Jika user baru login Google, role asalnya adalah student.
      // Kita arahkan mereka ke halaman onboarding jika perlu, 
      // atau biarkan mereka menekan tombol "Daftar Jadi Tentor" di profil mereka nanti.
      toast.success("Berhasil masuk dengan Google! Silakan lengkapi profil Anda.");
      
      if (data.role === "tutor" && data.status !== "approved" && !data.cv_url) {
        navigate("/onboarding/tutor", { replace: true });
      } else if (data.status !== "approved" && data.role !== "admin") {
        navigate("/pending", { replace: true });
      } else {
        navigate(roleHome(data.role), { replace: true });
      }
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#EFF6F8]">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2.5 mb-8 justify-center">
          <SiteLogoMark className="h-10 w-10 rounded-xl bg-[#C9A227]" iconClass="h-5 w-5 text-white" />
          <span className="font-head font-bold text-xl text-[#0A1128]"><SiteName /></span>
        </Link>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FBF3DC] text-[#C9A227] px-3 py-1 text-xs font-semibold"><BadgeCheck className="h-3.5 w-3.5" /> Portal Tentor / Pengajar</span>
          <h1 className="mt-3 text-2xl font-bold text-[#0A1128]">Daftar sebagai Tentor</h1>
          <p className="mt-2 text-sm text-[#475569]">Bergabung mengajar di Skena LMS. Akun aktif setelah CV & sertifikat diverifikasi admin. Sudah punya akun? <Link to="/login" className="text-[#0E7490] font-semibold hover:underline">Masuk</Link></p>

          <div className="flex justify-center w-full mt-6 mb-2">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error("Gagal mendaftar dengan layanan Google")}
              useOneTap
              shape="pill"
              theme="outline"
              width="100%"
            />
          </div>
          
          <div className="my-5 flex items-center gap-3 text-xs text-[#94A3B8]"><div className="flex-1 h-px bg-[#E2E8F0]" /> atau isi manual <div className="flex-1 h-px bg-[#E2E8F0]" /></div>

          <form onSubmit={submit} className="space-y-4" data-testid="register-tutor-form">
            <div><Label className="text-[#0A1128]">Nama Lengkap</Label><Input required value={form.name} onChange={set("name")} placeholder="Nama lengkap Anda" className="mt-1.5 h-11" data-testid="tutor-name" /></div>
            <div><Label className="text-[#0A1128]">Email</Label><Input required type="email" value={form.email} onChange={set("email")} placeholder="tentor@email.com" className="mt-1.5 h-11" data-testid="tutor-email" /></div>
            <div><Label className="text-[#0A1128]">No. WhatsApp</Label><Input required value={form.phone} onChange={set("phone")} placeholder="0812xxxxxxx" className="mt-1.5 h-11" data-testid="tutor-phone" /></div>
            <div><Label className="text-[#0A1128]">Kata Sandi</Label><Input required type="password" value={form.password} onChange={set("password")} placeholder="Minimal 6 karakter" className="mt-1.5 h-11" data-testid="tutor-password" /></div>
            <Button type="submit" disabled={loading} className="w-full h-11 rounded-full bg-[#C9A227] hover:bg-[#A9871C] text-[#0A1128]" data-testid="tutor-submit">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Lanjut ke Unggah Berkas <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-[#475569]">Mendaftar sebagai siswa? <Link to="/register" className="text-[#0E7490] font-semibold hover:underline">Daftar Siswa</Link></p>
        </div>
      </div>
    </div>
  );
}