import { useState } from "react";
import { Plus, Trash2, Users, School, CheckCircle2, XCircle, Settings2, Clock, FileText, Award, Download, FolderOpen } from "lucide-react";
import useFetch from "@/hooks/useFetch";
import api, { apiError } from "@/lib/api";
import PageHeader from "@/components/common/PageHeader";
import { Loading, Empty } from "@/components/common/States";
import ConfirmButton from "@/components/common/ConfirmButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fileUrl } from "@/lib/media";
import { toast } from "sonner";

const ROLE_BADGE = {
  admin: { l: "Admin", c: "#7C3AED", bg: "#F5F3FF" },
  student: { l: "Siswa", c: "#0E7490", bg: "#E6F5F8" },
  tutor: { l: "Tentor", c: "#C9A227", bg: "#FBF3DC" },
  proctor: { l: "Proktor", c: "#10B981", bg: "#ECFDF5" },
};
const STATUS_BADGE = {
  pending: { l: "Menunggu", c: "#B45309", bg: "#FEF3C7" },
  approved: { l: "Terverifikasi", c: "#047857", bg: "#D1FAE5" },
  rejected: { l: "Ditolak", c: "#B91C1C", bg: "#FEE2E2" },
};
const EMPTY = { name: "", email: "", password: "", role: "tutor", phone: "", school_id: "", qualifications: "" };
const NONE = "none";

async function downloadDoc(url, name) {
  try {
    const res = await api.get(url.replace(/^\/api/, ""), { responseType: "blob" });
    const blobUrl = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = blobUrl; a.download = name || "berkas"; a.click();
    URL.revokeObjectURL(blobUrl);
    toast.success("Berkas diunduh");
  } catch { toast.error("Gagal mengunduh berkas"); }
}

