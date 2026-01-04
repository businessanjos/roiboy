import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Target,
  Zap,
  Shield,
  Filter,
  Clock,
  PauseCircle,
  Ban,
  UserX,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Contract {
  id: string;
  client_id: string;
  start_date: string;
  end_date: string | null;
  value: number;
  status: string;
  contract_type: string;
  created_at: string;
  product?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

interface ContractsDashboardProps {
  contracts: Contract[];
}

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  pending: "#3b82f6",
  suspended: "#f97316",
  paused: "#f59e0b",
  cancelled: "#ef4444",
  ended: "#64748b",
  scheduled: "#6366f1",
  dismissed: "#e11d48",
  dropout_7d: "#ec4899",
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  compra: "Compra",
  renovacao: "Renovação",
  migracao: "Migração",
  confissao_divida: "Confissão",
  termo_congelamento: "Congelamento",
  distrato: "Distrato",
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

export function ContractsDashboard({ contracts }: ContractsDashboardProps) {
  // Monthly evolution data (last 6 months) - uses start_date for contract initiation
  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      const newContracts = contracts.filter(c => {
        const startDate = parseISO(c.start_date);
        return isWithinInterval(startDate, { start: monthStart, end: monthEnd });
      });
      
      const cancelledContracts = contracts.filter(c => {
        if (c.status !== "cancelled" && c.status !== "ended") return false;
        const startDate = parseISO(c.start_date);
        return isWithinInterval(startDate, { start: monthStart, end: monthEnd });
      });
      
      const activeAtEnd = contracts.filter(c => {
        const startDate = parseISO(c.start_date);
        return startDate <= monthEnd && c.status === "active";
      });
      
      months.push({
        month: format(date, "MMM", { locale: ptBR }),
        fullMonth: format(date, "MMMM yyyy", { locale: ptBR }),
        novos: newContracts.length,
        cancelados: cancelledContracts.filter(c => c.status === "cancelled").length,
        encerrados: cancelledContracts.filter(c => c.status === "ended").length,
        ativos: activeAtEnd.length,
        valorNovos: newContracts.reduce((sum, c) => sum + (c.value || 0), 0),
      });
    }
    return months;
  }, [contracts]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    contracts.forEach(c => {
      distribution[c.status] = (distribution[c.status] || 0) + 1;
    });
    return Object.entries(distribution).map(([status, count]) => ({
      name: status === "active" ? "Ativos" :
            status === "pending" ? "Pendentes" :
            status === "suspended" ? "Suspensos" :
            status === "paused" ? "Pausados" :
            status === "cancelled" ? "Cancelados" :
            status === "ended" ? "Encerrados" :
            status === "scheduled" ? "A Iniciar" :
            status === "dismissed" ? "Demitidas" :
            status === "dropout_7d" ? "Desistência 7D" : status,
      value: count,
      color: STATUS_COLORS[status] || "#94a3b8",
    }));
  }, [contracts]);

  // Product distribution
  const productDistribution = useMemo(() => {
    const distribution: Record<string, { count: number; value: number; color: string }> = {};
    contracts.forEach(c => {
      const productName = c.product?.name || "Sem Produto";
      const productColor = c.product?.color || "#94a3b8";
      if (!distribution[productName]) {
        distribution[productName] = { count: 0, value: 0, color: productColor };
      }
      distribution[productName].count += 1;
      distribution[productName].value += c.value || 0;
    });
    return Object.entries(distribution)
      .map(([name, data]) => ({
        name,
        count: data.count,
        value: data.value,
        color: data.color,
      }))
      .sort((a, b) => b.count - a.count);
  }, [contracts]);

  // Type distribution
  const typeDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    contracts.forEach(c => {
      const typeName = CONTRACT_TYPE_LABELS[c.contract_type] || c.contract_type;
      distribution[typeName] = (distribution[typeName] || 0) + 1;
    });
    return Object.entries(distribution).map(([name, value]) => ({
      name,
      value,
    }));
  }, [contracts]);

  // Funnel data - lifecycle flow
  const funnelData = useMemo(() => {
    const total = contracts.length;
    const scheduled = contracts.filter(c => c.status === "scheduled").length;
    const pending = contracts.filter(c => c.status === "pending").length;
    const active = contracts.filter(c => c.status === "active").length;
    const paused = contracts.filter(c => c.status === "paused").length;
    const suspended = contracts.filter(c => c.status === "suspended").length;
    const ended = contracts.filter(c => c.status === "ended").length;
    const cancelled = contracts.filter(c => c.status === "cancelled").length;
    const dismissed = contracts.filter(c => c.status === "dismissed").length;
    const dropout7d = contracts.filter(c => c.status === "dropout_7d").length;
    
    // Calculate rates
    const activeRate = total > 0 ? (active / total) * 100 : 0;
    const completedRate = total > 0 ? (ended / total) * 100 : 0;
    const churnTotal = cancelled + dismissed + dropout7d;
    const churnRate = total > 0 ? (churnTotal / total) * 100 : 0;
    const inProgressRate = total > 0 ? ((active + pending + scheduled + paused + suspended) / total) * 100 : 0;
    
    return {
      total,
      scheduled,
      pending,
      active,
      paused,
      suspended,
      ended,
      cancelled,
      dismissed,
      dropout7d,
      churnTotal,
      activeRate,
      completedRate,
      churnRate,
      inProgressRate,
    };
  }, [contracts]);

  // KPIs
  const kpis = useMemo(() => {
    const activeContracts = contracts.filter(c => c.status === "active");
    const currentMonth = monthlyData[monthlyData.length - 1];
    const previousMonth = monthlyData[monthlyData.length - 2];
    
    const totalValue = activeContracts.reduce((sum, c) => sum + (c.value || 0), 0);
    const averageTicket = activeContracts.length > 0 ? totalValue / activeContracts.length : 0;
    
    const growthRate = previousMonth?.novos > 0 
      ? ((currentMonth?.novos - previousMonth?.novos) / previousMonth?.novos) * 100 
      : 0;
    
    const churnRate = previousMonth?.ativos > 0
      ? ((currentMonth?.cancelados + currentMonth?.encerrados) / previousMonth?.ativos) * 100
      : 0;
    
    const retentionRate = 100 - churnRate;
    
    return {
      totalActive: activeContracts.length,
      totalValue,
      averageTicket,
      newThisMonth: currentMonth?.novos || 0,
      churnThisMonth: (currentMonth?.cancelados || 0) + (currentMonth?.encerrados || 0),
      growthRate,
      churnRate,
      retentionRate,
    };
  }, [contracts, monthlyData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: value >= 10000 ? "compact" : "standard",
    }).format(value);
  };

  const renderTrend = (value: number, inverted = false) => {
    const isPositive = inverted ? value < 0 : value > 0;
    const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
    const color = isPositive ? "text-emerald-500" : value === 0 ? "text-muted-foreground" : "text-rose-500";
    
    return (
      <span className={`flex items-center gap-0.5 text-xs font-medium ${color}`}>
        <Icon className="h-3.5 w-3.5" />
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl px-4 py-3 shadow-xl">
        <p className="text-sm font-medium mb-2">{payload[0]?.payload?.fullMonth || label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Hero KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent shadow-lg shadow-emerald-500/5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-xs">
                  +{kpis.newThisMonth} novos
                </Badge>
              </div>
              <p className="text-3xl font-bold tracking-tight">{kpis.totalActive}</p>
              <p className="text-sm text-muted-foreground mt-1">Contratos Ativos</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent shadow-lg shadow-blue-500/5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-blue-500/15 ring-1 ring-blue-500/20">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ticket médio</p>
                  <p className="text-xs font-semibold text-blue-600">{formatCurrency(kpis.averageTicket)}</p>
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight">{formatCurrency(kpis.totalValue)}</p>
              <p className="text-sm text-muted-foreground mt-1">Faturamento Total</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent shadow-lg shadow-violet-500/5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-violet-500/15 ring-1 ring-violet-500/20">
                  <Shield className="h-5 w-5 text-violet-500" />
                </div>
                {renderTrend(kpis.growthRate)}
              </div>
              <p className="text-3xl font-bold tracking-tight">{kpis.retentionRate.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground mt-1">Taxa de Retenção</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent shadow-lg shadow-rose-500/5">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-rose-500/15 ring-1 ring-rose-500/20">
                  <XCircle className="h-5 w-5 text-rose-500" />
                </div>
                <Badge variant="outline" className="border-rose-500/30 text-rose-600 text-xs">
                  {kpis.churnRate.toFixed(1)}% taxa
                </Badge>
              </div>
              <p className="text-3xl font-bold tracking-tight text-rose-600">{kpis.churnThisMonth}</p>
              <p className="text-sm text-muted-foreground mt-1">Churn este mês</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Funnel - Lifecycle Flow */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20">
                <Filter className="h-4 w-4 text-violet-500" />
              </div>
              <CardTitle className="text-base font-semibold">Funil do Processo</CardTitle>
              <Badge variant="outline" className="ml-auto text-xs">
                Taxa de Eficiência: {funnelData.activeRate.toFixed(1)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Total Entries */}
              <div className="relative">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">Total de Contratos</span>
                      <span className="text-lg font-bold">{funnelData.total}</span>
                    </div>
                    <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80"
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">100%</span>
                </div>
              </div>

              {/* Active (In Progress) */}
              <div className="relative pl-6 border-l-2 border-dashed border-muted-foreground/20 ml-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">Ativos</span>
                      <span className="text-lg font-bold text-emerald-600">{funnelData.active}</span>
                    </div>
                    <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${funnelData.activeRate}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-emerald-600 font-medium w-12 text-right">{funnelData.activeRate.toFixed(1)}%</span>
                </div>
              </div>

              {/* Pending + Scheduled */}
              <div className="relative pl-6 border-l-2 border-dashed border-muted-foreground/20 ml-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                    <Clock className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">Pendentes + A Iniciar</span>
                      <span className="text-lg font-bold text-blue-600">{funnelData.pending + funnelData.scheduled}</span>
                    </div>
                    <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${funnelData.total > 0 ? ((funnelData.pending + funnelData.scheduled) / funnelData.total) * 100 : 0}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-blue-600 font-medium w-12 text-right">
                    {funnelData.total > 0 ? (((funnelData.pending + funnelData.scheduled) / funnelData.total) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>

              {/* Paused + Suspended */}
              <div className="relative pl-6 border-l-2 border-dashed border-muted-foreground/20 ml-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
                    <PauseCircle className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">Pausados + Suspensos</span>
                      <span className="text-lg font-bold text-amber-600">{funnelData.paused + funnelData.suspended}</span>
                    </div>
                    <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${funnelData.total > 0 ? ((funnelData.paused + funnelData.suspended) / funnelData.total) * 100 : 0}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-amber-600 font-medium w-12 text-right">
                    {funnelData.total > 0 ? (((funnelData.paused + funnelData.suspended) / funnelData.total) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>

              {/* Ended (Completed) */}
              <div className="relative pl-6 border-l-2 border-dashed border-muted-foreground/20 ml-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-500/10 shrink-0">
                    <Ban className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">Encerrados</span>
                      <span className="text-lg font-bold text-slate-600">{funnelData.ended}</span>
                    </div>
                    <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full rounded-full bg-gradient-to-r from-slate-500 to-slate-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${funnelData.completedRate}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 font-medium w-12 text-right">{funnelData.completedRate.toFixed(1)}%</span>
                </div>
              </div>

              {/* Churn (Cancelled + Dismissed + Dropout) */}
              <div className="relative pl-6 border-l-2 border-dashed border-rose-500/30 ml-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-rose-500/10 shrink-0">
                    <UserX className="h-4 w-4 text-rose-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Churn Total</span>
                        <span className="text-xs text-muted-foreground">
                          (Cancel: {funnelData.cancelled} | Demitidas: {funnelData.dismissed} | 7D: {funnelData.dropout7d})
                        </span>
                      </div>
                      <span className="text-lg font-bold text-rose-600">{funnelData.churnTotal}</span>
                    </div>
                    <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${funnelData.churnRate}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-rose-600 font-medium w-12 text-right">{funnelData.churnRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3 mt-6 pt-4 border-t border-border/50">
              <div className="text-center p-3 rounded-xl bg-emerald-500/5">
                <p className="text-2xl font-bold text-emerald-600">{funnelData.inProgressRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Em Andamento</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-slate-500/5">
                <p className="text-2xl font-bold text-slate-600">{funnelData.completedRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Finalizados</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-rose-500/5">
                <p className="text-2xl font-bold text-rose-600">{funnelData.churnRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Taxa de Churn</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-base font-semibold">Evolução Mensal</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      className="text-xs" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="novos" name="Novos" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="cancelados" name="Cancelados" fill="#ef4444" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="encerrados" name="Encerrados" fill="#64748b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs text-muted-foreground">Novos</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="text-xs text-muted-foreground">Cancelados</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-500" />
                  <span className="text-xs text-muted-foreground">Encerrados</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </div>
                <CardTitle className="text-base font-semibold">Tendência de Ativos</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAtivos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      className="text-xs" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="ativos" 
                      name="Ativos" 
                      stroke="#3b82f6" 
                      strokeWidth={2.5}
                      fill="url(#colorAtivos)"
                      dot={{ fill: "#3b82f6", strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-500/10">
                  <Target className="h-4 w-4 text-violet-500" />
                </div>
                <CardTitle className="text-base font-semibold">Por Status</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 shadow-xl">
                            <p className="text-sm font-medium">{data.name}</p>
                            <p className="text-lg font-bold">{data.value}</p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                {statusDistribution.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-xs font-medium">{entry.name}</span>
                    <span className="text-xs text-muted-foreground">({entry.value})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <Zap className="h-4 w-4 text-amber-500" />
                </div>
                <CardTitle className="text-base font-semibold">Por Tipo</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {typeDistribution.map((type, index) => {
                  const percentage = (type.value / contracts.length) * 100;
                  const colors = [
                    "from-blue-500 to-blue-600",
                    "from-emerald-500 to-emerald-600",
                    "from-amber-500 to-amber-600",
                    "from-violet-500 to-violet-600",
                    "from-rose-500 to-rose-600",
                    "from-slate-500 to-slate-600",
                  ];
                  const color = colors[index % colors.length];
                  
                  return (
                    <div key={type.name} className="group">
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium">{type.name}</span>
                        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                          {type.value} <span className="text-xs">({percentage.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                        <motion.div 
                          className={`h-full rounded-full bg-gradient-to-r ${color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.1 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                </div>
                <CardTitle className="text-base font-semibold">Por Produto</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {productDistribution.slice(0, 6).map((product, index) => {
                  const percentage = (product.count / contracts.length) * 100;
                  
                  return (
                    <div key={product.name} className="group">
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium truncate flex-1 mr-2">{product.name}</span>
                        <div className="text-right shrink-0">
                          <span className="text-xs text-muted-foreground">{product.count}×</span>
                          <span className="text-xs font-semibold ml-1.5" style={{ color: product.color }}>
                            {formatCurrency(product.value)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full rounded-full"
                          style={{ backgroundColor: product.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.1 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Revenue Chart */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <CardTitle className="text-base font-semibold">Valor de Novos Contratos</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValor" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22c55e"/>
                      <stop offset="100%" stopColor="#10b981"/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.[0]) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-xl px-4 py-3 shadow-xl">
                          <p className="text-sm font-medium mb-1">{data?.fullMonth || label}</p>
                          <p className="text-lg font-bold text-emerald-500">{formatCurrency(payload[0].value as number)}</p>
                        </div>
                      );
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="valorNovos" 
                    name="Valor" 
                    stroke="url(#colorValor)" 
                    strokeWidth={3}
                    dot={{ fill: "#22c55e", strokeWidth: 2, stroke: "#fff", r: 5 }}
                    activeDot={{ r: 7, strokeWidth: 2, stroke: "#fff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
