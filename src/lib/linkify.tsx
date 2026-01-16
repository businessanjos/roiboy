import React from "react";
import { ensureHttps } from "@/lib/url-security";

// Regex para detectar URLs no texto (suporta http, https e www)
const URL_REGEX = /(https?:\/\/[^\s<>[\]()]+|www\.[^\s<>[\]()]+)/gi;

/**
 * Converte URLs em texto para links clicáveis
 * @param text Texto contendo URLs
 * @returns Array de React nodes com links renderizados
 */
export function linkifyText(text: string): React.ReactNode[] {
  if (!text) return [];
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  
  // Reset regex state
  URL_REGEX.lastIndex = 0;
  
  while ((match = URL_REGEX.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    // Add the URL as a link
    const url = match[0];
    const safeUrl = ensureHttps(url);
    
    parts.push(
      <a
        key={`link-${match.index}`}
        href={safeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline hover:text-primary/80 break-all"
      >
        {url}
      </a>
    );
    
    lastIndex = match.index + url.length;
  }
  
  // Add remaining text after last URL
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
}
