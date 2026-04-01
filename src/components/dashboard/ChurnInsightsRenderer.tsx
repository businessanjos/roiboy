import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  AlertTriangle,
  MessageSquare,
  Clock,
  BarChart3,
  Target,
  Shield,
  Trophy,
  UserCircle,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  Users,
  DollarSign,
  Mail,
} from "lucide-react";

interface ChurnInsightsRendererProps {
  insights: string;
  meta?: {
    contractsAnalyzed: number;
    clientsWithMessages: number;
    totalMessages: number;
    totalValue?: number;
    periodStart?: string | null;
    periodEnd?: string | null;
  } | null;
}

interface Section {
  emoji: string;
  title: string;
  icon: React.ElementType;
  content: string[];
  variant: "default" | "danger" | "warning" | "info" | "success" | "accent" | "ranking" | "profile";
}

interface ExtractedStat {
  value: string;
  label: string;
  isAlert?: boolean;
}

const SECTION_CONFIG: Record<string, { icon: React.ElementType; variant: Section["variant"] }> = {
  "RANKING DE CONSULTORAS": { icon: Trophy, variant: "ranking" },
  "PERFIL DO CLIENTE": { icon: UserCircle, variant: "profile" },
  "PADRÕES IDENTIFICADOS": { icon: Search, variant: "danger" },
  "SINAIS DE ALERTA": { icon: AlertTriangle, variant: "warning" },
  "TIMING CRÍTICO": { icon: Clock, variant: "accent" },
  "ANÁLISE DE SENTIMENTO": { icon: MessageSquare, variant: "info" },
  "ANÁLISE POR MOTIVO": { icon: BarChart3, variant: "default" },
  "RECOMENDAÇÕES": { icon: Target, variant: "success" },
  "SCORE DE PREVENIBILIDADE": { icon: Shield, variant: "danger" },
  "AÇÕES IMEDIATAS": { icon: TrendingDown, variant: "danger" },
  "AÇÕES PRIORITÁRIAS": { icon: TrendingDown, variant: "danger" },
};

function matchSection(title: string): { icon: React.ElementType; variant: Section["variant"] } | null {
  const upper = title.toUpperCase();
  for (const [key, config] of Object.entries(SECTION_CONFIG)) {
    if (upper.includes(key)) return config;
  }
  return null;
}

const VARIANT_STYLES: Record<Section["variant"], { border: string; bg: string; iconBg: string; iconColor: string; titleColor: string; statBg: string; statText: string }> = {
  ranking: {
    border: "border-yellow-500/40",
    bg: "bg-gradient-to-br from-yellow-500/10 to-amber-500/5",
    iconBg: "bg-yellow-500/15",
    iconColor: "text-yellow-600 dark:text-yellow-400",
    titleColor: "text-yellow-700 dark:text-yellow-400",
    statBg: "bg-yellow-500/10",
    statText: "text-yellow-700 dark:text-yellow-300",
  },
  profile: {
    border: "border-violet-500/40",
    bg: "bg-gradient-to-br from-violet-500/10 to-purple-500/5",
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-600 dark:text-violet-400",
    titleColor: "text-violet-700 dark:text-violet-400",
    statBg: "bg-violet-500/10",
    statText: "text-violet-700 dark:text-violet-300",
  },
  danger: {
    border: "border-destructive/30",
    bg: "bg-destructive/5",
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    titleColor: "text-destructive",
    statBg: "bg-destructive/10",
    statText: "text-destructive",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
    titleColor: "text-amber-700 dark:text-amber-400",
    statBg: "bg-amber-500/10",
    statText: "text-amber-700 dark:text-amber-300",
  },
  info: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-600 dark:text-blue-400",
    titleColor: "text-blue-700 dark:text-blue-400",
    statBg: "bg-blue-500/10",
    statText: "text-blue-700 dark:text-blue-300",
  },
  success: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    titleColor: "text-emerald-700 dark:text-emerald-400",
    statBg: "bg-emerald-500/10",
    statText: "text-emerald-700 dark:text-emerald-300",
  },
  accent: {
    border: "border-purple-500/30",
    bg: "bg-purple-500/5",
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-600 dark:text-purple-400",
    titleColor: "text-purple-700 dark:text-purple-400",
    statBg: "bg-purple-500/10",
    statText: "text-purple-700 dark:text-purple-300",
  },
  default: {
    border: "border-border",
    bg: "bg-muted/30",
    iconBg: "bg-muted",
    iconColor: "text-foreground",
    titleColor: "text-foreground",
    statBg: "bg-muted/50",
    statText: "text-foreground",
  },
};

