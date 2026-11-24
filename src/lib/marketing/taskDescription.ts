import type { JSONContent } from "@tiptap/react";
import { format, isValid, parse } from "date-fns";

export const TASK_MARKER_COLORS = [
  { name: "Amarelo", color: "var(--task-marker-yellow)", className: "task-marker-yellow" },
  { name: "Verde", color: "var(--task-marker-green)", className: "task-marker-green" },
  { name: "Azul", color: "var(--task-marker-blue)", className: "task-marker-blue" },
  { name: "Rosa", color: "var(--task-marker-pink)", className: "task-marker-pink" },
] as const;
export function validMarkerColor(color: unknown): color is string {
  return typeof color === "string" && (/^#[0-9a-f]{6}$/i.test(color) || TASK_MARKER_COLORS.some((c) => c.color === color));
}
export function markerInk(color: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return "var(--task-marker-ink)";
  const rgb = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return luminance > 0.179 ? "var(--task-marker-ink)" : "var(--task-marker-light-ink)";
}
const allowedNodes = new Set(["doc", "paragraph", "text", "hardBreak", "bulletList", "orderedList", "listItem"]);
export function cleanTaskDocument(value: unknown, depth = 0, allowMentions = false): JSONContent | null {
  if (depth > 15 || !value || typeof value !== "object") return null;
  const raw = value as JSONContent;
  if (allowMentions && raw.type === "mention" && typeof raw.attrs?.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.attrs.id) && typeof raw.attrs?.label === "string") {
    return { type: "mention", attrs: { id: raw.attrs.id, label: raw.attrs.label.trim().split(/\s+/)[0].slice(0, 80) } };
  }
  if (!raw.type || !allowedNodes.has(raw.type)) return null;
  const node: JSONContent = { type: raw.type };
  if (raw.type === "text" && typeof raw.text === "string") node.text = raw.text;
  if (Array.isArray(raw.content)) node.content = raw.content.map((child) => cleanTaskDocument(child, depth + 1, allowMentions)).filter((child): child is JSONContent => !!child);
  if (Array.isArray(raw.marks)) node.marks = raw.marks.flatMap((mark) => {
    if (mark.type === "bold" || mark.type === "italic") return [{ type: mark.type }];
    if (mark.type === "highlight" && validMarkerColor(mark.attrs?.color)) return [{ type: "highlight", attrs: { color: mark.attrs?.color } }];
    return [];
  });
  return node;
}
export function plainTaskDocument(text: string): JSONContent {
  return { type: "doc", content: text.split("\n").map((line) => ({ type: "paragraph", ...(line ? { content: [{ type: "text", text: line }] } : {}) })) };
}
export function taskDescriptionContent(text: string, stored: unknown): JSONContent {
  if (stored && typeof stored === "object") {
    const snapshot = stored as { text?: unknown; document?: unknown };
    const document = cleanTaskDocument(snapshot.document);
    if (snapshot.text === text && document?.type === "doc") return document;
  }
  return plainTaskDocument(text);
}
export function writeTaskDescription(base: Record<string, unknown>, text: string, document: JSONContent, colors: string[]): Record<string, unknown> {
  return { ...base, description_editor: { text, document: cleanTaskDocument(document) ?? plainTaskDocument(text), colors: [...new Set(colors.filter((color) => /^#[0-9a-f]{6}$/i.test(color)))] } };
}
export function readTaskMarkerColors(base?: Record<string, unknown>): string[] {
  const values = (base?.description_editor as { colors?: unknown } | undefined)?.colors;
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) : [];
}

export function deliveryDateInput(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-"); return `${day}/${month}/${year}`;
  }
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length <= 2 ? digits : digits.length <= 4 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
export function parseDeliveryDate(value: string): Date | undefined {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return undefined;
  const date = parse(value, "dd/MM/yyyy", new Date());
  return isValid(date) && format(date, "dd/MM/yyyy") === value ? date : undefined;
}