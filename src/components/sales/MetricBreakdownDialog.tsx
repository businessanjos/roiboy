import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  classifyMeetingTask,
  meetingDedupeKey,
  type MeetingTaskKind,
} from "@/lib/sales/meetingMetrics";
import { ExternalLink } from "lucide-react";

export type BreakdownKind = "held" | "noshow" | "scheduled" | "won";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: BreakdownKind;
  userId?: string | null;
  accountId?: string | null;
  startDate: Date;
  endDate: Date;
  title: string;
}

interface Row {
  id: string;
  label: string;
  date: string | null;
  dateField: string;
  source: string;
  link?: string;
  meta?: string;
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

async function fetchClientNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await supabase.from("clients").select("id, name").in("id", ids);
  (data || []).forEach((c: any) => map.set(c.id, c.name));
  return map;
}

async function fetchLeadNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await supabase.from("leads").select("id, full_name").in("id", ids);
  (data || []).forEach((l: any) => map.set(l.id, l.full_name));
  return map;
}

export function MetricBreakdownDialog({ open, onOpenChange, kind, userId, accountId, startDate, endDate, title }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useMemo(() => startDate.toISOString(), [startDate]);
  const end = useMemo(() => endDate.toISOString(), [endDate]);

  useEffect(() => {
    if (!open || !userId || !accountId) return;
    let cancel = false;
    setLoading(true);
    setError(null);
    setRows([]);

    (async () => {
      try {
        if (kind === "won") {
          const { data, error } = await supabase
            .from("deals")
            .select("id, title, value, won_at, client_id")
            .eq("account_id", accountId)
            .eq("responsible_user_id", userId)
            .eq("status", "won")
            .gte("won_at", start)
            .lte("won_at", end)
            .order("won_at", { ascending: false });
          if (error) throw error;
          if (cancel) return;
          const clientIds = Array.from(new Set((data || []).map((d: any) => d.client_id).filter(Boolean)));
          const nameMap = await fetchClientNames(clientIds);
          setRows(
            (data || []).map((d: any) => ({
              id: d.id,
              label: nameMap.get(d.client_id) || d.title || "Cliente sem nome",
              date: d.won_at,
              dateField: "Fechada em",
              source: "Venda fechada",
              link: `/sales/deals/${d.id}`,
              meta: d.title && nameMap.get(d.client_id) && d.title !== nameMap.get(d.client_id) ? d.title : undefined,
            })),
          );
        } else {
          const useCompletedAt = kind === "held";
          let query = supabase
            .from("internal_tasks")
            .select(
              "id, title, created_at, completed_at, client_id, deal_id, lead_id, activity_types!internal_tasks_activity_type_id_fkey(name)",
            )
            .eq("account_id", accountId)
            .eq("assigned_to", userId);
          if (useCompletedAt) {
            query = query.not("completed_at", "is", null).gte("completed_at", start).lte("completed_at", end);
          } else {
            query = query.gte("created_at", start).lte("created_at", end);
          }
          const { data, error } = await query.limit(2000);
          if (error) throw error;
          if (cancel) return;

          const filtered = (data || []).filter(
            (t: any) => classifyMeetingTask((t.activity_types as any)?.name, t.title) === kind,
          );
          const clientIds = Array.from(new Set(filtered.map((t: any) => t.client_id).filter(Boolean)));
          const leadIds = Array.from(new Set(filtered.map((t: any) => t.lead_id).filter(Boolean)));
          const [clientMap, leadMap] = await Promise.all([
            fetchClientNames(clientIds),
            fetchLeadNames(leadIds),
          ]);

          const seen = new Set<string>();
          const result: Row[] = [];
          for (const t of filtered) {
            const dk = meetingDedupeKey(userId, t as any);
            if (seen.has(dk)) continue;
            seen.add(dk);
            const dateLabel = useCompletedAt ? "Concluída em" : "Criada em";
            const clientName = t.client_id ? clientMap.get(t.client_id) : null;
            const leadName = t.lead_id ? leadMap.get(t.lead_id) : null;
            const personName = clientName || leadName;
            const personPrefix = clientName ? "" : leadName ? "Lead: " : "";
            const activity = (t.activity_types as any)?.name || "Reunião";
            result.push({
              id: t.id,
              label: personName ? `${personPrefix}${personName}` : t.title || "Sem contato vinculado",
              date: useCompletedAt ? t.completed_at : t.created_at,
              dateField: dateLabel,
              source: activity,
              link: t.deal_id ? `/sales/deals/${t.deal_id}` : t.client_id ? `/clients/${t.client_id}` : undefined,
              meta: t.title && personName && t.title !== personName ? t.title : undefined,
            });
          }
          result.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
          setRows(result);
        }
      } catch (e: any) {
        if (!cancel) setError(e?.message || "Erro ao carregar dados");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [open, kind, userId, accountId, start, end]);

  const sourceHelp =
    kind === "held"
      ? "Lista de reuniões marcadas como concluídas no período (uma por cliente)."
      : kind === "noshow"
        ? "Reuniões marcadas como no-show (cliente não compareceu) no período."
        : kind === "scheduled"
          ? "Reuniões agendadas no período (independentemente de já terem ocorrido)."
          : "Vendas fechadas no período por este vendedor.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-xs">
            {sourceHelp}
            <br />
            Período: {startDate.toLocaleDateString("pt-BR")} → {endDate.toLocaleDateString("pt-BR")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro encontrado para esta métrica no período.</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                <Badge variant="secondary">{rows.length}</Badge> {rows.length === 1 ? "registro" : "registros"}
              </span>
            </div>
            <ScrollArea className="max-h-[60vh] pr-3">
              <ul className="divide-y divide-border">
                {rows.map((r) => (
                  <li key={r.id} className="py-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{r.label}</p>
                        {r.meta && <p className="text-xs text-muted-foreground truncate">{r.meta}</p>}
                        <p className="text-[11px] text-muted-foreground/80 mt-0.5">{r.source}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {r.dateField}: {fmtDate(r.date)}
                        </p>
                        {r.link && (
                          <a
                            href={r.link}
                            className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                          >
                            abrir <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
