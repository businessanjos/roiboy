import type { JSONContent } from "@tiptap/react";

export function taskTimestampRanges(text: string): { from: number; to: number }[] {
  // Minutes may exceed 59; seconds (and minutes in hh:mm:ss) must be complete.
  const expression = /(^|[^\p{L}\p{N}:])(\d+:[0-5]\d(?::[0-5]\d)?)(?![\p{L}\p{N}:])/gu;
  return Array.from(text.matchAll(expression), (match) => {
    const from = match.index + match[1].length;
    return { from, to: from + match[2].length };
  });
}

export function boldTaskTimestamps(document: JSONContent): JSONContent {
  if (!document.content) return document;
  if (document.type !== "paragraph") {
    return { ...document, content: document.content.map(boldTaskTimestamps) };
  }
  const text = document.content.map((node) => node.type === "text" ? node.text ?? "" : "\n").join("");
  const ranges = taskTimestampRanges(text);
  if (!ranges.length) return document;
  let offset = 0;
  return { ...document, content: document.content.flatMap((node) => {
    const start = offset;
    offset += node.type === "text" ? (node.text?.length ?? 0) : 1;
    if (node.type !== "text" || !node.text) return [node];
    const nodeText = node.text;
    const cuts = [...new Set([start, offset, ...ranges.flatMap((range) => [range.from, range.to]).filter((cut) => cut > start && cut < offset)])].sort((a, b) => a - b);
    return cuts.slice(0, -1).map((from, index) => {
      const to = cuts[index + 1];
      const inTimestamp = ranges.some((range) => from >= range.from && to <= range.to);
      const marks = node.marks ?? [];
      return { ...node, text: nodeText.slice(from - start, to - start), ...(inTimestamp && !marks.some((mark) => mark.type === "bold") ? { marks: [...marks, { type: "bold" }] } : {}) };
    });
  }) };
}