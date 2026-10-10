import { useEffect, useState } from "react";
import { Smartphone, Share, PlusSquare, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isIOS, isStandalone } from "@/lib/fullscreen";
import { canPromptInstall, onInstallAvailable, promptInstall } from "@/lib/pwa";

const KEY = "install_banner_hidden";

export default function InstallAppBanner() {
  const [canPrompt, setCanPrompt] = useState(canPromptInstall());
  const [hidden, setHidden] = useState(() => sessionStorage.getItem(KEY) === "1");
  const [iosOpen, setIosOpen] = useState(false);
  useEffect(() => onInstallAvailable(setCanPrompt), []);

  const ios = isIOS();
  if (isStandalone() || hidden || (!ios && !canPrompt)) return null;

  const install = () => (ios ? setIosOpen(true) : promptInstall());
  const close = () => { sessionStorage.setItem(KEY, "1"); setHidden(true); };

  return (
    <>
      <div className="mb-6 rounded-2xl border border-[#BEE3EC] bg-[#E6F5F8] p-4 flex items-start sm:items-center gap-3 flex-col sm:flex-row" data-testid="install-app-banner">
        <div className="h-10 w-10 shrink-0 rounded-full bg-[#0E7490] flex items-center justify-center"><Smartphone className="h-5 w-5 text-white" /></div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#0A1128] text-sm">Pasang Binara sebagai Aplikasi</p>
          <p className="text-xs text-[#475569] mt-0.5">Try Out tampil penuh tanpa bilah browser, seperti aplikasi CBT{ios ? " (direkomendasikan untuk iPhone/iPad)" : ""}.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={install} className="flex-1 sm:flex-none rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="install-app-button"><Download className="h-4 w-4" /> Pasang Aplikasi</Button>
          <Button variant="ghost" size="icon" onClick={close} className="rounded-full shrink-0" data-testid="install-app-dismiss"><X className="h-4 w-4" /></Button>
        </div>
      </div>
      <IosInstallDialog open={iosOpen} onOpenChange={setIosOpen} />
    </>
  );
}

function IosInstallDialog({ open, onOpenChange }) {
  const steps = [
    { icon: Share, text: <>Buka di <b>Safari</b>, lalu ketuk tombol <b>Bagikan</b> di bilah bawah/atas.</> },
    { icon: PlusSquare, text: <>Gulir dan pilih <b>Tambahkan ke Layar Utama</b> (Add to Home Screen).</> },
    { icon: Smartphone, text: <>Ketuk <b>Tambah</b>, lalu buka <b>Binara</b> dari ikon di layar utama untuk mengerjakan Try Out.</> },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-md" data-testid="ios-install-dialog">
        <DialogHeader><DialogTitle className="text-left">Pasang di iPhone / iPad</DialogTitle></DialogHeader>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 items-start text-sm text-[#475569]">
              <span className="h-8 w-8 shrink-0 rounded-full bg-[#E6F5F8] flex items-center justify-center"><s.icon className="h-4 w-4 text-[#0E7490]" /></span>
              <span className="pt-1.5">{s.text}</span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
