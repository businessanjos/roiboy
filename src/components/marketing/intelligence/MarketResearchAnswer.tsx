import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Lightbulb, AlertTriangle, Target, BarChart3, ChevronDown, Maximize2, Minimize2 } from "lucide-react";

/**
 * Parser leve: transforma o markdown vindo da Perplexity em blocos visuais.
 * Extrai:
 *  - TL;DR (primeira linha começando com **TL;DR** ou primeiro parágrafo curto)
 *  - Números-chave (bullets no formato "- **Rótulo**: valor")
 *  - Seções (## Título → conteúdo)
 */

function stripCitations(s: string) {
  return s.replace(/\[\d+(,\s*\d+)*\]/g, "").replace(/\s{2,}/g, " ").trim();
}

type KeyStat = { label: string; value: string; detail?: string };
type Section = { title: string; icon: "insight" | "risk" | "trend" | "target" | "data"; body: string };

function pickIcon(title: string): Section["icon"] {
  const t = title.toLowerCase();
  if (/risco|amea|desafio|regulat/.test(t)) return "risk";
  if (/tend|cresci|futuro|proje/.test(t)) return "trend";
  if (/oportun|recomend|ação|acao|estrat/.test(t)) return "target";
  if (/número|numero|dado|tama|mercado|tam|sam/.test(t)) return "data";
  return "insight";
}

const iconMap = {
  insight: Lightbulb,
  risk: AlertTriangle,
  trend: TrendingUp,
  target: Target,
  data: BarChart3,
};

const iconColor = {
  insight: "text-warning",
  risk: "text-danger",
  trend: "text-success",
  target: "text-purple-600",
  data: "text-info",
};

