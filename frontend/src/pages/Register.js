import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, ArrowRight, Loader2 } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import api, { apiError } from "@/lib/api";
import { useAuth, roleHome } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Register() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", school_id: "", grade: "", goal: "" });
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  useEffect(() => {
    if (user && user.role) {
      if (user.status && user.status !== "approved" && user.role !== "admin") navigate("/pending", { replace: true });
      else navigate(roleHome(user.role), { replace: true });
    }
    api.get("/public/schools").then((r) => setSchools(r.data)).catch(() => {});
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.school_id) return toast.error("Pilih asal sekolah terlebih dahulu");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", form);
      setUser(data);
      toast.success("Akun berhasil dibuat!");
      if (data.status && data.status !== "approved") navigate("/pending", { replace: true });
      else navigate(roleHome(data.role), { replace: true });
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/google/session", { token: credentialResponse.credential });
      setUser(data);
      toast.success("Akun Google terhubung! Lengkapi biodata Anda.");
      if (data.status && data.status !== "approved" && data.role !== "admin") navigate("/pending", { replace: true });
      else navigate(roleHome(data.role), { replace: true });
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
          <div className="h-10 w-10 rounded-xl bg-[#0E7490] flex items-center justify-center"><GraduationCap className="h-5 w-5 text-white" /></div>
          <span className="font-head font-bold text-xl text-[#0A1128]">SKENA PENDIDIKAN BERPRESTASI</span>
        </Link>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#0A1128]">Daftar sebagai Siswa</h1>
          <p className="mt-2 text-sm text-[#475569]">Sudah punya akun? <Link to="/login" className="text-[#0E7490] font-semibold hover:underline">Masuk</Link></p>

          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="register-form">
            <div>
              <Label className="text-[#0A1128]">Nama Lengkap</Label>
              <Input required value={form.name} onChange={set("name")} placeholder="Nama Anda" className="mt-1.5 h-11" data-testid="register-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[#0A1128]">Kelas</Label>
                <Input required value={form.grade} onChange={set("grade")} placeholder="Kelas 12 IPA" className="mt-1.5 h-11" data-testid="register-grade" />
              </div>
              <div>
                <Label className="text-[#0A1128]">No. WhatsApp</Label>
                <Input required value={form.phone} onChange={set("phone")} placeholder="0812xxxxxxx" className="mt-1.5 h-11" data-testid="register-phone" />
              </div>
            </div>
            <div>
              <Label className="text-[#0A1128]">Asal Sekolah</Label>
              <Select value={form.school_id} onValueChange={set("school_id")}>
                <SelectTrigger className="mt-1.5 h-11" data-testid="register-school"><SelectValue placeholder="Pilih sekolah" /></SelectTrigger>
                <SelectContent>
                  {schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#0A1128]">Email</Label>
              <Input required type="email" value={form.email} onChange={set("email")} placeholder="nama@email.com" className="mt-1.5 h-11" data-testid="register-email" />
            </div>
            <div>
              <Label className="text-[#0A1128]">Kata Sandi</Label>
              <Input required type="password" value={form.password} onChange={set("password")} placeholder="Minimal 6 karakter" className="mt-1.5 h-11" data-testid="register-password" />
            </div>
            <div>
              <Label className="text-[#0A1128]">Target Bergabung (Tujuan)</Label>
              <Textarea required value={form.goal} onChange={set("goal")} placeholder="Contoh: lolos UTBK ke PTN impian, memperbaiki nilai Matematika..." className="mt-1.5" data-testid="register-goal" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="register-submit">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Buat Akun <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-[#94A3B8]">
            <div className="flex-1 h-px bg-[#E2E8F0]" />ATAU<div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>

          <div className="flex justify-center w-full mb-6">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error("Gagal mendaftar dengan Google")}
              useOneTap
              shape="pill"
              theme="outline"
              width="100%"
            />
          </div>

          <p className="mt-4 text-center text-sm text-[#475569]">Perwakilan sekolah? <Link to="/register/proktor" className="text-[#10B981] font-semibold hover:underline" data-testid="link-register-proctor">Daftar sebagai Proktor</Link> · Pengajar? <Link to="/register/tentor" className="text-[#C9A227] font-semibold hover:underline" data-testid="link-register-tutor">Daftar sebagai Tentor</Link></p>
        </div>
      </div>
    </div>
  );
}