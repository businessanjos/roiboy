import type { JSONContent } from "@tiptap/react";
import { cleanTaskDocument } from "./taskDescription";

const COMMENT_PREFIX = "ROY_TASK_COMMENT_V1:";

/** Unformatted comments retain their existing plain-text storage. */
export function writeTaskComment(text: string, document: JSONContent): string {
  const cleaned = cleanTaskDocument(document);
  const hasFormatting = (node: JSONContent): boolean =>
    !!node.marks?.length || node.type === "bulletList" || node.type === "orderedList" ||
    (node.content?.some(hasFormatting) ?? false);
  if (!cleaned || cleaned.type !== "doc" || !hasFormatting(cleaned)) return text.trim();
  return COMMENT_PREFIX + JSON.stringify({ text: text.trim(), document: cleaned });
}

/** Never interpret legacy text as HTML or restore arbitrary editor nodes. */
export function readTaskComment(body: string): { text: string; document: JSONContent | null } {
  if (!body.startsWith(COMMENT_PREFIX)) return { text: body, document: null };
  try {
    const value: unknown = JSON.parse(body.slice(COMMENT_PREFIX.length));
    if (!value || typeof value !== "object" || !("text" in value) || typeof value.text !== "string") {
      return { text: body, document: null };
    }
    const document = cleanTaskDocument("document" in value ? value.document : null);
    return { text: value.text, document: document?.type === "doc" ? document : null };
  } catch {
    return { text: body, document: null };
  }
}