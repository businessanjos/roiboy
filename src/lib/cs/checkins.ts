export const CHECKPOINT_INTERVAL_DAYS = 15;

export type CheckinInitiatedBy = "consultor" | "cliente";
export type CheckinChannel =
  | "whatsapp"
  | "ligacao"
  | "reuniao"
  | "presencial"
  | "email"
  | "outro";
export type CheckinKind = "checkpoint" | "contato";
export type CheckinSource = "manual" | "ai_whatsapp";

export interface ClientCheckin {
  id: string;
  account_id: string;
  client_id: string;
  user_id: string | null;
  happened_at: string;
  initiated_by: CheckinInitiatedBy;
  channel: CheckinChannel;
  kind: CheckinKind;
  summary: string;
  source: CheckinSource;
  message_count: number;
  created_at: string;
  updated_at: string;
  users?: { name: string | null; avatar_url: string | null } | null;
}

export const CHECKIN_CHANNELS: { value: CheckinChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ligacao", label: "Ligação" },
  { value: "reuniao", label: "Reunião online" },
  { value: "presencial", label: "Presencial" },
  { value: "email", label: "E-mail" },
  { value: "outro", label: "Outro" },
];

export const CHECKIN_INITIATED_BY: { value: CheckinInitiatedBy; label: string }[] = [
  { value: "consultor", label: "Consultor procurou o cliente" },
  { value: "cliente", label: "Cliente procurou a gente" },
];

export function getChannelLabel(value?: string | null) {
  return CHECKIN_CHANNELS.find((c) => c.value === value)?.label || "Contato";
}

export function getInitiatedByLabel(value?: string | null) {
  return value === "cliente" ? "Cliente" : "Consultor";
}

export function getKindLabel(kind?: string | null) {
  return kind === "checkpoint" ? "Checkpoint quinzenal" : "Contato";
}

export type CheckpointStatus = "em_dia" | "atencao" | "vencido" | "sem_registro";

export interface CheckpointState {
  status: CheckpointStatus;
  lastCheckpointAt: string | null;
  nextDueAt: string | null;
  daysSince: number | null;
  daysUntilDue: number | null;
  label: string;
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export function getCheckpointState(
  lastCheckpointAt: string | null | undefined,
  now: Date = new Date()
): CheckpointState {
  if (!lastCheckpointAt) {
    return {
      status: "sem_registro",
      lastCheckpointAt: null,
      nextDueAt: null,
      daysSince: null,
      daysUntilDue: null,
      label: "Sem checkpoint registrado",
    };
  }

  const last = new Date(lastCheckpointAt);
  const next = new Date(last.getTime() + CHECKPOINT_INTERVAL_DAYS * 86_400_000);
  const daysSince = daysBetween(last, now);
  const daysUntilDue = daysBetween(now, next);

  let status: CheckpointStatus = "em_dia";
  if (daysUntilDue < 0) status = "vencido";
  else if (daysUntilDue <= 3) status = "atencao";

  const label =
    status === "vencido"
      ? `Checkpoint vencido há ${Math.abs(daysUntilDue)} dia(s)`
      : status === "atencao"
        ? `Vence em ${daysUntilDue} dia(s)`
        : `Em dia · próximo em ${daysUntilDue} dia(s)`;

  return {
    status,
    lastCheckpointAt,
    nextDueAt: next.toISOString(),
    daysSince,
    daysUntilDue,
    label,
  };
}

export const CHECKPOINT_STATUS_STYLES: Record<CheckpointStatus, string> = {
  em_dia: "bg-success/10 text-success border-success/30",
  atencao: "bg-warning/10 text-warning border-warning/30",
  vencido: "bg-destructive/10 text-destructive border-destructive/30",
  sem_registro: "bg-muted text-muted-foreground border-border",
};

export const CHECKPOINT_STATUS_LABELS: Record<CheckpointStatus, string> = {
  em_dia: "Em dia",
  atencao: "Vence em breve",
  vencido: "Vencido",
  sem_registro: "Sem registro",
};
