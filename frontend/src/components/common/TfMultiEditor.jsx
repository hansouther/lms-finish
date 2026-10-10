import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function TfLabelsEditor({ labels, onChange }) {
  const set = (i, v) => onChange(labels.map((l, idx) => (idx === i ? v : l)));
  return (
    <div className="grid grid-cols-2 gap-3" data-testid="tf-labels-editor">
      <div><Label className="text-xs">Teks pilihan "benar"</Label><Input value={labels[0]} onChange={(e) => set(0, e.target.value)} placeholder="Benar" className="mt-1" data-testid="tf-label-true" /></div>
      <div><Label className="text-xs">Teks pilihan "salah"</Label><Input value={labels[1]} onChange={(e) => set(1, e.target.value)} placeholder="Salah" className="mt-1" data-testid="tf-label-false" /></div>
      <p className="col-span-2 -mt-1 text-xs text-[#94A3B8]">Bisa diganti sesuai kebutuhan, mis. Sesuai / Tidak Sesuai, Fakta / Opini, Ya / Tidak.</p>
    </div>
  );
}

function KeyToggle({ value, current, label, onClick, testid }) {
  const on = current === value;
  const color = value === "true" ? "border-[#10B981] bg-[#10B981] text-white" : "border-[#EF4444] bg-[#EF4444] text-white";
  return (
    <button type="button" onClick={onClick} data-testid={testid}
      className={`min-w-[72px] rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${on ? color : "border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9]"}`}>
      {label}
    </button>
  );
}

export default function TfMultiEditor({ statements, keyMap, labels, onStatements, onKey }) {
  const setText = (i, v) => onStatements(statements.map((s, idx) => (idx === i ? { ...s, text: v } : s)));
  const add = () => {
    const n = Math.max(0, ...statements.map((s) => parseInt(String(s.id).replace(/\D/g, ""), 10) || 0)) + 1;
    onStatements([...statements, { id: `o${n}`, text: "" }]);
  };
  const remove = (sid) => onStatements(statements.filter((s) => s.id !== sid));
  return (
    <div data-testid="tf-multi-editor">
      <Label>Pernyataan & Kunci <span className="text-[#94A3B8] font-normal">(teks deskripsi ditulis di kolom Pertanyaan)</span></Label>
      <div className="mt-2 space-y-2">
        {statements.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2" data-testid={`tf-stmt-row-${s.id}`}>
            <span className="w-6 shrink-0 text-center font-mono2 text-xs text-[#94A3B8]">{i + 1}</span>
            <Input value={s.text} onChange={(e) => setText(i, e.target.value)} placeholder={`Pernyataan ${i + 1}`} data-testid={`tf-stmt-input-${s.id}`} />
            <KeyToggle value="true" current={keyMap[s.id]} label={labels[0] || "Benar"} onClick={() => onKey(s.id, "true")} testid={`tf-stmt-key-true-${s.id}`} />
            <KeyToggle value="false" current={keyMap[s.id]} label={labels[1] || "Salah"} onClick={() => onKey(s.id, "false")} testid={`tf-stmt-key-false-${s.id}`} />
            {statements.length > 2 && <Button variant="ghost" size="icon" onClick={() => remove(s.id)} data-testid={`tf-stmt-remove-${s.id}`}><X className="h-4 w-4 text-[#94A3B8]" /></Button>}
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={add} className="mt-2 rounded-full" data-testid="tf-stmt-add"><Plus className="h-4 w-4" /> Tambah Pernyataan</Button>
      <p className="mt-1 text-xs text-[#94A3B8]">Nilai dihitung proporsional: tiap pernyataan yang dijawab benar mendapat bagian poin yang sama.</p>
    </div>
  );
}
