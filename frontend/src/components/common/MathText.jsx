import { useMemo } from "react";
import katex from "katex";
import { fileUrl } from "@/lib/media";

const DELIMS = [
  ["$$", "$$", true],
  ["\\[", "\\]", true],
  ["\\(", "\\)", false],
  ["$", "$", false],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function findClose(src, close, from) {
  let i = from;
  while ((i = src.indexOf(close, i)) !== -1) {
    if (src[i - 1] !== "\\" || close.startsWith("\\")) return i;
    i += 1;
  }
  return -1;
}

export function renderMath(src) {
  let out = "";
  let buf = "";
  let i = 0;
  while (i < src.length) {
    if (src[i] === "\\" && src[i + 1] === "$") { buf += "$"; i += 2; continue; }
    const d = DELIMS.find(([open]) => src.startsWith(open, i));
    const end = d ? findClose(src, d[1], i + d[0].length) : -1;
    if (d && end > i + d[0].length) {
      const tex = src.slice(i + d[0].length, end);
      out += esc(buf); buf = "";
      out += katex.renderToString(tex, { displayMode: d[2], throwOnError: false, strict: "ignore", trust: false, output: "htmlAndMathml" });
      i = end + d[1].length;
      continue;
    }
    buf += src[i]; i += 1;
  }
  return out + esc(buf);
}

export default function MathText({ text, as: Tag = "span", className = "", ...rest }) {
  const html = useMemo(() => renderMath(String(text ?? "")), [text]);
  return <Tag className={`math-text whitespace-pre-wrap break-words ${className}`} dangerouslySetInnerHTML={{ __html: html }} {...rest} />;
}

export function QuestionImage({ src, className = "", testid }) {
  if (!src) return null;
  return (
    <img src={fileUrl(src)} alt="Gambar soal" loading="lazy" data-testid={testid}
      className={`max-h-80 w-auto max-w-full rounded-lg border border-[#E2E8F0] bg-white object-contain ${className}`} />
  );
}
