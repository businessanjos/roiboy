import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Row {
  id: string;
  user_name: string | null;
  created_at: string;
  details: Record<string, any> | null;
}

export function OnboardingHistoryButton({ clientId }: { clientId: string }) {
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["onboarding-history", clientId],
    enabled: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, user_name, created_at, details")
        .eq("entity_type", "client")
        .eq("entity_id", clientId)
        .eq("details->>context", "onboarding")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  return (
    <Popover onOpenChange={(o) => o && refetch()}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Histórico do onboarding">
              <History className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Histórico do onboarding</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b text-sm font-medium">Histórico do onboarding</div>
        <div className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : data.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">Nenhuma ação registrada ainda.</p>
          ) : (
            <ul className="divide-y">
              {data.map((r) => {
                const done = r.details?.event === "onboarding_completed";
                return (
                  <li key={r.id} className="px-3 py-2 text-xs">
                    <p className="font-medium">
                      {done ? "Concluiu o onboarding" : `Mudou para ${r.details?.to_stage ?? "outra etapa"}`}
                    </p>
                    <p className="text-muted-foreground">
                      {r.user_name ?? "Usuário"} ·{" "}
                      {new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {r.details?.from_stage && (
                      <p className="text-muted-foreground">Saiu de: {r.details.from_stage}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
