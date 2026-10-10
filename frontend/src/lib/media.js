import api, { cleanBaseUrl as BACKEND, getAccessToken } from "@/lib/api";

export function fileUrl(path) {
  if (!path) return "";
  const url = path.startsWith("http") ? path : `${BACKEND}${path}`;
  const token = getAccessToken();
  if (!token || !url.startsWith(BACKEND) || !url.includes("/api/files/") || /[?&]token=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

export function youtubeEmbed(url) {
  if (!url) return "";
  const m = url.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post("/upload", fd);
  return data; // { id, url, filename, content_type, size, path }
}
