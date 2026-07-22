import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Lightbulb, AlertTriangle, Target, BarChart3 } from "lucide-react";

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
  insight: "text-amber-600",
  risk: "text-red-600",
  trend: "text-emerald-600",
  target: "text-purple-600",
  data: "text-blue-600",
};

function parseAnswer(raw: string): { tldr: string | null; stats: KeyStat[]; sections: Section[]; rest: string } {
  const text = stripCitations(raw);
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
              <div className="absolute top-0 right-0 h-1 w-full bg-gradient-to-r from-purple-400/40 via-blue-400/40 to-emerald-400/40" />
            </Card>
          ))}
        </div>
      )}

      {sections.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {sections.map((sec, i) => {
            const Icon = iconMap[sec.icon];
            return (
              <Card key={i} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${iconColor[sec.icon]}`} />
                    <h4 className="font-semibold text-sm">{sec.title}</h4>
                  </div>
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-headings:hidden prose-strong:text-foreground text-sm text-muted-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{sec.body}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {rest && sections.length === 0 && !tldr && (
        // Fallback: sem estrutura reconhecida, renderiza markdown puro
        <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{rest}</ReactMarkdown>
        </div>
      )}

      {rest && (sections.length > 0 || stats.length > 0) && rest.length > 40 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground select-none">
            Ver contexto adicional
          </summary>
          <div className="mt-2 prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5">
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
