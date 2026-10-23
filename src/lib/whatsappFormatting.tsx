import type { ReactNode } from "react";

// Aplica a formatação estilo WhatsApp: *negrito*, _itálico_, ~riscado~, ```monospace``` e @menções.
export function applyWhatsAppFormatting(text: string, keyPrefix: string = ""): ReactNode[] {
  const result: ReactNode[] = [];
  let remaining = text;
  let partIndex = 0;

  // Pattern to match WhatsApp formatting: *bold*, _italic_, ~strikethrough~, ```monospace```
  const formatPatterns = [
    { pattern: /\*([^*]+)\*/g, tag: "strong" },
    { pattern: /_([^_]+)_/g, tag: "em" },
    { pattern: /~([^~]+)~/g, tag: "del" },
    { pattern: /```([^`]+)```/g, tag: "code" },
  ];

  // Also match @mention patterns and render them styled
  const mentionPattern = /@([\p{L}\p{N}\s._-]+?)(?=\s|$|[,!?.;:])/gu;

  // Simple approach: process one format at a time
  let hasMatch = true;
  while (hasMatch) {
    hasMatch = false;

    // Check mention pattern first
    mentionPattern.lastIndex = 0;
    const mentionMatch = mentionPattern.exec(remaining);

    // Check format patterns
    let bestMatch: { match: RegExpExecArray; tag: string } | null = null;
    for (const { pattern, tag } of formatPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(remaining);
      if (match && (!bestMatch || match.index < bestMatch.match.index)) {
        bestMatch = { match, tag };
      }
    }

    // Use whichever comes first (mention or format)
    if (mentionMatch && (!bestMatch || mentionMatch.index < bestMatch.match.index)) {
      hasMatch = true;
      const beforeMatch = remaining.substring(0, mentionMatch.index);
      const mentionName = mentionMatch[1].trim();
      const afterMatch = remaining.substring(mentionMatch.index + mentionMatch[0].length);

      if (beforeMatch) result.push(beforeMatch);

      // Only style as mention if it looks like a name (not a pure number)
      if (/^\d+$/.test(mentionName)) {
        // Raw JID number - render as dimmed text
        result.push(
          <span key={`${keyPrefix}-mention-${partIndex++}`} className="text-[#53bdeb]/50 text-xs">
            @{mentionName}
          </span>
        );
      } else {
        result.push(
          <span key={`${keyPrefix}-mention-${partIndex++}`} className="text-[#53bdeb] font-medium">
            @{mentionName}
          </span>
        );
      }

      remaining = afterMatch;
      continue;
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
