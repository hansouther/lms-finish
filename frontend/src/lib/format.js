export function formatRupiah(value) {
  if (value === 0 || value == null) return "Gratis";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export function formatDate(iso, opts) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", opts || { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

export const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export function formatDateTime(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export const formatNilai = (v) => Number(v || 0).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
