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
  Route,
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
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO, differenceInMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Contract {
  id: string;
  client_id: string;
  start_date: string;
  end_date: string | null;
  cancelled_at: string | null;
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
  suspended_bonus: "#eab308",
  paused: "#f59e0b",
  cancelled: "#ef4444",
  ended: "#64748b",
  scheduled: "#6366f1",
  dismissed: "#e11d48",
  dismissal_termination: "#be123c",
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
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

const pulseKeyframes = {
  "0%, 100%": { opacity: 0.4 },
  "50%": { opacity: 0.8 },
};

export function ContractsDashboard({ contracts }: ContractsDashboardProps) {
  // Monthly evolution data (last 12 months) - uses start_date for contract initiation
  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
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
            status === "suspended_bonus" ? "Suspenso Bônus" :
            status === "paused" ? "Pausados" :
            status === "cancelled" ? "Distrato de Cancelamento" :
            status === "ended" ? "Encerrados" :
            status === "scheduled" ? "A Iniciar" :
            status === "dismissed" ? "Demitidas" :
            status === "dismissal_termination" ? "Distrato por Demissão" :
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

  // Customer Journey - Churn by contract month (1st, 2nd, 3rd... month)
  // Uses cancelled_at for accurate churn timing
  const customerJourneyData = useMemo(() => {
    const journeyData: { month: number; label: string; churned: number; total: number; rate: number }[] = [];
    
    // Get contracts that churned (cancelled, dismissed, dropout_7d, ended)
    // Uses cancelled_at for the actual churn date
    const churnedContracts = contracts.filter(c => 
      ['cancelled', 'dismissed', 'dropout_7d', 'ended'].includes(c.status) && 
      c.cancelled_at
    );
    
    // Calculate the month of churn for each contract
    for (let month = 1; month <= 12; month++) {
      let churnedInMonth = 0;
      let totalAtMonth = 0;
      
      churnedContracts.forEach(contract => {
        if (!contract.cancelled_at) return;
        
        const startDate = parseISO(contract.start_date);
        const churnDate = parseISO(contract.cancelled_at);
        const monthsActive = differenceInMonths(churnDate, startDate) + 1;
        
        if (monthsActive === month) {
          churnedInMonth++;
        }
      });
      
      // Total contracts that reached this month (active or churned after this month)
      contracts.forEach(contract => {
        const startDate = parseISO(contract.start_date);
        
        // For churned contracts, use cancelled_at; for active ones, use today
        let referenceDate: Date;
        if (['cancelled', 'dismissed', 'dropout_7d', 'ended'].includes(contract.status) && contract.cancelled_at) {
          referenceDate = parseISO(contract.cancelled_at);
        } else {
          referenceDate = new Date();
        }
        
        const monthsActive = differenceInMonths(referenceDate, startDate) + 1;
        
        if (monthsActive >= month) {
          totalAtMonth++;
        }
      });
      
      journeyData.push({
        month,
        label: `${month}º`,
        churned: churnedInMonth,
        total: totalAtMonth,
        rate: totalAtMonth > 0 ? (churnedInMonth / totalAtMonth) * 100 : 0,
      });
    }
    
    return journeyData;
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
        <motion.div variants={itemVariants} whileHover={{ scale: 1.02, y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent shadow-xl shadow-emerald-500/10 hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-400/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-500/20">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-xs font-semibold backdrop-blur-sm">
                  +{kpis.newThisMonth} novos
                </Badge>
              </div>
              <p className="text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">{kpis.totalActive}</p>
              <p className="text-sm text-muted-foreground mt-1 font-medium">Contratos Ativos</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} whileHover={{ scale: 1.02, y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-transparent shadow-xl shadow-blue-500/10 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-400/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 ring-1 ring-blue-500/30 shadow-lg shadow-blue-500/20">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-right backdrop-blur-sm bg-background/30 rounded-lg px-2 py-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Ticket médio</p>
                  <p className="text-xs font-bold text-blue-600">{formatCurrency(kpis.averageTicket)}</p>
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">{formatCurrency(kpis.totalValue)}</p>
              <p className="text-sm text-muted-foreground mt-1 font-medium">Faturamento Total</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} whileHover={{ scale: 1.02, y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-violet-500/15 via-violet-500/5 to-transparent shadow-xl shadow-violet-500/10 hover:shadow-2xl hover:shadow-violet-500/20 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-violet-400/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-600/10 ring-1 ring-violet-500/30 shadow-lg shadow-violet-500/20">
                  <Shield className="h-5 w-5 text-violet-500" />
                </div>
                {renderTrend(kpis.growthRate)}
              </div>
              <p className="text-4xl font-bold tracking-tight bg-gradient-to-r from-violet-600 to-violet-500 bg-clip-text text-transparent">{kpis.retentionRate.toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground mt-1 font-medium">Taxa de Retenção</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} whileHover={{ scale: 1.02, y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent shadow-xl shadow-rose-500/10 hover:shadow-2xl hover:shadow-rose-500/20 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-rose-400/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-600/10 ring-1 ring-rose-500/30 shadow-lg shadow-rose-500/20">
                  <XCircle className="h-5 w-5 text-rose-500" />
                </div>
                <Badge variant="outline" className="border-rose-500/40 text-rose-600 text-xs font-semibold backdrop-blur-sm bg-rose-500/5">
                  {kpis.churnRate.toFixed(1)}% taxa
                </Badge>
              </div>
              <p className="text-4xl font-bold tracking-tight text-rose-600">{kpis.churnThisMonth}</p>
              <p className="text-sm text-muted-foreground mt-1 font-medium">Churn este mês</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Funnel - Lifecycle Flow */}
      <motion.div variants={itemVariants}>
        <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-card via-card to-violet-500/5 backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-violet-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-emerald-500/10 via-blue-500/5 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          <CardHeader className="pb-3 relative">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 ring-1 ring-violet-500/30 shadow-lg shadow-violet-500/20">
                <Filter className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Funil do Processo</CardTitle>
                <p className="text-xs text-muted-foreground">Jornada completa dos contratos</p>
              </div>
              <Badge className="ml-auto bg-gradient-to-r from-violet-500/20 to-indigo-500/20 text-violet-600 border-violet-500/30 text-xs font-semibold px-3 py-1">
                ✨ Eficiência: {funnelData.activeRate.toFixed(1)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="relative">
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

              {/* Suspensos */}
              <div className="relative pl-6 border-l-2 border-dashed border-muted-foreground/20 ml-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
                    <PauseCircle className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">Suspensos</span>
                      <span className="text-lg font-bold text-amber-600">{funnelData.suspended}</span>
                    </div>
                    <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${funnelData.total > 0 ? (funnelData.suspended / funnelData.total) * 100 : 0}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-amber-600 font-medium w-12 text-right">
                    {funnelData.total > 0 ? ((funnelData.suspended / funnelData.total) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>

              {/* Pausados */}
              <div className="relative pl-6 border-l-2 border-dashed border-muted-foreground/20 ml-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/10 shrink-0">
                    <PauseCircle className="h-4 w-4 text-sky-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">Pausados</span>
                      <span className="text-lg font-bold text-sky-600">{funnelData.paused}</span>
                    </div>
                    <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${funnelData.total > 0 ? (funnelData.paused / funnelData.total) * 100 : 0}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.35 }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-sky-600 font-medium w-12 text-right">
                    {funnelData.total > 0 ? ((funnelData.paused / funnelData.total) * 100).toFixed(1) : 0}%
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
            <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-border/30">
              <motion.div 
                className="group relative text-center p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300"
                whileHover={{ scale: 1.03 }}
              >
                <div className="absolute inset-0 bg-emerald-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">{funnelData.inProgressRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground font-medium mt-1">Em Andamento</p>
              </motion.div>
              <motion.div 
                className="group relative text-center p-4 rounded-2xl bg-gradient-to-br from-slate-500/10 via-slate-500/5 to-transparent border border-slate-500/20 hover:border-slate-500/40 transition-all duration-300"
                whileHover={{ scale: 1.03 }}
              >
                <div className="absolute inset-0 bg-slate-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <p className="text-3xl font-bold bg-gradient-to-r from-slate-600 to-slate-500 bg-clip-text text-transparent">{funnelData.completedRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground font-medium mt-1">Finalizados</p>
              </motion.div>
              <motion.div 
                className="group relative text-center p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/20 hover:border-rose-500/40 transition-all duration-300"
                whileHover={{ scale: 1.03 }}
              >
                <div className="absolute inset-0 bg-rose-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <p className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">{funnelData.churnRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground font-medium mt-1">Taxa de Churn</p>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card className="group relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-card via-card to-primary/5 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:opacity-80 transition-opacity" />
            <CardHeader className="pb-2 relative">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 ring-1 ring-primary/30 shadow-lg shadow-primary/20">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-base font-semibold">Evolução Mensal</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barNovos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#16a34a" stopOpacity={0.8}/>
                      </linearGradient>
                      <linearGradient id="barCancelados" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8}/>
                      </linearGradient>
                      <linearGradient id="barEncerrados" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#64748b" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#475569" stopOpacity={0.8}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" vertical={false} />
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
                    <Bar dataKey="novos" name="Novos" fill="url(#barNovos)" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="cancelados" name="Cancelados" fill="url(#barCancelados)" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="encerrados" name="Encerrados" fill="url(#barEncerrados)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                  <span className="text-xs font-medium text-emerald-600">Novos</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50" />
                  <span className="text-xs font-medium text-rose-600">Cancelados</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-500/10">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-500 shadow-lg shadow-slate-500/50" />
                  <span className="text-xs font-medium text-slate-600">Encerrados</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="group relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-card via-card to-blue-500/5 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:opacity-80 transition-opacity" />
            <CardHeader className="pb-2 relative">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 ring-1 ring-blue-500/30 shadow-lg shadow-blue-500/20">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </div>
                <CardTitle className="text-base font-semibold">Tendência Anual</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAtivos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                      </linearGradient>
                      <linearGradient id="colorCancelados" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02}/>
                      </linearGradient>
                      <linearGradient id="colorEncerrados" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#64748b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#64748b" stopOpacity={0.02}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" vertical={false} />
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
                      strokeWidth={3}
                      fill="url(#colorAtivos)"
                      dot={{ fill: "#3b82f6", strokeWidth: 2, stroke: "#fff", r: 4 }}
                      activeDot={{ r: 7, strokeWidth: 3, stroke: "#fff", fill: "#3b82f6" }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cancelados" 
                      name="Cancelados" 
                      stroke="#ef4444" 
                      strokeWidth={2}
                      fill="url(#colorCancelados)"
                      dot={{ fill: "#ef4444", strokeWidth: 2, stroke: "#fff", r: 3 }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff", fill: "#ef4444" }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="encerrados" 
                      name="Encerrados" 
                      stroke="#64748b" 
                      strokeWidth={2}
                      fill="url(#colorEncerrados)"
                      dot={{ fill: "#64748b", strokeWidth: 2, stroke: "#fff", r: 3 }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff", fill: "#64748b" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                  <span className="text-xs font-medium text-blue-600">Ativos</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50" />
                  <span className="text-xs font-medium text-rose-600">Cancelados</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-500/10">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-500 shadow-lg shadow-slate-500/50" />
                  <span className="text-xs font-medium text-slate-600">Encerrados</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants}>
          <Card className="group relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-card via-card to-violet-500/5 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:opacity-80 transition-opacity" />
            <CardHeader className="pb-2 relative">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/10 ring-1 ring-violet-500/30 shadow-lg shadow-violet-500/20">
                  <Target className="h-4 w-4 text-violet-500" />
                </div>
                <CardTitle className="text-base font-semibold">Por Status</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {statusDistribution.map((entry, index) => (
                        <linearGradient key={`grad-${index}`} id={`pieGrad-${index}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={entry.color} stopOpacity={1}/>
                          <stop offset="100%" stopColor={entry.color} stopOpacity={0.7}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={78}
                      paddingAngle={4}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="hsl(var(--background))"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#pieGrad-${index})`} />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background/95 backdrop-blur-md border border-border/30 rounded-xl px-4 py-3 shadow-2xl">
                            <p className="text-sm font-semibold">{data.name}</p>
                            <p className="text-2xl font-bold" style={{ color: data.color }}>{data.value}</p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                {statusDistribution.map((entry) => (
                  <motion.div 
                    key={entry.name} 
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all hover:scale-105"
                    style={{ 
                      backgroundColor: `${entry.color}10`,
                      borderColor: `${entry.color}30`
                    }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <div 
                      className="w-2.5 h-2.5 rounded-full shadow-sm" 
                      style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}60` }}
                    />
                    <span className="text-xs font-medium">{entry.name}</span>
                    <span className="text-xs font-bold" style={{ color: entry.color }}>({entry.value})</span>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="group relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-card via-card to-amber-500/5 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:opacity-80 transition-opacity" />
            <CardHeader className="pb-2 relative">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/10 ring-1 ring-amber-500/30 shadow-lg shadow-amber-500/20">
                  <Zap className="h-4 w-4 text-amber-500" />
                </div>
                <CardTitle className="text-base font-semibold">Por Tipo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-4">
                {typeDistribution.map((type, index) => {
                  const percentage = contracts.length > 0 ? (type.value / contracts.length) * 100 : 0;
                  const colors = [
                    { from: "#3b82f6", to: "#2563eb" },
                    { from: "#22c55e", to: "#16a34a" },
                    { from: "#f59e0b", to: "#d97706" },
                    { from: "#8b5cf6", to: "#7c3aed" },
                    { from: "#ef4444", to: "#dc2626" },
                    { from: "#64748b", to: "#475569" },
                  ];
                  const color = colors[index % colors.length];
                  
                  return (
                    <motion.div 
                      key={type.name} 
                      className="group/item"
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-semibold">{type.name}</span>
                        <span className="font-bold" style={{ color: color.from }}>
                          {type.value} <span className="text-xs text-muted-foreground font-medium">({percentage.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-3 bg-muted/30 rounded-full overflow-hidden shadow-inner">
                        <motion.div 
                          className="h-full rounded-full shadow-lg"
                          style={{ 
                            background: `linear-gradient(90deg, ${color.from}, ${color.to})`,
                            boxShadow: `0 2px 8px ${color.from}40`
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.1 }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="group relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-card via-card to-emerald-500/5 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:opacity-80 transition-opacity" />
            <CardHeader className="pb-2 relative">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-500/20">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                </div>
                <CardTitle className="text-base font-semibold">Por Produto</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-4 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
                {productDistribution.slice(0, 6).map((product, index) => {
                  const percentage = contracts.length > 0 ? (product.count / contracts.length) * 100 : 0;
                  
                  return (
                    <motion.div 
                      key={product.name} 
                      className="group/item"
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-semibold truncate flex-1 mr-2">{product.name}</span>
                        <div className="text-right shrink-0 flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className="text-xs font-bold px-2"
                            style={{ borderColor: `${product.color}50`, color: product.color }}
                          >
                            {product.count}×
                          </Badge>
                          <span className="text-xs font-bold" style={{ color: product.color }}>
                            {formatCurrency(product.value)}
                          </span>
                        </div>
                      </div>
                      <div className="h-3 bg-muted/30 rounded-full overflow-hidden shadow-inner">
                        <motion.div 
                          className="h-full rounded-full shadow-lg"
                          style={{ 
                            background: `linear-gradient(90deg, ${product.color}, ${product.color}cc)`,
                            boxShadow: `0 2px 8px ${product.color}40`
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.1 }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Revenue Chart */}
      <motion.div variants={itemVariants}>
        <Card className="group relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-card via-card to-emerald-500/5 backdrop-blur-sm hover:shadow-2xl transition-all duration-500">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:opacity-80 transition-opacity" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-emerald-500/10 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 opacity-30" />
          <CardHeader className="pb-2 relative">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-500/20">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <CardTitle className="text-base font-semibold">Valor de Novos Contratos</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValor" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22c55e"/>
                      <stop offset="50%" stopColor="#10b981"/>
                      <stop offset="100%" stopColor="#14b8a6"/>
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" vertical={false} />
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
                        <div className="bg-background/95 backdrop-blur-md border border-emerald-500/30 rounded-xl px-4 py-3 shadow-2xl shadow-emerald-500/20">
                          <p className="text-sm font-medium mb-1">{data?.fullMonth || label}</p>
                          <p className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">{formatCurrency(payload[0].value as number)}</p>
                        </div>
                      );
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="valorNovos" 
                    name="Valor" 
                    stroke="url(#colorValor)" 
                    strokeWidth={4}
                    filter="url(#glow)"
                    dot={{ fill: "#22c55e", strokeWidth: 3, stroke: "#fff", r: 6 }}
                    activeDot={{ r: 10, strokeWidth: 4, stroke: "#fff", fill: "#22c55e" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Customer Journey - Retention Analysis */}
      <motion.div variants={itemVariants}>
        <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-card via-card to-rose-500/5 backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-rose-500/10 via-orange-500/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-amber-500/10 via-rose-500/5 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          <CardHeader className="pb-3 relative">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 ring-1 ring-rose-500/30 shadow-lg shadow-rose-500/20">
                <Route className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Jornada de Retenção</CardTitle>
                <p className="text-xs text-muted-foreground">Tendência de desistência por mês de contrato</p>
              </div>
              {(() => {
                const peakMonth = customerJourneyData.reduce((max, current) => 
                  current.churned > max.churned ? current : max
                , customerJourneyData[0]);
                return peakMonth && peakMonth.churned > 0 ? (
                  <Badge className="ml-auto bg-gradient-to-r from-rose-500/20 to-orange-500/20 text-rose-600 border-rose-500/30 text-xs font-semibold px-3 py-1">
                    ⚠️ Pico: {peakMonth.label} mês ({peakMonth.churned} saídas)
                  </Badge>
                ) : null;
              })()}
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={customerJourneyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="journeyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#fb923c" stopOpacity={0.8}/>
                    </linearGradient>
                    <linearGradient id="journeyRateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#a855f7" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    className="text-xs" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    yAxisId="left"
                    className="text-xs" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    className="text-xs" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.[0]) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background/95 backdrop-blur-md border border-rose-500/30 rounded-xl px-4 py-3 shadow-2xl shadow-rose-500/20">
                          <p className="text-sm font-semibold mb-2">{label} mês de contrato</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                              <span className="text-xs text-muted-foreground">Desistências:</span>
                              <span className="text-sm font-bold text-rose-600">{data.churned}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                              <span className="text-xs text-muted-foreground">Taxa:</span>
                              <span className="text-sm font-bold text-violet-600">{data.rate.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar 
                    yAxisId="left"
                    dataKey="churned" 
                    name="Desistências" 
                    fill="url(#journeyGrad)" 
                    radius={[8, 8, 0, 0]} 
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="rate" 
                    name="Taxa %" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    dot={{ fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff", r: 4 }}
                    activeDot={{ r: 7, strokeWidth: 3, stroke: "#fff", fill: "#8b5cf6" }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10">
                <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 shadow-lg shadow-rose-500/50" />
                <span className="text-xs font-medium text-rose-600">Desistências</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10">
                <div className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-lg shadow-violet-500/50" />
                <span className="text-xs font-medium text-violet-600">Taxa de Saída (%)</span>
              </div>
            </div>
            
            {/* Insights por Trimestre */}
            <div className="grid grid-cols-4 gap-4 mt-6 pt-5 border-t border-border/30">
              {(() => {
                // Calculate total churn from the chart data to ensure consistency
                const totalChurn = customerJourneyData.reduce((sum, m) => sum + m.churned, 0);
                
                // Quarter 1: months 1-3
                const q1 = customerJourneyData.slice(0, 3).reduce((sum, m) => sum + m.churned, 0);
                // Quarter 2: months 4-6
                const q2 = customerJourneyData.slice(3, 6).reduce((sum, m) => sum + m.churned, 0);
                // Quarter 3: months 7-9
                const q3 = customerJourneyData.slice(6, 9).reduce((sum, m) => sum + m.churned, 0);
                // Quarter 4: months 10-12
                const q4 = customerJourneyData.slice(9, 12).reduce((sum, m) => sum + m.churned, 0);
                
                const quarters = [
                  { label: 'Q1', range: '1º-3º mês', value: q1, color: 'rose' },
                  { label: 'Q2', range: '4º-6º mês', value: q2, color: 'amber' },
                  { label: 'Q3', range: '7º-9º mês', value: q3, color: 'violet' },
                  { label: 'Q4', range: '10º-12º mês', value: q4, color: 'emerald' },
                ];
                
                const colorClasses: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
                  rose: { bg: 'from-rose-500/10 via-rose-500/5', border: 'border-rose-500/20 hover:border-rose-500/40', text: 'text-rose-500', gradient: 'from-rose-600 to-rose-500' },
                  amber: { bg: 'from-amber-500/10 via-amber-500/5', border: 'border-amber-500/20 hover:border-amber-500/40', text: 'text-amber-500', gradient: 'from-amber-600 to-amber-500' },
                  violet: { bg: 'from-violet-500/10 via-violet-500/5', border: 'border-violet-500/20 hover:border-violet-500/40', text: 'text-violet-500', gradient: 'from-violet-600 to-violet-500' },
                  emerald: { bg: 'from-emerald-500/10 via-emerald-500/5', border: 'border-emerald-500/20 hover:border-emerald-500/40', text: 'text-emerald-500', gradient: 'from-emerald-600 to-emerald-500' },
                };
                
                return quarters.map((q) => {
                  const classes = colorClasses[q.color];
                  const percentage = totalChurn > 0 ? ((q.value / totalChurn) * 100).toFixed(0) : 0;
                  
                  return (
                    <motion.div 
                      key={q.label}
                      className={`group relative text-center p-4 rounded-2xl bg-gradient-to-br ${classes.bg} to-transparent border ${classes.border} transition-all duration-300`}
                      whileHover={{ scale: 1.03 }}
                    >
                      <div className={`absolute inset-0 bg-${q.color}-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />
                      <p className={`text-3xl font-bold bg-gradient-to-r ${classes.gradient} bg-clip-text text-transparent`}>{q.value}</p>
                      <p className="text-xs text-muted-foreground font-medium mt-1">{q.range}</p>
                      <p className={`text-[10px] ${classes.text} mt-0.5`}>{percentage}% do churn</p>
                    </motion.div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
