import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  AlertTriangle,
  MessageSquare,
  Clock,
  BarChart3,
  Calendar,
  Target,
  Shield,
  Trophy,
  UserCircle,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  DollarSign,
  Mail,
  Flame,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

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
  "AÇÕES IMEDIATAS": { icon: Flame, variant: "danger" },
  "AÇÕES PRIORITÁRIAS": { icon: Flame, variant: "danger" },
};

function matchSection(title: string): { icon: React.ElementType; variant: Section["variant"] } | null {
  const upper = title.toUpperCase();
  for (const [key, config] of Object.entries(SECTION_CONFIG)) {
    if (upper.includes(key)) return config;
  }
  return null;
}

const VARIANT_STYLES: Record<Section["variant"], {
  border: string; bg: string; iconBg: string; iconColor: string;
  titleColor: string; statBg: string; statText: string; accentBar: string;
}> = {
  ranking: {
    border: "border-yellow-500/30",
    bg: "bg-gradient-to-br from-yellow-500/8 via-amber-500/4 to-transparent",
    iconBg: "bg-yellow-500/12",
    iconColor: "text-yellow-600 dark:text-yellow-400",
    titleColor: "text-yellow-700 dark:text-yellow-400",
    statBg: "bg-yellow-500/8 border border-yellow-500/20",
    statText: "text-yellow-700 dark:text-yellow-300",
    accentBar: "bg-yellow-500",
  },
  profile: {
    border: "border-violet-500/30",
    bg: "bg-gradient-to-br from-violet-500/8 via-purple-500/4 to-transparent",
    iconBg: "bg-violet-500/12",
    iconColor: "text-violet-600 dark:text-violet-400",
    titleColor: "text-violet-700 dark:text-violet-400",
    statBg: "bg-violet-500/8 border border-violet-500/20",
    statText: "text-violet-700 dark:text-violet-300",
    accentBar: "bg-violet-500",
  },
  danger: {
    border: "border-destructive/25",
    bg: "bg-gradient-to-br from-destructive/6 via-destructive/2 to-transparent",
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    titleColor: "text-destructive",
    statBg: "bg-destructive/8 border border-destructive/20",
    statText: "text-destructive",
    accentBar: "bg-destructive",
  },
  warning: {
    border: "border-amber-500/25",
    bg: "bg-gradient-to-br from-amber-500/6 via-amber-500/2 to-transparent",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
    titleColor: "text-amber-700 dark:text-amber-400",
    statBg: "bg-amber-500/8 border border-amber-500/20",
    statText: "text-amber-700 dark:text-amber-300",
    accentBar: "bg-amber-500",
  },
  info: {
    border: "border-blue-500/25",
    bg: "bg-gradient-to-br from-blue-500/6 via-blue-500/2 to-transparent",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-600 dark:text-blue-400",
    titleColor: "text-blue-700 dark:text-blue-400",
    statBg: "bg-blue-500/8 border border-blue-500/20",
    statText: "text-blue-700 dark:text-blue-300",
    accentBar: "bg-blue-500",
  },
  success: {
    border: "border-emerald-500/25",
    bg: "bg-gradient-to-br from-emerald-500/6 via-emerald-500/2 to-transparent",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    titleColor: "text-emerald-700 dark:text-emerald-400",
    statBg: "bg-emerald-500/8 border border-emerald-500/20",
    statText: "text-emerald-700 dark:text-emerald-300",
    accentBar: "bg-emerald-500",
  },
  accent: {
    border: "border-purple-500/25",
    bg: "bg-gradient-to-br from-purple-500/6 via-purple-500/2 to-transparent",
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-600 dark:text-purple-400",
    titleColor: "text-purple-700 dark:text-purple-400",
    statBg: "bg-purple-500/8 border border-purple-500/20",
    statText: "text-purple-700 dark:text-purple-300",
    accentBar: "bg-purple-500",
  },
  default: {
    border: "border-border",
    bg: "bg-muted/20",
    iconBg: "bg-muted",
    iconColor: "text-foreground",
    titleColor: "text-foreground",
    statBg: "bg-muted/50 border border-border",
    statText: "text-foreground",
    accentBar: "bg-muted-foreground",
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

    const isHeader = trimmed.match(/^#{1,4}\s/) || trimmed.match(/^\*\*[^*]+\*\*$/) || trimmed.match(/^[🔍⚠️💬🕐📊🎯📈🛡️🏆👤🚨🔥]/u);

    if (isHeader) {
      const cleaned = cleanLine(trimmed);
      const config = matchSection(cleaned);
      if (config) {
        const emojiMatch = cleaned.match(/^([🔍⚠️💬🕐📊🎯📈🛡️🏆👤🚨🔥])\s*/u);
        const emoji = emojiMatch ? emojiMatch[1] : "";
        const title = cleaned.replace(/^[🔍⚠️💬🕐📊🎯📈🛡️🏆👤🚨🔥]\s*/u, "").trim();
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

function extractStats(content: string[]): ExtractedStat[] {
  const stats: ExtractedStat[] = [];
  const seen = new Set<string>();
  for (const line of content) {
    const percentMatch = line.match(/(\d{1,3}[,.]?\d*)\s*%/);
    const currencyMatch = line.match(/R\$\s*([\d.,]+[kKmM]?)/);
    const countMatch = line.match(/(\d+)\s+(cancel|cliente|contrato|mulher|hom[eê]|dias|meses|anos)/i);

    if (percentMatch && !seen.has(percentMatch[1])) {
      const val = percentMatch[1] + "%";
      seen.add(percentMatch[1]);
      const label = line.replace(percentMatch[0], "").replace(/^[•\-:]\s*/, "").replace(/[:–—]\s*$/, "").trim().slice(0, 50);
      if (label) stats.push({ value: val, label, isAlert: parseFloat(percentMatch[1]) >= 50 });
    } else if (currencyMatch && !seen.has(currencyMatch[1])) {
      seen.add(currencyMatch[1]);
      stats.push({ value: `R$ ${currencyMatch[1]}`, label: line.replace(currencyMatch[0], "").replace(/^[•\-:]\s*/, "").trim().slice(0, 50), isAlert: true });
    } else if (countMatch && !seen.has(countMatch[0])) {
      seen.add(countMatch[0]);
      const label = line.replace(countMatch[0], "").replace(/^[•\-:]\s*/, "").trim().slice(0, 50) || countMatch[2];
      stats.push({ value: countMatch[1], label: label || countMatch[2] });
    }
    if (stats.length >= 4) break;
  }
  return stats.slice(0, 4);
}

function splitHeadlineAndDetail(content: string[]): { headline: string | null; details: string[] } {
  if (content.length === 0) return { headline: null, details: [] };
  const firstNonBullet = content.findIndex(
    (l) => l && !l.startsWith("•") && !l.startsWith("-") && !l.match(/^\d+[\.\)]/)
  );
  if (firstNonBullet >= 0 && firstNonBullet < 2) {
    return { headline: content[firstNonBullet], details: content.filter((_, i) => i !== firstNonBullet) };
  }
  return { headline: null, details: content };
}

function HighlightedText({ text, size = "xs" }: { text: string; size?: "xs" | "sm" }) {
  const highlighted = text.replace(
    /(\d+[,.]?\d*\s*%|\bR\$\s*[\d.,]+[kKmM]?|\d+\s*(?:dias|meses|semanas|clientes|contratos|cancelamentos|anos|horas?))/gi,
    "⟨$1⟩"
  );
  const parts = highlighted.split(/⟨|⟩/);

  return (
    <>
      {parts.map((part, j) =>
        j % 2 === 1 ? (
          <span key={j} className={`font-bold text-foreground bg-foreground/6 px-1 py-0.5 rounded text-${size}`}>{part}</span>
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
      <div className="flex items-start gap-2.5 py-0.5 group">
        <ArrowRight className="h-3 w-3 text-muted-foreground/40 mt-0.5 shrink-0 group-hover:text-muted-foreground/70 transition-colors" />
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
  const trackColor = score >= 70 ? "text-destructive/15" : score >= 40 ? "text-amber-500/15" : "text-emerald-500/15";
  const label = score >= 70 ? "Alto potencial de prevenção" : score >= 40 ? "Moderado" : "Baixo";

  return (
    <div className="flex items-center gap-5 py-3">
      <div className="relative w-24 h-24 shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className={trackColor} />
          <circle
            cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8"
            className={color}
            strokeDasharray={`${(score / 100) * 251} 251`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-black ${color}`}>{score}%</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${bgColor} animate-pulse`} />
          <span className="text-sm font-bold text-foreground">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground leading-snug max-w-[200px]">
          dos cancelamentos poderiam ter sido evitados com ações proativas
        </span>
      </div>
    </div>
  );
}

function StatPill({ stat, styles }: { stat: ExtractedStat; styles: typeof VARIANT_STYLES["default"] }) {
  return (
    <div className={`flex flex-col items-center px-3 py-2.5 rounded-lg ${styles.statBg} min-w-0 transition-transform hover:scale-[1.02]`}>
      <span className={`text-base font-black leading-tight ${stat.isAlert ? "text-destructive" : styles.statText}`}>
        {stat.value}
      </span>
      <span className="text-[10px] text-muted-foreground text-center leading-tight mt-1 line-clamp-2">
        {stat.label}
      </span>
    </div>
  );
}

function SectionCard({ section, defaultExpanded = false, compact = false }: { section: Section; defaultExpanded?: boolean; compact?: boolean }) {
  const styles = VARIANT_STYLES[section.variant];
  const Icon = section.icon;
  const isScoreSection = section.title.toUpperCase().includes("SCORE") || section.title.toUpperCase().includes("PREVENIBILIDADE");
  const score = isScoreSection ? extractPreventabilityScore(section.content) : null;
  const stats = useMemo(() => extractStats(section.content), [section.content]);
  const { headline, details } = useMemo(() => splitHeadlineAndDetail(section.content), [section.content]);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasDetails = details.length > 0;
  const detailCount = details.filter(l => l !== "").length;

  return (
    <Card className={`${styles.border} ${styles.bg} overflow-hidden relative group`}>
      {/* Accent bar left */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${styles.accentBar} opacity-60 rounded-l-lg`} />
      
      <CardContent className="p-0 pl-1">
        {/* Header */}
        <button
          onClick={() => hasDetails && setExpanded(!expanded)}
          className="w-full flex items-center gap-2.5 px-3 py-3 text-left hover:bg-foreground/[0.02] transition-colors"
        >
          <div className={`p-1.5 rounded-md ${styles.iconBg} shrink-0`}>
            <Icon className={`h-4 w-4 ${styles.iconColor}`} />
          </div>
          <h3 className={`font-bold text-[13px] ${styles.titleColor} flex-1 tracking-tight`}>
            {section.emoji && <span className="mr-1.5">{section.emoji}</span>}
            {section.title}
          </h3>
          {hasDetails && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal text-muted-foreground border-border/50">
              {detailCount}
            </Badge>
          )}
          {hasDetails && (
            <div className="text-muted-foreground/40 transition-transform duration-200" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}>
              <ChevronDown className="h-4 w-4" />
            </div>
          )}
        </button>

        {/* Score gauge */}
        {score !== null && (
          <div className="px-4 pb-2">
            <ScoreGauge score={score} />
          </div>
        )}

        {/* Headline */}
        {headline && (
          <div className="px-4 pb-2">
            <p className="text-[13px] font-medium text-foreground/85 leading-snug">
              <HighlightedText text={headline} size="sm" />
            </p>
          </div>
        )}

        {/* Stats row */}
        {stats.length > 0 && !compact && (
          <div className={`grid gap-1.5 px-4 pb-3 ${
            stats.length === 1 ? "grid-cols-1 max-w-[160px]" :
            stats.length === 2 ? "grid-cols-2" :
            stats.length === 3 ? "grid-cols-3" :
            "grid-cols-4"
          }`}>
            {stats.map((stat, i) => (
              <StatPill key={i} stat={stat} styles={styles} />
            ))}
          </div>
        )}

        {/* Expandable details */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            expanded && hasDetails ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="px-4 pb-3 pt-1.5 border-t border-border/20 space-y-0.5">
            {details.map((line, i) => (
              <ContentLine key={i} text={line} />
            ))}
          </div>
        </div>
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
    <div className="space-y-4">
      {/* Period + Meta combined hero */}
      {meta && (
        <div className="rounded-xl bg-gradient-to-r from-muted/60 via-muted/30 to-transparent border border-border/50 p-4">
          {/* Period */}
          {meta.periodStart && meta.periodEnd && (
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/30">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Período analisado:{" "}
                <span className="font-semibold text-foreground">{formatDate(meta.periodStart)}</span>
                <span className="mx-1.5 text-muted-foreground/50">→</span>
                <span className="font-semibold text-foreground">{formatDate(meta.periodEnd)}</span>
              </span>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/10 mb-1.5">
                <TrendingDown className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-2xl font-black text-destructive leading-none">{meta.contractsAnalyzed}</p>
              <p className="text-[10px] text-muted-foreground mt-1 font-medium tracking-wide uppercase">Cancelamentos</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-muted mb-1.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-black text-foreground leading-none">{meta.totalMessages}</p>
              <p className="text-[10px] text-muted-foreground mt-1 font-medium tracking-wide uppercase">Mensagens</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/10 mb-1.5">
                <DollarSign className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-2xl font-black text-destructive leading-none">
                {meta.totalValue
                  ? meta.totalValue >= 1_000_000
                    ? `R$ ${(meta.totalValue / 1_000_000).toFixed(1)}M`
                    : `R$ ${(meta.totalValue / 1000).toFixed(0)}k`
                  : meta.clientsWithMessages}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 font-medium tracking-wide uppercase">
                {meta.totalValue ? "Valor perdido" : "Com conversas"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Score + Profile in 2-col grid */}
      {(scoreSection || profileSection) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scoreSection && <SectionCard section={scoreSection} defaultExpanded />}
          {profileSection && <SectionCard section={profileSection} defaultExpanded />}
        </div>
      )}

      {/* Danger/warning - expanded, 2-col if multiple */}
      {dangerSections.length > 0 && (
        <div className={`grid gap-3 ${dangerSections.length >= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
          {dangerSections.map((section, i) => (
            <SectionCard key={`danger-${i}`} section={section} defaultExpanded />
          ))}
        </div>
      )}

      {/* Ranking */}
      {rankingSection && <SectionCard section={rankingSection} defaultExpanded />}

      {/* Other sections - collapsed by default */}
      {otherSections.length > 0 && (
        <div className={`grid gap-3 ${otherSections.length >= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
          {otherSections.map((section, i) => (
            <SectionCard key={`other-${i}`} section={section} />
          ))}
        </div>
      )}

      {/* Fallback */}
      {sections.length === 0 && (
        <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
          {cleanLine(insights)}
        </div>
      )}
    </div>
  );
}
