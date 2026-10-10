import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Newspaper, ArrowRight, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import PublicShell from "@/components/public/PublicShell";
import useSeo from "@/hooks/useSeo";
import { Loading, Empty } from "@/components/common/States";
import { formatDate } from "@/lib/format";
import { SiteLogoMark, SiteName } from "@/components/common/SiteBrand";

export default function NewsPage() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useSeo({
    title: "Berita & Pengumuman — Binara LMS",
    description: "Berita, pengumuman, dan informasi program terbaru dari Binara LMS. Klik judul untuk membaca selengkapnya.",
  });

  useEffect(() => {
    api.get("/public/news").then((r) => setNews(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <PublicShell>
      <section className="bg-[#0A1128] text-white py-16">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white px-4 py-1.5 text-xs font-semibold">
            <Newspaper className="h-3.5 w-3.5 text-[#C9A227]" /> Berita & Pengumuman
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold leading-tight">Kabar Terbaru <SiteName /></h1>
          <p className="mt-4 text-white/70 max-w-2xl">Semua pengumuman, informasi program, dan berita terbaru. Klik judul untuk membaca selengkapnya.</p>
        </div>
      </section>

      <section className="py-14">
        <div className="max-w-4xl mx-auto px-5 sm:px-8" data-testid="news-page">
          {loading ? <Loading /> : news.length === 0 ? (
            <Empty icon={Newspaper} title="Belum ada berita" desc="Berita dan pengumuman akan tampil di sini." />
          ) : (
            <div className="divide-y divide-[#E2E8F0] rounded-2xl border border-[#E2E8F0] bg-white">
              {news.map((n) => (
                <Link key={n.id} to={`/berita/${n.id}`} data-testid={`news-item-${n.id}`}
                  className="group flex items-start gap-4 p-5 hover:bg-[#F8FAFC] transition-colors duration-200">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#0E7490] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-block rounded-full bg-[#E6F5F8] text-[#0E7490] px-2.5 py-0.5 text-[11px] font-semibold">{n.category}</span>
                      <span className="text-[11px] text-[#94A3B8]">{formatDate(n.created_at)}</span>
                    </div>
                    <h2 className="mt-2 font-semibold text-[#0A1128] group-hover:text-[#0E7490] transition-colors duration-200">{n.title}</h2>
                  </div>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#0E7490] opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
                    Lihat lebih lanjut <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          )}
          <div className="mt-8">
            <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-[#0E7490] hover:underline">
              <ArrowRight className="h-4 w-4 rotate-180" /> Kembali ke beranda
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
