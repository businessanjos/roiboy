import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { startOfMonth, endOfMonth, subDays } from "date-fns";
import { useTrafficAgencies } from "@/hooks/useTrafficAgencies";
import { useAgencyMetrics } from "@/hooks/useAgencyMetrics";
import { AgencyKpiGrid } from "@/components/marketing/agencies/AgencyKpiGrid";
import { AgencyFunnel } from "@/components/marketing/agencies/AgencyFunnel";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

const RANGES = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "Mês atual", month: true },
];

const METRICS = [
  { value: "spend", label: "Investimento" },
  { value: "leads", label: "Leads" },
  { value: "mql", label: "MQL" },
  { value: "vendas", label: "Vendas" },
] as const;

function AgencyMetricsSlot({ agencyId, range }: { agencyId: string; range: any }) {
  const { data } = useAgencyMetrics(agencyId, range);
  if (!data) return <p className="text-xs text-muted-foreground">Carregando...</p>;
  return <AgencyKpiGrid metrics={data} compact />;
}

function AgencyFunnelSlot({ agencyId, color, range }: { agencyId: string; color: string; range: any }) {
  const { data } = useAgencyMetrics(agencyId, range);
  if (!data) return null;
  return (
    <AgencyFunnel
      lead={data.funnel.lead}
      mql={data.funnel.mql}
      vendas={data.funnel.vendas}
      color={color}
    />
  );
}

function TimelineChart({ agencies, range, metric }: { agencies: any[]; range: any; metric: string }) {
  // Fetch each agency's metrics individually and merge by date
  const queries = agencies.map((a) => useAgencyMetrics(a.id, range));
  const merged = useMemo(() => {
    if (!queries.every((q) => q.data)) return [];
    const byDate: Record<string, any> = {};
    queries.forEach((q, i) => {
      q.data!.daily.forEach((d) => {
        if (!byDate[d.date]) byDate[d.date] = { date: d.date };
        byDate[d.date][agencies[i].name] = (d as any)[metric] ?? 0;
      });
    });
    return Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [queries.map((q) => q.dataUpdatedAt).join(","), metric]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={merged}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        {agencies.map((a) => (
          <Line key={a.id} type="monotone" dataKey={a.name} stroke={a.color} strokeWidth={2} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function MarketingAgenciesCompare() {
  const { data: agencies = [] } = useTrafficAgencies();
  const navigate = useNavigate();
  const [rangeKey, setRangeKey] = useState("Mês atual");
  const [metric, setMetric] = useState("leads");

  const now = new Date();
  const range = (() => {
    const r = RANGES.find((x) => x.label === rangeKey)!;
    if (r.month) return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    return { startDate: subDays(now, r.days || 0), endDate: now };
  })();

  const active = agencies.filter((a) => a.is_active);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/marketing/agencias")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Comparativo de agências</h1>
            <p className="text-sm text-muted-foreground">Compare lado a lado a performance de todas as agências ativas.</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {RANGES.map((r) => (
            <Button key={r.label} size="sm" variant={rangeKey === r.label ? "default" : "outline"} onClick={() => setRangeKey(r.label)}>
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {active.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma agência ativa para comparar.</CardContent></Card>
      ) : (
        <>
          {/* KPIs por agência */}
          <div className="space-y-4">
            {active.map((a) => (
              <Card key={a.id} className="overflow-hidden">
                <div className="h-1" style={{ background: a.color }} />
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: a.color }} />
                    {a.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AgencyMetricsSlot agencyId={a.id} range={range} />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Evolução temporal */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Evolução temporal</CardTitle>
              <div className="flex gap-1">
                {METRICS.map((m) => (
                  <Button
                    key={m.value}
                    size="sm"
                    variant={metric === m.value ? "default" : "outline"}
                    onClick={() => setMetric(m.value)}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <TimelineChart agencies={active} range={range} metric={metric} />
            </CardContent>
          </Card>

          {/* Funil de cada agência */}
          <div className="grid md:grid-cols-2 gap-4">
            {active.map((a) => (
              <div key={a.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: a.color }} />
                  <h3 className="font-semibold">{a.name}</h3>
                </div>
                <AgencyFunnelSlot agencyId={a.id} color={a.color} range={range} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