function TutorDocs({ user }) {
  const certs = user.certificates || [];
  if (!user.cv_url && certs.length === 0)
    return <p className="text-sm text-[#94A3B8]" data-testid="tutor-docs-empty">Tentor ini belum mengunggah CV atau sertifikat.</p>;
  return (
    <div className="space-y-2" data-testid="tutor-docs">
      {user.cv_url && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2">
          <span className="flex items-center gap-2 text-sm text-[#0A1128] min-w-0"><FileText className="h-4 w-4 text-[#0E7490] shrink-0" /><span className="truncate">{user.cv_name || "CV Tentor"}</span></span>
          <span className="flex items-center gap-1 shrink-0">
            <a href={fileUrl(user.cv_url)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#0E7490] hover:underline px-2 py-1" data-testid="tutor-cv-view">Lihat</a>
            <Button size="sm" variant="outline" className="h-7 rounded-full" onClick={() => downloadDoc(user.cv_url, user.cv_name || "cv.pdf")} data-testid="tutor-cv-download"><Download className="h-3.5 w-3.5" /> Unduh</Button>
          </span>
        </div>
      )}
      {certs.map((c, i) => (
        <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2">
          <span className="flex items-center gap-2 text-sm text-[#0A1128] min-w-0"><Award className="h-4 w-4 text-[#10B981] shrink-0" /><span className="truncate">{c.name || `Sertifikat ${i + 1}`}</span></span>
          <span className="flex items-center gap-1 shrink-0">
            <a href={fileUrl(c.url)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#0E7490] hover:underline px-2 py-1" data-testid={`tutor-cert-view-${i}`}>Lihat</a>
            <Button size="sm" variant="outline" className="h-7 rounded-full" onClick={() => downloadDoc(c.url, c.name || `sertifikat-${i + 1}`)} data-testid={`tutor-cert-download-${i}`}><Download className="h-3.5 w-3.5" /> Unduh</Button>
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ManageUsers() {
  const { data: users, loading, refetch } = useFetch("/admin/users");
  const { data: schools, refetch: refetchSchools } = useFetch("/admin/schools");
  const [tab, setTab] = useState("pending");
  const [open, setOpen] = useState(false);
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [schoolForm, setSchoolForm] = useState({ name: "", city: "" });
  const [edit, setEdit] = useState(null);
  const [docsUser, setDocsUser] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const pendingCount = (users || []).filter((u) => (u.status || "approved") === "pending").length;
  const list = (users || []).filter((u) =>
    tab === "all" ? true : tab === "pending" ? (u.status || "approved") === "pending" : u.role === tab
  );

  const save = async () => {
    const payload = {
      ...form,
      school_id: form.school_id || null,
      qualifications: form.qualifications.split(",").map((s) => s.trim()).filter(Boolean),
    };
    try { await api.post("/admin/users", payload); toast.success("Pengguna dibuat"); setOpen(false); setForm(EMPTY); refetch(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { try { await api.delete(`/admin/users/${id}`); toast.success("Pengguna dihapus"); refetch(); } catch (e) { toast.error(apiError(e)); } };
  const saveSchool = async () => {
    try { await api.post("/admin/schools", schoolForm); toast.success("Sekolah ditambahkan"); setSchoolOpen(false); setSchoolForm({ name: "", city: "" }); refetchSchools(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const quickVerify = async (id, status) => {
    try { await api.put(`/admin/users/${id}`, { status }); toast.success(status === "approved" ? "Akun disetujui" : "Akun ditolak"); refetch(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const openEdit = (u) => setEdit({ id: u.id, name: u.name, email: u.email, role: u.role, school_id: u.school_id || NONE, status: u.status || "approved", grade: u.grade, goal: u.goal, phone: u.phone, school_name_text: u.school_name_text, cv_url: u.cv_url, cv_name: u.cv_name, certificates: u.certificates || [] });
  const saveEdit = async () => {
    try {
      await api.put(`/admin/users/${edit.id}`, { role: edit.role, status: edit.status, school_id: edit.school_id === NONE ? null : edit.school_id });
      toast.success("Perubahan disimpan"); setEdit(null); refetch();
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="manage-users">
      <PageHeader title="Pengguna & Sekolah Mitra" subtitle="Verifikasi akun, atur peran, dan tautkan sekolah. Proktor hanya melihat siswa sekolahnya."
        actions={<div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSchoolOpen(true)} className="rounded-full hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid="add-school-btn"><School className="h-4 w-4" /> Tambah Sekolah</Button>
          <Button onClick={() => { setForm(EMPTY); setOpen(true); }} className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="add-user-btn"><Plus className="h-4 w-4" /> Tambah Pengguna</Button>
        </div>} />

      {/* Schools row */}
      <div className="mb-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(schools || []).map((s) => (
          <div key={s.id} className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex items-center gap-3" data-testid={`school-${s.id}`}>
            <div className="h-10 w-10 rounded-lg bg-[#ECFDF5] text-[#10B981] flex items-center justify-center"><School className="h-5 w-5" /></div>
            <div><p className="font-semibold text-[#0A1128] text-sm">{s.name}</p><p className="text-xs text-[#94A3B8]">{s.city} · {s.student_count} siswa</p></div>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="max-w-full overflow-x-auto justify-start" data-testid="user-tabs">
          <TabsTrigger value="pending" data-testid="tab-pending">Menunggu {pendingCount > 0 && <span className="ml-1.5 rounded-full bg-[#FEF3C7] text-[#B45309] px-1.5 text-[10px] font-bold">{pendingCount}</span>}</TabsTrigger>
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="tutor">Tentor</TabsTrigger>
          <TabsTrigger value="proctor">Proktor</TabsTrigger>
          <TabsTrigger value="student">Siswa</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? <Loading /> : !list.length ? (
        <Empty icon={tab === "pending" ? Clock : Users} title={tab === "pending" ? "Tidak ada akun menunggu verifikasi" : "Tidak ada pengguna"} />
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#EFF6F8]">
                <TableHead>Nama & Detail</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead className="hidden md:table-cell">Sekolah</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-44 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((u) => {
                const b = ROLE_BADGE[u.role] || ROLE_BADGE.student;
                const st = STATUS_BADGE[u.status || "approved"];
                const isPending = (u.status || "approved") === "pending";
                return (
                  <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                    <TableCell>
                      <p className="font-medium text-[#0A1128]">{u.name}</p>
                      <p className="text-xs text-[#94A3B8]">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                      {u.role === "student" && (u.grade || u.goal) && (
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">{u.grade ? `Kelas: ${u.grade}` : ""}{u.goal ? ` · Target: ${u.goal}` : ""}</p>
                      )}
                    </TableCell>
                    <TableCell><span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: b.c, backgroundColor: b.bg }}>{b.l}</span></TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-[#475569]">
                      {u.school_name || (u.school_name_text ? <span className="italic text-[#94A3B8]">{u.school_name_text} (belum ditautkan)</span> : (u.qualifications?.length ? u.qualifications.join(", ") : "-"))}
                    </TableCell>
                    <TableCell><span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: st.c, backgroundColor: st.bg }} data-testid={`user-status-${u.id}`}>{st.l}</span></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 justify-end">
                        {isPending && (
                          <>
                            <Button size="sm" onClick={() => quickVerify(u.id, "approved")} className="h-8 rounded-full bg-[#10B981] hover:bg-[#0ea371]" data-testid={`approve-user-${u.id}`}><CheckCircle2 className="h-3.5 w-3.5" /> Setujui</Button>
                            <Button size="sm" variant="outline" onClick={() => quickVerify(u.id, "rejected")} className="h-8 rounded-full hover:bg-red-50 hover:text-red-600" data-testid={`reject-user-${u.id}`}><XCircle className="h-3.5 w-3.5" /></Button>
                          </>
                        )}
                        {u.role === "tutor" && (u.cv_url || u.certificates?.length > 0) && (
                          <Button size="icon" variant="ghost" onClick={() => setDocsUser(u)} className="h-8 w-8 hover:bg-[#FBF3DC] hover:text-[#C9A227]" data-testid={`docs-user-${u.id}`} title="Lihat & unduh berkas tentor"><FolderOpen className="h-4 w-4" /></Button>
                        )}
                        {u.role !== "admin" && (
                          <Button size="icon" variant="ghost" onClick={() => openEdit(u)} className="h-8 w-8 hover:bg-[#E6F5F8] hover:text-[#0E7490]" data-testid={`edit-user-${u.id}`}><Settings2 className="h-4 w-4" /></Button>
                        )}
                        {u.role !== "admin" && (
                          <ConfirmButton onConfirm={() => del(u.id)} trigger={<Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 hover:text-red-600" data-testid={`delete-user-${u.id}`}><Trash2 className="h-4 w-4" /></Button>} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tutor documents (view & download for verification) */}
      <Dialog open={!!docsUser} onOpenChange={(o) => !o && setDocsUser(null)}>
        <DialogContent data-testid="tutor-docs-dialog">
          <DialogHeader><DialogTitle>Berkas Tentor — {docsUser?.name}</DialogTitle></DialogHeader>
          {docsUser && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-[#94A3B8]">{docsUser.email}{docsUser.phone ? ` · ${docsUser.phone}` : ""}</p>
                {(() => { const st = STATUS_BADGE[docsUser.status || "approved"]; return <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: st.c, backgroundColor: st.bg }}>{st.l}</span>; })()}
              </div>
              <TutorDocs user={docsUser} />
              <p className="text-[11px] text-[#94A3B8]">Tinjau CV & sertifikat, lalu setujui atau tolak akun tentor.</p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setDocsUser(null)}>Tutup</Button>
            {docsUser && (docsUser.status || "approved") === "pending" && (
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={async () => { await quickVerify(docsUser.id, "rejected"); setDocsUser(null); }} className="rounded-full hover:bg-red-50 hover:text-red-600" data-testid="docs-reject-tutor"><XCircle className="h-4 w-4" /> Tolak</Button>
                <Button onClick={async () => { await quickVerify(docsUser.id, "approved"); setDocsUser(null); }} className="rounded-full bg-[#10B981] hover:bg-[#0ea371]" data-testid="docs-approve-tutor"><CheckCircle2 className="h-4 w-4" /> Setujui Tentor</Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit / verify user */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent data-testid="edit-user-dialog">
          <DialogHeader><DialogTitle>Atur Akun — {edit?.name}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-4">
              <p className="text-xs text-[#94A3B8]">{edit.email}{edit.phone ? ` · ${edit.phone}` : ""}{edit.school_name_text ? ` · Sekolah diajukan: ${edit.school_name_text}` : ""}</p>
              {edit.role === "tutor" && (
                <div className="rounded-lg bg-[#EFF6F8] p-3 space-y-2" data-testid="edit-tutor-docs">
                  <p className="text-xs font-semibold text-[#0A1128]">Berkas Tentor (untuk verifikasi)</p>
                  <TutorDocs user={edit} />
                </div>
              )}
              <div>
                <Label>Peran</Label>
                <Select value={edit.role} onValueChange={(v) => setEdit((f) => ({ ...f, role: v }))}>
                  <SelectTrigger className="mt-1.5" data-testid="edit-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Siswa</SelectItem>
                    <SelectItem value="tutor">Tentor</SelectItem>
                    <SelectItem value="proctor">Proktor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tautkan Sekolah</Label>
                <Select value={edit.school_id} onValueChange={(v) => setEdit((f) => ({ ...f, school_id: v }))}>
                  <SelectTrigger className="mt-1.5" data-testid="edit-school"><SelectValue placeholder="Pilih sekolah" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Tidak ada —</SelectItem>
                    {(schools || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-[#94A3B8]">Proktor hanya bisa melihat siswa dari sekolah yang ditautkan.</p>
              </div>
              <div>
                <Label>Status Verifikasi</Label>
                <Select value={edit.status} onValueChange={(v) => setEdit((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1.5" data-testid="edit-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Menunggu</SelectItem>
                    <SelectItem value="approved">Terverifikasi</SelectItem>
                    <SelectItem value="rejected">Ditolak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Batal</Button>
            <Button onClick={saveEdit} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="save-edit-user">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create user */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Tambah Pengguna</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nama</Label><Input value={form.name} onChange={set("name")} className="mt-1.5" data-testid="user-name" /></div>
              <div><Label>Peran</Label>
                <Select value={form.role} onValueChange={set("role")}>
                  <SelectTrigger className="mt-1.5" data-testid="user-role"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="tutor">Tentor</SelectItem><SelectItem value="proctor">Proktor</SelectItem><SelectItem value="student">Siswa</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={set("email")} className="mt-1.5" data-testid="user-email" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Kata Sandi</Label><Input value={form.password} onChange={set("password")} className="mt-1.5" data-testid="user-password" /></div>
              <div><Label>Telepon</Label><Input value={form.phone} onChange={set("phone")} className="mt-1.5" data-testid="user-phone" /></div>
            </div>
            {(form.role === "proctor" || form.role === "student") && (
              <div><Label>Sekolah</Label>
                <Select value={form.school_id} onValueChange={set("school_id")}>
                  <SelectTrigger className="mt-1.5" data-testid="user-school"><SelectValue placeholder="Pilih sekolah" /></SelectTrigger>
                  <SelectContent>{(schools || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.role === "tutor" && (
              <div><Label>Kualifikasi (pisahkan dengan koma)</Label><Input value={form.qualifications} onChange={set("qualifications")} placeholder="Matematika, Fisika" className="mt-1.5" data-testid="user-quals" /></div>
            )}
            <p className="text-[11px] text-[#94A3B8]">Akun yang dibuat admin otomatis terverifikasi.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="save-user">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create school */}
      <Dialog open={schoolOpen} onOpenChange={setSchoolOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Sekolah Mitra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nama Sekolah</Label><Input value={schoolForm.name} onChange={(e) => setSchoolForm((f) => ({ ...f, name: e.target.value }))} className="mt-1.5" data-testid="school-name" /></div>
            <div><Label>Kota</Label><Input value={schoolForm.city} onChange={(e) => setSchoolForm((f) => ({ ...f, city: e.target.value }))} className="mt-1.5" data-testid="school-city" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchoolOpen(false)}>Batal</Button>
            <Button onClick={saveSchool} className="bg-[#0E7490] hover:bg-[#0B5C74]" data-testid="save-school">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
