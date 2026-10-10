import { useState } from "react";
import { Lock, Globe, FileText, Library } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { fileUrl } from "@/lib/media";

export default function LearningRoom() {
  const { data, loading } = useFetch("/student/materials");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);

  const items = (data || []).filter((m) => filter === "all" || m.visibility === filter);

  return (
    <div data-testid="learning-room">
      <PageHeader title="Ruang Belajar" subtitle="Akses materi publik dari tim akademik serta materi privat khusus kelas Anda." />

      <Tabs value={filter} onValueChange={setFilter} className="mb-6">
        <TabsList data-testid="material-filter">
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="public">Publik</TabsTrigger>
          <TabsTrigger value="private">Privat Kelas</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? <Loading /> : items.length === 0 ? (
        <Empty icon={Library} title="Belum ada materi" desc="Materi dari tentor akan muncul di sini." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((m) => (
            <button key={m.id} onClick={() => setOpen(m)} data-testid={`material-${m.id}`}
              className="text-left bg-white rounded-xl border border-[#E2E8F0] p-5 hover:-translate-y-1 transition-transform duration-200">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-[#E6F5F8] text-[#0E7490] flex items-center justify-center"><FileText className="h-5 w-5" /></div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${m.visibility === "private" ? "bg-[#FBF3DC] text-[#C9A227]" : "bg-[#ECFDF5] text-[#10B981]"}`}>
                  {m.visibility === "private" ? <><Lock className="h-3 w-3" /> Privat</> : <><Globe className="h-3 w-3" /> Publik</>}
                </span>
              </div>
              <h3 className="mt-4 font-semibold text-[#0A1128]">{m.title}</h3>
              <p className="mt-1 text-sm text-[#475569] line-clamp-2">{m.description}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-[#94A3B8]">
                <span>{m.subject || "Umum"}</span><span>{m.tutor_name}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={() => setOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{open?.title}</DialogTitle></DialogHeader>
          <div className="text-sm text-[#475569] space-y-3">
            <p className="text-[#0A1128]">{open?.description}</p>
            <div className="rounded-lg bg-[#EFF6F8] p-4 whitespace-pre-wrap">{open?.content || "Konten materi tidak tersedia."}</div>
            {open?.file_url && <a href={fileUrl(open.file_url)} target="_blank" rel="noreferrer" className="text-[#0E7490] font-semibold hover:underline">Buka lampiran</a>}
            <p className="text-xs text-[#94A3B8]">Oleh {open?.tutor_name} · {formatDate(open?.created_at)}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
