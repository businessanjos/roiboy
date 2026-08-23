import { useMemo } from "react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp, Trophy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface RevenueHistoryPoint {
  month: string; // yyyy-MM or date string
  revenue: number;
  notes?: string | null;
}

interface ClientIdentity {
  name: string | null;
  avatarUrl?: string | null;
  logoUrl?: string | null;
  segment?: string | null;
  niche?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: RevenueHistoryPoint[];
  initialRevenue: number | null;
  mentoringStartMonth: string | null;
  client?: ClientIdentity;
}

const currency = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(v);

const compact = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);

const monthLabel = (m: string) => {
  try {
    return format(parse(m.slice(0, 7), "yyyy-MM", new Date()), "MMM/yy", { locale: ptBR });
  } catch {
    return m;
  }
};

const monthLabelLong = (m: string) => {
  try {
    return format(parse(m.slice(0, 7), "yyyy-MM", new Date()), "MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return m;
  }
};

function Kpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "gold";
}) {
  const toneCls =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
      ? "text-danger"
      : tone === "gold"
      ? "text-warning"
      : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-3">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </span>
      <div className={`text-xl font-bold mt-1 ${toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export function RevenueHistoryDialog({
  open,
  onOpenChange,
  history,
  initialRevenue,
  mentoringStartMonth,
  client,
}: Props) {
  const rows = useMemo(() => {
    const filtered = history
      .filter((h) => !!h.month)
      .map((h) => ({ ...h, month: String(h.month).slice(0, 7), revenue: Number(h.revenue) }))
      .filter((h) => (mentoringStartMonth ? h.month >= mentoringStartMonth : true))
      .sort((a, b) => a.month.localeCompare(b.month));

    return filtered.map((h, i) => {
      const prev = i > 0 ? filtered[i - 1].revenue : null;
      const deltaAbs = prev != null ? h.revenue - prev : null;
      const deltaPct = prev != null && prev > 0 ? ((h.revenue - prev) / prev) * 100 : null;
      const vsInitial =
        initialRevenue != null && initialRevenue > 0
          ? ((h.revenue - initialRevenue) / initialRevenue) * 100
          : null;
      return { ...h, deltaAbs, deltaPct, vsInitial };
    });
  }, [history, mentoringStartMonth, initialRevenue]);

  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const values = rows.map((r) => r.revenue);
    const best = rows.reduce((b, r) => (r.revenue > b.revenue ? r : b), rows[0]);
    const worst = rows.reduce((b, r) => (r.revenue < b.revenue ? r : b), rows[0]);
    const last = rows[rows.length - 1];
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const total = values.reduce((a, b) => a + b, 0);
    const growth =
      initialRevenue && initialRevenue > 0
        ? ((last.revenue - initialRevenue) / initialRevenue) * 100
        : null;
    const monthsUp = rows.filter((r) => (r.deltaAbs ?? 0) > 0).length;
    return { best, worst, last, avg, total, growth, monthsUp };
  }, [rows, initialRevenue]);

  const chartData = rows.map((r) => ({
    month: monthLabel(r.month),
    revenue: r.revenue,
    delta: r.deltaPct ?? 0,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 shrink-0 border border-border">
              <AvatarImage src={client?.avatarUrl || client?.logoUrl || undefined} alt={client?.name || ""} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {client?.name
                  ?.split(" ")
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase() || "CL"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg leading-tight flex items-center gap-2 flex-wrap">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="truncate">{client?.name || "Cliente"}</span>
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {mentoringStartMonth
                  ? `Evolução desde a entrada na mentoria (${monthLabelLong(mentoringStartMonth)})`
                  : "Evolução do faturamento mensal do cliente"}
              </DialogDescription>
              {(client?.segment || client?.niche) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {client?.segment && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      {client.segment}
                    </Badge>
                  )}
                  {client?.niche && (
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                      {client.niche}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh]">
          <div className="px-6 pb-6 space-y-4">
            {rows.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Nenhum faturamento registrado desde a entrada na mentoria.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Kpi
                    label="Inicial"
                    value={currency(initialRevenue)}
                    hint={mentoringStartMonth ? monthLabelLong(mentoringStartMonth) : undefined}
                  />
                  <Kpi
                    label="Atual"
                    value={currency(stats!.last.revenue)}
                    hint={monthLabelLong(stats!.last.month)}
                    tone="default"
                  />
                  <Kpi
                    label="Crescimento"
                    value={
                      stats!.growth == null
                        ? "—"
                        : `${stats!.growth >= 0 ? "+" : ""}${stats!.growth.toFixed(0)}%`
                    }
                    hint={
                      initialRevenue != null
                        ? `${currency(stats!.last.revenue - initialRevenue)} desde o início`
                        : "Sem faturamento inicial"
                    }
                    tone={stats!.growth == null ? "default" : stats!.growth >= 0 ? "positive" : "negative"}
                  />
                  <Kpi
                    label="Recorde"
                    value={currency(stats!.best.revenue)}
                    hint={monthLabelLong(stats!.best.month)}
                    tone="gold"
                  />
                  <Kpi
                    label="Média mensal"
                    value={currency(Math.round(stats!.avg))}
                    hint={`${rows.length} ${rows.length === 1 ? "mês informado" : "meses informados"}`}
                  />
                  <Kpi
                    label="Acumulado"
                    value={currency(stats!.total)}
                    hint="Soma dos meses informados"
                  />
                  <Kpi
                    label="Meses em alta"
                    value={`${stats!.monthsUp}`}
                    hint={`de ${Math.max(0, rows.length - 1)} comparações`}
                    tone={stats!.monthsUp > 0 ? "positive" : "default"}
                  />
                  <Kpi
                    label="Pior mês"
                    value={currency(stats!.worst.revenue)}
                    hint={monthLabelLong(stats!.worst.month)}
                  />
                </div>

                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Evolução mensal
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="month" fontSize={11} />
                        <YAxis fontSize={11} tickFormatter={compact} />
                        <Tooltip
                          formatter={(v: number) => currency(v)}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                          }}
                        />
                        {initialRevenue != null && (
                          <ReferenceLine
                            y={initialRevenue}
                            stroke="hsl(var(--muted-foreground))"
                            strokeDasharray="4 4"
                            label={{
                              value: "Inicial",
                              position: "insideTopLeft",
                              fontSize: 10,
                              fill: "hsl(var(--muted-foreground))",
                            }}
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#revGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {rows.length > 1 && (
                  <div className="rounded-lg border bg-card p-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Variação mês a mês (%)
                    </div>
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData.slice(1)}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="month" fontSize={11} />
                          <YAxis fontSize={11} tickFormatter={(v) => `${Number(v).toFixed(0)}%`} />
                          <Tooltip
                            formatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                            }}
                          />
                          <ReferenceLine y={0} stroke="hsl(var(--border))" />
                          <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
                            {chartData.slice(1).map((d, i) => (
                              <Cell
                                key={i}
                                fill={d.delta >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                        <TableHead className="text-right">vs. mês anterior</TableHead>
                        <TableHead className="text-right">vs. inicial</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...rows].reverse().map((r) => (
                        <TableRow key={r.month}>
                          <TableCell className="capitalize font-medium">
                            {monthLabelLong(r.month)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {currency(r.revenue)}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.deltaPct == null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 ${
                                  r.deltaPct > 0
                                    ? "text-success"
                                    : r.deltaPct < 0
                                    ? "text-danger"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {r.deltaPct > 0 ? (
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                ) : r.deltaPct < 0 ? (
                                  <ArrowDownRight className="h-3.5 w-3.5" />
                                ) : (
                                  <Minus className="h-3.5 w-3.5" />
                                )}
                                {r.deltaPct > 0 ? "+" : ""}
                                {r.deltaPct.toFixed(1)}%
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.vsInitial == null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span
                                className={
                                  r.vsInitial >= 0 ? "text-success" : "text-danger"
                                }
                              >
                                {r.vsInitial >= 0 ? "+" : ""}
                                {r.vsInitial.toFixed(0)}%
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {r.month === stats!.best.month && (
                              <Badge
                                variant="outline"
                                className="text-warning border-warning gap-1"
                              >
                                <Trophy className="h-3 w-3" /> Recorde
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default RevenueHistoryDialog;
