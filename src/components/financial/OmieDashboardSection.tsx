import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight, RefreshCw, TrendingUp, TrendingDown, Wallet, AlertTriangle, Receipt, CalendarDays } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type PeriodPreset = "today" | "this_month" | "this_quarter" | "this_year" | "last_90" | "custom";

const PRESET_LABELS: Record<PeriodPreset, string> = {
  today: "Hoje",
  this_month: "Este mês",
  this_quarter: "Este trimestre",
  this_year: "Este ano",
  last_90: "Últimos 90 dias",
  custom: "Personalizado",
};

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function resolvePreset(preset: PeriodPreset, custom?: { start?: Date; end?: Date }): { start: Date; end: Date } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (preset) {
    case "today":
      return { start: today, end: today };
    case "this_month":
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end: new Date(today.getFullYear(), today.getMonth() + 1, 0),
      };
    case "this_quarter": {
      const q = Math.floor(today.getMonth() / 3);
      return {
        start: new Date(today.getFullYear(), q * 3, 1),
        end: new Date(today.getFullYear(), q * 3 + 3, 0),
      };
    }
    case "this_year":
      return {
        start: new Date(today.getFullYear(), 0, 1),
        end: new Date(today.getFullYear(), 11, 31),
      };
    case "last_90": {
      const start = new Date(today);
      start.setDate(start.getDate() - 89);
      return { start, end: today };
    }
    case "custom":
      if (custom?.start && custom?.end) return { start: custom.start, end: custom.end };
      return null;
  }
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtBRLcompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return fmtBRL(n);
};

interface OmieMetrics {
  window: { months: number; start: string; end: string };
  kpis: {
    totalReceived: number;
    totalToReceive: number;
    totalOverdueReceive: number;
    avgTicketReceived: number;
    totalPaid: number;
    totalToPay: number;
    totalOverduePay: number;
    netResult: number;
  };
  monthly: { label: string; received: number; expected: number; paid: number; toPay: number }[];
  topClients: { name: string; total: number }[];
  topCategories: { category: string; total: number }[];
  counts: { receberTitles: number; pagarTitles: number };
  generatedAt: string;
}

function MiniKpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const toneText: Record<string, string> = {
    default: "text-foreground",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-red-600",
    info: "text-blue-600",
  };
  const toneBg: Record<string, string> = {
    default: "bg-muted",
    success: "bg-emerald-500/10",
    warning: "bg-amber-500/10",
    danger: "bg-red-500/10",
    info: "bg-blue-500/10",
  };
  return (
    <div className="rounded-lg border bg-card p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
          <p className={cn("text-lg font-bold tabular-nums truncate", toneText[tone])}>{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        <div className={cn("p-1.5 rounded-md shrink-0", toneBg[tone])}>
          <Icon className={cn("h-4 w-4", toneText[tone])} />
        </div>
      </div>
    </div>
  );
}

import { useFinancialCompany } from "@/contexts/FinancialCompanyContext";

