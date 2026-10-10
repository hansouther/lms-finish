import { ShieldAlert } from "lucide-react";

export default function CheatTag({ total = 0, current = 0, auto = false, testid }) {
  if (!total && !current) return null;
  const title = `Total keluar tab di Try Out ini: ${total} kali (termasuk sebelum diulang). Percobaan sekarang: ${current} kali.`;
  return (
    <div className="mt-1 flex flex-wrap gap-1" data-testid={testid} title={title}>
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-600">
        <ShieldAlert className="h-3 w-3" /> Terindikasi mencontek: {Math.max(total, current)}x keluar tab
      </span>
      {auto && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">Otomatis dikumpulkan</span>}
    </div>
  );
}
