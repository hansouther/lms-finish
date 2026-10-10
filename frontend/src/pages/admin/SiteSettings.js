import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, Trash2, Save, Globe, Image as ImageIcon, Timer } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { assetUrl, updateSiteLocal, DEFAULT_SITE, isVideo } from "@/lib/site";
import PageHeader from "@/components/common/PageHeader";
import { Loading } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

function Section({ icon: Icon, title, desc, children }) {
  return (
    <section className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-9 w-9 rounded-lg bg-[#E6F5F8] flex items-center justify-center shrink-0"><Icon className="h-4 w-4 text-[#0E7490]" /></div>
        <div><h2 className="font-bold text-[#0A1128]">{title}</h2><p className="text-xs text-[#475569] mt-0.5">{desc}</p></div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

const IMG_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,.ico";

function MediaThumb({ src, testid }) {
  if (isVideo(src)) return <video src={assetUrl(src)} autoPlay muted loop playsInline className="h-full w-full object-contain" data-testid={`${testid}-preview`} />;
  return <img src={assetUrl(src)} alt="" className="h-full w-full object-contain" data-testid={`${testid}-preview`} />;
}

function ImageField({ label, hint, value, onChange, testid, preview = "h-16 w-16", accept = IMG_ACCEPT }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try { const { data } = await api.post("/admin/site-assets", fd); onChange(data.url); toast.success("Gambar terunggah"); }
    catch (err) { toast.error(apiError(err)); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <Label className="text-[#0A1128]">{label}</Label>
      {hint && <p className="text-[11px] text-[#94A3B8] mt-0.5">{hint}</p>}
      <div className="mt-2 flex items-center gap-3 flex-wrap">
        <div className={`${preview} rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] flex items-center justify-center overflow-hidden`}>
          {value ? <MediaThumb src={value} testid={testid} /> : <ImageIcon className="h-5 w-5 text-[#CBD5E1]" />}
        </div>
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={pick} data-testid={`${testid}-input`} />
        <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={busy} onClick={() => ref.current?.click()} data-testid={`${testid}-upload`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Unggah
        </Button>
        {value && <Button type="button" variant="ghost" size="sm" className="rounded-full text-red-600" onClick={() => onChange("")} data-testid={`${testid}-remove`}><Trash2 className="h-4 w-4" /> Hapus</Button>}
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange, testid }) {
  return (
    <div>
      <Label className="text-[#0A1128] text-xs">{label}</Label>
      <div className="mt-1.5 flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-10 w-12 rounded-md border border-[#E2E8F0] cursor-pointer bg-white" data-testid={`${testid}-picker`} />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-10 font-mono2 text-xs" maxLength={7} data-testid={testid} />
      </div>
    </div>
  );
}

function MediaPreview({ f }) {
  const cover = f.loader_media_fit === "cover";
  const cls = cover ? "absolute inset-0 h-full w-full object-cover" : "max-h-40 max-w-[80%] object-contain rounded-xl";
  return (
    <div className="relative rounded-xl h-64 overflow-hidden flex flex-col items-center justify-center gap-3 text-center p-4" style={{ background: f.loader_bg_color, color: f.loader_text_color }} data-testid="loader-preview">
      {isVideo(f.loader_media_url)
        ? <video key={f.loader_media_url} src={assetUrl(f.loader_media_url)} autoPlay muted loop playsInline className={cls} data-testid="loader-preview-media" />
        : <img src={assetUrl(f.loader_media_url)} alt="" className={cls} data-testid="loader-preview-media" />}
      {f.loader_message && <p className={`relative text-xs max-w-xs ${cover ? "mt-auto px-3 py-2 rounded-lg bg-black/45 text-white" : "opacity-75"}`}>{f.loader_message}</p>}
    </div>
  );
}

function LoaderPreview({ f }) {
  if (f.loader_mode === "media" && f.loader_media_url) return <MediaPreview f={f} />;
  const logo = f.loader_logo_url || f.logo_url;
  const ind = f.loader_style === "bar"
    ? <div className="w-40 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.15)" }}><div className="h-full w-2/5 rounded-full animate-pulse" style={{ background: f.loader_accent_color }} /></div>
    : f.loader_style === "pulse"
      ? <div className="flex gap-2">{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: f.loader_accent_color, animationDelay: `${i * 150}ms` }} />)}</div>
      : <div className="h-8 w-8 rounded-full border-4 animate-spin" style={{ borderColor: "rgba(255,255,255,.18)", borderTopColor: f.loader_accent_color }} />;
  return (
    <div className="rounded-xl h-64 flex flex-col items-center justify-center gap-3 text-center p-4" style={{ background: f.loader_bg_color, color: f.loader_text_color }} data-testid="loader-preview">
      {logo ? <img src={assetUrl(logo)} alt="" className="h-14 w-14 object-contain rounded-xl" /> : <div className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl font-extrabold text-white" style={{ background: f.loader_accent_color }}>{(f.site_name || "B")[0].toUpperCase()}</div>}
      <p className="font-bold text-lg">{f.loader_title || f.site_name}</p>
      {ind}
      <p className="text-xs opacity-75 max-w-xs">{f.loader_message}</p>
    </div>
  );
}

