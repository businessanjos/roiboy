import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  lead: number;
  mql: number;
  vendas: number;
  color?: string;
}

export function AgencyFunnel({ lead, mql, vendas, color = "#6366f1" }: Props) {
  const mqlRate = lead > 0 ? (mql / lead) * 100 : 0;
  const closeRate = mql > 0 ? (vendas / mql) * 100 : 0;
  const overallRate = lead > 0 ? (vendas / lead) * 100 : 0;
  const max = Math.max(lead, 1);
  const w = (n: number) => Math.max(8, (n / max) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Funil de conversão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[
          { label: "Leads", v: lead, w: w(lead) },
          { label: "MQL", v: mql, w: w(mql), rate: `${mqlRate.toFixed(1)}% dos leads` },
          { label: "Vendas", v: vendas, w: w(vendas), rate: `${closeRate.toFixed(1)}% dos MQL` },
        ].map((s) => (
          <div key={s.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground">{s.v.toLocaleString("pt-BR")} {s.rate ? `· ${s.rate}` : ""}</span>
            </div>
            <div className="h-8 rounded bg-muted overflow-hidden">
              <div className="h-full rounded" style={{ width: `${s.w}%`, background: color }} />
            </div>
          </div>
        ))}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Conversão total Lead → Venda: <span className="font-semibold">{overallRate.toFixed(2)}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
