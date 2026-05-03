import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { usePersistedFilter } from "@/hooks/usePersistedFilter";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDashboardContractStats } from "@/hooks/useDashboardContractStats";
import { useDoubleChairCount } from "@/hooks/useDoubleChairCount";
import { useQuery } from "@tanstack/react-query";
import { ContractsDashboard } from "@/components/contracts/ContractsDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import {
  Clock,
  Users,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Search,
  Plus,
  ArrowRight,
  RefreshCw,
  Target,
  Heart,
  Settings2,
  Cake,
  Baby,
  GraduationCap,
  Trophy,
  Calendar,
  Bell,
  Star,
  Briefcase,
  Plane,
  Sparkles,
  MessageSquare,
  TrendingDown,
  Minus,
  BarChart3,
  Eye,
  EyeOff,
  Filter,
  Video,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, addYears, isBefore, isSameDay, startOfMonth, endOfMonth, subMonths, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { ZoomControls } from "@/components/ui/zoom-controls";
import { ChurnReportSection } from "@/components/dashboard/ChurnReportSection";
import { AIUsageStats } from "@/components/dashboard/AIUsageStats";
import { GroupEngagementReport } from "@/components/dashboard/GroupEngagementReport";
import { CancellationAnalyticsModal, canAccessCancellationAnalytics } from "@/components/dashboard/CancellationAnalyticsModal";




interface ContractData {
  id: string;
  status: string;
  status_changed_at: string | null;
  cancelled_at: string | null;
  start_date: string;
  value: number;
  client_id: string;
}

interface ContractDataDashboard {
  id: string;
  status: string;
  status_changed_at: string | null;
  cancelled_at: string | null;
  start_date: string;
  value: number;
  client_id: string;
}