function parseAnswer(raw: string): { tldr: string | null; stats: KeyStat[]; sections: Section[]; rest: string } {
  const text = stripCitations(raw).replace(/([^\n])\s*(#{2,4}\s)/g, "$1\n$2");
  const lines = text.split(/\r?\n/);

  let tldr: string | null = null;
  const stats: KeyStat[] = [];
  const sections: Section[] = [];

  // TL;DR: linha com **TL;DR** ou primeiro parágrafo se curto
  const tldrIdx = lines.findIndex((l) => /\*\*\s*(TL;?\s*DR|Resumo|Em resumo)\s*\*\*/i.test(l));
  if (tldrIdx >= 0) {
    tldr = lines[tldrIdx].replace(/\*\*\s*(TL;?\s*DR|Resumo|Em resumo)\s*\*\*\s*[:—-]?\s*/i, "").replace(/^\*+|\*+$/g, "").trim();
    lines.splice(tldrIdx, 1);
  }

  // Números-chave: bullets "- **Label**: valor" ou "**Label:** valor"
  const statRegex = /^[-*]\s*\*\*([^*]+?)\*\*\s*[:：]\s*(.+)$/;
  const bulletKeepIdx: number[] = [];
  lines.forEach((l, i) => {
    const m = l.match(statRegex);
    if (m) {
      const label = m[1].trim().replace(/[:：]$/, "");
      let value = m[2].trim();
      let detail: string | undefined;
      // Se o valor tem um traço/parênteses com detalhe, separa
      const parenMatch = value.match(/^(.+?)\s*[—–-]\s*(.+)$/);
      if (parenMatch && parenMatch[1].length < 80) {
        value = parenMatch[1].trim();
        detail = parenMatch[2].trim();
      }
      // Só considera "stat" se tiver número ou %
      if (/\d|%|R\$/.test(value) && value.length < 120) {
        stats.push({ label, value, detail });
        return;
      }
    }
    bulletKeepIdx.push(i);
  });
  const remainingLines = bulletKeepIdx.map((i) => lines[i]);

  // Seções por ## ou ###
  let currentTitle: string | null = null;
  let currentBody: string[] = [];
  const flush = () => {
    if (currentTitle && currentBody.join("").trim()) {
      sections.push({ title: currentTitle, icon: pickIcon(currentTitle), body: currentBody.join("\n").trim() });
    }
    currentTitle = null;
    currentBody = [];
  };
  const preSection: string[] = [];
  for (const l of remainingLines) {
    const h = l.match(/^#{2,4}\s+(.+)$/);
    if (h) {
      flush();
      currentTitle = h[1].replace(/[*_`]/g, "").trim();
    } else if (currentTitle) {
      currentBody.push(l);
    } else {
      preSection.push(l);
    }
  }
  flush();

  const rest = preSection.join("\n").trim();
  // Se ainda não temos TL;DR, usar primeiro parágrafo curto do "rest"
  if (!tldr && rest) {
    const firstPara = rest.split(/\n\s*\n/)[0].trim();
    if (firstPara && firstPara.length < 400 && !firstPara.startsWith("-")) {
      tldr = firstPara.replace(/^\*+|\*+$/g, "");
    }
  }

  return { tldr, stats, sections, rest };
}

export function MarketResearchAnswer({ answer }: { answer: string }) {
  const { tldr, stats, sections, rest } = parseAnswer(answer);

  const hasStructured = tldr || stats.length > 0 || sections.length > 0;
  const [open, setOpen] = useState<Set<number>>(new Set());
  const allOpen = sections.length > 0 && open.size === sections.length;
  const toggle = (i: number) => setOpen(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <div className="space-y-4">
      {tldr && (
        <Card className="border-l-4 border-l-purple-500 bg-purple-50/40 dark:bg-purple-950/20 border-purple-200/60">
          <CardContent className="py-3.5">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 rounded-full bg-purple-500/15 p-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300 mb-1">
                  Resumo executivo
                </div>
                <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-0 prose-strong:text-foreground text-sm leading-relaxed text-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{tldr}</ReactMarkdown>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {stats.length > 0 && (
        <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Card
              key={i}
              className="relative overflow-hidden bg-gradient-to-br from-background to-muted/40 hover:shadow-md transition-shadow"
            >
              <CardContent className="py-3 px-3.5">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground line-clamp-2 min-h-[24px]">
                  {s.label}
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums text-foreground leading-tight break-words">
                  {s.value}
                </div>
                {s.detail && (
                  <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{s.detail}</div>
                )}
              </CardContent>
              <div className="absolute top-0 right-0 h-1 w-full bg-gradient-to-r from-purple-400/40 via-info/40 to-success/40" />
            </Card>
          ))}
        </div>
      )}

      {sections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Análise detalhada · {sections.length} seç{sections.length === 1 ? "ão" : "ões"}</span>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setOpen(allOpen ? new Set() : new Set(sections.map((_, i) => i)))}>
              {allOpen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              {allOpen ? "Minimizar tudo" : "Maximizar tudo"}
            </Button>
          </div>
          <div className="divide-y rounded-lg border bg-card">
            {sections.map((sec, i) => {
              const Icon = iconMap[sec.icon];
              const isOpen = open.has(i);
              return (
                <div key={i} className="min-w-0">
                  <button type="button" aria-expanded={isOpen} onClick={() => toggle(i)} className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-muted/40">
                    <Icon className={`h-4 w-4 shrink-0 ${iconColor[sec.icon]}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{sec.title}</span>
                      {!isOpen && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{sec.body.replace(/[*_#>`-]/g, "").replace(/\s+/g, " ").slice(0, 160)}</span>}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="animate-fade-in px-4 pb-4 pl-11">
                      <div className="prose prose-sm max-w-3xl dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-headings:text-sm prose-headings:mt-3 prose-headings:mb-1 prose-strong:text-foreground text-sm leading-relaxed text-muted-foreground break-words">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{sec.body}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rest && sections.length === 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{rest}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {rest && sections.length > 0 && rest.length > 40 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground select-none">
            Ver contexto adicional
          </summary>
          <div className="mt-2 prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-strong:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{rest}</ReactMarkdown>
          </div>
        </details>
      )}

      {!hasStructured && !rest && (
        <p className="text-sm text-muted-foreground italic">Sem conteúdo estruturado.</p>
      )}

      {hasStructured && (
        <div className="flex flex-wrap gap-1 pt-1">
          {stats.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {stats.length} métrica{stats.length === 1 ? "" : "s"}
            </Badge>
          )}
          {sections.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {sections.length} seç{sections.length === 1 ? "ão" : "ões"}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
