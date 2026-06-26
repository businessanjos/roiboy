import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, TrendingUp } from "lucide-react";
import { subDays, parseISO } from "date-fns";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMarketingDashboardMetrics } from "@/hooks/useMarketingDashboardMetrics";
import { useSalesTeamMetrics } from "@/hooks/useSalesTeamMetrics";
import { useDashboardContractStats } from "@/hooks/useDashboardContractStats";
import { useFinancialDashboardMetrics } from "@/hooks/useFinancialDashboardMetrics";

type AreaId = "marketing" | "comercial" | "cs" | "financeiro";

interface Props {
  area: AreaId;
  meetingDate: string; // yyyy-MM-dd
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: v >= 100000 ? "compact" : "standard",
    maximumFractionDigits: v >= 100000 ? 1 : 0,
  }).format(v || 0);

const fmtNum = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v || 0);

const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`;

export function AreaKpiSnapshot({ area, meetingDate }: Props) {
  const date = useMemo(() => parseISO(meetingDate), [meetingDate]);
  const start = useMemo(() => subDays(date, 6), [date]);

  if (area === "marketing") return <MarketingKpis start={start} end={date} />;
  if (area === "comercial") return <ComercialKpis start={start} end={date} />;
  if (area === "cs") return <CsKpis />;
  if (area === "financeiro") return <FinanceiroKpis />;
  return null;
}

function Shell({
  loading,
  items,
}: {
  loading: boolean;
  items: { label: string; value: string; hint?: string }[];
}) {
  return (
    <Card className="border-dashed bg-muted/30">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          <TrendingUp className="h-3.5 w-3.5" />
          KPIs automáticos
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {items.map((it) => (
              <div key={it.label}>
                <div className="text-xs text-muted-foreground">{it.label}</div>
                <div className="text-xl font-semibold tracking-tight mt-0.5">{it.value}</div>
                {it.hint && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">{it.hint}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MarketingKpis({ start, end }: { start: Date; end: Date }) {
  const { data, isLoading } = useMarketingDashboardMetrics({ startDate: start, endDate: end });
  return (
    <Shell
      loading={isLoading}
      items={[
        { label: "Leads (7d)", value: fmtNum(data?.leadsThisMonth || 0) },
        { label: "MQLs (7d)", value: fmtNum(data?.mqlThisMonth || 0) },
        { label: "Conversão MQL", value: fmtPct(data?.mqlConversionRate || 0) },
        { label: "Investido em ads", value: fmtBRL(data?.adSpend || 0), hint: `CPL ${fmtBRL(data?.adCpl || 0)}` },
      ]}
    />
  );
}

function ComercialKpis({ start, end }: { start: Date; end: Date }) {
  const { metrics, loading } = useSalesTeamMetrics({ startDate: start, endDate: end });
  const agg = useMemo(() => {
    return (metrics || []).reduce(
      (acc, m) => {
        acc.won_deals += m.won_deals;
        acc.won_value += m.won_value;
        acc.open_deals += m.open_deals;
        acc.pipeline_value += m.pipeline_value;
        acc.total_deals += m.total_deals;
        acc.lost_deals += m.lost_deals;
        return acc;
      },
      { won_deals: 0, won_value: 0, open_deals: 0, pipeline_value: 0, total_deals: 0, lost_deals: 0 }
    );
  }, [metrics]);
  const conv = agg.total_deals > 0 ? (agg.won_deals / agg.total_deals) * 100 : 0;
  return (
    <Shell
      loading={loading}
      items={[
        { label: "Vendas fechadas (7d)", value: fmtNum(agg.won_deals), hint: fmtBRL(agg.won_value) },
        { label: "Pipeline aberto", value: fmtNum(agg.open_deals), hint: fmtBRL(agg.pipeline_value) },
        { label: "Conversão", value: fmtPct(conv) },
        { label: "Perdidas (7d)", value: fmtNum(agg.lost_deals) },
      ]}
    />
  );
}

function CsKpis() {
  const { currentUser } = useCurrentUser();
  const { data, isLoading } = useDashboardContractStats(currentUser?.account_id);
  return (
    <Shell
      loading={isLoading}
      items={[
        { label: "Clientes ativos", value: fmtNum(data?.active || 0) },
        { label: "Cancelados", value: fmtNum(data?.cancelled || 0) },
        { label: "Suspensos", value: fmtNum(data?.suspended || 0) },
        { label: "Pausados", value: fmtNum(data?.paused || 0) },
      ]}
    />
  );
}

function FinanceiroKpis() {
  const { data, isLoading } = useFinancialDashboardMetrics();
  const k = data?.kpis;
  return (
    <Shell
      loading={isLoading}
      items={[
        { label: "MRR", value: fmtBRL(k?.mrr || 0), hint: `ARR ${fmtBRL(k?.arr || 0)}` },
        { label: "Recebido no mês", value: fmtBRL(k?.receivedThisMonth || 0), hint: `de ${fmtBRL(k?.expectedThisMonth || 0)}` },
        { label: "Taxa de cobrança", value: fmtPct(k?.collectionRate || 0) },
        { label: "Em aberto", value: fmtBRL(k?.totalOpen || 0), hint: `Vencido ${fmtBRL(k?.totalOverdue || 0)}` },
      ]}
    />
  );
}
