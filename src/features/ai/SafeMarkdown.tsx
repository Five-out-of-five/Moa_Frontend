import Link from "next/link";
import { Fragment, type ReactNode } from "react";

function inline(text: string, roomId?: number): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link && isAllowedLink(link[2], roomId)) {
      return <Link key={index} className="text-primary underline" href={link[2]}>{link[1]}</Link>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function isAllowedLink(href: string, roomId?: number) {
  if (/[\\\s]/.test(href)) return false;
  const prefix = roomId === undefined ? "/" : `/rooms/${roomId}/`;
  if (href.startsWith(prefix) && !href.startsWith("//")) {
    return new URL(href, "https://moa.invalid").pathname.startsWith(prefix);
  }
  if (roomId !== undefined || !href.startsWith("https://")) return false;
  try { return Boolean(new URL(href).hostname); } catch { return false; }
}

export function SafeMarkdown({ text, roomId }: { text: string; roomId?: number }) {
  let inCode = false;
  return <div className="space-y-1.5 text-sm break-words">{text.split("\n").map((line, index) => {
    if (line.startsWith("```")) { inCode = !inCode; return null; }
    if (inCode) return <pre key={index} className="bg-muted rounded px-2 py-1 text-xs whitespace-pre-wrap">{line}</pre>;
    if (line.startsWith("# ")) return <h2 key={index} className="pt-2 text-base font-semibold">{inline(line.slice(2), roomId)}</h2>;
    if (line.startsWith("### ")) return <h4 key={index} className="pt-2 font-semibold">{inline(line.slice(4), roomId)}</h4>;
    if (line.startsWith("## ")) return <h3 key={index} className="pt-2 font-semibold">{inline(line.slice(3), roomId)}</h3>;
    if (line.startsWith("- ")) return <p key={index} className="pl-2">• {inline(line.slice(2), roomId)}</p>;
    return line ? <p key={index}>{inline(line, roomId)}</p> : <div key={index} className="h-1" />;
  })}</div>;
}
