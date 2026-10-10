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
## Iteration 7 (Jun 2026)
- Pembahasan per soal (`explanation` + `explanation_image_url`, rumus KaTeX), kolom impor `pembahasan`
- Saklar `show_review` per Try Out (form + tombol cepat "Buka Pembahasan", PUT /admin/tryouts/{id}/review); tertutup = siswa hanya lihat nilai 0–100 & IRT (per_question/answers tidak dikirim). Latihan (exercise) selalu terbuka
- Nilai 0–100 = poin/maks*100, 2 desimal format id-ID (formatNilai)
- Penyelarasan IRT (irt.align_scores, PAVA): nilai asli lebih tinggi tidak pernah dapat IRT lebih rendah; 100 = maks skala, 0 = min; `irt_raw` menyimpan skor asli; dijalankan saat submit, paksa kumpul, reset, ganti skala, kalibrasi
## Iteration 8 (Jun 2026)
- Template CSV & Excel kini berisi kolom bidang, materi, pembahasan (+ option_e di CSV), contoh terisi & petunjuk; CSV ber-BOM UTF-8 agar rapi di Excel
## Iteration 9 (Jun 2026)
- Pratinjau impor: POST /admin/questions/import/preview -> tabel status per baris, edit/hapus baris, POST /admin/questions/import/validate, impor baris valid via POST /admin/tryouts/{id}/questions/import-rows (gambar ZIP diunggah saat pratinjau)
- Ekspor bank soal Excel sesuai filter: GET /admin/question-bank/export (format template + sumber_tryout, bisa diimpor ulang)
- Kolom template `gambar_pembahasan` -> explanation_image_url
## Iteration 10 (Jun 2026)
- Duplikat soal (kunci = teks + pilihan dinormalisasi): impor (preview/validate/import-rows/import) melewati soal yang sudah ada di Try Out tujuan atau berulang di berkas + notifikasi
- Kolom wajib template: type,text,option_a..e,correct,points,competency,tingkat (400 bila header hilang; points/competency/tingkat wajib valid per baris); header wajib berwarna di Excel + petunjuk WAJIB/OPSIONAL
- Cek Duplikat Soal (ManageTryouts): GET /admin/question-bank/duplicates, rapikan otomatis (sisakan 1 per Try Out), POST /admin/questions/bulk-delete

## Update Jun 2026 — CBT Lockdown semua device (additive only)
- useExamLockdown hook: kunci back button, pinch-zoom, shortcut (Ctrl+P/S/U, F5, F12), scroll bounce, Esc key lock (Chrome desktop)
- PseudoFullscreenGate untuk iPhone/in-app browser/browser tanpa Fullscreen API + rekomendasi Chrome/Android
- Pelanggaran tetap memakai peringatan admin (tab_warning_limit) + auto-submit existing
- Backlog: mode kiosk PWA, deteksi split-screen/floating window Android

## Update Jun 2026 — PWA + Deteksi Layar Terbagi
- PWA: manifest (fullscreen, ikon 192/512), sw.js, apple-touch-icon; InstallAppBanner di /student/tryouts (Android prompt, iOS panduan Add to Home Screen)
- useSplitScreenGuard: deteksi split-screen/jendela mengambang (viewport <60% layar, abaikan saat mengetik) + window blur >1.5s → peringatan existing; SplitScreenOverlay; dedupe 2.5s
- Backlog: riwayat pelanggaran detail untuk admin

## Update Jun 2026 — Tanpa verifikasi admin untuk siswa + Biodata wajib
- Siswa (email & Google) langsung approved; migrasi startup: siswa pending → approved. Proktor/tentor tetap diverifikasi
- /lengkapi-biodata (CompleteBiodata.js): wajib isi sekolah, kelas, WA, tujuan + pernyataan kejujuran; ProtectedRoute redirect bila school_id/grade kosong
- Export repo kedua (LMS-test1) diperbarui: /app/frontend/public/downloads/binara-update.zip & .patch

## Update Jun 2026 — Pengaturan Website (Admin)
- routes_site didaftarkan di server.py; halaman /admin/site-settings + menu sidebar "Pengaturan Website"
- Admin atur: nama, tagline, footer, logo, favicon (ikon tab), foto hero/login/OG, loading screen (on/off, logo, judul, pesan, warna latar/teks/aksen, gaya, durasi min)
- Penyimpanan Cloudflare R2 (R2_* di backend/.env); unggahan mengembalikan URL publik R2_PUBLIC_URL langsung (beban server rendah saat trafik tinggi)
- Teruji: iteration_34 (backend & frontend 100%)
## Backlog
- Gambar landing tambahan (galeri/section lain) bila nanti ditambahkan

## Update Jun 2026 — Loading screen GIF/Video
- loader_mode: custom | media; loader_media_url (GIF/PNG/WEBP ≤5MB, MP4/WEBM ≤15MB ke R2); loader_media_fit: contain | cover
- Boot loader index.html: media mode render img/video (autoplay muted loop playsinline) + pesan; pratinjau admin ikut mendukung
- Teruji: iteration_35 (100%)
