import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calculator,
  CheckCircle2,
  XCircle,
  Trophy,
  TrendingUp,
  Phone,
  Target,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { CommissionPlan, CommissionPeriodResult } from "@/hooks/useCommissionPlan";

interface CommissionDashboardProps {
  plan: CommissionPlan;
  periods: CommissionPeriodResult[];
  calculating: boolean;
  onCalculate: () => Promise<void>;
  compact?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

const TRIGGER_LABELS: Record<string, string> = {
  min_calls: "Ligações",
  min_conversion_rate: "Conversão",
  no_delinquency: "Inadimplência",
  tasks_completed: "Tarefas",
};

export function CommissionDashboard({
  plan,
  periods,
  calculating,
  onCalculate,
}: CommissionDashboardProps) {
  // Group periods by week
  const weekGroups = useMemo(() => {
    const groups: Record<string, CommissionPeriodResult[]> = {};
    for (const p of periods) {
      const key = p.period_start;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [periods]);

  const latestWeek = weekGroups[0];
  const latestPeriods = latestWeek ? latestWeek[1] : [];

  const totals = useMemo(() => {
    return latestPeriods.reduce(
      (acc, p) => ({
        wonValue: acc.wonValue + p.won_value,
        totalCommission: acc.totalCommission + p.total_commission,
        qualifiedCount: acc.qualifiedCount + (p.all_triggers_met ? 1 : 0),
        totalCount: acc.totalCount + 1,
      }),
      { wonValue: 0, totalCommission: 0, qualifiedCount: 0, totalCount: 0 }
    );
  }, [latestPeriods]);

  const formatWeek = (start: string, end: string) => {
    const s = new Date(start + "T12:00:00");
    const e = new Date(end + "T12:00:00");
    const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `${fmt(s)} - ${fmt(e)}`;
  };

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{plan.name}</h3>
          <p className="text-xs text-muted-foreground">
            Apuração {plan.period_type === "weekly" ? "semanal" : plan.period_type === "biweekly" ? "quinzenal" : "mensal"}
          </p>
        </div>
        <Button onClick={onCalculate} disabled={calculating}>
          <Calculator className="h-4 w-4 mr-2" />
          {calculating ? "Calculando..." : "Calcular Semana Atual"}
        </Button>
      </div>

      {/* Summary Cards */}
      {latestPeriods.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10">
                  <Trophy className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.wonValue)}</p>
                  <p className="text-xs text-muted-foreground">Total vendido</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(totals.totalCommission)}</p>
                  <p className="text-xs text-muted-foreground">Total comissão</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals.qualifiedCount}</p>
                  <p className="text-xs text-muted-foreground">Qualificados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totals.totalCount - totals.qualifiedCount}</p>
                  <p className="text-xs text-muted-foreground">Sem gatilhos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Table */}
      {weekGroups.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhum cálculo realizado</p>
            <p className="text-sm mt-1">
              Clique em "Calcular Semana Atual" para apurar as comissões.
            </p>
          </CardContent>
        </Card>
      ) : (
        weekGroups.map(([weekStart, weekPeriods]) => {
          const firstPeriod = weekPeriods[0];
          return (
            <Card key={weekStart}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  📅 Semana: {formatWeek(firstPeriod.period_start, firstPeriod.period_end)}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Valor Ganho</TableHead>
                      <TableHead className="text-center">Ligações</TableHead>
                      <TableHead className="text-center">Conversão</TableHead>
                      <TableHead className="text-center">Tarefas</TableHead>
                      <TableHead className="text-center">Gatilhos</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekPeriods
                      .sort((a, b) => b.won_value - a.won_value)
                      .map((period) => (
                        <TableRow key={period.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={period.user_avatar || undefined} />
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {getInitials(period.user_name || "")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{period.user_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(period.won_value)}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({period.won_deals} neg.)
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{period.total_calls}</span>
                              {period.triggers_met?.min_calls !== undefined && (
                                period.triggers_met.min_calls ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-500" />
                                )
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-sm">{period.conversion_rate.toFixed(0)}%</span>
                              {period.triggers_met?.min_conversion_rate !== undefined && (
                                period.triggers_met.min_conversion_rate ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-500" />
                                )
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm">
                              {period.tasks_completed}/{period.tasks_total}
                            </span>
                            {period.triggers_met?.tasks_completed !== undefined && (
                              period.triggers_met.tasks_completed ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500 inline ml-1" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-500 inline ml-1" />
                              )
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {period.all_triggers_met ? (
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]">
                                ✅ OK
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-500 border-red-500/30 text-[10px]">
                                ❌ Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div>
                              <span className={`font-bold ${period.all_triggers_met ? "text-emerald-600" : "text-muted-foreground line-through"}`}>
                                {formatCurrency(period.total_commission)}
                              </span>
                              {period.bonus_value > 0 && (
                                <p className="text-[10px] text-amber-600">
                                  +{formatCurrency(period.bonus_value)} bônus
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                period.status === "paid"
                                  ? "bg-green-500/10 text-green-600 border-green-500/30"
                                  : period.status === "approved"
                                  ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {period.status === "paid" ? "Pago" : period.status === "approved" ? "Aprovado" : "Pendente"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
