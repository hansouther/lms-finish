import axios from "axios";

// Membersihkan URL secara otomatis agar tidak terjadi penumpukan /api/api
const rawUrl = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL || "https://lms-binara-production.up.railway.app";
export const cleanBaseUrl = rawUrl.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: `${cleanBaseUrl}/api`,
  withCredentials: true,
});

// Token fallback for browsers that block cross-site cookies (Safari/iOS/macOS, Huawei, Firefox strict).
const ACCESS_KEY = "auth_access_token";
const REFRESH_KEY = "auth_refresh_token";
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* private mode */ } },
};
export const getAccessToken = () => store.get(ACCESS_KEY);
export function clearTokens() { store.set(ACCESS_KEY, null); store.set(REFRESH_KEY, null); }

api.interceptors.request.use((config) => {
  const token = store.get(ACCESS_KEY);
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = null;
const refreshAccess = () => {
  const rt = store.get(REFRESH_KEY);
  if (!rt) return Promise.reject(new Error("no refresh token"));
  refreshing = refreshing || axios
    .post(`${cleanBaseUrl}/api/auth/refresh`, null, { withCredentials: true, headers: { "X-Refresh-Token": rt } })
    .then((r) => { store.set(ACCESS_KEY, r.data?.access_token); return r.data?.access_token; })
    .finally(() => { refreshing = null; });
  return refreshing;
};

api.interceptors.response.use(
  (res) => {
    const d = res.data;
    if (d && typeof d === "object" && !Array.isArray(d) && typeof d.access_token === "string") {
      store.set(ACCESS_KEY, d.access_token);
      if (d.refresh_token) store.set(REFRESH_KEY, d.refresh_token);
      delete d.access_token;
      delete d.refresh_token;
    }
    if (/\/auth\/logout$/.test(res.config?.url || "")) clearTokens();
    return res;
  },
  async (error) => {
    const cfg = error.config;
    const url = cfg?.url || "";
    if (error.response?.status === 401 && cfg && !cfg._retried && !/\/auth\/(login|refresh|logout|register)/.test(url) && store.get(REFRESH_KEY)) {
      cfg._retried = true;
      try {
        const token = await refreshAccess();
        if (token) { cfg.headers.Authorization = `Bearer ${token}`; return api(cfg); }
      } catch { clearTokens(); }
    }
    return Promise.reject(error);
  }
);

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