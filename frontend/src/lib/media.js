import api, { cleanBaseUrl as BACKEND } from "@/lib/api";

export function fileUrl(path) {
  if (!path) return "";
  return path.startsWith("http") ? path : `${BACKEND}${path}`;
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