function cleanLine(line: string): string {
  return line
    .replace(/^#{1,4}\s*/, "")
    .replace(/\*\*\*(.*?)\*\*\*/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .trim();
}

function parseSections(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "---") {
      if (current && current.content.length > 0) current.content.push("");
      continue;
    }

    const isHeader = trimmed.match(/^#{1,4}\s/) || trimmed.match(/^\*\*[^*]+\*\*$/) || trimmed.match(/^[🔍⚠️💬🕐📊🎯📈🛡️🏆👤🚨]/u);

    if (isHeader) {
      const cleaned = cleanLine(trimmed);
      const config = matchSection(cleaned);
      if (config) {
        const emojiMatch = cleaned.match(/^([🔍⚠️💬🕐📊🎯📈🛡️🏆👤🚨])\s*/u);
        const emoji = emojiMatch ? emojiMatch[1] : "";
        const title = cleaned.replace(/^[🔍⚠️💬🕐📊🎯📈🛡️🏆👤🚨]\s*/u, "").trim();
        current = { emoji, title, icon: config.icon, content: [], variant: config.variant };
        sections.push(current);
        continue;
      }
    }

    if (current) {
      const cleaned = cleanLine(trimmed);
      if (cleaned) current.content.push(cleaned);
    }
  }

  sections.forEach((s) => {
    while (s.content.length > 0 && s.content[s.content.length - 1] === "") s.content.pop();
  });

  return sections;
}

function extractPreventabilityScore(content: string[]): number | null {
  for (const line of content) {
    const match = line.match(/(\d{1,3})\s*%/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

/** Extract key stats from content lines for visual callouts */
function extractStats(content: string[]): ExtractedStat[] {
  const stats: ExtractedStat[] = [];
  for (const line of content) {
    // Match "Value: Label" or "Label: Value" patterns with numbers/percentages
    const percentMatch = line.match(/(\d{1,3}[,.]?\d*)\s*%/);
    const currencyMatch = line.match(/R\$\s*([\d.,]+[kKmM]?)/);
    const countMatch = line.match(/(\d+)\s+(cancel|cliente|contrato|mulher|hom[eê]|dias|meses|anos)/i);

    if (percentMatch) {
      const val = percentMatch[1] + "%";
      const label = line.replace(percentMatch[0], "").replace(/^[•\-:]\s*/, "").replace(/[:–—]\s*$/, "").trim().slice(0, 40);
      if (label && stats.length < 4) {
        stats.push({ value: val, label, isAlert: parseFloat(percentMatch[1]) >= 50 });
      }
    } else if (currencyMatch && stats.length < 4) {
      stats.push({ value: `R$ ${currencyMatch[1]}`, label: line.replace(currencyMatch[0], "").replace(/^[•\-:]\s*/, "").trim().slice(0, 40), isAlert: true });
    } else if (countMatch && stats.length < 4) {
      const label = line.replace(countMatch[0], "").replace(/^[•\-:]\s*/, "").trim().slice(0, 40) || countMatch[2];
      stats.push({ value: countMatch[1], label: label || countMatch[2] });
    }
  }
  return stats.slice(0, 3);
}

/** Separate "headline" (first sentence/key finding) from supporting detail */
function splitHeadlineAndDetail(content: string[]): { headline: string | null; details: string[] } {
  if (content.length === 0) return { headline: null, details: [] };

  // First non-bullet line is the headline
  const firstNonBullet = content.findIndex(
    (l) => l && !l.startsWith("•") && !l.startsWith("-") && !l.match(/^\d+[\.\)]/)
  );

  if (firstNonBullet >= 0 && firstNonBullet < 2) {
    return {
      headline: content[firstNonBullet],
      details: content.filter((_, i) => i !== firstNonBullet),
    };
  }

  return { headline: null, details: content };
}

function HighlightedText({ text }: { text: string }) {
  const highlighted = text.replace(
    /(\d+[,.]?\d*\s*%|\bR\$\s*[\d.,]+[kKmM]?|\d+\s*(?:dias|meses|semanas|clientes|contratos|cancelamentos|anos|horas?))/gi,
    "⟨$1⟩"
  );
  const parts = highlighted.split(/⟨|⟩/);

  return (
    <>
      {parts.map((part, j) =>
        j % 2 === 1 ? (
          <span key={j} className="font-bold text-foreground bg-foreground/8 px-1 py-0.5 rounded text-xs">{part}</span>
        ) : (
          <span key={j}>{part}</span>
        )
      )}
    </>
  );
}

function ContentLine({ text }: { text: string }) {
  if (text === "") return <div className="h-1" />;

  const isBullet = text.startsWith("•") || text.startsWith("-") || text.match(/^\d+[\.\)]/);
  const bulletText = text.replace(/^[•\-]\s*/, "").replace(/^\d+[\.\)]\s*/, "");

  if (isBullet) {
    return (
      <div className="flex items-start gap-2 py-0.5">
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
        <span className="text-xs text-muted-foreground leading-relaxed">
          <HighlightedText text={bulletText} />
        </span>
      </div>
    );
  }

  return (
    <p className="text-xs text-muted-foreground leading-relaxed">
      <HighlightedText text={text} />
    </p>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? "text-destructive" : score >= 40 ? "text-amber-500" : "text-emerald-500";
  const bgColor = score >= 70 ? "bg-destructive" : score >= 40 ? "bg-amber-500" : "bg-emerald-500";
  const label = score >= 70 ? "Alto potencial de prevenção" : score >= 40 ? "Moderado" : "Baixo";

  return (
    <div className="flex items-center gap-4 py-2">
      <div className="relative w-20 h-20 shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
          <circle
            cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10"
            className={color}
            strokeDasharray={`${(score / 100) * 264} 264`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-black ${color}`}>{score}%</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${bgColor}`} />
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground">dos cancelamentos poderiam ter sido evitados</span>
      </div>
    </div>
  );
}

function StatPill({ stat, styles }: { stat: ExtractedStat; styles: typeof VARIANT_STYLES["default"] }) {
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg ${styles.statBg} min-w-0`}>
      <span className={`text-lg font-black leading-tight ${stat.isAlert ? "text-destructive" : styles.statText}`}>
        {stat.value}
      </span>
      <span className="text-[10px] text-muted-foreground text-center leading-tight mt-0.5 line-clamp-2">
        {stat.label}
      </span>
    </div>
  );
}

function SectionCard({ section, defaultExpanded = false }: { section: Section; defaultExpanded?: boolean }) {
  const styles = VARIANT_STYLES[section.variant];
  const Icon = section.icon;
  const isScoreSection = section.title.toUpperCase().includes("SCORE") || section.title.toUpperCase().includes("PREVENIBILIDADE");
  const score = isScoreSection ? extractPreventabilityScore(section.content) : null;
  const stats = useMemo(() => extractStats(section.content), [section.content]);
  const { headline, details } = useMemo(() => splitHeadlineAndDetail(section.content), [section.content]);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasDetails = details.length > 0;

  return (
    <Card className={`${styles.border} ${styles.bg} overflow-hidden transition-all`}>
      <CardContent className="p-0">
        {/* Header - always visible, clickable */}
        <button
          onClick={() => hasDetails && setExpanded(!expanded)}
          className="w-full flex items-center gap-3 p-3 pb-2 text-left"
        >
          <div className={`p-1.5 rounded-md ${styles.iconBg} shrink-0`}>
            <Icon className={`h-4 w-4 ${styles.iconColor}`} />
          </div>
          <h3 className={`font-bold text-sm ${styles.titleColor} flex-1`}>
            {section.emoji && <span className="mr-1">{section.emoji}</span>}
            {section.title}
          </h3>
          {hasDetails && (
            <div className="text-muted-foreground/50">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          )}
        </button>

        {/* Score gauge */}
        {score !== null && (
          <div className="px-3 pb-2">
            <ScoreGauge score={score} />
          </div>
        )}

        {/* Headline - always visible */}
        {headline && (
          <div className="px-3 pb-2">
            <p className="text-sm font-medium text-foreground/90 leading-snug">
              <HighlightedText text={headline} />
            </p>
          </div>
        )}

        {/* Stats row - always visible */}
        {stats.length > 0 && (
          <div className={`grid gap-2 px-3 pb-3 ${stats.length === 1 ? "grid-cols-1" : stats.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {stats.map((stat, i) => (
              <StatPill key={i} stat={stat} styles={styles} />
            ))}
          </div>
        )}

        {/* Expandable details */}
        {hasDetails && expanded && (
          <div className="px-3 pb-3 pt-1 border-t border-border/30 space-y-0.5">
            {details.map((line, i) => (
              <ContentLine key={i} text={line} />
            ))}
          </div>
        )}

        {/* "show more" hint when collapsed and has details */}
        {hasDetails && !expanded && (
          <div className="px-3 pb-2">
            <button
              onClick={() => setExpanded(true)}
              className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              ver detalhes ({details.filter(l => l !== "").length} itens)
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ChurnInsightsRenderer({ insights, meta }: ChurnInsightsRendererProps) {
  const sections = useMemo(() => parseSections(insights), [insights]);

  const rankingSection = sections.find((s) => s.variant === "ranking");
  const profileSection = sections.find((s) => s.variant === "profile");
  const scoreSection = sections.find((s) => s.title.toUpperCase().includes("SCORE") || s.title.toUpperCase().includes("PREVENIBILIDADE"));
  const dangerSections = sections.filter((s) => (s.variant === "danger" || s.variant === "warning") && s !== scoreSection);
  const otherSections = sections.filter(
    (s) => s !== rankingSection && s !== profileSection && s !== scoreSection && !dangerSections.includes(s)
  );

  return (
    <div className="space-y-3">
      {/* Period banner */}
      {meta?.periodStart && meta?.periodEnd && (
        <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            Período: <span className="font-semibold text-foreground">{formatDate(meta.periodStart)}</span>
            {" — "}
            <span className="font-semibold text-foreground">{formatDate(meta.periodEnd)}</span>
          </span>
        </div>
      )}
      {/* Hero meta stats */}
      {meta && (
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center p-3 rounded-xl bg-destructive/8 border border-destructive/20">
            <TrendingDown className="h-4 w-4 text-destructive mb-1" />
            <span className="text-xl font-black text-destructive">{meta.contractsAnalyzed}</span>
            <span className="text-[10px] text-muted-foreground font-medium">Cancelamentos</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-xl bg-muted/50 border border-border">
            <Mail className="h-4 w-4 text-muted-foreground mb-1" />
            <span className="text-xl font-black text-foreground">{meta.totalMessages}</span>
            <span className="text-[10px] text-muted-foreground font-medium">Mensagens</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-xl bg-destructive/8 border border-destructive/20">
            <DollarSign className="h-4 w-4 text-destructive mb-1" />
            <span className="text-xl font-black text-destructive">
              {meta.totalValue
                ? meta.totalValue >= 1_000_000
                  ? `R$ ${(meta.totalValue / 1_000_000).toFixed(1)}M`
                  : `R$ ${(meta.totalValue / 1000).toFixed(0)}k`
                : meta.clientsWithMessages}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              {meta.totalValue ? "Valor perdido" : "Com conversas"}
            </span>
          </div>
        </div>
      )}

      {/* Score + Profile side by side at top */}
      {(scoreSection || profileSection) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {scoreSection && <SectionCard section={scoreSection} defaultExpanded />}
          {profileSection && <SectionCard section={profileSection} defaultExpanded />}
        </div>
      )}

      {/* ALERT: Danger/warning sections - always expanded */}
      {dangerSections.length > 0 && (
        <div className="space-y-2">
          {dangerSections.map((section, i) => (
            <SectionCard key={`danger-${i}`} section={section} defaultExpanded />
          ))}
        </div>
      )}

      {/* Ranking */}
      {rankingSection && <SectionCard section={rankingSection} defaultExpanded />}

      {/* Other sections - collapsed by default */}
      {otherSections.length > 0 && (
        <div className="space-y-2">
          {otherSections.map((section, i) => (
            <SectionCard key={`other-${i}`} section={section} />
          ))}
        </div>
      )}

      {/* Fallback for unparseable text */}
      {sections.length === 0 && (
        <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
          {cleanLine(insights)}
        </div>
      )}
    </div>
  );
}
