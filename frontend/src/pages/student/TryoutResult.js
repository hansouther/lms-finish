import { useParams, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, ArrowLeft, Trophy } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import { Loading } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import MathText, { QuestionImage } from "@/components/common/MathText";
import { TfMultiReview } from "@/components/common/TfMulti";
import { tfLabels } from "@/lib/tf";

const TYPE_LABEL = { single: "Pilihan Ganda", multiple: "Pilihan Ganda Kompleks", truefalse: "Benar/Salah", truefalse_multi: "Benar/Salah Majemuk", essay: "Esai" };

function answerText(pq) {
  const opts = pq.options || [];
  const toText = (arr) => arr.map((a) => {
    const o = opts.find((o) => o.id === a);
    if (o) return o.text;
    if (a === "true") return tfLabels(pq)[0];
    if (a === "false") return tfLabels(pq)[1];
    return a;
  }).join(", ");
  return { student: toText(pq.student_answer || []) || "(kosong)", correct: toText(pq.correct_answers || []) };
}

export default function TryoutResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { data, loading } = useFetch(`/student/attempts/${attemptId}`);

  if (loading) return <Loading />;
  const pct = data.percentage;
  const color = pct >= 70 ? "#10B981" : pct >= 50 ? "#C9A227" : "#EF4444";

  return (
    <div data-testid="tryout-result">
      <Button variant="ghost" onClick={() => navigate("/student/tryouts")} className="mb-4 text-[#475569] hover:text-[#0E7490] hover:bg-[#E6F5F8]" data-testid="back-to-tryouts"><ArrowLeft className="h-4 w-4" /> Kembali</Button>

      <div className="rounded-2xl bg-[#0A1128] text-white p-8 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full blur-3xl" style={{ backgroundColor: `${color}55` }} />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-white/70 text-sm">{data.tryout?.title}</p>
            <h1 className="mt-1 text-2xl font-bold">Hasil Try Out Anda</h1>
            <p className="mt-3 text-white/70 text-sm">Skor: <span className="font-mono2 font-bold text-white">{data.score} / {data.max_score}</span></p>
            {data.irt_scaled != null && (
              <div className="mt-3 inline-flex items-center gap-3 rounded-xl bg-white/10 px-4 py-2" data-testid="irt-score-badge">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-white/60">Skor IRT{data.irt_scale_label ? ` · ${data.irt_scale_label}` : ""}</p>
                  <p className="font-mono2 text-xl font-bold text-[#5FD3E8]">{data.irt_scaled}</p>
                </div>
                <div className="h-8 w-px bg-white/15" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-white/60">Kemampuan (θ)</p>
                  <p className="font-mono2 text-sm text-white">{data.theta}{data.theta_se != null ? <span className="text-white/50"> ± {data.theta_se}</span> : null}</p>
                </div>
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="h-28 w-28 rounded-full flex items-center justify-center border-4" style={{ borderColor: color }}>
              <div>
                <p className="font-mono2 text-3xl font-bold" style={{ color }}>{pct}%</p>
                <p className="text-[10px] text-white/60 uppercase tracking-wide">Nilai Akhir</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="mt-8 mb-4 font-semibold text-[#0A1128] flex items-center gap-2"><Trophy className="h-5 w-5 text-[#C9A227]" /> Pembahasan Jawaban</h2>
      <div className="space-y-4">
        {(data.per_question || []).map((pq, i) => {
          const at = answerText(pq);
          return (
            <div key={pq.question_id} className="bg-white rounded-xl border border-[#E2E8F0] p-5" data-testid={`review-${i}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {pq.correct ? <CheckCircle2 className="h-5 w-5 text-[#10B981] shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-[#EF4444] shrink-0 mt-0.5" />}
                  <div>
                    <p className="text-[11px] font-semibold text-[#94A3B8]">Soal {i + 1} · {TYPE_LABEL[pq.type]}</p>
                    <MathText as="div" text={pq.text} className="mt-1 block text-sm text-[#0A1128]" />
                    <QuestionImage src={pq.image_url} className="mt-2 max-h-60" testid={`review-image-${i}`} />
                  </div>
                </div>
                <span className="font-mono2 text-sm font-bold shrink-0" style={{ color: pq.correct ? "#10B981" : "#EF4444" }}>{pq.earned}/{pq.points}</span>
              </div>
              {pq.type === "truefalse_multi" ? <TfMultiReview pq={pq} /> : (
              <div className="mt-3 ml-8 grid sm:grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-[#EFF6F8] px-3 py-2"><span className="text-xs text-[#94A3B8]">Jawaban Anda:</span> <MathText text={at.student} className="text-[#0A1128]" /></div>
                <div className="rounded-lg bg-[#ECFDF5] px-3 py-2"><span className="text-xs text-[#94A3B8]">Kunci:</span> <MathText text={at.correct} className="text-[#10B981] font-medium" /></div>
              </div>
              )}
            </div>
          );
        })}
        {(!data.per_question || data.per_question.length === 0) && (
          <p className="text-sm text-[#94A3B8]">Pembahasan tidak tersedia untuk hasil ini.</p>
        )}
      </div>
    </div>
  );
}
