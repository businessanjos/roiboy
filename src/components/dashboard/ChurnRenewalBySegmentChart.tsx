import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LabelList } from "recharts";
import { Layers, XCircle, RefreshCw, Package } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props {
  accountId?: string | null;
  periodStart: Date;
  periodEnd: Date;
}

type EventKind = "cancelamento" | "renovado" | "vencido_sem_sucessor";

interface SegmentEvent {
  contractId: string;
  clientId: string | null;
  clientName: string;
  kind: EventKind;
  date: string | null;
  status: string;
}

interface SegmentRow {
  segment: string;
  churn: number;
  renewal: number;
  cancelamentos: number;
  base: number;
  renovados: number;
  vencidos: number;
  events: SegmentEvent[];
}

const INACTIVE_STATUSES = ["draft", "cancelled"];

const EVENT_LABEL: Record<EventKind, string> = {
  cancelamento: "Cancelamento",
  renovado: "Renovado",
  vencido_sem_sucessor: "Vencido sem sucessor",
};

const EVENT_VARIANT: Record<EventKind, "destructive" | "default" | "secondary"> = {
  cancelamento: "destructive",
  renovado: "default",
  vencido_sem_sucessor: "secondary",
};

const DATA_SOURCES: { metric: string; requirement: string; icon: typeof Layers }[] = [
  {
    metric: "Churn %",
    requirement:
      "Precisa de contratos cancelados/encerrados no período (Clientes › Contratos), com data de cancelamento e produto preenchidos.",
    icon: XCircle,
  },
  {
    metric: "Renovação %",
    requirement:
      "Precisa de contratos com data de término dentro do período (Operações › Renovações) e o contrato sucessor cadastrado para o mesmo cliente/produto.",
    icon: RefreshCw,
  },
  {
    metric: "Segmento (produto/plano)",
    requirement:
      "Cada contrato precisa estar vinculado a um produto em Configurações › Produtos; sem produto o contrato não entra em nenhum segmento.",
    icon: Package,
  },
];

const formatDate = (value: string | null) =>
  value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";


export function ChurnRenewalBySegmentChart({ accountId, periodStart, periodEnd }: Props) {
  const startStr = periodStart.toISOString().slice(0, 10);
  const endStr = periodEnd.toISOString().slice(0, 10);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

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
        {
          color: string | null;
          ativos: number;
          cancelamentos: number;
          novos: number;
          vencidos: number;
          renovados: number;
          events: SegmentEvent[];
        }
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
            events: [],
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
        if (inPeriodTs(c.cancelled_at)) {
          bucket.cancelamentos++;
          bucket.events.push({
            contractId: c.id,
            clientId: c.client_id ?? null,
            clientName: "",
            kind: "cancelamento",
            date: c.cancelled_at ?? null,
            status,
          });
        }
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
          bucket.events.push({
            contractId: c.id,
            clientId: c.client_id ?? null,
            clientName: "",
            kind: hasSuccessor ? "renovado" : "vencido_sem_sucessor",
            date: c.end_date ?? null,
            status,
          });
        }
      }

      // Resolve client names for every event
      const eventClientIds = Array.from(
        new Set(
          Array.from(buckets.values())
            .flatMap((b) => b.events.map((e) => e.clientId))
            .filter(Boolean)
        )
      ) as string[];

      const clientMap = new Map<string, string>();
      for (let i = 0; i < eventClientIds.length; i += 200) {
        const batch = eventClientIds.slice(i, i + 200);
        const { data: clients } = await supabase.from("clients").select("id, full_name").in("id", batch);
        (clients ?? []).forEach((cl: any) => clientMap.set(cl.id, cl.full_name));
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
          events: b.events
            .map((e) => ({
              ...e,
              clientName: (e.clientId && clientMap.get(e.clientId)) || "Cliente sem nome",
            }))
            .sort((a, b2) => (b2.date ?? "").localeCompare(a.date ?? "")),
        });
      }

      return result.sort((a, b) => b.base - a.base).slice(0, 12);
    },
  });

  const chartData = useMemo(() => data ?? [], [data]);
  const detail = useMemo(
    () => chartData.find((r) => r.segment === selectedSegment) ?? null,
    [chartData, selectedSegment]
  );

  return (
    <>
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Churn e Renovação por segmento
          </CardTitle>
          <CardDescription>
            Por produto/plano, no período selecionado. Churn = cancelamentos / base no início do período. Renovação =
            contratos vencidos com sucessor. Clique em uma barra para ver os clientes e eventos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">Carregando…</div>
          ) : chartData.length === 0 ? (
            <DashboardChartEmptyState
              icon={Layers}
              description="Nenhum cancelamento ou contrato vencido foi registrado para os segmentos neste período."
              periodStart={startStr}
              periodEnd={endStr}
              sources={DATA_SOURCES}
              className="min-h-[320px]"
            />


          ) : (
            <ChartContainer
              config={{
                churn: { label: "Churn %", color: "hsl(var(--danger))" },
                renewal: { label: "Renovação %", color: "hsl(var(--success))" },
              }}
              className="h-[340px] w-full"
            >
              <BarChart
                data={chartData}
                margin={{ top: 16, right: 8, left: 0, bottom: 48 }}
                onClick={(state: any) => {
                  const seg = state?.activePayload?.[0]?.payload?.segment;
                  if (seg) setSelectedSegment(seg);
                }}
              >
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
                <Bar dataKey="churn" name="Churn %" fill="var(--color-churn)" radius={[4, 4, 0, 0]} className="cursor-pointer">
                  <LabelList dataKey="churn" position="top" formatter={(v: number) => `${v.toFixed(0)}%`} className="fill-muted-foreground text-[10px]" />
                </Bar>
                <Bar dataKey="renewal" name="Renovação %" fill="var(--color-renewal)" radius={[4, 4, 0, 0]} className="cursor-pointer">
                  <LabelList dataKey="renewal" position="top" formatter={(v: number) => `${v.toFixed(0)}%`} className="fill-muted-foreground text-[10px]" />
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setSelectedSegment(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detail?.segment}</DialogTitle>
            <DialogDescription>
              {formatDate(startStr)} a {formatDate(endStr)} · Churn {detail?.churn.toFixed(1)}% (
              {detail?.cancelamentos} de {detail?.base}) · Renovação {detail?.renewal.toFixed(1)}% (
              {detail?.renovados} de {detail?.vencidos})
            </DialogDescription>
          </DialogHeader>

          {detail && detail.events.length > 0 ? (
            <ScrollArea className="max-h-[55vh] pr-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status do contrato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.events.map((e) => (
                    <TableRow key={`${e.contractId}-${e.kind}`}>
                      <TableCell className="font-medium">{e.clientName}</TableCell>
                      <TableCell>
                        <Badge variant={EVENT_VARIANT[e.kind]}>{EVENT_LABEL[e.kind]}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(e.date)}</TableCell>
                      <TableCell className="text-muted-foreground">{e.status || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum evento no período selecionado.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
