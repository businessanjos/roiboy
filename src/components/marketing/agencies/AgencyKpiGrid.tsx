import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Users, Target, Trophy, DollarSign, Activity } from "lucide-react";
import type { AgencyMetrics } from "@/hooks/useAgencyMetrics";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (v: number) => v.toLocaleString("pt-BR");

interface Props {
  metrics: AgencyMetrics;
  compact?: boolean;
}

export function AgencyKpiGrid({ metrics, compact = false }: Props) {
  const items = [
    { label: "Investimento", value: fmtBRL(metrics.spend), icon: DollarSign, accent: "text-amber-600" },
    { label: "Leads", value: fmtNum(metrics.leads), icon: Users, accent: "text-blue-600" },
    { label: "MQL", value: fmtNum(metrics.mql), icon: Target, accent: "text-purple-600" },
    { label: "Vendas", value: fmtNum(metrics.vendas), icon: Trophy, accent: "text-emerald-600" },
    { label: "CAC", value: metrics.cac > 0 ? fmtBRL(metrics.cac) : "—", icon: TrendingUp, accent: "text-rose-600" },
    { label: "ROAS", value: metrics.roas > 0 ? `${metrics.roas.toFixed(2)}x` : "—", icon: Activity, accent: "text-indigo-600" },
  ];
  return (
    <div className={`grid gap-3 ${compact ? "grid-cols-3 lg:grid-cols-6" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"}`}>
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{it.label}</span>
              <it.icon className={`h-4 w-4 ${it.accent}`} />
            </div>
            <div className={`mt-1 ${compact ? "text-lg" : "text-2xl"} font-bold`}>{it.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
