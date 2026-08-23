import { ReactNode, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Clock,
  Link2,
  LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MarketResearchAnswer } from "./MarketResearchAnswer";
import { cn } from "@/lib/utils";

export type MiAnalysisTone =
  | "purple"
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "slate"
  | "fuchsia"
  | "cyan";

const TONE: Record<
  MiAnalysisTone,
  { text: string; bg: string; ring: string; grad: string; headlineText: string }
> = {
  purple: {
    text: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
    ring: "ring-purple-500/20",
    grad: "from-purple-500/10 via-purple-500/5 to-transparent",
    headlineText: "text-purple-700 dark:text-purple-300",
  },
  blue: {
    text: "text-info dark:text-info",
    bg: "bg-info/10",
    ring: "ring-info/20",
    grad: "from-info/10 via-info/5 to-transparent",
    headlineText: "text-info-strong dark:text-info",
  },
  emerald: {
    text: "text-success dark:text-success",
    bg: "bg-success/10",
    ring: "ring-success/20",
    grad: "from-success/10 via-success/5 to-transparent",
    headlineText: "text-success-strong dark:text-success",
  },
  amber: {
    text: "text-warning dark:text-warning",
    bg: "bg-warning/10",
    ring: "ring-warning/20",
    grad: "from-warning/10 via-warning/5 to-transparent",
    headlineText: "text-warning-strong dark:text-warning",
  },
  rose: {
    text: "text-danger dark:text-danger",
    bg: "bg-danger/10",
    ring: "ring-danger/20",
    grad: "from-danger/10 via-danger/5 to-transparent",
    headlineText: "text-danger-strong dark:text-danger",
  },
  slate: {
    text: "text-muted-foreground dark:text-muted-foreground",
    bg: "bg-muted-foreground/10",
    ring: "ring-border/20",
    grad: "from-muted-foreground/10 via-muted-foreground/5 to-transparent",
    headlineText: "text-foreground dark:text-muted-foreground",
  },
  fuchsia: {
    text: "text-fuchsia-600 dark:text-fuchsia-400",
    bg: "bg-fuchsia-500/10",
    ring: "ring-fuchsia-500/20",
    grad: "from-fuchsia-500/10 via-fuchsia-500/5 to-transparent",
    headlineText: "text-fuchsia-700 dark:text-fuchsia-300",
  },
  cyan: {
    text: "text-info dark:text-info",
    bg: "bg-info/10",
    ring: "ring-info/20",
    grad: "from-info/10 via-info/5 to-transparent",
    headlineText: "text-info-strong dark:text-info",
  },
};

export interface MiAnalysisCitation {
  index?: number;
  url: string;
  title?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  tone?: MiAnalysisTone;
  eyebrow?: string;
  title: string;
  createdAt?: string | Date | null;
  headline?: string | null;
  headlineLabel?: string;
  query?: string;
  answer: string;
  citations?: MiAnalysisCitation[] | null;
  /** Extra structured blocks (e.g. faixas, exclusões) shown before the answer. */
  meta?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  onSecondary?: () => void;
  secondaryLabel?: string;
}

export function MiAnalysisSheet({
  open,
  onOpenChange,
  icon: Icon,
  tone = "purple",
  eyebrow,
  title,
  createdAt,
  headline,
  headlineLabel = "Headline",
  query,
  answer,
  citations,
  meta,
  onRefresh,
  refreshing,
  onSecondary,
  secondaryLabel,
}: Props) {
  const t = TONE[tone];
  const [showQuery, setShowQuery] = useState(false);
  const cites = Array.isArray(citations) ? citations : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col gap-0 bg-background">
        {/* Header with subtle tinted gradient */}
        <div className={cn("relative border-b", "bg-gradient-to-br", t.grad)}>
          <div className="px-6 pt-6 pb-5 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ring-1",
                  t.bg,
                  t.ring,
                )}
              >
                <Icon className={cn("h-5 w-5", t.text)} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                {eyebrow && (
                  <p
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-widest mb-1",
                      t.text,
                    )}
                  >
                    {eyebrow}
                  </p>
                )}
                <h2 className="text-lg font-semibold leading-tight text-foreground pr-8">
                  {title}
                </h2>
                {createdAt && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      Coletado em{" "}
                      {format(new Date(createdAt), "d 'de' MMM 'de' yyyy, HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {headline && (
              <div
                className={cn(
                  "rounded-xl border ring-1 px-4 py-3.5 bg-background/60 backdrop-blur-sm",
                  t.ring,
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  {headlineLabel}
                </p>
                <p
                  className={cn(
                    "text-3xl font-bold tabular-nums leading-tight break-words",
                    t.headlineText,
                  )}
                >
                  {headline}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {meta && <div className="space-y-4">{meta}</div>}

          {/* Answer */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className={cn("h-3.5 w-3.5", t.text)} />
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Análise
              </h3>
            </div>
            {answer ? (
              <MarketResearchAnswer answer={answer} />
            ) : (
              <p className="text-sm text-muted-foreground italic">Sem análise disponível.</p>
            )}
          </section>

          {/* Citations */}
          {cites.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Fontes citadas
                </h3>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">
                  {cites.length}
                </Badge>
              </div>
              <ol className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
                {cites.map((c, i) => (
                  <li key={i} className="text-xs leading-snug">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="group inline-flex items-start gap-2 hover:text-foreground text-muted-foreground"
                    >
                      <span className="tabular-nums font-medium min-w-[1.5rem] text-foreground/70">
                        [{c.index ?? i + 1}]
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="text-primary group-hover:underline break-words">
                          {c.title || new URL(c.url).hostname.replace(/^www\./, "")}
                        </span>
                        <ExternalLink className="inline h-3 w-3 ml-1 opacity-50" />
                        {c.title && (
                          <span className="block text-[10px] text-muted-foreground/70 truncate">
                            {c.url}
                          </span>
                        )}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Query (collapsible, technical) */}
          {query && (
            <section className="space-y-2">
              <button
                type="button"
                onClick={() => setShowQuery((v) => !v)}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Consulta enviada à IA</span>
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    showQuery && "rotate-90",
                  )}
                />
              </button>
              {showQuery && (
                <div className="rounded-lg border bg-muted/40 p-3">
                  <pre className="text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap font-mono">
                    {query}
                  </pre>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        {(onRefresh || onSecondary) && (
          <>
            <Separator />
            <div className="px-6 py-3 flex items-center justify-end gap-2 bg-muted/20">
              {onSecondary && secondaryLabel && (
                <Button size="sm" variant="ghost" onClick={onSecondary}>
                  {secondaryLabel}
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              )}
              {onRefresh && (
                <Button size="sm" variant="outline" onClick={onRefresh} disabled={refreshing}>
                  {refreshing ? (
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  )}
                  Recoletar dado
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
