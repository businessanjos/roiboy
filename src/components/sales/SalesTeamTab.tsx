import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Phone, 
  Target, 
  Trophy, 
  CheckCircle2,
  TrendingUp,
  Users,
  Clock,
  RefreshCw,
} from "lucide-react";
import { useSalesTeamMetrics, SalesRepMetrics } from "@/hooks/useSalesTeamMetrics";
import { SalesRepCard } from "./SalesRepCard";
import { SalesRepDetailSheet } from "./SalesRepDetailSheet";

type PeriodOption = "7d" | "30d" | "90d" | "all";

export function SalesTeamTab() {
  const [period, setPeriod] = useState<PeriodOption>("30d");
  const [selectedRep, setSelectedRep] = useState<SalesRepMetrics | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    
    switch (period) {
      case "7d":
        start.setDate(start.getDate() - 7);
        break;
      case "30d":
        start.setDate(start.getDate() - 30);
        break;
      case "90d":
        start.setDate(start.getDate() - 90);
        break;
      case "all":
        start.setFullYear(2020);
        break;
    }
    
    return { startDate: start, endDate: end };
  };

  const { metrics, totals, loading, refetch } = useSalesTeamMetrics(getDateRange());

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      return `${mins}min`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}min`;
  };

  const handleViewDetails = (rep: SalesRepMetrics) => {
    setSelectedRep(rep);
    setIsDetailOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Equipe de Vendas</h2>
          <Badge variant="secondary">{metrics.length} vendedores</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Todo período</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10">
                <Phone className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.total_calls}</p>
                <p className="text-xs text-muted-foreground">
                  Ligações ({formatDuration(totals.total_call_duration)})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-500/10">
                <Target className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.total_deals}</p>
                <p className="text-xs text-muted-foreground">
                  Pipeline: {formatCurrency(totals.pipeline_value)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10">
                <Trophy className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{totals.won_deals}</p>
                <p className="text-xs text-muted-foreground">
                  Ganhos: {formatCurrency(totals.won_value)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10">
                <CheckCircle2 className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.completed_tasks}</p>
                <p className="text-xs text-muted-foreground">
                  Tarefas concluídas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Grid */}
      {metrics.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhuma atividade no período</p>
            <p className="text-sm mt-1">
              Os vendedores aparecerão aqui quando tiverem ligações, negócios ou tarefas registradas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((rep) => (
            <SalesRepCard
              key={rep.user_id}
              rep={rep}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}

      {/* Detail Sheet */}
      <SalesRepDetailSheet
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        rep={selectedRep}
      />
    </div>
  );
}
