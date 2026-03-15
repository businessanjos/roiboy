import React from 'react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)|(\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      nodes.push(<strong key={key++} className="font-semibold text-foreground">{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<code key={key++} className="px-1.5 py-0.5 rounded bg-secondary text-primary text-xs font-mono">{match[4]}</code>);
    } else if (match[5]) {
      nodes.push(<em key={key++} className="italic text-foreground/80">{match[6]}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;
  let listBuffer: { content: string; ordered: boolean; index: number }[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const isOrdered = listBuffer[0].ordered;
    const ListTag = isOrdered ? 'ol' : 'ul';
    elements.push(
      <ListTag key={key++} className="my-3 space-y-2 list-none pl-0">
        {listBuffer.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
            {isOrdered ? (
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">
                {item.index}
              </span>
            ) : (
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-2" />
            )}
            <span className="flex-1">{parseInline(item.content)}</span>
          </li>
        ))}
      </ListTag>
    );
    listBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') { flushList(); continue; }

    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      flushList();
      elements.push(
        <div key={key++} className="my-8 flex items-center gap-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
      );
      continue;
    }

    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <div key={key++} className="mt-6 mb-5 first:mt-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{parseInline(trimmed.slice(2))}</h1>
          <div className="mt-2 h-0.5 w-16 bg-gradient-to-r from-primary to-primary/20 rounded-full" />
        </div>
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <div key={key++} className="mt-8 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full bg-primary" />
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{parseInline(trimmed.slice(3))}</h2>
          </div>
        </div>
      );
      continue;
    }

    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={key++} className="text-base font-semibold text-foreground/90 mt-5 mb-2 pl-4 border-l-2 border-primary/20">
          {parseInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      flushList();
      elements.push(
        <h4 key={key++} className="text-sm font-semibold text-foreground/80 uppercase tracking-wider mt-4 mb-2">
          {parseInline(trimmed.slice(5))}
        </h4>
      );
      continue;
    }

    if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote key={key++} className="my-4 relative rounded-lg border border-primary/15 bg-primary/5 px-5 py-3.5">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l-lg" />
          <p className="text-sm leading-relaxed text-foreground/85 italic pl-2">{parseInline(trimmed.slice(2))}</p>
        </blockquote>
      );
      continue;
    }

    const ulMatch = trimmed.match(/^[-•*]\s+(.+)/);
    if (ulMatch) { listBuffer.push({ content: ulMatch[1], ordered: false, index: 0 }); continue; }

    const olMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (olMatch) { listBuffer.push({ content: olMatch[2], ordered: true, index: parseInt(olMatch[1]) }); continue; }

    const kvMatch = trimmed.match(/^\*\*(.+?)\*\*[:：]\s*(.+)/);
    if (kvMatch) {
      flushList();
      elements.push(
        <div key={key++} className="flex items-start gap-2 my-1.5 pl-4">
          <span className="font-semibold text-sm text-foreground whitespace-nowrap">{kvMatch[1]}:</span>
          <span className="text-sm text-muted-foreground leading-relaxed">{parseInline(kvMatch[2])}</span>
        </div>
      );
      continue;
    }

    flushList();
    elements.push(
      <p key={key++} className="text-sm leading-relaxed text-muted-foreground my-2.5">{parseInline(trimmed)}</p>
    );
  }

  flushList();

  return <div className={cn("py-2", className)}>{elements}</div>;
}
