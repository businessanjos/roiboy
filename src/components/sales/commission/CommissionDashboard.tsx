import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Calculator,
  CheckCircle2,
  XCircle,
  Trophy,
  TrendingUp,
  Phone,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  DollarSign,
} from "lucide-react";
import { CommissionPlan, CommissionPeriodResult } from "@/hooks/useCommissionPlan";

interface CommissionDashboardProps {
  plan: CommissionPlan;
  periods: CommissionPeriodResult[];
  calculating: boolean;
  onCalculate: (year?: number, month?: number) => Promise<void>;
  compact?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function CommissionDashboard({
  plan,
  periods,
  calculating,
  onCalculate,
  compact = false,
}: CommissionDashboardProps) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const hasSDRModel = (plan as any).commission_model === "sdr_activity";
  const sdrValuePerCall = (plan as any).sdr_value_per_call || 0;
  const sdrValuePerSale = (plan as any).sdr_value_per_sale || 0;

  const selectedMonthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  const selectedPeriods = useMemo(() => {
    return periods.filter((p) => p.period_start === selectedMonthKey);
  }, [periods, selectedMonthKey]);

  // Split periods by role
  const sdrPeriods = useMemo(() => 
    selectedPeriods.filter((p) => (p.triggers_met as any)?.is_sdr === true),
    [selectedPeriods]
  );
  const closerPeriods = useMemo(() => 
    selectedPeriods.filter((p) => (p.triggers_met as any)?.is_sdr !== true),
    [selectedPeriods]
  );

  const sdrTotals = useMemo(() => {
    return sdrPeriods.reduce(
      (acc, p) => ({
        totalCommission: acc.totalCommission + p.total_commission,
        attendedCalls: acc.attendedCalls + (Number((p.triggers_met as any)?.sdr_attended_calls_count) || 0),
        originatedSales: acc.originatedSales + (Number((p.triggers_met as any)?.sdr_originated_sales_count) || 0),
      }),
      { totalCommission: 0, attendedCalls: 0, originatedSales: 0 }
    );
  }, [sdrPeriods]);

  const closerTotals = useMemo(() => {
    return closerPeriods.reduce(
      (acc, p) => ({
        wonValue: acc.wonValue + p.won_value,
        totalCommission: acc.totalCommission + p.total_commission,
        qualifiedCount: acc.qualifiedCount + (p.all_triggers_met ? 1 : 0),
        totalCount: acc.totalCount + 1,
      }),
      { wonValue: 0, totalCommission: 0, qualifiedCount: 0, totalCount: 0 }
    );
  }, [closerPeriods]);

  const goToPreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{plan.name}</h3>
          <p className="text-xs text-muted-foreground">
            Apuração mensal {isSDRModel && "· Modelo SDR por Atividade"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg px-1 py-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-2 min-w-[140px] text-center">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={goToNextMonth}
              disabled={isCurrentMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={() => onCalculate(selectedYear, selectedMonth)}
            disabled={calculating}
            size="sm"
          >
            <Calculator className="h-4 w-4 mr-2" />
            {calculating ? "Calculando..." : isCurrentMonth ? "Calcular Mês Atual" : "Recalcular"}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {selectedPeriods.length > 0 && (
        isSDRModel ? (
          /* SDR Summary Cards */
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-violet-500/10">
                    <Phone className="h-5 w-5 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-violet-600">{(totals as any).attendedCalls}</p>
                    <p className="text-xs text-muted-foreground">Calls comparecidas</p>
                    <p className="text-[10px] text-muted-foreground/70">× {formatCurrency(sdrValuePerCall)} = {formatCurrency((totals as any).attendedCalls * sdrValuePerCall)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10">
                    <CalendarCheck className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">{(totals as any).originatedSales}</p>
                    <p className="text-xs text-muted-foreground">Vendas originadas</p>
                    <p className="text-[10px] text-muted-foreground/70">× {formatCurrency(sdrValuePerSale)} = {formatCurrency((totals as any).originatedSales * sdrValuePerSale)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/10">
                    <DollarSign className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(totals.totalCommission)}</p>
                    <p className="text-xs text-muted-foreground">Total comissão SDR</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Closer Summary Cards */
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10">
                    <Trophy className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency((totals as any).wonValue)}</p>
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
                    <p className="text-2xl font-bold">{(totals as any).qualifiedCount}</p>
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
                    <p className="text-2xl font-bold">{totals.totalCount - (totals as any).qualifiedCount}</p>
                    <p className="text-xs text-muted-foreground">Sem gatilhos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      )}

      {/* Results Table */}
      {!compact && (selectedPeriods.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhum cálculo para {MONTH_NAMES[selectedMonth]} {selectedYear}</p>
            <p className="text-sm mt-1">
              Clique em "{isCurrentMonth ? "Calcular Mês Atual" : "Recalcular"}" para apurar as comissões.
            </p>
          </CardContent>
        </Card>
      ) : isSDRModel ? (
        /* SDR Table */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              📅 {MONTH_NAMES[selectedMonth]} {selectedYear} — SDR
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SDR</TableHead>
                  <TableHead className="text-center">Calls Comparecidas</TableHead>
                  <TableHead className="text-right">Comissão Calls</TableHead>
                  <TableHead className="text-center">Vendas Originadas</TableHead>
                  <TableHead className="text-right">Comissão Vendas</TableHead>
                  <TableHead className="text-right">Total Comissão</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPeriods
                  .sort((a, b) => b.total_commission - a.total_commission)
                  .map((period) => {
                    const attendedCalls = Number((period.triggers_met as any)?.sdr_attended_calls_count) || 0;
                    const originatedSales = Number((period.triggers_met as any)?.sdr_originated_sales_count) || 0;
                    const commCalls = attendedCalls * sdrValuePerCall;
                    const commSales = originatedSales * sdrValuePerSale;

                    return (
                      <TableRow key={period.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={period.user_avatar || undefined} />
                              <AvatarFallback className="text-xs bg-violet-500/10 text-violet-600">
                                {getInitials(period.user_name || "")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{period.user_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-violet-500" />
                            <span className="text-sm font-semibold">{attendedCalls}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(commCalls)}
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({attendedCalls} × {formatCurrency(sdrValuePerCall)})
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <CalendarCheck className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-sm font-semibold">{originatedSales}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(commSales)}
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({originatedSales} × {formatCurrency(sdrValuePerSale)})
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold text-emerald-600">
                            {formatCurrency(period.total_commission)}
                          </span>
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
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        /* Closer Table */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              📅 {MONTH_NAMES[selectedMonth]} {selectedYear}
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
                  {selectedPeriods
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
                          {Object.keys(period.triggers_met || {}).length === 0 ? (
                            <Badge variant="outline" className="text-muted-foreground text-[10px]">
                              — Sem gatilhos
                            </Badge>
                          ) : period.all_triggers_met ? (
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
      ))}
    </div>
  );
}
