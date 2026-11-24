import type { JSONContent } from "@tiptap/react";
import { find } from "linkifyjs";

/** Only public web links can be opened; never interpret executable schemes or credentials. */
export function safeTaskLinkHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (!/^https?:\/\//i.test(href) || /[\s\u0000-\u001f\u007f\\]/u.test(href)) return null;
  try {
    const url = new URL(href);
    return url.hostname && !url.username && !url.password ? href : null;
  } catch { return null; }
}

export function taskLinkRanges(text: string): { from: number; to: number; href: string }[] {
  return find(text, { defaultProtocol: "https" }).flatMap((match) => {
    const href = match.isLink && match.type === "url" ? safeTaskLinkHref(match.href) : null;
    return href ? [{ from: match.start, to: match.end, href }] : [];
  });
}

/** Link existing plain text without changing it, including URLs split by other formatting marks. */
export function linkTaskDocument(document: JSONContent): JSONContent {
  if (!document.content) return document;
  if (document.type !== "paragraph") return { ...document, content: document.content.map(linkTaskDocument) };
  const text = document.content.map((node) => node.type === "text" ? node.text ?? "" : "\n").join("");
  const ranges = taskLinkRanges(text);
  if (!ranges.length) return document;
  let offset = 0;
  return { ...document, content: document.content.flatMap((node) => {
    const start = offset;
    offset += node.type === "text" ? node.text?.length ?? 0 : 1;
    if (node.type !== "text" || !node.text || node.marks?.some((mark) => mark.type === "link")) return [node];
    const nodeText = node.text;
    const cuts = [...new Set([start, offset, ...ranges.flatMap((range) => [range.from, range.to]).filter((cut) => cut > start && cut < offset)])].sort((a, b) => a - b);
    return cuts.slice(0, -1).map((from, index) => {
      const to = cuts[index + 1];
      const range = ranges.find((candidate) => from >= candidate.from && to <= candidate.to);
      return { ...node, text: nodeText.slice(from - start, to - start), ...(range ? { marks: [...(node.marks ?? []), { type: "link", attrs: { href: range.href } }] } : {}) };
    });
  }) };
}