const EVENT_TYPE_ICONS: Record<string, any> = {
  birthday: Cake,
  child_birth: Baby,
  pregnancy: Baby,
  wedding: Heart,
  anniversary: Heart,
  graduation: GraduationCap,
  new_job: Briefcase,
  promotion: TrendingUp,
  travel: Plane,
  achievement: Trophy,
  celebration: Star,
  other: Calendar,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  
  // Use optimized hook for all dashboard data
  const { 
    products, 
    clients, 
    upcomingEvents, 
    contractData, 
    isLoading: loading, 
    refetchAll 
  } = useDashboardData();

  // Hide renewal-only / deprecated products from "Clientes por Produto" cards
  const HIDDEN_PRODUCT_NAMES = ["Ren. Rykas Mentoring", "Ren. Eternum Club", "Ren. Eternum Private", "Rykas Pass", "Consultoria Premium"];
  const visibleProducts = useMemo(
    () => products.filter((p: any) => !HIDDEN_PRODUCT_NAMES.includes((p.name ?? "").trim())),
    [products],
  );

  // Contract stats from RPC for accurate Gestão metrics
  const { data: contractStats, refetch: refetchContractStats } = useDashboardContractStats(currentUser?.account_id);
  const { data: doubleChairCount } = useDoubleChairCount(currentUser?.account_id);

  // Contracts data for the Contratos tab (exclude renewals to avoid duplicates)
  // Optimized: limit to 500 most recent + paginated fetch for full data
  const { data: dashboardContracts = [] } = useQuery({
    queryKey: ["dashboard-contracts-full"],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const all: any[] = [];
      let from = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from("client_contracts")
          .select(`
            id, client_id, start_date, end_date, cancelled_at, value, status, contract_type, created_at,
            product:products(id, name, color)
          `)
          .is("parent_contract_id", null)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        hasMore = data.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }
      
      return all;
    },
    staleTime: 1000 * 60 * 5,
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);
  const showCancellationAnalytics = canAccessCancellationAnalytics(currentUser?.id);
  
  const [gestaoProductFilter, setGestaoProductFilter] = useState<string>("all");
  const [gestaoPeriodFilter, setGestaoPeriodFilter] = useState<string>("6");
  const [gestaoCustomDateRange, setGestaoCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [gestaoDatePickerOpen, setGestaoDatePickerOpen] = useState(false);
  const [gestaoViewMode, setGestaoViewMode] = useState<"operacoes" | "comercial">("operacoes");

  // Focus mode states
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [focusZoom, setFocusZoom] = useState(100);
  const focusModeRef = useRef<HTMLDivElement>(null);

  // ESC key listener for focus mode
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isFocusMode]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement && focusModeRef.current) {
      await focusModeRef.current.requestFullscreen();
    } else if (document.exitFullscreen) {
      await document.exitFullscreen();
    }
  };

  // Check onboarding status (skip for external/viewer users)
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!currentUser?.account_id) return;
      if (currentUser?.role === "viewer") return;
      
      const { data } = await supabase
        .from("account_settings")
        .select("onboarding_completed")
        .eq("account_id", currentUser.account_id)
        .maybeSingle();
      
      if (data && !data.onboarding_completed) {
        navigate("/onboarding");
      }
    };
    
    checkOnboarding();
  }, [currentUser?.account_id, currentUser?.role, navigate]);


  // Get client to products mapping
  const clientProductsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    clients.forEach(client => {
      map[client.id] = client.product_ids || [];
    });
    return map;
  }, [clients]);

  // Calculate period start/end based on filter type
  const gestaoPeriodRange = useMemo(() => {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date = now;
    
    switch (gestaoPeriodFilter) {
      case "month":
        periodStart = startOfMonth(now);
        periodEnd = endOfMonth(now);
        break;
      case "7":
        periodStart = subDays(now, 7);
        break;
      case "custom":
        if (gestaoCustomDateRange?.from) {
          periodStart = gestaoCustomDateRange.from;
          periodEnd = gestaoCustomDateRange.to || gestaoCustomDateRange.from;
        } else {
          periodStart = subMonths(now, 6);
        }
        break;
      default:
        const months = parseInt(gestaoPeriodFilter);
        periodStart = subMonths(now, months);
    }
    
    return { periodStart, periodEnd };
  }, [gestaoPeriodFilter, gestaoCustomDateRange]);

  // Filter contract data by product and period
  const filteredContractData = useMemo(() => {
    const { periodStart, periodEnd } = gestaoPeriodRange;
    
    return contractData.filter(contract => {
      // Include contract if ANY relevant date falls within the period
      const startDate = contract.start_date ? parseISO(contract.start_date) : null;
      const exitDate = contract.cancelled_at 
        ? parseISO(contract.cancelled_at)
        : contract.status_changed_at
          ? parseISO(contract.status_changed_at)
          : null;

      const startInPeriod = startDate && startDate >= periodStart && startDate <= periodEnd;
      const exitInPeriod = exitDate && exitDate >= periodStart && exitDate <= periodEnd;

      if (!startInPeriod && !exitInPeriod) return false;

      // Filter by product
      if (gestaoProductFilter !== "all") {
        const clientProducts = clientProductsMap[contract.client_id] || [];
        if (!clientProducts.includes(gestaoProductFilter)) return false;
      }

      return true;
    });
  }, [contractData, gestaoProductFilter, gestaoPeriodRange, clientProductsMap]);

  // Calculate monthly chart data including new clients
  const monthlyChartData = useMemo(() => {
    const { periodStart, periodEnd } = gestaoPeriodRange;
    const months: { [key: string]: { month: string; novos: number; cancelamentos: number; encerramentos: number; suspensos: number; pausados: number } } = {};
    
    // Calculate the number of months to show
    const monthsDiff = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    
    // Initialize months based on period
    for (let i = monthsDiff - 1; i >= 0; i--) {
      const date = subMonths(periodEnd, i);
      const key = format(date, "yyyy-MM");
      const label = format(date, "MMM/yy", { locale: ptBR });
      if (!months[key]) {
        months[key] = { month: label, novos: 0, cancelamentos: 0, encerramentos: 0, suspensos: 0, pausados: 0 };
      }
    }
    
    filteredContractData.forEach((contract) => {
      // Count new contracts by start_date - ALL contracts, regardless of current status
      if (contract.start_date) {
        const startDate = parseISO(contract.start_date);
        const startKey = format(startDate, "yyyy-MM");
        if (months[startKey]) {
          months[startKey].novos++;
        }
      }
      
      // Count exits using cancelled_at (fallback to status_changed_at)
      const exitDate = contract.cancelled_at || contract.status_changed_at;
      if (exitDate && contract.status !== "active" && contract.status !== "pending") {
        const date = parseISO(exitDate);
        const key = format(date, "yyyy-MM");
        
        if (months[key]) {
          if (["cancelled", "dismissed", "dropout_7d"].includes(contract.status)) {
            months[key].cancelamentos++;
          } else if (contract.status === "ended") {
            months[key].encerramentos++;
          } else if (contract.status === "suspended") {
            months[key].suspensos++;
          } else if (contract.status === "paused") {
            months[key].pausados++;
          }
        }
      }
    });
    
    return Object.values(months);
  }, [filteredContractData, gestaoPeriodRange]);


  // Filter clients by gestaoProductFilter for status cards
  const gestaoFilteredClients = useMemo(() => {
    if (gestaoProductFilter === "all") return clients;
    return clients.filter(c => c.product_ids?.includes(gestaoProductFilter));
  }, [clients, gestaoProductFilter]);

  const gestaoClientStats = useMemo(() => ({
    total: gestaoFilteredClients.length,
    active: gestaoFilteredClients.filter(c => c.hasActiveContract === true).length,
    churned: gestaoFilteredClients.filter(c => c.status === "churned").length,
    churnRisk: gestaoFilteredClients.filter(c => c.status === "churn_risk").length,
    paused: gestaoFilteredClients.filter(c => c.status === "paused").length,
  }), [gestaoFilteredClients]);

  // Retention metrics
  const retentionMetrics = useMemo(() => {
    if (monthlyChartData.length === 0) return { rate: 0, novos: 0, cancelamentos: 0 };
    const currentMonth = monthlyChartData[monthlyChartData.length - 1];
    const novos = currentMonth?.novos || 0;
    const cancelamentos = currentMonth?.cancelamentos || 0;
    const total = (contractStats?.active ?? gestaoClientStats.active) + cancelamentos;
    const rate = total > 0 ? Math.round(((total - cancelamentos) / total) * 100) : 100;
    return { rate, novos, cancelamentos };
  }, [monthlyChartData, contractStats, gestaoClientStats]);

  // Lost financial value
  const lostFinancialValue = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    const lostContracts = contractData.filter(contract => {
      if (!["cancelled", "dismissed", "dropout_7d", "ended"].includes(contract.status)) return false;
      const exitDate = contract.cancelled_at || contract.status_changed_at;
      if (!exitDate) return false;
      const date = parseISO(exitDate);
      return date >= monthStart && date <= monthEnd;
    });

    const totalLost = lostContracts.reduce((sum, c) => sum + (c.value || 0), 0);
    const cancelledValue = lostContracts
      .filter(c => ["cancelled", "dismissed", "dropout_7d"].includes(c.status))
      .reduce((sum, c) => sum + (c.value || 0), 0);
    const endedValue = lostContracts
      .filter(c => c.status === "ended")
      .reduce((sum, c) => sum + (c.value || 0), 0);

    return { totalLost, cancelledValue, endedValue, count: lostContracts.length };
  }, [contractData]);

  const chartConfig = {
    novos: {
      label: "Novos",
      color: "hsl(var(--success))",
    },
    cancelamentos: {
      label: "Cancelamentos",
      color: "hsl(var(--danger))",
    },
    encerramentos: {
      label: "Encerramentos",
      color: "hsl(25 95% 53%)",
    },
    suspensos: {
      label: "Suspensos",
      color: "hsl(38 92% 50%)",
    },
    pausados: {
      label: "Pausados",
      color: "hsl(200 80% 50%)",
    },
  };

  // Debounced real-time subscription for client changes (filtered by account_id)
  useEffect(() => {
    if (!currentUser?.account_id) return;
    
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => refetchAll(), 2000);
    };
    
    const accountFilter = `account_id=eq.${currentUser.account_id}`;
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients", filter: accountFilter }, debouncedRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "client_contracts", filter: accountFilter }, debouncedRefetch)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [refetchAll, currentUser?.account_id]);


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Visão geral do seu negócio</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGestaoViewMode(prev => prev === "operacoes" ? "comercial" : "operacoes")}
            title={gestaoViewMode === "operacoes" ? "Mudar para visual Comercial" : "Mudar para visual Operações"}
          >
            {gestaoViewMode === "operacoes" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            <span className="hidden sm:inline ml-2">{gestaoViewMode === "operacoes" ? "Operações" : "Comercial"}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFocusMode(true)}
            title="Modo Foco (ideal para TV)"
          >
            <Maximize2 className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Modo Foco</span>
          </Button>
          <Button variant="outline" size="sm" onClick={refetchAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline ml-2">Atualizar</span>
          </Button>
          <Button asChild size="sm">
            <Link to="/clients/new">
              <Plus className="h-4 w-4" />
              <span className="hidden xs:inline ml-2">Novo Cliente</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="gestao" className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <TabsList className="grid w-full grid-cols-3 max-w-sm sm:max-w-md h-9 sm:h-10">
            <TabsTrigger value="gestao" className="gap-1.5 text-xs sm:text-sm">
              <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Gestão</span>
            </TabsTrigger>
            <TabsTrigger value="contratos" className="gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Contratos</span>
            </TabsTrigger>
            <TabsTrigger value="cx" className="gap-1.5 text-xs sm:text-sm">
              <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>CX</span>
            </TabsTrigger>
          </TabsList>

          {/* Filters - aligned with tabs */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 scrollbar-thin">
            <div className="flex items-center gap-1.5 text-muted-foreground flex-shrink-0">
              <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm font-medium hidden xs:inline">Filtros:</span>
            </div>
            <Select value={gestaoProductFilter} onValueChange={setGestaoProductFilter}>
              <SelectTrigger className="w-[130px] sm:w-[160px] h-8 sm:h-9 text-xs sm:text-sm flex-shrink-0">
                <SelectValue placeholder="Produtos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os produtos</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select 
              value={gestaoPeriodFilter} 
              onValueChange={(value) => {
                setGestaoPeriodFilter(value);
                if (value === "custom") {
                  setGestaoDatePickerOpen(true);
                }
              }}
            >
              <SelectTrigger className="w-[120px] sm:w-[150px] h-8 sm:h-9 text-xs sm:text-sm flex-shrink-0">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {gestaoPeriodFilter === "custom" && (
              <Popover open={gestaoDatePickerOpen} onOpenChange={setGestaoDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 justify-start text-left font-normal"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {gestaoCustomDateRange?.from ? (
                      gestaoCustomDateRange.to ? (
                        <>
                          {format(gestaoCustomDateRange.from, "dd/MM", { locale: ptBR })} -{" "}
                          {format(gestaoCustomDateRange.to, "dd/MM", { locale: ptBR })}
                        </>
                      ) : (
                        format(gestaoCustomDateRange.from, "dd/MM/yy", { locale: ptBR })
                      )
                    ) : (
                      <span className="text-muted-foreground">Período</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={gestaoCustomDateRange?.from}
                    selected={gestaoCustomDateRange}
                    onSelect={setGestaoCustomDateRange}
                    numberOfMonths={2}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}
            {(gestaoProductFilter !== "all" || gestaoPeriodFilter !== "6" || gestaoCustomDateRange) && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setGestaoProductFilter("all");
                  setGestaoPeriodFilter("6");
                  setGestaoCustomDateRange(undefined);
                }}
                className="h-9 text-muted-foreground hover:text-foreground"
              >
                Limpar
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="cx" className="space-y-6">
          {/* CX Stats Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="shadow-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Momentos CX Próximos</p>
                    <p className="text-3xl font-bold text-primary">{upcomingEvents.length}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bell className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Aniversários</p>
                    <p className="text-3xl font-bold text-foreground">
                      {upcomingEvents.filter(e => e.event_type === "birthday").length}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-pink-500/10 flex items-center justify-center">
                    <Cake className="h-6 w-6 text-pink-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Detectados por IA</p>
                    <p className="text-3xl font-bold text-foreground">
                      {upcomingEvents.filter(e => e.source === "ai_detected").length}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-violet-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Upcoming Life Events */}
          <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Próximos Momentos CX</CardTitle>
                </div>
                <CardDescription>Eventos importantes dos próximos 30 dias</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum momento CX próximo. Cadastre aniversários e datas importantes dos seus clientes!
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {upcomingEvents.map((event: any) => {
                      const Icon = EVENT_TYPE_ICONS[event.event_type] || Calendar;
                      return (
                        <Link
                          key={event.id}
                          to={`/clients/${event.client_id}`}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                        >
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{event.title}</p>
                            <p className="text-xs text-muted-foreground">{event.client_name}</p>
                            {event.nextDate && (
                              <p className="text-xs text-muted-foreground">
                                {format(event.nextDate, "dd 'de' MMMM", { locale: ptBR })}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {event.source === "ai_detected" && (
                              <Badge variant="outline" className="gap-1 text-xs border-primary/50 text-primary">
                                <Sparkles className="h-3 w-3" />
                                IA
                              </Badge>
                            )}
                            <Badge variant={event.daysUntil === 0 ? "default" : event.daysUntil <= 7 ? "secondary" : "outline"}>
                              {event.daysUntil === 0 ? "Hoje!" : event.daysUntil === 1 ? "Amanhã" : `${event.daysUntil} dias`}
                            </Badge>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

          {/* Live Participation Report */}

          {/* Group Engagement Report */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Engajamento em Grupos
            </h3>
            <GroupEngagementReport />
          </div>
        </TabsContent>


        {/* Gestão Tab */}
        <TabsContent value="gestao" className="space-y-6">
          {/* Clients per Product */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Clientes por Produto
              </CardTitle>
              <CardDescription>Distribuição em tempo real</CardDescription>
            </CardHeader>
            <CardContent>
              {visibleProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum produto cadastrado.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visibleProducts.map((product) => {
                    const clientCount = clients.filter(c => c.product_ids?.includes(product.id)).length;
                    return (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Target className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{product.name}</p>
                            <p className="text-xs text-muted-foreground">Clientes ativos</p>
                          </div>
                        </div>
                        <span className="text-2xl font-bold text-primary">{clientCount}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Cards - Single Row */}
          <div className={`grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 ${gestaoViewMode === "operacoes" ? "md:grid-cols-7" : "md:grid-cols-3"}`}>
            {/* Total de Clientes (oculto no modo operações) */}
            {gestaoViewMode !== "operacoes" && (
            <Card className="shadow-card border-l-4 border-l-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total Clientes</p>
                    <p className="text-2xl font-bold text-foreground">{contractStats?.total_clients ?? gestaoClientStats.total}</p>
                  </div>
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </CardContent>
            </Card>
            )}

            {/* Cadeira Dupla — vínculos com sync_data ativos (cada par conta como 1) */}
            <Link to="/dashboard/cadeira-dupla" className="block">
              <Card className="shadow-card border-l-4 border-l-pink-500 cursor-pointer hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Cadeira Dupla</p>
                      <p className="text-2xl font-bold text-pink-600">{doubleChairCount ?? 0}</p>
                    </div>
                    <Heart className="h-5 w-5 text-pink-500" />
                  </div>
                </CardContent>
              </Card>
            </Link>


            {/* Ativos */}
            <Card className="shadow-card border-l-4 border-l-success">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Ativos</p>
                    <p className="text-2xl font-bold text-success">{contractStats?.active ?? gestaoClientStats.active}</p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
              </CardContent>
            </Card>

            {/* Cancelamentos */}
            {gestaoViewMode === "operacoes" && (
            <Card 
              className={`shadow-card border-l-4 border-l-danger ${showCancellationAnalytics ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
              onClick={showCancellationAnalytics ? () => setCancellationModalOpen(true) : undefined}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Cancelamentos</p>
                    <p className="text-2xl font-bold text-danger">{contractStats?.cancelled ?? 0}</p>
                  </div>
                  <AlertTriangle className="h-5 w-5 text-danger" />
                </div>
              </CardContent>
            </Card>
            )}

            {/* Encerramentos */}
            {gestaoViewMode === "operacoes" && (
            <Card className="shadow-card border-l-4 border-l-warning">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Encerramentos</p>
                    <p className="text-2xl font-bold text-warning">{contractStats?.ended ?? 0}</p>
                  </div>
                  <TrendingDown className="h-5 w-5 text-warning" />
                </div>
              </CardContent>
            </Card>
            )}

            {/* Suspensos */}
            {gestaoViewMode === "operacoes" && (
            <Card className="shadow-card border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Suspensos</p>
                    <p className="text-2xl font-bold text-amber-600">{contractStats?.suspended ?? 0}</p>
                  </div>
                  <Minus className="h-5 w-5 text-amber-500" />
                </div>
              </CardContent>
            </Card>
            )}

            {/* Pausados */}
            {gestaoViewMode === "operacoes" && (
            <Card className="shadow-card border-l-4 border-l-sky-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Pausados</p>
                    <p className="text-2xl font-bold text-sky-600">{contractStats?.paused ?? 0}</p>
                  </div>
                  <Minus className="h-5 w-5 text-sky-500" />
                </div>
              </CardContent>
            </Card>
            )}

            {/* Vencidos (active + end_date < today) */}
            <Card className="shadow-card border-l-4 border-l-orange-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Vencidos</p>
                    <p className="text-2xl font-bold text-orange-600">{contractStats?.expired ?? 0}</p>
                  </div>
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
              </CardContent>
            </Card>
           </div>

          {/* Historical Chart */}
          <Card className="shadow-card overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-primary" />
                    </div>
                    Evolução Mensal
                  </CardTitle>
                  <CardDescription className="mt-1">{gestaoViewMode === "operacoes" ? "Novos, cancelamentos, encerramentos, suspensos e pausados nos últimos 6 meses" : "Novos contratos nos últimos 6 meses"}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer config={chartConfig} className="h-[250px] sm:h-[320px] w-full">
                <BarChart 
                  data={monthlyChartData} 
                  margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
                  barCategoryGap="20%"
                >
                  <defs>
                    <linearGradient id="novosGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142 76% 46%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(142 76% 36%)" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="cancelamentosGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(0 84% 60%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(0 84% 50%)" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="encerramentosGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(25 95% 53%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(25 95% 43%)" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="suspensosGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(38 92% 40%)" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="pausadosGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(200 80% 50%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(200 80% 40%)" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false} 
                    stroke="hsl(var(--border))" 
                    strokeOpacity={0.5}
                  />
                  <XAxis 
                    dataKey="month" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    dy={10}
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    allowDecimals={false}
                    dx={-5}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />} 
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                  />
                  <Bar 
                    dataKey="novos" 
                    fill="url(#novosGradient)" 
                    radius={[6, 6, 0, 0]} 
                    name="Novos"
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                  {gestaoViewMode === "operacoes" && (
                    <>
                      <Bar 
                        dataKey="cancelamentos" 
                        fill="url(#cancelamentosGradient)" 
                        radius={[6, 6, 0, 0]} 
                        name="Cancelamentos"
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                      <Bar 
                        dataKey="encerramentos" 
                        fill="url(#encerramentosGradient)" 
                        radius={[6, 6, 0, 0]} 
                        name="Encerramentos"
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                      <Bar 
                        dataKey="suspensos" 
                        fill="url(#suspensosGradient)" 
                        radius={[6, 6, 0, 0]} 
                        name="Suspensos"
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                      <Bar 
                        dataKey="pausados" 
                        fill="url(#pausadosGradient)" 
                        radius={[6, 6, 0, 0]} 
                        name="Pausados"
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                    </>
                  )}
                  <Legend 
                    wrapperStyle={{ paddingTop: 20 }}
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-sm text-muted-foreground ml-1">{value}</span>}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Retention & Financial Loss Row */}
          {gestaoViewMode === "operacoes" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Taxa de Retenção */}
              <Card className="shadow-card">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Taxa de Retenção</p>
                      <p className="text-3xl font-bold text-foreground">{retentionMetrics.rate}%</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {retentionMetrics.novos} novos · {retentionMetrics.cancelamentos} cancelamentos (mês atual)
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  {/* Visual indicator */}
                  <div className="mt-3 w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        retentionMetrics.rate >= 90 ? "bg-success" : retentionMetrics.rate >= 70 ? "bg-warning" : "bg-danger"
                      }`}
                      style={{ width: `${retentionMetrics.rate}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Valor Perdido */}
              <Card className="shadow-card">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Valor Perdido (Mês Atual)</p>
                      <p className="text-3xl font-bold text-danger">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lostFinancialValue.totalLost)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {lostFinancialValue.count} contratos · Cancel.: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lostFinancialValue.cancelledValue)} · Encerr.: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lostFinancialValue.endedValue)}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-danger/10 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-danger" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        </TabsContent>

        {/* Contratos Tab */}
        <TabsContent value="contratos" className="space-y-6">
          <ContractsDashboard contracts={dashboardContracts} />
        </TabsContent>
      </Tabs>

      {/* Focus Mode Overlay */}
      {isFocusMode && createPortal(
        <div ref={focusModeRef} className="fixed inset-0 z-[9999] bg-background overflow-auto">
          <div className="px-8 py-6 mx-auto max-w-[95vw]">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold">Dashboard Operacional</h2>
              <div className="flex items-center gap-3">
                <ZoomControls zoom={focusZoom} onZoomChange={setFocusZoom} />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-5 w-5" />
                  ) : (
                    <Maximize2 className="h-5 w-5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFocusMode(false)}
                  className="hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div style={{ zoom: focusZoom / 100 }}>
            {/* Clientes por Produto */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {visibleProducts.map((product) => {
                const clientCount = clients.filter(c => c.product_ids?.includes(product.id)).length;
                return (
                  <Card key={product.id}>
                    <CardContent className="p-8">
                      <div className="flex items-center gap-5">
                        <div className="p-4 rounded-xl bg-primary/10">
                          <Target className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                          <p className="text-base text-muted-foreground">{product.name}</p>
                          <p className="text-4xl font-bold">{clientCount}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Status Cards */}
            <div className={`grid grid-cols-2 sm:grid-cols-3 ${gestaoViewMode === "operacoes" ? "md:grid-cols-7" : "md:grid-cols-3"} gap-6 mb-8`}>
              {gestaoViewMode !== "operacoes" && (
              <Card className="border-l-4 border-l-primary">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Clientes</p>
                      <p className="text-4xl font-bold">{contractStats?.total_clients ?? gestaoClientStats.total}</p>
                    </div>
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
              )}

              <Card className="border-l-4 border-l-pink-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Cadeira Dupla</p>
                      <p className="text-4xl font-bold text-pink-600">{doubleChairCount ?? 0}</p>
                    </div>
                    <Heart className="h-8 w-8 text-pink-500" />
                  </div>
                </CardContent>
              </Card>


              <Card className="border-l-4 border-l-success">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Ativos</p>
                      <p className="text-4xl font-bold text-success">{contractStats?.active ?? gestaoClientStats.active}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-success" />
                  </div>
                </CardContent>
              </Card>

              {gestaoViewMode === "operacoes" && (
              <Card className="border-l-4 border-l-destructive">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Cancelamentos</p>
                      <p className="text-4xl font-bold text-destructive">{contractStats?.cancelled ?? 0}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                  </div>
                </CardContent>
              </Card>
              )}

              {gestaoViewMode === "operacoes" && (
              <Card className="border-l-4 border-l-warning">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Encerramentos</p>
                      <p className="text-4xl font-bold text-warning">{contractStats?.ended ?? 0}</p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-warning" />
                  </div>
                </CardContent>
              </Card>
              )}

              {gestaoViewMode === "operacoes" && (
              <Card className="border-l-4 border-l-amber-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Suspensos</p>
                      <p className="text-4xl font-bold text-amber-600">{contractStats?.suspended ?? 0}</p>
                    </div>
                    <Minus className="h-8 w-8 text-amber-500" />
                  </div>
                </CardContent>
              </Card>
              )}

              {gestaoViewMode === "operacoes" && (
              <Card className="border-l-4 border-l-sky-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Pausados</p>
                      <p className="text-4xl font-bold text-sky-600">{contractStats?.paused ?? 0}</p>
                    </div>
                    <Minus className="h-8 w-8 text-sky-500" />
                  </div>
                </CardContent>
              </Card>
              )}

              <Card className="border-l-4 border-l-orange-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Vencidos</p>
                      <p className="text-4xl font-bold text-orange-600">{contractStats?.expired ?? 0}</p>
                    </div>
                    <Clock className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Evolução Mensal Chart */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  Evolução Mensal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[350px] w-full">
                  <BarChart data={monthlyChartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }} barCategoryGap="20%">
                    <defs>
                      <linearGradient id="focusNovosGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(142 76% 46%)" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(142 76% 36%)" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="focusCancelamentosGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(0 84% 60%)" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(0 84% 50%)" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="focusEncerramentosGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(25 95% 53%)" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(25 95% 43%)" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="focusSuspensosGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(38 92% 40%)" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="focusPausadosGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(200 80% 50%)" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(200 80% 40%)" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 14, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 14, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                    <Bar dataKey="novos" fill="url(#focusNovosGradient)" radius={[6, 6, 0, 0]} name="Novos" />
                    {gestaoViewMode === "operacoes" && (
                      <>
                        <Bar dataKey="cancelamentos" fill="url(#focusCancelamentosGradient)" radius={[6, 6, 0, 0]} name="Cancelamentos" />
                        <Bar dataKey="encerramentos" fill="url(#focusEncerramentosGradient)" radius={[6, 6, 0, 0]} name="Encerramentos" />
                        <Bar dataKey="suspensos" fill="url(#focusSuspensosGradient)" radius={[6, 6, 0, 0]} name="Suspensos" />
                        <Bar dataKey="pausados" fill="url(#focusPausadosGradient)" radius={[6, 6, 0, 0]} name="Pausados" />
                      </>
                    )}
                    <Legend wrapperStyle={{ paddingTop: 20 }} iconType="circle" iconSize={10} formatter={(value) => <span className="text-base text-muted-foreground ml-1">{value}</span>} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Focus Mode: Retention & Financial Loss */}
            {gestaoViewMode === "operacoes" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Taxa de Retenção</p>
                        <p className="text-4xl font-bold">{retentionMetrics.rate}%</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {retentionMetrics.novos} novos · {retentionMetrics.cancelamentos} cancel. (mês atual)
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-primary" />
                    </div>
                    <div className="mt-3 w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          retentionMetrics.rate >= 90 ? "bg-success" : retentionMetrics.rate >= 70 ? "bg-warning" : "bg-danger"
                        }`}
                        style={{ width: `${retentionMetrics.rate}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Valor Perdido (Mês Atual)</p>
                        <p className="text-4xl font-bold text-danger">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lostFinancialValue.totalLost)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {lostFinancialValue.count} contratos
                        </p>
                      </div>
                      <DollarSign className="h-8 w-8 text-danger" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            </div>
          </div>
        </div>,
        document.body
      )}

      {showCancellationAnalytics && (
        <CancellationAnalyticsModal 
          open={cancellationModalOpen} 
          onOpenChange={setCancellationModalOpen} 
        />
      )}
    </div>
  );
}
