import {
  Settings,
  FileText,
  ListOrdered,
  CheckSquare,
  Gift,
  DollarSign,
  Users,
  Users2,
  Image,
  Palette,
  MessageSquare,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type EventPhaseId = "planejar" | "executar" | "pos";

export interface EventTabDef {
  value: string;
  label: string;
  icon: LucideIcon;
  phase: EventPhaseId;
}

/**
 * Fonte única das abas do detalhe do evento, agrupadas pelas três fases reais
 * de trabalho. Usada pela navegação por fase e pela sincronização com a URL
 * (`?tab=`), para que qualquer aba seja compartilhável por link.
 */
export const EVENT_TABS: EventTabDef[] = [
  { value: "overview", label: "Geral", icon: Settings, phase: "planejar" },
  { value: "briefing", label: "Briefing", icon: FileText, phase: "planejar" },
  { value: "schedule", label: "Agenda", icon: ListOrdered, phase: "planejar" },
  { value: "checklist", label: "Checklist", icon: CheckSquare, phase: "planejar" },
  { value: "team", label: "Equipe", icon: Users2, phase: "planejar" },
  { value: "costs", label: "Custos", icon: DollarSign, phase: "planejar" },
  { value: "gifts", label: "Brindes", icon: Gift, phase: "planejar" },
  { value: "design", label: "Design", icon: Palette, phase: "planejar" },

  { value: "participants", label: "Participantes", icon: Users, phase: "executar" },
  { value: "notes", label: "Notas", icon: FileText, phase: "executar" },

  { value: "media", label: "Mídia", icon: Image, phase: "pos" },
  { value: "feedback", label: "Feedback", icon: MessageSquare, phase: "pos" },
  { value: "roi", label: "Resultado", icon: TrendingUp, phase: "pos" },
  { value: "summaries", label: "Resumos IA", icon: Sparkles, phase: "pos" },
];

export const EVENT_PHASES: { id: EventPhaseId; label: string }[] = [
  { id: "planejar", label: "Planejar" },
  { id: "executar", label: "Executar" },
  { id: "pos", label: "Pós-evento" },
];

export const EVENT_TAB_VALUES = new Set(EVENT_TABS.map((t) => t.value));

export function isEventTab(value: unknown): value is string {
  return typeof value === "string" && EVENT_TAB_VALUES.has(value);
}

export function sanitizeEventTab(value: unknown, fallback = "overview"): string {
  return isEventTab(value) ? value : fallback;
}

export function phaseOfTab(tab: string): EventPhaseId {
  return EVENT_TABS.find((t) => t.value === tab)?.phase ?? "planejar";
}

export function tabsOfPhase(phase: EventPhaseId): EventTabDef[] {
  return EVENT_TABS.filter((t) => t.phase === phase);
}
