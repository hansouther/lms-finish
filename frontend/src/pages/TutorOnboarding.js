import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Award, Loader2, Upload, Trash2, CheckCircle2, ArrowRight } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import FullScreenLoader from "@/components/FullScreenLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fileUrl } from "@/lib/media";
import { toast } from "sonner";
import { SiteLogoMark, SiteName } from "@/components/common/SiteBrand";

export default function TutorOnboarding() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [cv, setCv] = useState(null);
  const [certs, setCerts] = useState([]);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user === false) { navigate("/login", { replace: true }); return; }
    if (user) {
      setPhone(user.phone || "");
      if (user.cv_url) setCv({ url: user.cv_url, name: user.cv_name || "CV" });
      if (user.certificates?.length) setCerts(user.certificates);
    }
  }, [user, navigate]);

  if (!user) return <FullScreenLoader label="Memuat..." />;

  const doUpload = async (file) => {
    const fd = new FormData(); fd.append("file", file);
    const { data } = await api.post("/auth/upload-doc", fd, { headers: { "Content-Type": "multipart/form-data" } });
    return data;
  };

  const onCv = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingCv(true);
    try { const up = await doUpload(file); setCv({ url: up.url, name: up.name }); toast.success("CV terunggah"); }
    catch (err) { toast.error(apiError(err)); } finally { setUploadingCv(false); e.target.value = ""; }
  };
  const onCert = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingCert(true);
    try { const up = await doUpload(file); setCerts((c) => [...c, { url: up.url, name: up.name, type: up.type }]); toast.success("Sertifikat terunggah"); }
    catch (err) { toast.error(apiError(err)); } finally { setUploadingCert(false); e.target.value = ""; }
  };
  const removeCert = (i) => setCerts((c) => c.filter((_, idx) => idx !== i));

  const finish = async () => {
    if (!cv) return toast.error("Unggah CV (PDF) terlebih dahulu");
    setSaving(true);
    try {
      const { data } = await api.put("/auth/profile", { phone, cv_url: cv.url, cv_name: cv.name, certificates: certs });
      setUser(data);
      toast.success("Berkas tersimpan! Menunggu verifikasi admin.");
      navigate("/pending", { replace: true });
    } catch (err) { toast.error(apiError(err)); } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#EFF6F8]" data-testid="tutor-onboarding">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <SiteLogoMark className="h-10 w-10 rounded-xl bg-[#C9A227]" iconClass="h-5 w-5 text-white" />
          <span className="font-head font-bold text-xl text-[#0A1128]"><SiteName /></span>
        </div>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[#0A1128]">Lengkapi Berkas Tentor</h1>
          <p className="mt-2 text-sm text-[#475569]">Unggah CV dan sertifikat Anda agar admin dapat memverifikasi akun. CV: PDF. Sertifikat: PDF atau gambar PNG/JPEG (maks 2 MB).</p>

          <div className="mt-6 space-y-5">
            <div><Label className="text-[#0A1128]">No. WhatsApp</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812xxxxxxx" className="mt-1.5 h-11" data-testid="onboarding-phone" /></div>

            {/* CV */}
            <div>
              <Label className="text-[#0A1128]">CV (PDF)</Label>
              {cv ? (
                <div className="mt-1.5 flex items-center justify-between rounded-lg border border-[#E2E8F0] p-3" data-testid="cv-uploaded">
                  <a href={fileUrl(cv.url)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-[#0E7490] hover:underline"><FileText className="h-4 w-4" /> {cv.name}</a>
                  <button onClick={() => setCv(null)} className="text-[#CBD5E1] hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ) : (
                <label className="mt-1.5 flex items-center gap-2 rounded-lg border border-dashed border-[#CBD5E1] p-4 cursor-pointer hover:bg-[#EFF6F8] text-sm text-[#475569]" data-testid="cv-upload">
                  {uploadingCv ? <Loader2 className="h-4 w-4 animate-spin text-[#0E7490]" /> : <Upload className="h-4 w-4 text-[#0E7490]" />} {uploadingCv ? "Mengunggah..." : "Pilih berkas CV (PDF)"}
                  <input type="file" accept=".pdf" className="hidden" onChange={onCv} disabled={uploadingCv} />
                </label>
              )}
            </div>

            {/* Certificates */}
            <div>
              <Label className="text-[#0A1128]">Sertifikat (PDF / PNG / JPEG, maks 2 MB per gambar)</Label>
              <div className="mt-1.5 space-y-2" data-testid="certs-list">
                {certs.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] p-3" data-testid={`cert-${i}`}>
                    <a href={fileUrl(c.url)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-[#10B981] hover:underline"><Award className="h-4 w-4" /> {c.name}</a>
                    <button onClick={() => removeCert(i)} className="text-[#CBD5E1] hover:text-red-600" data-testid={`remove-cert-${i}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-[#CBD5E1] p-4 cursor-pointer hover:bg-[#EFF6F8] text-sm text-[#475569]" data-testid="cert-upload">
                {uploadingCert ? <Loader2 className="h-4 w-4 animate-spin text-[#10B981]" /> : <Upload className="h-4 w-4 text-[#10B981]" />} {uploadingCert ? "Mengunggah..." : "Tambah sertifikat"}
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={onCert} disabled={uploadingCert} />
              </label>
            </div>
          </div>

          <Button onClick={finish} disabled={saving} className="w-full h-11 rounded-full bg-[#0E7490] hover:bg-[#0B5C74] mt-7" data-testid="onboarding-finish">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> Simpan & Kirim untuk Verifikasi <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </div>
      </div>
    </div>
  );
}
