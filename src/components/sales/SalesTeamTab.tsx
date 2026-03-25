import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Phone, 
  Target, 
  Trophy, 
  CheckCircle2,
  TrendingUp,
  Users,
  Clock,
  RefreshCw,
  CalendarIcon,
  CalendarCheck,
  UserX,
  List,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSalesTeamMetrics, SalesRepMetrics } from "@/hooks/useSalesTeamMetrics";
import { SalesRepCard } from "./SalesRepCard";
import { SalesRepRow } from "./SalesRepRow";
import { SalesRepDetailSheet } from "./SalesRepDetailSheet";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PeriodOption = "7d" | "30d" | "90d" | "all" | "custom";

export function SalesTeamTab() {
  const [period, setPeriod] = useState<PeriodOption>("30d");
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);
  const [selectedRep, setSelectedRep] = useState<SalesRepMetrics | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Memoize date range to prevent infinite re-renders
  const dateRange = useMemo(() => {
    if (period === "custom" && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }

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
      case "custom":
        // fallback while dates aren't set
        start.setDate(start.getDate() - 30);
        break;
    }
    
    return { startDate: start, endDate: end };
  }, [period, customStart, customEnd]);

  const { metrics, totals, loading, refetch } = useSalesTeamMetrics(dateRange);

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
      <div className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 sm:h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 sm:h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          <h2 className="font-semibold text-sm sm:text-base">Equipe de Vendas</h2>
          <Badge variant="secondary" className="text-[10px] sm:text-xs">{metrics.length} vendedores</Badge>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
            <SelectTrigger className="w-[140px] sm:w-[160px] h-8 sm:h-9 text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Todo período</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {period === "custom" && (
            <div className="flex items-center gap-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-8 sm:h-9 gap-1 sm:gap-1.5 text-xs", !customStart && "text-muted-foreground")}>
                    <CalendarIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    {customStart ? format(customStart, "dd/MM/yy") : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customStart}
                    onSelect={setCustomStart}
                    disabled={(date) => (customEnd ? date > customEnd : date > new Date())}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-8 sm:h-9 gap-1 sm:gap-1.5 text-xs", !customEnd && "text-muted-foreground")}>
                    <CalendarIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    {customEnd ? format(customEnd, "dd/MM/yy") : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customEnd}
                    onSelect={setCustomEnd}
                    disabled={(date) => (customStart ? date < customStart : false) || date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Phone className="h-4 w-4 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold">{totals.total_calls}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  Ligações ({formatDuration(totals.total_call_duration)})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Target className="h-4 w-4 text-purple-500" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold">{totals.total_deals}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  Pipeline: {formatCurrency(totals.pipeline_value)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Trophy className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold text-emerald-600">{totals.won_deals}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  Ganhos: {formatCurrency(totals.won_value)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <CheckCircle2 className="h-4 w-4 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold">{totals.completed_tasks}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  Tarefas concluídas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agendamentos */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <CalendarCheck className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-bold">{totals.scheduled_calls}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  Agendamentos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* No-Show */}
        <Card className={totals.noshow_calls > 0 ? "bg-red-500/5 border-red-500/20" : ""}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <UserX className="h-4 w-4 text-red-500" />
              </div>
              <div className="min-w-0">
                <p className={`text-lg sm:text-xl font-bold ${totals.noshow_calls > 0 ? 'text-red-600' : ''}`}>{totals.noshow_calls}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  No-Show {totals.scheduled_calls > 0 ? `(${Math.round((totals.noshow_calls / totals.scheduled_calls) * 100)}%)` : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Grid */}
      {metrics.length === 0 ? (
        <Card>
          <CardContent className="p-6 sm:p-8 text-center text-muted-foreground">
            <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium text-sm sm:text-base">Nenhuma atividade no período</p>
            <p className="text-xs sm:text-sm mt-1">
              Os vendedores aparecerão aqui quando tiverem ligações, negócios ou tarefas registradas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
