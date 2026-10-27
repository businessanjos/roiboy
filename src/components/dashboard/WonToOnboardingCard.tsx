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
            <p className="font-semibold">Tempo entre a venda e o início do onboarding</p>
            <p>Conta quantos dias se passam desde o dia em que o negócio foi marcado como ganho até o dia em que o onboarding do cliente começou. Considera os últimos 6 meses.</p>
            {data && (
              <ul className="pt-1 space-y-0.5">
                <li>Metade dos clientes começa em até <strong>{data.median_days != null ? `${data.median_days.toFixed(1).replace(".", ",")} dias` : "—"}</strong></li>
                <li>Mais rápido: <strong>{data.min_days != null ? `${data.min_days.toFixed(1).replace(".", ",")} dias` : "—"}</strong> · Mais demorado: <strong>{data.max_days != null ? `${data.max_days.toFixed(1).replace(".", ",")} dias` : "—"}</strong></li>
                <li>Clientes considerados: <strong>{data.sample_count}</strong></li>
              </ul>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
