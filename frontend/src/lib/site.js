import { useSyncExternalStore } from "react";
import api, { cleanBaseUrl } from "@/lib/api";

export const SITE_CACHE_KEY = "site_settings_cache";
export const DEFAULT_SITE = {
  site_name: "Binara LMS",
  tagline: "Platform Belajar Terintegrasi",
  logo_url: "", favicon_url: "", hero_image_url: "", login_image_url: "", og_image_url: "", footer_text: "",
  loader_enabled: true, loader_title: "", loader_message: "Mohon tunggu, sedang menyiapkan halaman...", loader_logo_url: "",
  loader_bg_color: "#0A1128", loader_text_color: "#FFFFFF", loader_accent_color: "#22D3EE", loader_style: "spinner", loader_min_ms: 800,
  loader_mode: "custom", loader_media_url: "", loader_media_fit: "contain",
};

export const isVideo = (u) => /\.(mp4|webm)(\?|$)/i.test(u || "");

export const assetUrl = (u) => (!u ? "" : u.startsWith("http") ? u : `${cleanBaseUrl}${u}`);

const readCache = () => {
  try { return { ...DEFAULT_SITE, ...(JSON.parse(localStorage.getItem(SITE_CACHE_KEY)) || {}) }; } catch { return DEFAULT_SITE; }
};

let site = readCache();
const listeners = new Set();

function setLink(rel, href) {
  document.querySelectorAll(`link[rel="${rel}"]`).forEach((el) => el.setAttribute("href", href));
  if (!document.querySelector(`link[rel="${rel}"]`)) {
    const el = document.createElement("link");
    el.setAttribute("rel", rel);
    el.setAttribute("href", href);
    document.head.appendChild(el);
  }
}

function applyHead(s) {
  const fav = assetUrl(s.favicon_url || s.logo_url);
  if (fav) { setLink("icon", fav); setLink("apple-touch-icon", fav); }
  const appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appTitle) appTitle.setAttribute("content", s.site_name);
  if (document.title.includes(DEFAULT_SITE.site_name)) document.title = document.title.split(DEFAULT_SITE.site_name).join(s.site_name);
}

function setSite(next) {
  site = { ...DEFAULT_SITE, ...next };
  const resolved = { ...site, logo_url: assetUrl(site.logo_url), favicon_url: assetUrl(site.favicon_url), loader_logo_url: assetUrl(site.loader_logo_url), loader_media_url: assetUrl(site.loader_media_url) };
  try { localStorage.setItem(SITE_CACHE_KEY, JSON.stringify(resolved)); } catch { /* storage unavailable */ }
  applyHead(site);
  listeners.forEach((cb) => cb());
}

export function loadSite() {
  applyHead(site);
  return api.get("/public/site-settings").then((r) => setSite(r.data)).catch(() => {});
}

export const updateSiteLocal = (data) => setSite(data);

export function useSite() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => site);
}

// Hides the boot loader (rendered by public/index.html) once settings are ready and min duration passed.
export function hideBootLoader(ready) {
  const el = document.getElementById("boot-loader");
  if (!el) return;
  const start = window.__bootStart || Date.now();
  const timeout = new Promise((r) => setTimeout(r, 8000));
  Promise.race([ready, timeout]).then(() => {
    const wait = Math.max(0, (Number(site.loader_min_ms) || 0) - (Date.now() - start));
    setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 400);
    }, site.loader_enabled ? wait : 0);
  });
}
