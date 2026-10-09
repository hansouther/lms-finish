import axios from "axios";

// Membersihkan URL secara otomatis agar tidak terjadi penumpukan /api/api
const rawUrl = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL || "https://lms-binara-production.up.railway.app";
export const cleanBaseUrl = rawUrl.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: `${cleanBaseUrl}/api`,
  withCredentials: true,
});

export function apiError(e) {
  const detail = e?.response?.data?.detail;
  if (detail == null) return e?.message || "Terjadi kesalahan. Coba lagi.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((d) => (d && typeof d.msg === "string" ? d.msg : JSON.stringify(d))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;