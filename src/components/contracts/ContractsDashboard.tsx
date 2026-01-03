import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  PauseCircle,
  Ban,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
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
  Legend,
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
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  compra: "Compra",
  renovacao: "Renovação",
  migracao: "Migração",
  confissao_divida: "Confissão",
  termo_congelamento: "Congelamento",
  distrato: "Distrato",
};

export function ContractsDashboard({ contracts }: ContractsDashboardProps) {
  // Monthly evolution data (last 6 months)
  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      const newContracts = contracts.filter(c => {
        const created = parseISO(c.created_at);
        return isWithinInterval(created, { start: monthStart, end: monthEnd });
      });
      
      const cancelledContracts = contracts.filter(c => {
        if (c.status !== "cancelled" && c.status !== "ended") return false;
        const created = parseISO(c.created_at);
        return isWithinInterval(created, { start: monthStart, end: monthEnd });
      });
      
      const activeAtEnd = contracts.filter(c => {
        const created = parseISO(c.created_at);
        return created <= monthEnd && c.status === "active";
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
            status === "scheduled" ? "A Iniciar" : status,
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
    const color = isPositive ? "text-green-600" : value === 0 ? "text-muted-foreground" : "text-red-600";
    
    return (
      <span className={`flex items-center text-xs ${color}`}>
        <Icon className="h-3 w-3" />
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contratos Ativos</p>
                <p className="text-2xl font-bold">{kpis.totalActive}</p>
              </div>
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                +{kpis.newThisMonth} este mês
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor Total (MRR)</p>
                <p className="text-2xl font-bold">{formatCurrency(kpis.totalValue)}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                Ticket médio: {formatCurrency(kpis.averageTicket)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Retenção</p>
                <p className="text-2xl font-bold">{kpis.retentionRate.toFixed(1)}%</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="mt-2">
              {renderTrend(kpis.growthRate)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Churn</p>
                <p className="text-2xl font-bold text-red-600">{kpis.churnThisMonth}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                {kpis.churnRate.toFixed(1)}% este mês
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Evolution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data?.fullMonth || label;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="novos" name="Novos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cancelados" name="Cancelados" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="encerrados" name="Encerrados" fill="#64748b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Active Contracts Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Contratos Ativos (Tendência)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data?.fullMonth || label;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="ativos" 
                    name="Ativos" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {statusDistribution.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1 text-xs">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span>{entry.name}: {entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Type Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Por Tipo de Contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {typeDistribution.map((type, index) => {
                const percentage = (type.value / contracts.length) * 100;
                const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#64748b"];
                const color = colors[index % colors.length];
                
                return (
                  <div key={type.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{type.name}</span>
                      <span className="font-medium">{type.value}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ width: `${percentage}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Product Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Por Produto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[280px] overflow-y-auto">
              {productDistribution.slice(0, 8).map((product) => {
                const percentage = (product.count / contracts.length) * 100;
                
                return (
                  <div key={product.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="truncate flex-1 mr-2">{product.name}</span>
                      <span className="font-medium whitespace-nowrap">
                        {product.count} ({formatCurrency(product.value)})
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ width: `${percentage}%`, backgroundColor: product.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Valor de Novos Contratos por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis 
                  className="text-xs" 
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [formatCurrency(value), "Valor"]}
                  labelFormatter={(label, payload) => {
                    const data = payload?.[0]?.payload;
                    return data?.fullMonth || label;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="valorNovos" 
                  name="Valor" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  dot={{ fill: "#22c55e", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
