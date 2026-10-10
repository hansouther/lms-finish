# Load Test — 300 Peserta Try Out Serentak (Binara LMS)

Toolkit untuk menguji Try Out diakses **banyak siswa sekaligus** (login → mulai → kerjakan → submit).

## Isi
- `seed_loadtest.py`  → membuat N akun siswa uji + 1 Try Out khusus load test (`lt_tryout`, tipe latihan, tersembunyi dari daftar normal).
- `run_loadtest.py`   → penguji bawaan (Python + requests, tanpa install apa pun). Menjalankan alur ujian penuh untuk N user paralel.
- `k6_tryout.js`      → skrip k6 (disarankan untuk uji realistis/terdistribusi dengan ramp-up).
- `cleanup_loadtest.py` → menghapus SEMUA data uji (akun, attempt, tryout).

## Cara pakai (cepat)
```bash
cd /app/loadtest

# 1) Siapkan 300 akun uji + tryout khusus
python seed_loadtest.py 300

# 2a) Jalankan penguji bawaan (default target = preview)
python run_loadtest.py <BASE_URL> 300 lt_tryout
#   contoh preview : python run_loadtest.py https://web-config-studio.preview.emergentagent.com 300
#   contoh produksi: python run_loadtest.py https://adaptive-edu-portal.emergent.host 300

# 2b) ATAU pakai k6 (lebih realistis, ada ramp-up 30s)
k6 run -e BASE=https://adaptive-edu-portal.emergent.host -e VUS=300 k6_tryout.js

# 3) Bersihkan data uji (WAJIB)
python cleanup_loadtest.py
```

## Metrik yang dibaca
- **Sukses %** — target ≥ 99%.
- **p95 latensi per flow** — target < 5 detik (produksi multi-worker).
- **Throughput** — user-flow/detik.

## Catatan penting
- **Preview (dev)** hanya 1 worker uvicorn → login bcrypt & grading berjalan serial, jadi latensi tinggi walau **sukses 100%**. Ini WAJAR dan bukan bug. Produksi Emergent memakai resource lebih besar/paralel → jauh lebih cepat.
- **Produksi**: uji di jam sepi. Data attempt uji akan masuk DB → jalankan `cleanup_loadtest.py` setelahnya. Untuk membuat akun uji di produksi Anda perlu akses DB produksi (hubungi Emergent Support) atau daftarkan+approve akun lewat panel admin.
- Agar 300 serentak mulus di hari-H: pakai **staggered start** (buka bergelombang, k6 sudah ramp 30s), dan pastikan backend produksi berjalan dengan beberapa worker/instance.
