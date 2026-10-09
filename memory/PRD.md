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
