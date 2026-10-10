import MathText from "@/components/common/MathText";
import { tfLabels, parseTfMap } from "@/lib/tf";

export function TfMultiAnswer({ q, value, onChange }) {
  const [lt, lf] = tfLabels(q);
  const map = parseTfMap(value);
  const pick = (sid, v) => {
    const next = { ...map, [sid]: v };
    onChange(q.options.filter((s) => next[s.id]).map((s) => `${s.id}:${next[s.id]}`));
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]" data-testid="tf-multi-answer">
      <table className="w-full text-sm">
        <thead className="bg-[#F8FAFC] text-[#475569]">
          <tr>
            <th className="w-10 px-3 py-2.5 text-left font-semibold">No</th>
            <th className="px-3 py-2.5 text-left font-semibold">Pernyataan</th>
            <th className="w-28 px-2 py-2.5 text-center font-semibold">{lt}</th>
            <th className="w-28 px-2 py-2.5 text-center font-semibold">{lf}</th>
          </tr>
        </thead>
        <tbody>
          {q.options.map((s, i) => (
            <tr key={s.id} className={`border-t border-[#E2E8F0] transition-colors duration-200 ${map[s.id] ? "bg-[#F0F9FB]" : ""}`} data-testid={`tf-row-${s.id}`}>
              <td className="px-3 py-3 font-mono2 text-xs text-[#94A3B8]">{i + 1}</td>
              <td className="px-3 py-3"><MathText text={s.text} className="text-[#0A1128]" /></td>
              {["true", "false"].map((v) => (
                <td key={v} className="px-2 py-3 text-center">
                  <button type="button" onClick={() => pick(s.id, v)} aria-label={v === "true" ? lt : lf} data-testid={`tf-pick-${v}-${s.id}`}
                    className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors duration-200 ${map[s.id] === v ? "border-[#0E7490] bg-[#0E7490]" : "border-[#CBD5E1] hover:border-[#0E7490]"}`}>
                    {map[s.id] === v && <span className="h-2 w-2 rounded-full bg-white" />}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TfMultiReview({ pq }) {
  const [lt, lf] = tfLabels(pq);
  const label = (v) => (v === "true" ? lt : v === "false" ? lf : "(kosong)");
  const mine = parseTfMap(pq.student_answer);
  const key = parseTfMap(pq.correct_answers);
  return (
    <div className="mt-3 ml-8 overflow-x-auto rounded-lg border border-[#E2E8F0]" data-testid="tf-multi-review">
      <table className="w-full text-sm">
        <thead className="bg-[#F8FAFC] text-xs text-[#94A3B8]">
          <tr><th className="px-3 py-2 text-left">Pernyataan</th><th className="px-3 py-2 text-left">Jawaban Anda</th><th className="px-3 py-2 text-left">Kunci</th></tr>
        </thead>
        <tbody>
          {(pq.options || []).map((s) => (
            <tr key={s.id} className="border-t border-[#E2E8F0]">
              <td className="px-3 py-2"><MathText text={s.text} className="text-[#0A1128]" /></td>
              <td className={`px-3 py-2 font-medium ${mine[s.id] === key[s.id] ? "text-[#10B981]" : "text-[#EF4444]"}`}>{label(mine[s.id])}</td>
              <td className="px-3 py-2 font-medium text-[#10B981]">{label(key[s.id])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
