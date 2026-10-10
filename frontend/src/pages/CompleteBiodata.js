import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GraduationCap, Loader2, ArrowRight, LogOut, ShieldCheck } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { useAuth, roleHome, needsBiodata } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FullScreenLoader from "@/components/FullScreenLoader";
import { toast } from "sonner";

export default function CompleteBiodata() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", school_id: "", grade: "", phone: "", goal: "" });
  const [schools, setSchools] = useState([]);
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  useEffect(() => {
    if (user === false) navigate("/login", { replace: true });
    else if (user && !needsBiodata(user)) navigate(roleHome(user.role), { replace: true });
    if (user) setForm((f) => ({ name: f.name || user.name || "", school_id: f.school_id || user.school_id || "", grade: f.grade || user.grade || "", phone: f.phone || user.phone || "", goal: f.goal || user.goal || "" }));
  }, [user, navigate]);
  useEffect(() => { api.get("/public/schools").then((r) => setSchools(r.data)).catch(() => {}); }, []);

  if (!user) return <FullScreenLoader label="Memuat biodata..." />;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.school_id) return toast.error("Pilih asal sekolah terlebih dahulu");
    if (!agree) return toast.error("Centang pernyataan kebenaran data terlebih dahulu");
    setSaving(true);
    try {
      const { data } = await api.put("/auth/profile", { ...form, name: form.name.trim(), grade: form.grade.trim(), phone: form.phone.trim() });
      setUser(data);
      toast.success("Biodata tersimpan. Selamat datang!");
      navigate(roleHome(data.role), { replace: true });
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };
  const handleLogout = async () => { await logout(); navigate("/login", { replace: true }); };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#EFF6F8]" data-testid="complete-biodata">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="h-10 w-10 rounded-xl bg-[#0E7490] flex items-center justify-center"><GraduationCap className="h-5 w-5 text-white" /></div>
          <span className="font-head font-bold text-xl text-[#0A1128]">SKENA PENDIDIKAN BERPRESTASI</span>
        </Link>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#0A1128]">Lengkapi Biodata Siswa</h1>
          <p className="mt-2 text-sm text-[#475569]">Isi biodata dengan <b>jujur dan sebenar-benarnya</b> sesuai data diri Anda. Data ini dipakai untuk nilai Try Out, peringkat, dan laporan ke sekolah.</p>
          <p className="mt-2 text-xs text-[#94A3B8] truncate" data-testid="biodata-email">Akun: {user.email}</p>

          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="biodata-form">
            <div>
              <Label className="text-[#0A1128]">Nama Lengkap (sesuai data sekolah)</Label>
              <Input required value={form.name} onChange={set("name")} placeholder="Nama lengkap" className="mt-1.5 h-11" data-testid="biodata-name" />
            </div>
            <div>
              <Label className="text-[#0A1128]">Asal Sekolah</Label>
              <Select value={form.school_id} onValueChange={set("school_id")}>
                <SelectTrigger className="mt-1.5 h-11" data-testid="biodata-school"><SelectValue placeholder="Pilih sekolah" /></SelectTrigger>
                <SelectContent>
                  {schools.map((s) => <SelectItem key={s.id} value={s.id} data-testid={`biodata-school-${s.id}`}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[#0A1128]">Kelas</Label>
                <Input required value={form.grade} onChange={set("grade")} placeholder="Kelas 12 IPA" className="mt-1.5 h-11" data-testid="biodata-grade" />
              </div>
              <div>
                <Label className="text-[#0A1128]">No. WhatsApp</Label>
                <Input required type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="0812xxxxxxx" className="mt-1.5 h-11" data-testid="biodata-phone" />
              </div>
            </div>
            <div>
              <Label className="text-[#0A1128]">Target Bergabung (Tujuan)</Label>
              <Textarea required value={form.goal} onChange={set("goal")} placeholder="Contoh: lolos UTBK ke PTN impian..." className="mt-1.5" data-testid="biodata-goal" />
            </div>
            <label className="flex items-start gap-2.5 rounded-xl bg-[#EFF6F8] p-3 text-xs text-[#475569] cursor-pointer">
              <Checkbox checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" data-testid="biodata-agree" />
              <span><ShieldCheck className="inline h-3.5 w-3.5 text-[#0E7490] mr-1" />Saya menyatakan biodata di atas diisi dengan jujur, benar, dan sesuai data diri saya yang sebenarnya.</span>
            </label>
            <Button type="submit" disabled={saving} className="w-full h-11 rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="biodata-submit">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Simpan & Lanjutkan <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>
          <button type="button" onClick={handleLogout} className="mt-4 w-full text-center text-xs text-[#94A3B8] hover:text-[#0E7490] flex items-center justify-center gap-1" data-testid="biodata-logout">
            <LogOut className="h-3.5 w-3.5" /> Bukan akun Anda? Keluar
          </button>
        </div>
      </div>
    </div>
  );
}
