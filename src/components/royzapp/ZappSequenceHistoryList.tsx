import { friendlyError } from "@/lib/zappSequenceFriendlyError";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Clock, History, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const db = supabase as any;

interface SequenceRunRow {
  id: string;
  sequence_name: string;
  status: string;
  sent_steps: number;
  total_steps: number;
  triggered_by_name: string | null;
  cancel_reason: string | null;
  created_at: string;
  finished_at: string | null;
  contact_name: string | null;
}

interface RunStepRow {
  id: string;
  position: number;
  name: string | null;
  content_type: string;
  status: string;
  delay_seconds: number;
  scheduled_at: string;
  sent_at: string | null;
  last_error: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  running: "Em andamento",
  completed: "Concluída",
  done: "Concluída",
  cancelled: "Cancelada",
  failed: "Falhou",
};

const STATUS_CLASS: Record<string, string> = {
  running: "bg-primary/15 text-primary",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
};

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function ZappSequenceHistoryList({ open }: { open: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: runs = [], isLoading, isRefetching } = useQuery({
    queryKey: ["zapp-sequence-history", open],
    enabled: open,
    refetchInterval: 15000,
    queryFn: async (): Promise<SequenceRunRow[]> => {
      const { data, error } = await db
        .from("zapp_sequence_runs")
        .select("id, sequence_name, status, sent_steps, total_steps, triggered_by_name, cancel_reason, created_at, finished_at, zapp_conversations(contact_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map((r: any) => ({ ...r, contact_name: r.zapp_conversations?.contact_name ?? null }));
    },
  });

  const { data: steps = [], isLoading: stepsLoading } = useQuery({
    queryKey: ["zapp-sequence-history-steps", expanded],
    enabled: !!expanded,
    queryFn: async (): Promise<RunStepRow[]> => {
      const { data, error } = await db
        .from("zapp_sequence_run_steps")
        .select("id, position, name, content_type, status, delay_seconds, scheduled_at, sent_at, last_error")
        .eq("run_id", expanded)
        .order("position");
      if (error) throw error;
      return data || [];
    },
  });

  if (!open) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Últimos 50 disparos de sequências nas conversas do setor.</p>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => qc.invalidateQueries({ queryKey: ["zapp-sequence-history", open] })}>
          {isRefetching ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />} Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : runs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          <History className="mx-auto mb-2 h-6 w-6 opacity-50" />
          Nenhum disparo registrado ainda. Inicie uma sequência em uma conversa para aparecer aqui.
        </p>
      ) : (
        <div className="space-y-2">
          {runs.map((r) => {
            const isExpanded = expanded === r.id;
            return (
              <div key={r.id} className="rounded-md border">
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : r.id)}
                  className="flex w-full flex-wrap items-center gap-2 p-3 text-left"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.sequence_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.contact_name || "Contato"} · {r.triggered_by_name || "—"} · {fmtDateTime(r.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{r.sent_steps}/{r.total_steps}</span>
                  <Badge variant="secondary" className={cn("shrink-0 font-medium", STATUS_CLASS[r.status] || "")}>
                    {STATUS_LABEL[r.status] || r.status}
                  </Badge>
                </button>

                {r.cancel_reason && r.status === "cancelled" && (
                  <p className="px-3 pb-2 text-xs text-muted-foreground">Motivo: {r.cancel_reason}</p>
                )}

                {isExpanded && (
                  <div className="border-t px-3 py-2">
                    {stepsLoading ? (
                      <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                    ) : (
                      <ul className="space-y-1.5">
                        {steps.map((s) => (
                          <li key={s.id} className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="w-4 shrink-0 text-center font-semibold text-muted-foreground">{s.position + 1}</span>
                            <span className="min-w-0 flex-1 truncate">{s.name || s.content_type}</span>
                            <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {s.status === "sent" ? `enviada ${fmtTime(s.sent_at)}` : `prevista ${fmtTime(s.scheduled_at)}`}
                              {s.status !== "sent" && s.delay_seconds > 0 ? ` (após ${s.delay_seconds}s)` : ""}
                            </span>
                            <Badge variant="secondary" className={cn("shrink-0 font-medium", STATUS_CLASS[s.status] || "")}>
                              {s.status === "sent" ? "Enviada" : s.status === "pending" ? "Pendente" : s.status === "claimed" ? "Enviando" : STATUS_LABEL[s.status] || s.status}
                            </Badge>
                            {s.last_error && <span className="w-full text-destructive">{friendlyError(s.last_error, s.content_type)}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
