import { useRef, useState } from "react";
import { BookOpenCheck, ImagePlus, Loader2, X } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import MathText, { QuestionImage } from "@/components/common/MathText";
import { toast } from "sonner";

export default function ExplanationEditor({ text, imageUrl, onChange }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Ukuran gambar maksimal 5 MB");
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try {
      const { data } = await api.post("/questions/upload-image", fd);
      onChange({ explanation_image_url: data.url });
    } catch (err) { toast.error(apiError(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-[#C9A227]/40 bg-[#FFFBEB] p-4" data-testid="explanation-field">
      <Label className="flex items-center gap-1.5"><BookOpenCheck className="h-4 w-4 text-[#C9A227]" /> Pembahasan <span className="text-[#94A3B8] font-normal">(penjelasan mendalam, tampil ke siswa jika pembahasan dibuka)</span></Label>
      <Textarea value={text} onChange={(e) => onChange({ explanation: e.target.value })} rows={5} className="mt-2 bg-white font-mono2 text-sm" placeholder="Jelaskan langkah penyelesaian, konsep, dan alasan kunci jawaban. Rumus pakai $...$" data-testid="question-explanation" />
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" className="hidden" onChange={pick} data-testid="explanation-image-input" />
      <div className="mt-2 flex items-start gap-3">
        {imageUrl && <QuestionImage src={imageUrl} className="max-h-40" testid="explanation-image-preview" />}
        <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={busy} className="rounded-full bg-white" data-testid="explanation-image-upload">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {imageUrl ? "Ganti gambar" : "Gambar pembahasan"}
        </Button>
        {imageUrl && <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ explanation_image_url: null })} className="rounded-full text-red-600 hover:bg-red-50" data-testid="explanation-image-remove"><X className="h-4 w-4" /> Hapus</Button>}
      </div>
      {text?.trim() && (
        <div className="mt-3 rounded-lg bg-white border border-[#E2E8F0] p-3" data-testid="explanation-preview">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8] mb-1">Pratinjau pembahasan</p>
          <MathText as="div" text={text} className="block text-sm text-[#0A1128] whitespace-pre-line" />
        </div>
      )}
    </div>
  );
}
