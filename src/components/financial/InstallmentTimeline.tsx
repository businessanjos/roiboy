import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Lock,
  Unlock,
  FileText,
  CreditCard,
  Banknote,
  XCircle,
  Gavel,
  Percent,
  Phone,
  HandCoins,
  TimerReset,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type EventRow = {
  id: string;
  event_type: string;
  payload: any;
  created_at: string;
  created_by: string | null;
};

type Props = {
  installmentId: string;
  className?: string;
};

const EVENT_META: Record<
  string,
  { icon: any; label: string; tone: string }
> = {
  system: { icon: Sparkles, label: "Criação", tone: "text-muted-foreground" },
  status_change: { icon: RefreshCw, label: "Status alterado", tone: "text-blue-500" },
  check_status_change: { icon: Banknote, label: "Cheque", tone: "text-amber-500" },
  card_status_change: { icon: CreditCard, label: "Cartão", tone: "text-purple-500" },
  full_payment: { icon: CheckCircle2, label: "Pagamento total", tone: "text-emerald-500" },
  partial_payment: { icon: HandCoins, label: "Pagamento parcial", tone: "text-emerald-400" },
  charge_attempt: { icon: Phone, label: "Tentativa de cobrança", tone: "text-blue-400" },
  promise: { icon: TimerReset, label: "Promessa de pagamento", tone: "text-cyan-500" },
  renegotiation: { icon: RefreshCw, label: "Renegociação", tone: "text-orange-500" },
  dispute: { icon: Gavel, label: "Disputa", tone: "text-red-500" },
  bounce: { icon: AlertTriangle, label: "Devolução", tone: "text-red-400" },
  discount: { icon: Percent, label: "Desconto", tone: "text-pink-500" },
  write_off: { icon: XCircle, label: "Baixa", tone: "text-zinc-500" },
  lock: { icon: Lock, label: "Bloqueado", tone: "text-zinc-500" },
  unlock: { icon: Unlock, label: "Desbloqueado", tone: "text-zinc-400" },
  note: { icon: FileText, label: "Nota", tone: "text-muted-foreground" },
};

function describePayload(eventType: string, payload: any): string | null {
  if (!payload) return null;
  switch (eventType) {
    case "status_change":
    case "check_status_change":
    case "card_status_change": {
      const from = payload.from ?? payload.old ?? "—";
      const to = payload.to ?? payload.new ?? "—";
      return `${from} → ${to}`;
    }
    case "system":
      return payload.message || "Parcela criada";
    case "full_payment":
    case "partial_payment":
      return payload.amount
        ? `R$ ${Number(payload.amount).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}`
        : null;
    case "renegotiation":
      return payload.new_invoice_id
        ? `Nova fatura: ${String(payload.new_invoice_id).slice(0, 8)}`
        : payload.note ?? null;
    case "note":
      return payload.text ?? payload.note ?? null;
    default:
      return payload.note ?? payload.message ?? null;
  }
}

type FilterKey = "all" | "status" | "payments" | "renegotiation" | "dispute";

const FILTERS: { key: FilterKey; label: string; types: string[] }[] = [
  { key: "all", label: "Tudo", types: [] },
  {
    key: "status",
    label: "Status",
    types: ["status_change", "check_status_change", "card_status_change", "lock", "unlock"],
  },
  {
    key: "payments",
    label: "Pagamentos",
    types: ["full_payment", "partial_payment", "discount", "write_off", "charge_attempt", "promise"],
  },
  { key: "renegotiation", label: "Renegociações", types: ["renegotiation"] },
  { key: "dispute", label: "Disputas", types: ["dispute", "bounce"] },
];

export function InstallmentTimeline({ installmentId, className }: Props) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("installment_events")
        .select("id, event_type, payload, created_at, created_by")
        .eq("installment_id", installmentId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        if (error) console.error("[InstallmentTimeline]", error);
        setEvents((data as EventRow[]) ?? []);
        setLoading(false);
      }
    }
    load();

    const channel = supabase
      .channel(`installment_events:${installmentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "installment_events",
          filter: `installment_id=eq.${installmentId}`,
        },
        (payload) => {
          setEvents((prev) => [...prev, payload.new as EventRow]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [installmentId]);

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-3/4" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground",
          className
        )}
      >
        Sem eventos registrados ainda. A régua de cobrança e mudanças de
        status aparecerão aqui automaticamente.
      </div>
    );
  }

  const latest = events[events.length - 1];
  const latestMeta = EVENT_META[latest.event_type] ?? {
    icon: Clock,
    label: latest.event_type,
    tone: "text-muted-foreground",
  };
  const LatestIcon = latestMeta.icon;
  const latestDescription = describePayload(latest.event_type, latest.payload);
  const lastStatusChange = [...events]
    .reverse()
    .find((e) => e.event_type === "status_change");
  const currentStatus =
    lastStatusChange?.payload?.to ?? lastStatusChange?.payload?.new ?? null;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full bg-muted",
                latestMeta.tone
              )}
            >
              <LatestIcon className="h-4 w-4" />
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Status atual
                </span>
                {currentStatus && (
                  <Badge variant="secondary" className="capitalize">
                    {String(currentStatus).replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium">
                Última movimentação: {latestMeta.label}
              </p>
              {latestDescription && (
                <p className="text-xs text-muted-foreground">
                  {latestDescription}
                </p>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(latest.created_at), "dd/MM/yyyy 'às' HH:mm", {
              locale: ptBR,
            })}
          </span>
        </div>
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>{events.length} eventos registrados</span>
          <span>
            Início:{" "}
            {format(new Date(events[0].created_at), "dd/MM/yyyy", {
              locale: ptBR,
            })}
          </span>
        </div>
      </div>

      <ol className="relative space-y-4 pl-6">
        <span
          aria-hidden
          className="absolute left-2 top-1 bottom-1 w-px bg-border"
        />
        {events.map((ev) => {
          const meta = EVENT_META[ev.event_type] ?? {
            icon: Clock,
            label: ev.event_type,
            tone: "text-muted-foreground",
          };
          const Icon = meta.icon;
          const description = describePayload(ev.event_type, ev.payload);
          return (
            <li key={ev.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[22px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-2 ring-border",
                  meta.tone
                )}
              >
                <Icon className="h-3 w-3" />
              </span>
              <div className="flex flex-col gap-1 rounded-md border border-border bg-card/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{meta.label}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {ev.event_type}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(ev.created_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default InstallmentTimeline;