export default function SiteSettings() {
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));

  useEffect(() => { api.get("/admin/site-settings").then((r) => setF(r.data)).catch((e) => toast.error(apiError(e))); }, []);
  if (!f) return <Loading />;

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/admin/site-settings", { ...f, loader_min_ms: Number(f.loader_min_ms) || 0 });
      setF(data);
      updateSiteLocal(data);
      toast.success("Pengaturan website tersimpan");
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 pb-24" data-testid="site-settings-page">
      <PageHeader title="Pengaturan Website" subtitle="Atur nama, logo, ikon tab browser, gambar, dan loading screen website." />
      <div className="grid lg:grid-cols-2 gap-6">
        <Section icon={Globe} title="Identitas Website" desc="Tampil di header, footer, login, dashboard, dan judul tab browser.">
          <div>
            <Label className="text-[#0A1128]">Nama Website</Label>
            <Input value={f.site_name} onChange={set("site_name")} maxLength={80} className="mt-1.5 h-11" data-testid="site-name-input" />
          </div>
          <div>
            <Label className="text-[#0A1128]">Tagline</Label>
            <Input value={f.tagline} onChange={set("tagline")} maxLength={160} className="mt-1.5 h-11" data-testid="site-tagline-input" />
          </div>
          <div>
            <Label className="text-[#0A1128]">Teks Footer</Label>
            <Input value={f.footer_text} onChange={set("footer_text")} maxLength={200} placeholder="Learning Management System berbasis RBAC." className="mt-1.5 h-11" data-testid="site-footer-input" />
          </div>
          <ImageField label="Logo Website" hint="PNG/SVG transparan, persegi, min. 256×256 px." value={f.logo_url} onChange={set("logo_url")} testid="site-logo" />
          <ImageField label="Ikon Tab Browser (Favicon)" hint="Persegi 64×64 / 128×128 px (PNG atau ICO). Kosongkan untuk memakai logo." value={f.favicon_url} onChange={set("favicon_url")} testid="site-favicon" preview="h-10 w-10" />
        </Section>

        <Section icon={ImageIcon} title="Foto yang Ditampilkan" desc="Gambar utama di halaman depan, panel login, dan gambar saat link dibagikan.">
          <ImageField label="Foto Utama Halaman Depan (Hero)" hint="Lanskap, min. 1200×900 px." value={f.hero_image_url} onChange={set("hero_image_url")} testid="site-hero" preview="h-20 w-32" />
          <ImageField label="Foto Latar Panel Login" hint="Tampil samar di panel kiri halaman login (laptop/PC)." value={f.login_image_url} onChange={set("login_image_url")} testid="site-login-image" preview="h-20 w-32" />
          <ImageField label="Gambar Bagikan Link (WhatsApp/Sosmed)" hint="1200×630 px. Kosongkan untuk memakai foto utama." value={f.og_image_url} onChange={set("og_image_url")} testid="site-og" preview="h-20 w-32" />
        </Section>

        <Section icon={Timer} title="Loading Screen" desc="Tampil saat website pertama kali dibuka, termasuk saat trafik sedang tinggi.">
          <div className="flex items-center justify-between rounded-lg bg-[#F8FAFC] p-3">
            <Label className="text-[#0A1128]">Aktifkan loading screen</Label>
            <Switch checked={f.loader_enabled} onCheckedChange={set("loader_enabled")} data-testid="loader-enabled-switch" />
          </div>
          <div>
            <Label className="text-[#0A1128]">Jenis Loading Screen</Label>
            <Select value={f.loader_mode} onValueChange={set("loader_mode")}>
              <SelectTrigger className="mt-1.5 h-11" data-testid="loader-mode-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Kustom (logo, judul, animasi)</SelectItem>
                <SelectItem value="media">GIF / Video pendek</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {f.loader_mode === "media" && (
            <div className="space-y-4 rounded-lg border border-[#E2E8F0] p-3" data-testid="loader-media-fields">
              <ImageField label="GIF / Video Loading" hint="GIF/PNG/WEBP maks. 5 MB, atau video MP4/WEBM maks. 15 MB (disarankan 2–6 detik, diputar berulang tanpa suara)." value={f.loader_media_url} onChange={set("loader_media_url")} testid="loader-media" preview="h-20 w-32" accept="image/gif,image/png,image/jpeg,image/webp,video/mp4,video/webm" />
              <div>
                <Label className="text-[#0A1128]">Tampilan Media</Label>
                <Select value={f.loader_media_fit} onValueChange={set("loader_media_fit")}>
                  <SelectTrigger className="mt-1.5 h-11" data-testid="loader-media-fit-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contain">Di tengah (ukuran asli)</SelectItem>
                    <SelectItem value="cover">Penuh layar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!f.loader_media_url && <p className="text-[11px] text-amber-600">Belum ada media — loading screen kustom akan dipakai.</p>}
            </div>
          )}
          {f.loader_mode !== "media" && <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-[#0A1128]">Judul</Label>
              <Input value={f.loader_title} onChange={set("loader_title")} maxLength={80} placeholder={f.site_name} className="mt-1.5 h-11" data-testid="loader-title-input" />
            </div>
            <div>
              <Label className="text-[#0A1128]">Gaya Animasi</Label>
              <Select value={f.loader_style} onValueChange={set("loader_style")}>
                <SelectTrigger className="mt-1.5 h-11" data-testid="loader-style-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spinner">Lingkaran berputar</SelectItem>
                  <SelectItem value="bar">Garis progres</SelectItem>
                  <SelectItem value="pulse">Titik berdenyut</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>}
          <div>
            <Label className="text-[#0A1128]">Pesan</Label>
            <Input value={f.loader_message} onChange={set("loader_message")} maxLength={200} className="mt-1.5 h-11" data-testid="loader-message-input" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ColorField label="Latar" value={f.loader_bg_color} onChange={set("loader_bg_color")} testid="loader-bg-color" />
            <ColorField label="Teks" value={f.loader_text_color} onChange={set("loader_text_color")} testid="loader-text-color" />
            <ColorField label="Aksen" value={f.loader_accent_color} onChange={set("loader_accent_color")} testid="loader-accent-color" />
          </div>
          <div>
            <Label className="text-[#0A1128]">Durasi minimal tampil (detik)</Label>
            <Input type="number" min={0} max={10} step={0.1} value={(Number(f.loader_min_ms) || 0) / 1000} onChange={(e) => set("loader_min_ms")(Math.round(Math.min(10, Math.max(0, Number(e.target.value) || 0)) * 1000))} className="mt-1.5 h-11 w-32" data-testid="loader-min-input" />
            <p className="text-[11px] text-[#94A3B8] mt-1">Loading screen tetap tampil sampai website siap, lalu minimal selama durasi ini.</p>
          </div>
          {f.loader_mode !== "media" && <ImageField label="Logo Loading Screen" hint="Kosongkan untuk memakai logo website." value={f.loader_logo_url} onChange={set("loader_logo_url")} testid="loader-logo" />}
        </Section>

        <Section icon={Timer} title="Pratinjau Loading Screen" desc="Tampilan yang dilihat pengunjung saat website dibuka.">
          <LoaderPreview f={f} />
          <Button type="button" variant="outline" className="rounded-full" onClick={() => setF((x) => ({ ...x, ...Object.fromEntries(Object.entries(DEFAULT_SITE).filter(([k]) => k.startsWith("loader_"))) }))} data-testid="loader-reset">
            Kembalikan loading screen bawaan
          </Button>
        </Section>
      </div>

      <div className="fixed bottom-0 inset-x-0 lg:left-64 z-30 border-t border-[#E2E8F0] bg-white/90 backdrop-blur px-4 sm:px-8 py-3 flex justify-end">
        <Button onClick={save} disabled={saving} className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74] px-6" data-testid="site-settings-save">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Pengaturan
        </Button>
      </div>
    </div>
  );
}
