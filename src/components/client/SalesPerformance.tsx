import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Target, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Calendar,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SalesGoal {
  id: string;
  period_start: string;
  period_end: string;
  goal_amount: number;
  currency: string;
}

interface SalesRecord {
  id: string;
  sale_date: string;
  amount: number;
  description: string | null;
  currency: string;
}

interface SalesPerformanceProps {
  clientId: string;
}

export function SalesPerformance({ clientId }: SalesPerformanceProps) {
  const [goals, setGoals] = useState<SalesGoal[]>([]);
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const [goalsResult, salesResult] = await Promise.all([
        supabase
          .from("sales_goals")
          .select("*")
          .eq("client_id", clientId)
          .order("period_start", { ascending: false }),
        supabase
          .from("sales_records")
          .select("*")
          .eq("client_id", clientId)
          .order("sale_date", { ascending: false }),
      ]);

      setGoals((goalsResult.data || []) as SalesGoal[]);
      setSales((salesResult.data || []) as SalesRecord[]);
      setLoading(false);
    };

    fetchData();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`sales-${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_goals', filter: `client_id=eq.${clientId}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_records', filter: `client_id=eq.${clientId}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Calculate performance for each goal
  const getGoalPerformance = (goal: SalesGoal) => {
    const goalSales = sales.filter((s) => {
      const saleDate = new Date(s.sale_date);
      return saleDate >= new Date(goal.period_start) && saleDate <= new Date(goal.period_end);
    });
    
    const totalSales = goalSales.reduce((sum, s) => sum + Number(s.amount), 0);
    const percentage = goal.goal_amount > 0 ? (totalSales / goal.goal_amount) * 100 : 0;
    const isCurrentPeriod = new Date() >= new Date(goal.period_start) && new Date() <= new Date(goal.period_end);
    const isPastPeriod = new Date() > new Date(goal.period_end);
    
    return {
      totalSales,
      percentage: Math.min(percentage, 100),
      actualPercentage: percentage,
      salesCount: goalSales.length,
      isCurrentPeriod,
      isPastPeriod,
      goalMet: totalSales >= goal.goal_amount,
    };
  };

  // Calculate totals
  const totalGoals = goals.reduce((sum, g) => sum + Number(g.goal_amount), 0);
  const totalSalesAmount = sales.reduce((sum, s) => sum + Number(s.amount), 0);
  const overallPercentage = totalGoals > 0 ? (totalSalesAmount / totalGoals) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (goals.length === 0 && sales.length === 0) {
    return (
      <div className="text-center py-12">
        <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">
          Nenhuma meta ou venda registrada para este cliente.
        </p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Os dados serão sincronizados automaticamente do Clínica Ryka.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Meta Total</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(totalGoals)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Vendido</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(totalSalesAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${overallPercentage >= 100 ? 'from-emerald-500/5 to-emerald-500/10 border-emerald-500/20' : overallPercentage >= 70 ? 'from-amber-500/5 to-amber-500/10 border-amber-500/20' : 'from-destructive/5 to-destructive/10 border-destructive/20'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${overallPercentage >= 100 ? 'bg-emerald-500/10' : overallPercentage >= 70 ? 'bg-amber-500/10' : 'bg-destructive/10'}`}>
                {overallPercentage >= 100 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                ) : (
                  <TrendingDown className={`h-5 w-5 ${overallPercentage >= 70 ? 'text-amber-500' : 'text-destructive'}`} />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Desempenho</p>
                <p className={`text-lg font-bold ${overallPercentage >= 100 ? 'text-emerald-500' : overallPercentage >= 70 ? 'text-amber-500' : 'text-destructive'}`}>
                  {overallPercentage.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals with Progress */}
      {goals.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Metas por Período</h3>
          <div className="space-y-3">
            {goals.map((goal) => {
              const perf = getGoalPerformance(goal);
              return (
                <div
                  key={goal.id}
                  className={`p-4 rounded-lg border ${
                    perf.isCurrentPeriod 
                      ? 'bg-primary/5 border-primary/30' 
                      : perf.isPastPeriod && perf.goalMet 
                        ? 'bg-emerald-500/5 border-emerald-500/20' 
                        : perf.isPastPeriod 
                          ? 'bg-muted/30 border-border' 
                          : 'bg-card border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {format(new Date(goal.period_start), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(goal.period_end), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      {perf.isCurrentPeriod && (
                        <Badge variant="default" className="text-xs">Atual</Badge>
                      )}
                      {perf.isPastPeriod && perf.goalMet && (
                        <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Atingida
                        </Badge>
                      )}
                      {perf.isPastPeriod && !perf.goalMet && (
                        <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Não atingida
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {perf.salesCount} venda{perf.salesCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {formatCurrency(perf.totalSales)} de {formatCurrency(goal.goal_amount)}
                      </span>
                      <span className={`font-medium ${
                        perf.actualPercentage >= 100 
                          ? 'text-emerald-500' 
                          : perf.actualPercentage >= 70 
                            ? 'text-amber-500' 
                            : 'text-muted-foreground'
                      }`}>
                        {perf.actualPercentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={perf.percentage} 
                      className={`h-2 ${
                        perf.actualPercentage >= 100 
                          ? '[&>div]:bg-emerald-500' 
                          : perf.actualPercentage >= 70 
                            ? '[&>div]:bg-amber-500' 
                            : ''
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Sales */}
      {sales.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Vendas Recentes</h3>
          <div className="space-y-2">
            {sales.slice(0, 10).map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-emerald-500/10 rounded">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {formatCurrency(sale.amount)}
                    </p>
                    {sale.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {sale.description}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(sale.sale_date), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
