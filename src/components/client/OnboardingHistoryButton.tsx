import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Row {
  id: string;
  user_name: string | null;
  entity_name: string | null;
  created_at: string;
  details: Record<string, any> | null;
}

const TZ = "America/Sao_Paulo";
const dayKey = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "long", year: "numeric" });
const hour = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/** Histórico de conclusões/mudanças de etapa do onboarding. Sem clientId mostra de todos. */
export function OnboardingHistoryButton({ clientId }: { clientId?: string }) {
  const { data = [], isFetching, refetch } = useQuery({
    queryKey: ["onboarding-history", clientId ?? "all"],
    enabled: false,
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("id, user_name, entity_name, created_at, details")
        .eq("entity_type", "client")
        .eq("details->>context", "onboarding")
        .order("created_at", { ascending: false })
        .limit(100);
      if (clientId) q = q.eq("entity_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of data) {
      const k = dayKey(r.created_at);
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()];
  }, [data]);

  return (
    <Popover onOpenChange={(o) => o && refetch()}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Histórico do onboarding">
              <History className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Histórico do onboarding</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-[360px] max-w-[calc(100vw-1rem)] p-0">
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-semibold">Histórico do onboarding</p>
          <p className="text-xs text-muted-foreground">Quem concluiu ou mudou a etapa</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {isFetching && data.length === 0 ? (
            <div className="p-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : data.length === 0 ? (
            <p className="p-6 text-center text-xs text-muted-foreground">Nenhuma ação registrada ainda.</p>
          ) : (
            groups.map(([day, rows]) => (
              <div key={day}>
                <p className="sticky top-0 bg-muted/60 backdrop-blur px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {day}
                </p>
                <ul className="divide-y">
                  {rows.map((r) => {
                    const done = r.details?.event === "onboarding_completed";
                    const Icon = done ? CheckCircle2 : ArrowRight;
                    return (
                      <li key={r.id} className="flex gap-3 px-4 py-2.5">
                        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${done ? "text-success" : "text-muted-foreground"}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-sm font-medium">{r.entity_name ?? "Cliente"}</p>
                            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{hour(r.created_at)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {done ? "Concluiu o onboarding" : `Mudou para ${r.details?.to_stage ?? "outra etapa"}`}
                            {r.details?.from_stage ? ` · saiu de ${r.details.from_stage}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">por {r.user_name ?? "Usuário"}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
