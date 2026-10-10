export const tfLabels = (q) => {
  const l = q?.tf_labels || [];
  return [l[0] || "Benar", l[1] || "Salah"];
};

export const parseTfMap = (arr) => Object.fromEntries((arr || []).filter((a) => typeof a === "string" && a.includes(":")).map((a) => a.split(":", 2)));
