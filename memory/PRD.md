# Binara LMS - PRD
Original: hapus semua ketergantungan Emergent (AI, storage, auth, email) agar bisa deploy mandiri. Brevo+SMTP/Gmail, Google OAuth pribadi + JWT, S3/S3-compatible, Midtrans pribadi, AI dihapus.
## Done (Jun 2026)
- requirements.txt dibersihkan (emergentintegrations, litellm, openai, google-genai dihapus)
- storage.py generik S3 (AWS/R2/MinIO) + fallback disk lokal storage_data/
- index.html: script emergent/posthog dihapus; sisa referensi session_id/testid emergent dihapus
- media.js pakai base URL yg sama dengan api.js
- deploy/dcloud/backend.env.example & frontend/env.example lengkap
## Backlog
- Audit repo kedua LMS-test1 (private, belum bisa di-clone)
## Iteration 2 (Jun 2026)
- Audit repo kedua LMS-test1: versi lama (tanpa IRT/Midtrans), sisa jejak Emergent sama + bug subjek email + requirements berat (pandas/numpy/jq). Rekomendasi: deploy dari repo pertama yg sudah dibersihkan.
- Gambar soal opsional (form manual + kolom `gambar` di template CSV/Excel + impor ZIP berisi Excel+gambar), endpoint publik /api/question-images/{name}
- Rumus matematika KaTeX ($...$, $$...$$, \(..\), \[..\]) di builder (pratinjau), CBT siswa, pembahasan
## Iteration 3 (Jun 2026)
- Tipe soal baru `truefalse_multi` (Benar/Salah Majemuk): 1 stimulus + banyak pernyataan, kunci per pernyataan ("o1:true"), nilai proporsional, label kustom `tf_labels` (juga untuk truefalse biasa), template CSV/XLSX kolom label_benar/label_salah
## Iteration 4 (Jun 2026)
- Jadwal Try Out (start_at/end_at) di form admin + ditegakkan backend (403 belum dibuka/ditutup; end tanggal saja = akhir hari)
- Autosave jawaban ke server (PUT /student/attempts/{id}/progress), timer dari server (remaining_seconds)
- Halaman admin Pantau Peserta /admin/tryouts/:id/monitor: status, progres, waktu simpan terakhir, sisa waktu; aksi Kumpulkan paksa, Ulangi (hapus data + izin ulang khusus siswa, bypass jadwal), Batalkan izin
## Iteration 5 (Jun 2026)
- Anti-mencontek Try Out (bukan latihan): deteksi pindah/keluar tab (visibilitychange, refresh tidak dihitung), alarm WebAudio, dialog "Selesaikan & Kumpulkan / Tetap Lanjutkan", maks 5 peringatan -> otomatis dikumpulkan server-side (POST /student/attempts/{id}/violation)
- Total pelanggaran disimpan di koleksi tryout_violations (tetap ada walau admin "Ulangi"); tag "Terindikasi mencontek: Nx keluar tab" di Pantau Peserta & Hasil
- Opsi per Try Out: shuffle_questions & shuffle_options (acak deterministik per siswa)
- Bank soal: ambil/salin soal dari Try Out lain (GET /admin/question-bank, POST /admin/tryouts/{id}/questions/copy)
## Iteration 6 (Jun 2026)
- Soal punya field `bidang` (mapel; default mapel Try Out, soal lama di-backfill saat startup) & `materi` (topik); bisa diisi di form, massal (bulk-materi), atau kolom impor bidang/materi
- Bank soal: filter Bidang, Materi, Kompetensi, Tingkat Kesulitan, teks (GET /admin/question-bank -> {items, facets})
- `tab_warning_limit` per Try Out (0-20, default 5, 0 = deteksi nonaktif)
## Backlog
- Kolom bidang/materi di template CSV/Excel
