import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  AlertTriangle,
  MessageSquare,
  Clock,
  BarChart3,
  Target,
  Shield,
  Zap,
  Trophy,
  UserCircle,
} from "lucide-react";

interface ChurnInsightsRendererProps {
  insights: string;
  meta?: {
    contractsAnalyzed: number;
    clientsWithMessages: number;
    totalMessages: number;
    totalValue?: number;
  } | null;
}

interface Section {
  emoji: string;
  title: string;
  icon: React.ElementType;
  content: string[];
  variant: "default" | "danger" | "warning" | "info" | "success" | "accent" | "ranking" | "profile";
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
};

function matchSection(title: string): { icon: React.ElementType; variant: Section["variant"] } | null {
  const upper = title.toUpperCase();
  for (const [key, config] of Object.entries(SECTION_CONFIG)) {
    if (upper.includes(key)) return config;
  }
  return null;
}

const VARIANT_STYLES: Record<Section["variant"], { border: string; bg: string; iconBg: string; iconColor: string; titleColor: string }> = {
  ranking: {
    border: "border-yellow-500/40",
    bg: "bg-gradient-to-br from-yellow-500/10 to-amber-500/5",
    iconBg: "bg-yellow-500/15",
    iconColor: "text-yellow-600 dark:text-yellow-400",
    titleColor: "text-yellow-700 dark:text-yellow-400",
  },
  profile: {
    border: "border-violet-500/40",
    bg: "bg-gradient-to-br from-violet-500/10 to-purple-500/5",
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-600 dark:text-violet-400",
    titleColor: "text-violet-700 dark:text-violet-400",
  },
  danger: {
    border: "border-destructive/30",
    bg: "bg-destructive/5",
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    titleColor: "text-destructive",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
    titleColor: "text-amber-700 dark:text-amber-400",
  },
  info: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-600 dark:text-blue-400",
    titleColor: "text-blue-700 dark:text-blue-400",
  },
  success: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    titleColor: "text-emerald-700 dark:text-emerald-400",
  },
  accent: {
    border: "border-purple-500/30",
    bg: "bg-purple-500/5",
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-600 dark:text-purple-400",
    titleColor: "text-purple-700 dark:text-purple-400",
  },
  default: {
    border: "border-border",
    bg: "bg-muted/30",
    iconBg: "bg-muted",
    iconColor: "text-foreground",
    titleColor: "text-foreground",
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

    const isHeader = trimmed.match(/^#{1,4}\s/) || trimmed.match(/^\*\*[^*]+\*\*$/) || trimmed.match(/^[🔍⚠️💬🕐📊🎯📈🛡️🏆👤]/u);

    if (isHeader) {
      const cleaned = cleanLine(trimmed);
      const config = matchSection(cleaned);
      if (config) {
        const emojiMatch = cleaned.match(/^([🔍⚠️💬🕐📊🎯📈🛡️🏆👤])\s*/u);
        const emoji = emojiMatch ? emojiMatch[1] : "";
        const title = cleaned.replace(/^[🔍⚠️💬🕐📊🎯📈🛡️🏆👤]\s*/u, "").trim();
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

function ContentLine({ text }: { text: string }) {
  if (text === "") return <div className="h-1.5" />;

  const isBullet = text.startsWith("•") || text.startsWith("-") || text.match(/^\d+[\.\)]/);
  const bulletText = text.replace(/^[•\-]\s*/, "").replace(/^\d+[\.\)]\s*/, "");

  // Highlight numbers, percentages, currency, and names in quotes
  const highlighted = (isBullet ? bulletText : text).replace(
    /(\d+[,.]?\d*\s*%|\bR\$\s*[\d.,]+|\d+\s*(?:dias|meses|semanas|clientes|contratos|cancelamentos|anos))/gi,
    "⟨$1⟩"
  );

  const parts = highlighted.split(/⟨|⟩/);

  if (isBullet) {
    return (
      <div className="flex items-start gap-2 py-0.5">
        <Zap className="h-3 w-3 mt-1.5 shrink-0 text-muted-foreground/60" />
        <span className="text-sm text-foreground/80 leading-relaxed">
          {parts.map((part, j) =>
            j % 2 === 1 ? (
              <span key={j} className="font-bold text-foreground bg-foreground/5 px-1 rounded">{part}</span>
            ) : (
              <span key={j}>{part}</span>
            )
          )}
        </span>
      </div>
    );
  }

  return (
    <p className="text-sm text-foreground/80 leading-relaxed">
      {parts.map((part, j) =>
        j % 2 === 1 ? (
          <span key={j} className="font-bold text-foreground bg-foreground/5 px-1 rounded">{part}</span>
        ) : (
          <span key={j}>{part}</span>
        )
      )}
    </p>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? "text-destructive" : score >= 40 ? "text-amber-500" : "text-emerald-500";
  const bgColor = score >= 70 ? "bg-destructive" : score >= 40 ? "bg-amber-500" : "bg-emerald-500";
  const label = score >= 70 ? "Alto potencial de prevenção" : score >= 40 ? "Moderado" : "Baixo";

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
          <circle
            cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
            className={color}
            strokeDasharray={`${(score / 100) * 264} 264`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${color}`}>{score}%</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${bgColor}`} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function SectionCard({ section }: { section: Section }) {
  const styles = VARIANT_STYLES[section.variant];
  const Icon = section.icon;
  const isScoreSection = section.title.toUpperCase().includes("SCORE") || section.title.toUpperCase().includes("PREVENIBILIDADE");
  const score = isScoreSection ? extractPreventabilityScore(section.content) : null;

  return (
    <Card className={`${styles.border} ${styles.bg} overflow-hidden`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-lg ${styles.iconBg}`}>
            <Icon className={`h-4 w-4 ${styles.iconColor}`} />
          </div>
          <h3 className={`font-semibold text-sm ${styles.titleColor}`}>
            {section.emoji && <span className="mr-1">{section.emoji}</span>}
            {section.title}
          </h3>
        </div>

        {score !== null && <ScoreGauge score={score} />}

        <div className="space-y-0.5">
          {section.content.map((line, i) => (
            <ContentLine key={i} text={line} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ChurnInsightsRenderer({ insights, meta }: ChurnInsightsRendererProps) {
  const sections = useMemo(() => parseSections(insights), [insights]);

  // Separate priority sections for top grid
  const rankingSection = sections.find((s) => s.variant === "ranking");
  const profileSection = sections.find((s) => s.variant === "profile");
  const otherSections = sections.filter((s) => s.variant !== "ranking" && s.variant !== "profile");

  return (
    <div className="space-y-4">
      {/* Meta stats */}
      {meta && (
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <span className="text-lg font-bold text-destructive">{meta.contractsAnalyzed}</span>
            <span className="text-xs text-muted-foreground">Contratos cancelados</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50 border">
            <span className="text-lg font-bold text-foreground">{meta.totalMessages}</span>
            <span className="text-xs text-muted-foreground">Mensagens processadas</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <span className="text-lg font-bold text-destructive">
              {meta.totalValue ? `R$ ${(meta.totalValue / 1000).toFixed(0)}k` : meta.clientsWithMessages}
            </span>
            <span className="text-xs text-muted-foreground">
              {meta.totalValue ? "Valor perdido" : "Clientes com conversas"}
            </span>
          </div>
        </div>
      )}

      {/* Priority: Ranking + Profile side by side */}
      {(rankingSection || profileSection) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rankingSection && <SectionCard section={rankingSection} />}
          {profileSection && <SectionCard section={profileSection} />}
        </div>
      )}

      {/* Other sections */}
      {otherSections.length > 0 ? (
        <div className="space-y-3">
          {otherSections.map((section, i) => (
            <SectionCard key={i} section={section} />
          ))}
        </div>
      ) : (
        sections.length === 0 && (
          <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {cleanLine(insights)}
          </div>
        )
      )}
    </div>
  );
}