export default function OmieDashboardSection() {
  const { selectedId, selected } = useFinancialCompany();
  const [data, setData] = useState<OmieMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState<number>(6);

  const load = async (m = months) => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("omie-dashboard-metrics", {
        body: { months: m, company_id: selectedId },
      });
      if (err) throw err;
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as OmieMetrics);
    } catch (e: any) {
      setError(e.message || "Falha ao carregar dados Omie");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedId) load(months);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              Dados Omie
              {data && (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  Atualizado {new Date(data.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Receitas, despesas e fluxo direto da Omie
              {data && ` • ${data.window.start} → ${data.window.end}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(months)}
              onValueChange={(v) => {
                const m = Number(v);
                setMonths(m);
                load(m);
              }}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => load(months)} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        )}

        {!loading && !data && !error && (
          <div className="flex flex-col items-center justify-center text-center py-8 px-4">
            <div className="rounded-full bg-muted p-3 mb-3">
              <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {selectedId ? "Sem dados da Omie no período" : "Selecione uma empresa"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {selectedId
                ? "Tente um período maior ou verifique a integração em /financial/integracoes/omie."
                : "Escolha uma empresa no seletor acima para carregar os dados da Omie."}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
            <div className="text-xs text-muted-foreground mt-1">
              Verifique se as credenciais Omie estão configuradas em <strong>/financial/integracoes/omie</strong>.
            </div>
          </div>
        )}

        {data && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <MiniKpi
                icon={TrendingUp}
                label="Recebido"
                value={fmtBRLcompact(data.kpis.totalReceived)}
                hint="Títulos liquidados no período"
                tone="success"
              />
              <MiniKpi
                icon={Wallet}
                label="A Receber"
                value={fmtBRLcompact(data.kpis.totalToReceive)}
                hint={`${data.counts.receberTitles} títulos`}
                tone="info"
              />
              <MiniKpi
                icon={AlertTriangle}
                label="Inadimplência"
                value={fmtBRLcompact(data.kpis.totalOverdueReceive)}
                hint="Recebíveis atrasados"
                tone={data.kpis.totalOverdueReceive > 0 ? "danger" : "success"}
              />
              <MiniKpi
                icon={Receipt}
                label="Ticket médio"
                value={fmtBRLcompact(data.kpis.avgTicketReceived)}
                hint="Por título recebido"
              />
              <MiniKpi
                icon={TrendingDown}
                label="Pago (Despesas)"
                value={fmtBRLcompact(data.kpis.totalPaid)}
                hint="Contas pagas no período"
                tone="warning"
              />
              <MiniKpi
                icon={Wallet}
                label="A Pagar"
                value={fmtBRLcompact(data.kpis.totalToPay)}
                hint={`${data.counts.pagarTitles} títulos`}
                tone="info"
              />
              <MiniKpi
                icon={AlertTriangle}
                label="Atraso (Despesas)"
                value={fmtBRLcompact(data.kpis.totalOverduePay)}
                tone={data.kpis.totalOverduePay > 0 ? "danger" : "default"}
              />
              <MiniKpi
                icon={data.kpis.netResult >= 0 ? TrendingUp : TrendingDown}
                label="Resultado"
                value={fmtBRLcompact(data.kpis.netResult)}
                hint="Recebido − Pago"
                tone={data.kpis.netResult >= 0 ? "success" : "danger"}
              />
            </div>

            {/* DRE simplificado mensal */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">DRE Simplificado (mensal)</h4>
                  <span className="text-[11px] text-muted-foreground">Recebido vs Pago</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.monthly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => fmtBRLcompact(v)} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: any) => fmtBRL(Number(v))}
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="received" name="Recebido" fill="hsl(142 71% 45%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="paid" name="Pago" fill="hsl(0 70% 55%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg border bg-card p-3">
                <h4 className="text-sm font-semibold mb-2">Top Clientes (Omie)</h4>
                {data.topClients.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-6">Nenhum recebimento no período</div>
                ) : (
                  <div className="space-y-1.5">
                    {data.topClients.slice(0, 6).map((c, i) => {
                      const max = data.topClients[0].total || 1;
                      const pct = (c.total / max) * 100;
                      return (
                        <div key={i} className="space-y-0.5">
                          <div className="flex justify-between text-xs">
                            <span className="truncate font-medium">{c.name}</span>
                            <span className="tabular-nums text-muted-foreground ml-2">{fmtBRLcompact(c.total)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Categorias de despesa */}
            {data.topCategories.length > 0 && (
              <div className="rounded-lg border bg-card p-3">
                <h4 className="text-sm font-semibold mb-2">Despesas por Categoria</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {data.topCategories.map((c, i) => {
                    const max = data.topCategories[0].total || 1;
                    const pct = (c.total / max) * 100;
                    return (
                      <div key={i} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="truncate">{c.category}</span>
                          <span className="tabular-nums text-muted-foreground ml-2">{fmtBRLcompact(c.total)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
