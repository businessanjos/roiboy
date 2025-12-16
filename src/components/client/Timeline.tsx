import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Video,
  Mic,
  DollarSign,
  Clock,
  Settings,
  Sparkles,
  Heart,
  Target,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TimelineEvent {
  id: string;
  type: "message" | "roi" | "risk" | "recommendation" | "session";
  title: string;
  description?: string;
  timestamp: string;
  metadata?: {
    source?: string;
    direction?: string;
    impact?: string;
    category?: string;
    level?: string;
    priority?: string;
    status?: string;
    roi_type?: string;
  };
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  revenue: <DollarSign className="h-3 w-3" />,
  cost: <DollarSign className="h-3 w-3" />,
  time: <Clock className="h-3 w-3" />,
  process: <Settings className="h-3 w-3" />,
  clarity: <Sparkles className="h-3 w-3" />,
  confidence: <Zap className="h-3 w-3" />,
  tranquility: <Heart className="h-3 w-3" />,
  status_direction: <Target className="h-3 w-3" />,
};

const getEventConfig = (event: TimelineEvent) => {
  switch (event.type) {
    case "message":
      const isClient = event.metadata?.direction === "client_to_team";
      const isAudio = event.metadata?.source === "whatsapp_audio_transcript";
      return {
        icon: isAudio ? <Mic className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />,
        bgColor: isClient ? "bg-blue-500" : "bg-slate-500",
        borderColor: isClient ? "border-blue-500" : "border-slate-500",
        textColor: isClient ? "text-blue-500" : "text-slate-500",
        label: isClient ? "Cliente" : "Equipe",
      };
    case "roi":
      const isTangible = event.metadata?.roi_type === "tangible";
      return {
        icon: <TrendingUp className="h-4 w-4" />,
        bgColor: isTangible ? "bg-emerald-500" : "bg-teal-500",
        borderColor: isTangible ? "border-emerald-500" : "border-teal-500",
        textColor: isTangible ? "text-emerald-500" : "text-teal-500",
        label: isTangible ? "ROI Tangível" : "ROI Intangível",
      };
    case "risk":
      const level = event.metadata?.level;
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        bgColor: level === "high" ? "bg-red-500" : level === "medium" ? "bg-orange-500" : "bg-amber-500",
        borderColor: level === "high" ? "border-red-500" : level === "medium" ? "border-orange-500" : "border-amber-500",
        textColor: level === "high" ? "text-red-500" : level === "medium" ? "text-orange-500" : "text-amber-500",
        label: `Risco ${level === "high" ? "Alto" : level === "medium" ? "Médio" : "Baixo"}`,
      };
    case "recommendation":
      return {
        icon: <Lightbulb className="h-4 w-4" />,
        bgColor: "bg-violet-500",
        borderColor: "border-violet-500",
        textColor: "text-violet-500",
        label: "Recomendação",
      };
    case "session":
      return {
        icon: <Video className="h-4 w-4" />,
        bgColor: "bg-indigo-500",
        borderColor: "border-indigo-500",
        textColor: "text-indigo-500",
        label: "Sessão ao Vivo",
      };
    default:
      return {
        icon: <MessageSquare className="h-4 w-4" />,
        bgColor: "bg-muted",
        borderColor: "border-muted",
        textColor: "text-muted-foreground",
        label: "",
      };
  }
};

