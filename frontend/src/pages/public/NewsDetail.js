import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Newspaper, User, CalendarDays, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import PublicShell from "@/components/public/PublicShell";
import useSeo, { DEFAULT_OG_IMAGE } from "@/hooks/useSeo";
import { Loading, Empty } from "@/components/common/States";
import { formatDate } from "@/lib/format";
import { SiteLogoMark, SiteName } from "@/components/common/SiteBrand";

export default function NewsDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useSeo({
    title: item ? `${item.title} — Binara LMS` : "Berita — Binara LMS",
    description: item ? (item.content || "").slice(0, 160) : "Berita & pengumuman Binara LMS.",
    image: item?.thumbnail || DEFAULT_OG_IMAGE,
    type: "article",
  });

  useEffect(() => {
    setLoading(true); setNotFound(false); setItem(null);
    api.get(`/public/news/${id}`)
      .then((r) => setItem(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    api.get("/public/news").then((r) => setRelated(r.data)).catch(() => {});
    window.scrollTo(0, 0);
  }, [id]);

  const others = related.filter((n) => n.id !== id);
  const sameCat = item ? others.filter((n) => n.category === item.category) : [];
  const relatedList = [...sameCat, ...others.filter((n) => !sameCat.includes(n))].slice(0, 4);

  return (
    <PublicShell>
      <section className="py-14">
        <div className="max-w-3xl mx-auto px-5 sm:px-8" data-testid="news-detail">
          <button onClick={() => navigate("/berita")} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#475569] hover:text-[#0E7490] mb-6 transition-colors duration-200" data-testid="news-back">
            <ArrowLeft className="h-4 w-4" /> Semua Berita
          </button>

          {loading ? <Loading /> : notFound || !item ? (
            <Empty icon={Newspaper} title="Berita tidak ditemukan" desc="Berita mungkin telah dihapus atau tautan tidak valid." />
          ) : (
            <article>
              <span className="inline-block rounded-full bg-[#E6F5F8] text-[#0E7490] px-3 py-1 text-xs font-semibold" data-testid="news-detail-category">{item.category}</span>
              <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold leading-tight text-[#0A1128]" data-testid="news-detail-title">{item.title}</h1>
              <div className="mt-4 flex items-center gap-4 text-sm text-[#94A3B8]">
                <span className="flex items-center gap-1.5"><User className="h-4 w-4" /> {item.author || "Redaksi"}</span>
                <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {formatDate(item.created_at)}</span>
              </div>
              <div className="mt-8 max-w-none text-[#334155] leading-relaxed whitespace-pre-line text-[15px]" data-testid="news-detail-content">
                {item.content}
              </div>
            </article>
          )}

          {/* Berita Lainnya (related) */}
          {!loading && !notFound && relatedList.length > 0 && (
            <div className="mt-14 pt-8 border-t border-[#E2E8F0]" data-testid="related-news">
              <h2 className="text-xl font-bold text-[#0A1128] mb-4">Berita Lainnya</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {relatedList.map((n) => (
                  <Link key={n.id} to={`/berita/${n.id}`} data-testid={`related-news-${n.id}`}
                    className="group rounded-xl border border-[#E2E8F0] bg-white p-4 hover:-translate-y-0.5 hover:border-[#0E7490]/40 transition-all duration-200">
                    <div className="flex items-center gap-2">
                      <span className="inline-block rounded-full bg-[#E6F5F8] text-[#0E7490] px-2.5 py-0.5 text-[10px] font-semibold">{n.category}</span>
                      <span className="text-[11px] text-[#94A3B8]">{formatDate(n.created_at)}</span>
                    </div>
                    <h3 className="mt-2 font-semibold text-sm text-[#0A1128] group-hover:text-[#0E7490] transition-colors duration-200 leading-snug">{n.title}</h3>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#0E7490]">Baca <ChevronRight className="h-3.5 w-3.5" /></span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-12 rounded-2xl bg-[#0A1128] text-white p-8 text-center">
            <h3 className="text-xl font-bold">Ingin ikut belajar di <SiteName />?</h3>
            <p className="mt-2 text-white/70 text-sm">Daftar gratis dan akses Try Out, kursus interaktif, serta pemantauan progres belajar.</p>
            <Link to="/register" className="inline-flex items-center gap-2 mt-5 rounded-full bg-[#C9A227] hover:bg-[#A9871C] text-[#0A1128] font-semibold px-6 py-3 transition-colors duration-200" data-testid="news-detail-cta">
              Daftar Sekarang
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
