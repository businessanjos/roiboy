import type { ReactNode } from "react";

// Aplica a formatação estilo WhatsApp: *negrito*, _itálico_, ~riscado~ e ```monospace```.
// Menções (@) NÃO são formatadas de propósito: o texto segue literal, como o cliente recebe.
export function applyWhatsAppFormatting(text: string, keyPrefix: string = ""): ReactNode[] {
  const result: ReactNode[] = [];
  let remaining = text;
  let partIndex = 0;

  const formatPatterns = [
    { pattern: /\*([^*]+)\*/g, tag: "strong" },
    { pattern: /_([^_]+)_/g, tag: "em" },
    { pattern: /~([^~]+)~/g, tag: "del" },
    { pattern: /```([^`]+)```/g, tag: "code" },
  ];

  // Simple approach: process one format at a time
  let hasMatch = true;
  while (hasMatch) {
    hasMatch = false;

    let bestMatch: { match: RegExpExecArray; tag: string } | null = null;
    for (const { pattern, tag } of formatPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(remaining);
      if (match && (!bestMatch || match.index < bestMatch.match.index)) {
        bestMatch = { match, tag };
      }
    }

    if (bestMatch) {
      hasMatch = true;
      const { match, tag } = bestMatch;
      const beforeMatch = remaining.substring(0, match.index);
      const matchedContent = match[1];
      const afterMatch = remaining.substring(match.index + match[0].length);

      if (beforeMatch) {
        result.push(beforeMatch);
      }

      const element = tag === "strong" ? (
        <strong key={`${keyPrefix}-${partIndex++}`} className="font-bold">{matchedContent}</strong>
      ) : tag === "em" ? (
        <em key={`${keyPrefix}-${partIndex++}`} className="italic">{matchedContent}</em>
      ) : tag === "del" ? (
        <del key={`${keyPrefix}-${partIndex++}`}>{matchedContent}</del>
      ) : (
        <code key={`${keyPrefix}-${partIndex++}`} className="bg-black/20 px-1 rounded text-xs font-mono">{matchedContent}</code>
      );

      result.push(element);
      remaining = afterMatch;
    }
  }

  if (remaining) {
    result.push(remaining);
  }

  return result.length > 0 ? result : [text];
}
