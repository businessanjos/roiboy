import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Timer } from "lucide-react";
import { useWonToOnboardingTime } from "@/hooks/useWonToOnboardingTime";

interface Props {
  accountId?: string;
  monthsBack?: number;
}

export function WonToOnboardingCard({ accountId, monthsBack = 6 }: Props) {
  const { data, isLoading } = useWonToOnboardingTime(accountId, monthsBack);

  const avg = data?.avg_days;
  const display = isLoading
    ? "..."
    : avg != null
      ? `${avg.toFixed(1)}d`
      : "—";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="shadow-card border-l-4 border-l-indigo-500 cursor-help">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Ganho → Onboarding</p>
                  <p className="text-2xl font-bold text-indigo-600">{display}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {data?.sample_count ?? 0} cliente{(data?.sample_count ?? 0) === 1 ? "" : "s"} · últimos {monthsBack}m
                  </p>
                </div>
                <Timer className="h-5 w-5 text-indigo-500" />
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p className="font-semibold">Tempo médio entre Deal Ganho e Onboarding concluído</p>
            <p>Mede o intervalo entre <code>deals.won_at</code> e a primeira conclusão de item do checklist nas etapas <strong>Onboarding com Consultor</strong> ou <strong>Onboarding de ferramentas</strong>.</p>
            {data && (
              <ul className="pt-1 space-y-0.5">
                <li>Mediana: <strong>{data.median_days != null ? `${data.median_days.toFixed(1)}d` : "—"}</strong></li>
                <li>Mín: <strong>{data.min_days != null ? `${data.min_days.toFixed(1)}d` : "—"}</strong> · Máx: <strong>{data.max_days != null ? `${data.max_days.toFixed(1)}d` : "—"}</strong></li>
                <li>Amostra: <strong>{data.sample_count}</strong></li>
              </ul>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
