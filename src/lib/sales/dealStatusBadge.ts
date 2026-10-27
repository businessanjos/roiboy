// Selo de status do negócio (aberto / ganho / perdido).
// Centralizado para que qualquer lista de negócios use o mesmo rótulo e as mesmas cores temáticas.
export type DealStatus = "open" | "won" | "lost";

export interface DealStatusBadge {
  label: string;
  className: string;
}

const DEAL_STATUS_BADGES: Record<DealStatus, DealStatusBadge> = {
  open: {
    label: "Aberto",
    className: "bg-info/10 text-info border-info/30",
  },
  won: {
    label: "Ganho",
    className: "bg-success/15 text-success-strong border-success/30",
  },
  lost: {
    label: "Perdido",
    className: "bg-danger/15 text-danger-strong border-danger/30",
  },
};

export function getDealStatusBadge(status?: string | null): DealStatusBadge | null {
  if (!status) return null;
  return DEAL_STATUS_BADGES[status as DealStatus] ?? null;
}
