import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusIndicator, QuadrantIndicator, TrendIndicator } from "@/components/ui/status-indicator";
import { ScoreBadge } from "@/components/ui/score-badge";
import { VNPSBadge } from "@/components/ui/vnps-badge";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import {
  Users,
  AlertTriangle,
  TrendingUp,
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
  DollarSign,
  Filter,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, addYears, isBefore, isSameDay, startOfMonth, endOfMonth, subMonths, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { ChurnReportSection } from "@/components/dashboard/ChurnReportSection";
import { AIUsageStats } from "@/components/dashboard/AIUsageStats";
import { GroupEngagementReport } from "@/components/dashboard/GroupEngagementReport";
import { ROIEventsFeed } from "@/components/dashboard/ROIEventsFeed";
import { LiveParticipationReport } from "@/components/dashboard/LiveParticipationReport";

interface ContractData {
  id: string;
  status: string;
  status_changed_at: string | null;
  start_date: string;
  value: number;
  client_id: string;
}

interface ClientWithScore {
  id: string;
  full_name: string;
  phone_e164: string;
  status: "active" | "paused" | "churn_risk" | "churned" | "no_contract";
  roizometer: number;
  escore: number;
  quadrant: "highE_lowROI" | "lowE_highROI" | "lowE_lowROI" | "highE_highROI";
  trend: "up" | "flat" | "down";
  last_risk?: string;
  recommendation?: string;
  vnps_score?: number;
  vnps_class?: "promoter" | "neutral" | "detractor";
  product_ids?: string[];
  hasActiveContract?: boolean;
}

interface Product {
  id: string;
  name: string;
}

interface LifeEvent {
  id: string;
  client_id: string;
  client_name: string;
  event_type: string;
  title: string;
  event_date: string | null;
  is_recurring: boolean;
  source: string;
}

interface ROIStats {
  totalROIEvents: number;
  tangibleCount: number;
  intangibleCount: number;
  highImpactCount: number;
  recentCategories: { category: string; count: number }[];
}

interface RiskStats {
  totalRiskEvents: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
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
  const [clients, setClients] = useState<ClientWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [quadrantFilter, setQuadrantFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<LifeEvent[]>([]);
  const [roiStats, setROIStats] = useState<ROIStats | null>(null);
  const [riskStats, setRiskStats] = useState<RiskStats | null>(null);
  const [contractData, setContractData] = useState<ContractData[]>([]);
  const [gestaoProductFilter, setGestaoProductFilter] = useState<string>("all");
  const [gestaoPeriodFilter, setGestaoPeriodFilter] = useState<string>("6");
  const [gestaoCustomDateRange, setGestaoCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [gestaoDatePickerOpen, setGestaoDatePickerOpen] = useState(false);

  // Check onboarding status
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!currentUser?.account_id) return;
      
      const { data } = await supabase
        .from("account_settings")
        .select("onboarding_completed")
        .eq("account_id", currentUser.account_id)
        .single();
      
      if (data && !data.onboarding_completed) {
        navigate("/onboarding");
      }
    };
    
    checkOnboarding();
  }, [currentUser?.account_id, navigate]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (clientsError) throw clientsError;

      // Fetch all client_products at once for efficiency
      const { data: clientProductsData } = await supabase
        .from("client_products")
        .select("client_id, product_id");

      // Fetch all active contracts to determine which clients have active contracts
      const { data: activeContractsData } = await supabase
        .from("client_contracts")
        .select("client_id")
        .eq("status", "active");

      // Create a set of client_ids with active contracts
      const clientsWithActiveContracts = new Set<string>();
      (activeContractsData || []).forEach((contract: any) => {
        clientsWithActiveContracts.add(contract.client_id);
      });

      // Create a map of client_id -> product_ids
      const clientProductsMap: Record<string, string[]> = {};
      (clientProductsData || []).forEach((cp: any) => {
        if (!clientProductsMap[cp.client_id]) {
          clientProductsMap[cp.client_id] = [];
        }
        clientProductsMap[cp.client_id].push(cp.product_id);
      });

      const clientsWithScores: ClientWithScore[] = await Promise.all(
        (clientsData || []).map(async (client) => {
          const { data: scoreData } = await supabase
            .from("score_snapshots")
            .select("*")
            .eq("client_id", client.id)
            .order("computed_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const { data: vnpsData } = await supabase
            .from("vnps_snapshots")
            .select("vnps_score, vnps_class")
            .eq("client_id", client.id)
            .order("computed_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const { data: riskData } = await supabase
            .from("risk_events")
            .select("reason")
            .eq("client_id", client.id)
            .order("happened_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const { data: recData } = await supabase
            .from("recommendations")
            .select("action_text")
            .eq("client_id", client.id)
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: client.id,
            full_name: client.full_name,
            phone_e164: client.phone_e164,
            status: client.status as ClientWithScore["status"],
            roizometer: scoreData?.roizometer ?? 0,
            escore: scoreData?.escore ?? 0,
            quadrant: (scoreData?.quadrant as ClientWithScore["quadrant"]) ?? "lowE_lowROI",
            trend: (scoreData?.trend as ClientWithScore["trend"]) ?? "flat",
            last_risk: riskData?.reason,
            recommendation: recData?.action_text,
            vnps_score: vnpsData?.vnps_score,
            vnps_class: vnpsData?.vnps_class as ClientWithScore["vnps_class"],
            product_ids: clientProductsMap[client.id] || [],
            hasActiveContract: clientsWithActiveContracts.has(client.id),
          };
        })
      );

      setClients(clientsWithScores);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingEvents = async () => {
    try {
      const { data: eventsData, error } = await supabase
        .from("client_life_events")
        .select("*, clients!inner(full_name)")
        .not("event_date", "is", null)
        .order("event_date", { ascending: true });

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcoming = (eventsData || [])
        .map((event: any) => {
          const eventDate = new Date(event.event_date);
          let nextDate = new Date(eventDate);
          
          if (event.is_recurring) {
            nextDate.setFullYear(today.getFullYear());
            if (isBefore(nextDate, today)) {
              nextDate = addYears(nextDate, 1);
            }
          }
          
          const daysUntil = differenceInDays(nextDate, today);
          
          return {
            ...event,
            client_name: event.clients?.full_name || "Cliente",
            daysUntil,
            nextDate,
          };
        })
        .filter((e: any) => e.daysUntil >= 0 && e.daysUntil <= 30)
        .sort((a: any, b: any) => a.daysUntil - b.daysUntil)
        .slice(0, 10);

      setUpcomingEvents(upcoming);
    } catch (error) {
      console.error("Error fetching life events:", error);
    }
  };

  const fetchROIStats = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: roiEvents, error } = await supabase
        .from("roi_events")
        .select("roi_type, category, impact")
        .gte("happened_at", thirtyDaysAgo.toISOString());

      if (error) throw error;

      const categoryCount: Record<string, number> = {};
      let tangible = 0;
      let intangible = 0;
      let highImpact = 0;

      (roiEvents || []).forEach((e: any) => {
        if (e.roi_type === "tangible") tangible++;
        else intangible++;
        if (e.impact === "high") highImpact++;
        categoryCount[e.category] = (categoryCount[e.category] || 0) + 1;
      });

      const recentCategories = Object.entries(categoryCount)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setROIStats({
        totalROIEvents: roiEvents?.length || 0,
        tangibleCount: tangible,
        intangibleCount: intangible,
        highImpactCount: highImpact,
        recentCategories,
      });
    } catch (error) {
      console.error("Error fetching ROI stats:", error);
    }
  };

  const fetchRiskStats = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: riskEvents, error } = await supabase
        .from("risk_events")
        .select("risk_level")
        .gte("happened_at", thirtyDaysAgo.toISOString());

      if (error) throw error;

      let high = 0, medium = 0, low = 0;
      (riskEvents || []).forEach((e: any) => {
        if (e.risk_level === "high") high++;
        else if (e.risk_level === "medium") medium++;
        else low++;
      });

      setRiskStats({
        totalRiskEvents: riskEvents?.length || 0,
        highRiskCount: high,
        mediumRiskCount: medium,
        lowRiskCount: low,
      });
    } catch (error) {
      console.error("Error fetching risk stats:", error);
    }
  };

  const fetchContractData = async () => {
    try {
      const twelveMonthsAgo = subMonths(new Date(), 12);
      
      const { data, error } = await supabase
        .from("client_contracts")
        .select("id, status, status_changed_at, start_date, value, client_id")
        .or(`start_date.gte.${format(twelveMonthsAgo, "yyyy-MM-dd")},status_changed_at.gte.${twelveMonthsAgo.toISOString()}`)
        .order("start_date", { ascending: true });

      if (error) throw error;
      setContractData(data || []);
    } catch (error) {
      console.error("Error fetching contract data:", error);
    }
  };

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
      // Filter by period
      const contractDate = contract.status_changed_at 
        ? parseISO(contract.status_changed_at) 
        : parseISO(contract.start_date);
      if (contractDate < periodStart || contractDate > periodEnd) return false;
      
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
    const months: { [key: string]: { month: string; novos: number; cancelamentos: number; encerramentos: number; congelamentos: number } } = {};
    
    // Calculate the number of months to show
    const monthsDiff = Math.max(1, Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    
    // Initialize months based on period
    for (let i = monthsDiff - 1; i >= 0; i--) {
      const date = subMonths(periodEnd, i);
      const key = format(date, "yyyy-MM");
      const label = format(date, "MMM/yy", { locale: ptBR });
      if (!months[key]) {
        months[key] = { month: label, novos: 0, cancelamentos: 0, encerramentos: 0, congelamentos: 0 };
      }
    }
    
    filteredContractData.forEach((contract) => {
      // Count new contracts by start_date
      if (contract.start_date) {
        const startDate = parseISO(contract.start_date);
        const startKey = format(startDate, "yyyy-MM");
        if (months[startKey] && contract.status === "active") {
          months[startKey].novos++;
        }
      }
      
      // Count status changes
      if (contract.status_changed_at && contract.status !== "active") {
        const date = parseISO(contract.status_changed_at);
        const key = format(date, "yyyy-MM");
        
        if (months[key]) {
          if (contract.status === "churned") {
            months[key].cancelamentos++;
          } else if (contract.status === "ended") {
            months[key].encerramentos++;
          } else if (contract.status === "paused") {
            months[key].congelamentos++;
          }
        }
      }
    });
    
    return Object.values(months);
  }, [filteredContractData, gestaoPeriodRange]);

  // Calculate retention metrics
  const retentionMetrics = useMemo(() => {
    const currentMonth = monthlyChartData[monthlyChartData.length - 1];
    const lastMonth = monthlyChartData[monthlyChartData.length - 2];
    
    if (!currentMonth) return { rate: 0, trend: 'flat' as const, novos: 0, saidas: 0 };
    
    const novos = currentMonth.novos;
    const saidas = currentMonth.cancelamentos + currentMonth.encerramentos + currentMonth.congelamentos;
    const netChange = novos - saidas;
    
    // Calculate rate: positive means growth, negative means churn
    const rate = saidas > 0 ? Math.round((novos / saidas) * 100) : (novos > 0 ? 100 : 0);
    
    // Compare with last month
    let trend: 'up' | 'flat' | 'down' = 'flat';
    if (lastMonth) {
      const lastSaidas = lastMonth.cancelamentos + lastMonth.encerramentos + lastMonth.congelamentos;
      const lastRate = lastSaidas > 0 ? Math.round((lastMonth.novos / lastSaidas) * 100) : (lastMonth.novos > 0 ? 100 : 0);
      if (rate > lastRate) trend = 'up';
      else if (rate < lastRate) trend = 'down';
    }
    
    return { rate, trend, novos, saidas, netChange };
  }, [monthlyChartData]);

  // Calculate lost financial value and counts from cancelled and ended contracts
  const lostFinancialValue = useMemo(() => {
    const currentMonthStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(new Date());
    const previousMonthStart = startOfMonth(subMonths(new Date(), 1));
    const previousMonthEnd = endOfMonth(subMonths(new Date(), 1));
    
    let totalLost = 0;
    let cancelamentosValue = 0;
    let demissoesValue = 0;
    let cancelamentosCount = 0;
    let demissoesCount = 0;
    let previousTotalLost = 0;
    
    // Use contractData instead of filtered for consistent period comparison
    contractData.forEach((contract) => {
      if (contract.status_changed_at) {
        const changedAt = parseISO(contract.status_changed_at);
        
        // Current month
        if (changedAt >= currentMonthStart && changedAt <= currentMonthEnd) {
          if (contract.status === "churned") {
            cancelamentosValue += contract.value || 0;
            cancelamentosCount++;
          } else if (contract.status === "ended") {
            demissoesValue += contract.value || 0;
            demissoesCount++;
          }
        }
        
        // Previous month
        if (changedAt >= previousMonthStart && changedAt <= previousMonthEnd) {
          if (contract.status === "churned" || contract.status === "ended") {
            previousTotalLost += contract.value || 0;
          }
        }
      }
    });
    
    totalLost = cancelamentosValue + demissoesValue;
    
    // Calculate trend
    let trend: 'up' | 'flat' | 'down' = 'flat';
    let percentChange = 0;
    if (previousTotalLost > 0) {
      percentChange = Math.round(((totalLost - previousTotalLost) / previousTotalLost) * 100);
      if (totalLost < previousTotalLost) trend = 'down'; // Less loss is good
      else if (totalLost > previousTotalLost) trend = 'up'; // More loss is bad
    } else if (totalLost > 0) {
      trend = 'up';
      percentChange = 100;
    }
    
    return { totalLost, cancelamentosValue, demissoesValue, cancelamentosCount, demissoesCount, previousTotalLost, trend, percentChange };
  }, [contractData]);

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
    congelamentos: {
      label: "Congelamentos",
      color: "hsl(38 92% 50%)",
    },
  };

  useEffect(() => {
    fetchProducts();
    fetchClients();
    fetchUpcomingEvents();
    fetchROIStats();
    fetchRiskStats();
    fetchContractData();

    // Real-time subscription for client changes
    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clients",
        },
        () => {
          fetchClients();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_products",
        },
        () => {
          fetchClients();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_contracts",
        },
        () => {
          fetchContractData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone_e164.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || client.status === statusFilter;
    const matchesQuadrant = quadrantFilter === "all" || client.quadrant === quadrantFilter;
    const matchesProduct = productFilter === "all" || (client.product_ids?.includes(productFilter) ?? false);
    return matchesSearch && matchesStatus && matchesQuadrant && matchesProduct;
  });

  const totalClients = clients.length;
  const churnRiskCount = clients.filter((c) => c.status === "churn_risk" || c.status === "churned").length;
  const promoterCount = clients.filter((c) => c.vnps_class === "promoter").length;
  const detractorCount = clients.filter((c) => c.vnps_class === "detractor").length;
  const avgROI = clients.length > 0 ? Math.round(clients.reduce((acc, c) => acc + c.roizometer, 0) / clients.length) : 0;
  const avgEScore = clients.length > 0 ? Math.round(clients.reduce((acc, c) => acc + c.escore, 0) / clients.length) : 0;

  const topRiskClients = [...clients]
    .filter((c) => c.status === "churn_risk" || c.status === "churned")
    .sort((a, b) => a.roizometer - b.roizometer)
    .slice(0, 5);

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      revenue: "Receita",
      cost: "Custos",
      time: "Tempo",
      process: "Processos",
      clarity: "Clareza",
      confidence: "Confiança",
      tranquility: "Tranquilidade",
      status_direction: "Direção",
    };
    return labels[cat] || cat;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Visão geral do seu negócio</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchClients(); fetchUpcomingEvents(); fetchROIStats(); fetchRiskStats(); fetchContractData(); }} disabled={loading}>
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
            <TabsTrigger value="gestao" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Gestão</span>
            </TabsTrigger>
            <TabsTrigger value="cx" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>CX</span>
            </TabsTrigger>
            <TabsTrigger value="roi" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>ROI</span>
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

        {/* ROI Tab */}
        <TabsContent value="roi" className="space-y-6">
          {/* ROI Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="shadow-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">ROIzômetro Médio</p>
                    <p className="text-3xl font-bold text-foreground">{avgROI}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Eventos ROI (30d)</p>
                    <p className="text-3xl font-bold text-foreground">{roiStats?.totalROIEvents || 0}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Eventos de Risco (30d)</p>
                    <p className="text-3xl font-bold text-danger">{riskStats?.totalRiskEvents || 0}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-danger/10 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-danger" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Alto Impacto</p>
                    <p className="text-3xl font-bold text-primary">{roiStats?.highImpactCount || 0}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Star className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ROI Events Feed - Full Width */}
          <ROIEventsFeed />
        </TabsContent>

        {/* CX Tab */}
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
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Relatório de Participação em Eventos
            </h3>
            <LiveParticipationReport />
          </div>

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
              {products.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum produto cadastrado.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {products.map((product) => {
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
          <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 md:grid-cols-5">
            {/* Total de Clientes */}
            <Card className="shadow-card border-l-4 border-l-primary">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total Clientes</p>
                    <p className="text-2xl font-bold text-foreground">{gestaoClientStats.total}</p>
                  </div>
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </CardContent>
            </Card>

            {/* Ativos */}
            <Card className="shadow-card border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Ativos</p>
                    <p className="text-2xl font-bold text-green-600">{gestaoClientStats.active}</p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
              </CardContent>
            </Card>

            {/* Cancelamentos */}
            <Card className="shadow-card border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Cancelamentos</p>
                    <p className="text-2xl font-bold text-red-600">{gestaoClientStats.churned}</p>
                  </div>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
              </CardContent>
            </Card>

            {/* Demissões (Encerramentos) */}
            <Card className="shadow-card border-l-4 border-l-orange-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Encerramentos</p>
                    <p className="text-2xl font-bold text-orange-600">{lostFinancialValue.demissoesCount}</p>
                    <p className="text-xs text-muted-foreground">no mês atual</p>
                  </div>
                  <TrendingDown className="h-5 w-5 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            {/* Congelamentos */}
            <Card className="shadow-card border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Congelamentos</p>
                    <p className="text-2xl font-bold text-amber-600">{gestaoClientStats.paused}</p>
                  </div>
                  <Minus className="h-5 w-5 text-amber-500" />
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
                  <CardDescription className="mt-1">Novos, cancelamentos, encerramentos e congelamentos nos últimos 6 meses</CardDescription>
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
                    <linearGradient id="congelamentosGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(38 92% 40%)" stopOpacity={0.8} />
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
                    dataKey="congelamentos" 
                    fill="url(#congelamentosGradient)" 
                    radius={[6, 6, 0, 0]} 
                    name="Congelamentos"
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Retention Rate Card */}
            <Card className={`shadow-card border-l-4 ${retentionMetrics.rate >= 100 ? 'border-l-green-500' : retentionMetrics.rate >= 50 ? 'border-l-amber-500' : 'border-l-red-500'}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Taxa de Retenção</p>
                    <div className="flex items-center gap-2">
                      <p className={`text-3xl font-bold ${retentionMetrics.rate >= 100 ? 'text-green-600' : retentionMetrics.rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {retentionMetrics.rate}%
                      </p>
                      {retentionMetrics.trend === 'up' && <TrendingUp className="h-5 w-5 text-green-500" />}
                      {retentionMetrics.trend === 'down' && <TrendingDown className="h-5 w-5 text-red-500" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {retentionMetrics.novos} novos vs {retentionMetrics.saidas} saídas (mês atual)
                    </p>
                  </div>
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center ${retentionMetrics.rate >= 100 ? 'bg-green-100 dark:bg-green-900/30' : retentionMetrics.rate >= 50 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    <Target className={`h-6 w-6 ${retentionMetrics.rate >= 100 ? 'text-green-600' : retentionMetrics.rate >= 50 ? 'text-amber-600' : 'text-red-600'}`} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Loss Card */}
            <Card className="shadow-card border-l-4 border-l-red-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Valor Perdido (Mês Atual)</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-red-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lostFinancialValue.totalLost)}
                      </p>
                      {lostFinancialValue.trend === 'down' && <TrendingDown className="h-5 w-5 text-green-500" />}
                      {lostFinancialValue.trend === 'up' && <TrendingUp className="h-5 w-5 text-red-500" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cancelamentos: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lostFinancialValue.cancelamentosValue)} | 
                      Demissões: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lostFinancialValue.demissoesValue)}
                    </p>
                    <p className={`text-xs mt-1 ${lostFinancialValue.trend === 'down' ? 'text-green-600' : lostFinancialValue.trend === 'up' ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {lostFinancialValue.trend === 'down' && `↓ ${Math.abs(lostFinancialValue.percentChange)}% vs mês anterior`}
                      {lostFinancialValue.trend === 'up' && `↑ ${lostFinancialValue.percentChange}% vs mês anterior`}
                      {lostFinancialValue.trend === 'flat' && 'Sem alteração vs mês anterior'}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </TabsContent>
      </Tabs>
    </div>
  );
}