const getImpactBadge = (impact?: string) => {
  if (!impact) return null;
  const config = {
    high: { className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", label: "Alto" },
    medium: { className: "bg-amber-500/10 text-amber-600 border-amber-500/30", label: "Médio" },
    low: { className: "bg-slate-500/10 text-slate-600 border-slate-500/30", label: "Baixo" },
  }[impact];
  
  return config ? (
    <Badge variant="outline" className={cn("text-xs", config.className)}>
      {config.label}
    </Badge>
  ) : null;
};

const getCategoryLabel = (category?: string) => {
  if (!category) return null;
  const labels: Record<string, string> = {
    revenue: "Receita",
    cost: "Custo",
    time: "Tempo",
    process: "Processo",
    clarity: "Clareza",
    confidence: "Confiança",
    tranquility: "Tranquilidade",
    status_direction: "Direção",
  };
  return labels[category];
};

export function Timeline({ events, className }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Nenhum evento na timeline ainda.</p>
        <p className="text-sm mt-1">Interações e análises aparecerão aqui.</p>
      </div>
    );
  }

  // Group events by date
  const groupedEvents: Record<string, TimelineEvent[]> = {};
  events.forEach((event) => {
    const date = format(new Date(event.timestamp), "yyyy-MM-dd");
    if (!groupedEvents[date]) {
      groupedEvents[date] = [];
    }
    groupedEvents[date].push(event);
  });

  const sortedDates = Object.keys(groupedEvents).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className={cn("space-y-6", className)}>
      {sortedDates.map((date) => {
        const dateObj = new Date(date);
        const isToday = format(new Date(), "yyyy-MM-dd") === date;
        const isYesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd") === date;
        
        const dateLabel = isToday 
          ? "Hoje" 
          : isYesterday 
          ? "Ontem" 
          : format(dateObj, "dd 'de' MMMM", { locale: ptBR });

        return (
          <div key={date} className="relative">
            {/* Date Header */}
            <div className="sticky top-0 z-10 flex items-center gap-3 mb-4 bg-background/95 backdrop-blur py-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-sm font-medium text-muted-foreground px-3 py-1 rounded-full bg-muted">
                {dateLabel}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Events for this date */}
            <div className="relative pl-8">
              {/* Vertical line */}
              <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-border via-border to-transparent" />

              <div className="space-y-4">
                {groupedEvents[date].map((event, index) => {
                  const config = getEventConfig(event);
                  const isLast = index === groupedEvents[date].length - 1;

                  return (
                    <div
                      key={event.id}
                      className={cn(
                        "relative group animate-fade-in",
                        "transition-all duration-200"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          "absolute -left-5 top-3 w-4 h-4 rounded-full border-2 bg-background",
                          "transition-transform duration-200 group-hover:scale-125",
                          config.borderColor
                        )}
                      >
                        <div
                          className={cn(
                            "absolute inset-0.5 rounded-full",
                            config.bgColor
                          )}
                        />
                      </div>

                      {/* Event Card */}
                      <div
                        className={cn(
                          "rounded-xl border bg-card p-4",
                          "transition-all duration-200",
                          "hover:shadow-md hover:border-primary/20",
                          "group-hover:translate-x-1"
                        )}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center text-white",
                                config.bgColor
                              )}
                            >
                              {event.type === "roi" && event.metadata?.category
                                ? categoryIcons[event.metadata.category] || config.icon
                                : config.icon}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {event.title}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={cn("text-xs font-medium", config.textColor)}>
                                  {config.label}
                                </span>
                                {event.metadata?.category && (
                                  <>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-xs text-muted-foreground">
                                      {getCategoryLabel(event.metadata.category)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(event.timestamp), "HH:mm", { locale: ptBR })}
                            </span>
                            {getImpactBadge(event.metadata?.impact || event.metadata?.level)}
                          </div>
                        </div>

                        {/* Description */}
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                            "{event.description}"
                          </p>
                        )}

                        {/* Footer with source indicator */}
                        {event.metadata?.source && (
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {event.metadata.source === "whatsapp_audio_transcript" ? (
                                <>
                                  <Mic className="h-3 w-3" />
                                  <span>Áudio transcrito</span>
                                </>
                              ) : event.metadata.source === "whatsapp_text" ? (
                                <>
                                  <MessageSquare className="h-3 w-3" />
                                  <span>WhatsApp</span>
                                </>
                              ) : event.metadata.source === "manual" ? (
                                <span>Adicionado manualmente</span>
                              ) : (
                                <span>{event.metadata.source}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
