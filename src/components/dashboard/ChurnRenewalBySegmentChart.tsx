import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LabelList } from "recharts";
import { Layers } from "lucide-react";

interface Props {
  accountId?: string | null;
  periodStart: Date;
  periodEnd: Date;
}

interface SegmentRow {
  segment: string;
  churn: number;
  renewal: number;
  cancelamentos: number;
  base: number;
  renovados: number;
  vencidos: number;
}

const INACTIVE_STATUSES = ["draft", "cancelled"];

export function ChurnRenewalBySegmentChart({ accountId, periodStart, periodEnd }: Props) {
  const startStr = periodStart.toISOString().slice(0, 10);
  const endStr = periodEnd.toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-churn-renewal-segment", accountId, startStr, endStr],
    enabled: !!accountId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data: contracts, error } = await supabase
        .from("client_contracts")
        .select("id, client_id, product_id, start_date, end_date, status, cancelled_at, parent_contract_id")
        .eq("account_id", accountId!)
        .limit(10000);
      if (error) throw error;

      const productIds = Array.from(
        new Set((contracts ?? []).map((c: any) => c.product_id).filter(Boolean))
      ) as string[];

      let productMap = new Map<string, { name: string; color: string | null }>();
      if (productIds.length > 0) {
        const { data: products, error: pErr } = await supabase
          .from("products")
          .select("id, name, color")
          .in("id", productIds);
        if (pErr) throw pErr;
        productMap = new Map(
          (products ?? []).map((p: any) => [p.id, { name: p.name as string, color: (p.color as string) ?? null }])
        );
      }

      const rows = (contracts ?? []) as any[];
      const buckets = new Map<
        string,
        { color: string | null; ativos: number; cancelamentos: number; novos: number; vencidos: number; renovados: number }
      >();

      const bucketFor = (productId: string | null) => {
        const info = productId ? productMap.get(productId) : undefined;
        const key = info?.name ?? "Sem produto";
        if (!buckets.has(key)) {
          buckets.set(key, {
            color: info?.color ?? null,
            ativos: 0,
            cancelamentos: 0,
            novos: 0,
            vencidos: 0,
            renovados: 0,
          });
        }
        return buckets.get(key)!;
      };

      const inPeriodDate = (value?: string | null) => !!value && value >= startStr && value <= endStr;
      const inPeriodTs = (value?: string | null) => {
        if (!value) return false;
        const d = value.slice(0, 10);
        return d >= startStr && d <= endStr;
      };

      for (const c of rows) {
        const status = String(c.status ?? "").toLowerCase();
        const bucket = bucketFor(c.product_id ?? null);

        if (status === "active") bucket.ativos++;
        if (inPeriodTs(c.cancelled_at)) bucket.cancelamentos++;
        if (inPeriodDate(c.start_date)) bucket.novos++;

        if (inPeriodDate(c.end_date) && !INACTIVE_STATUSES.includes(status)) {
          bucket.vencidos++;
          const hasSuccessor = rows.some((s: any) => {
            if (s.id === c.id) return false;
            if (INACTIVE_STATUSES.includes(String(s.status ?? "").toLowerCase())) return false;
            if (s.parent_contract_id === c.id) return true;
            if (s.client_id !== c.client_id) return false;
            if (c.product_id && s.product_id && s.product_id !== c.product_id) return false;
            return !!s.start_date && s.start_date >= c.end_date;
          });
          if (hasSuccessor) bucket.renovados++;
        }
      }

      const result: (SegmentRow & { color: string | null })[] = [];
      for (const [segment, b] of buckets.entries()) {
        const base = Math.max(0, b.ativos + b.cancelamentos - b.novos);
        if (base === 0 && b.vencidos === 0 && b.cancelamentos === 0) continue;
        result.push({
          segment,
          color: b.color,
          cancelamentos: b.cancelamentos,
          base,
          renovados: b.renovados,
          vencidos: b.vencidos,
          churn: base > 0 ? (b.cancelamentos / base) * 100 : 0,
          renewal: b.vencidos > 0 ? (b.renovados / b.vencidos) * 100 : 0,
        });
      }

      return result.sort((a, b) => b.base - a.base).slice(0, 12);
    },
  });

  const chartData = useMemo(() => data ?? [], [data]);

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4 text-muted-foreground" />
          Churn e Renovação por segmento
        </CardTitle>
        <CardDescription>
          Por produto/plano, no período selecionado. Churn = cancelamentos / base no início do período. Renovação =
          contratos vencidos com sucessor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">Carregando…</div>
        ) : chartData.length === 0 ? (
          <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
            Sem dados no período selecionado
          </div>
        ) : (
          <ChartContainer
            config={{
              churn: { label: "Churn %", color: "hsl(var(--danger))" },
              renewal: { label: "Renovação %", color: "hsl(var(--success))" },
            }}
            className="h-[340px] w-full"
          >
            <BarChart data={chartData} margin={{ top: 16, right: 8, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis
                dataKey="segment"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => {
                      const row = item?.payload as SegmentRow | undefined;
                      const pct = `${Number(value).toFixed(1)}%`;
                      if (name === "churn") {
                        return `Churn: ${pct} (${row?.cancelamentos ?? 0} de ${row?.base ?? 0})`;
                      }
                      return `Renovação: ${pct} (${row?.renovados ?? 0} de ${row?.vencidos ?? 0})`;
                    }}
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="churn" name="Churn %" fill="var(--color-churn)" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="churn" position="top" formatter={(v: number) => `${v.toFixed(0)}%`} className="fill-muted-foreground text-[10px]" />
              </Bar>
              <Bar dataKey="renewal" name="Renovação %" fill="var(--color-renewal)" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="renewal" position="top" formatter={(v: number) => `${v.toFixed(0)}%`} className="fill-muted-foreground text-[10px]" />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
