import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, Mail, Clock, XCircle, BarChart3, CheckCircle, CalendarDays, ChevronDown, User, Filter, RotateCcw, ZoomIn } from "lucide-react";
import { ZoomControls } from "@/components/ui/zoom-controls";
import { SharedVisualCard } from "@/components/insights/visuals/SharedVisualCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DrilldownRecord } from "@/hooks/useVisualDrilldown";
import { useIsMobile } from "@/hooks/use-mobile";

type Status = "loading" | "invalid" | "inactive" | "email_prompt" | "pending" | "rejected" | "approved";

type DatePreset = "today" | "week" | "month" | "quarter" | "year" | "last_month" | "custom";

interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

interface VisualItem {
  id: string;
  dashboard_id: string;
  title: string | null;
  chart_type: string | null;
  config: unknown;
  layout: { x: number; y: number; w: number; h: number; scale?: number; col_span?: string } | null;
}

interface FilterOption {
  id: string;
  name: string;
}

interface DashboardData {
  dashboard: { id: string; name: string } | null;
  visuals: VisualItem[];
  visualsData: Record<string, { data: AggregatedDataPoint[]; drilldownData?: DrilldownRecord[] }>;
  filterOptions?: { users: FilterOption[]; products: FilterOption[] };
}

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta Semana" },
  { value: "month", label: "Este Mês" },
  { value: "last_month", label: "Mês Passado" },
  { value: "quarter", label: "Este Trimestre" },
  { value: "year", label: "Este Ano" },
];

function getDateRangeFromPreset(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "today": return { start: startOfDay(now), end: endOfDay(now) };
    case "week": return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
    case "month": return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month": { const lm = subMonths(now, 1); return { start: startOfMonth(lm), end: endOfMonth(lm) }; }
    case "quarter": return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "year": return { start: startOfYear(now), end: endOfYear(now) };
    default: return { start: startOfYear(now), end: endOfYear(now) };
  }
}

export default function SharedInsights() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState(() => localStorage.getItem("shared_insights_email") || "");
  const [emailInput, setEmailInput] = useState("");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filter state
  const [preset, setPresetState] = useState<DatePreset>("year");
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [userId, setUserId] = useState("all");
  const [productId, setProductId] = useState("all");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [zoom, setZoom] = useState(80);

  const dateRange = useMemo(() => {
    if (preset === "custom" && customRange.from && customRange.to) {
      return { start: startOfDay(customRange.from), end: endOfDay(customRange.to) };
    }
    return getDateRangeFromPreset(preset);
  }, [preset, customRange]);

  const dateLabel = useMemo(() => {
    if (preset !== "custom") {
      return PRESETS.find(p => p.value === preset)?.label || "Este Ano";
    }
    if (customRange.from && customRange.to) {
      return `${format(customRange.from, "dd/MM/yy", { locale: ptBR })} - ${format(customRange.to, "dd/MM/yy", { locale: ptBR })}`;
    }
    return "Personalizado";
  }, [preset, customRange]);

  const hasActiveFilters = userId !== "all" || productId !== "all" || preset !== "year";

  const callEdgeFunction = useCallback(async (action: string, extraBody: Record<string, any> = {}) => {
    const res = await supabase.functions.invoke("shared-insights", {
      body: { action, token, ...extraBody },
    });
    return res;
  }, [token]);

  // Fetch filtered data
  const fetchFilteredData = useCallback(async () => {
    if (status !== "approved" || !email) return;
    setFiltersLoading(true);
    try {
      const { data, error } = await callEdgeFunction("fetch_filtered_data", {
        email,
        filters: {
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString(),
          userId,
          productId,
        },
      });
      if (!error && data?.visualsData) {
        setDashboardData(prev => prev ? { ...prev, visualsData: data.visualsData } : prev);
      }
    } finally {
      setFiltersLoading(false);
    }
  }, [status, email, dateRange, userId, productId, callEdgeFunction]);

  // Re-fetch when filters change (skip during initial load since initial data is already filtered)
  const [initialLoad, setInitialLoad] = useState(true);
  useEffect(() => {
    if (initialLoad) return;
    fetchFilteredData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customRange, userId, productId]);

  // Initial validation
  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }

    const init = async () => {
      const { data, error } = await callEdgeFunction("validate");
      
      if (error || !data?.valid) {
        if (data?.error === "inactive") {
          setStatus("inactive");
          setErrorMessage(data?.message || "Link desativado");
        } else {
          setStatus("invalid");
          setErrorMessage(data?.message || "Link inválido");
        }
        return;
      }

      const storedEmail = localStorage.getItem("shared_insights_email");
      if (storedEmail) {
        setEmail(storedEmail);
        await checkAccess(storedEmail);
      } else {
        setStatus("email_prompt");
      }
    };

    init();
  }, [token]);

  const getDefaultDateFilters = useCallback(() => {
    const range = getDateRangeFromPreset("year");
    return {
      startDate: range.start.toISOString(),
      endDate: range.end.toISOString(),
      userId: "all",
      productId: "all",
    };
  }, []);

  const loadDashboard = useCallback(async (emailToLoad: string, filters = getDefaultDateFilters()) => {
    const { data, error } = await callEdgeFunction("load_dashboard", {
      email: emailToLoad,
      filters,
    });

    if (error || !data || data.status !== "approved") {
      return false;
    }

    setDashboardData({
      dashboard: data.dashboard,
      visuals: data.visuals,
      visualsData: data.visualsData || {},
      filterOptions: data.filterOptions,
    });
    setStatus("approved");
    setInitialLoad(false);
    setErrorMessage("");
    return true;
  }, [callEdgeFunction, getDefaultDateFilters]);

  const checkAccess = async (emailToCheck: string) => {
    setStatus("loading");
    const defaultFilters = getDefaultDateFilters();
    const { data, error } = await callEdgeFunction("check_access", {
      email: emailToCheck,
      filters: defaultFilters,
    });

    if (error || !data) {
      setStatus("email_prompt");
      return;
    }

    if (data.status === "approved") {
      const loaded = await loadDashboard(emailToCheck, defaultFilters);
      if (!loaded) {
        setStatus("pending");
        setErrorMessage("Seu acesso foi liberado, mas o painel ainda está carregando. Aguarde alguns segundos.");
      }
    } else if (data.status === "rejected") {
      setStatus("rejected");
    } else if (data.status === "pending") {
      setStatus("pending");
    } else {
      setStatus("email_prompt");
    }
  };

  const requestAccess = async () => {
    if (!emailInput.trim()) return;
    setSubmitting(true);
    
    const normalizedEmail = emailInput.trim().toLowerCase();
    localStorage.setItem("shared_insights_email", normalizedEmail);
    setEmail(normalizedEmail);

    const defaultFilters = getDefaultDateFilters();
    const { data, error } = await callEdgeFunction("request_access", { email: normalizedEmail, filters: defaultFilters });
    setSubmitting(false);

    if (error || !data) {
      setErrorMessage("Erro ao solicitar acesso. Tente novamente.");
      return;
    }

    if (data.status === "approved") {
      const loaded = await loadDashboard(normalizedEmail, defaultFilters);
      if (!loaded) {
        setStatus("pending");
        setErrorMessage("Seu acesso foi liberado, mas o painel ainda está carregando. Aguarde alguns segundos.");
      }
    } else if (data.status === "rejected") {
      setStatus("rejected");
    } else {
      setStatus("pending");
    }
  };

  // Poll for approval when pending
  useEffect(() => {
    if (status !== "pending" || !email) return;
    const interval = setInterval(async () => {
      await checkAccess(email);
    }, 10000);
    return () => clearInterval(interval);
  }, [status, email]);

  // Render states
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "invalid" || status === "inactive") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Link indisponível</h2>
            <p className="text-muted-foreground text-sm">
              {status === "inactive" 
                ? "Este link de compartilhamento foi desativado pelo proprietário." 
                : "Este link não existe ou expirou."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "email_prompt") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Acesso ao Painel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Informe seu e-mail para acessar este painel. Se já foi aprovado anteriormente, o painel será exibido automaticamente.
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="seu@email.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && requestAccess()}
                disabled={submitting}
              />
              <Button onClick={requestAccess} disabled={submitting || !emailInput.trim()}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              </Button>
            </div>
            {errorMessage && (
              <p className="text-sm text-destructive text-center">{errorMessage}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <Clock className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-semibold">Aguardando aprovação</h2>
            <p className="text-muted-foreground text-sm">
              Sua solicitação foi enviada para <strong>{email}</strong>. O proprietário do painel precisa aprovar seu acesso.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Verificando automaticamente...
            </div>
            {errorMessage && (
              <p className="text-xs text-muted-foreground">{errorMessage}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Acesso negado</h2>
            <p className="text-muted-foreground text-sm">
              O proprietário recusou o acesso ao painel para <strong>{email}</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Approved — show dashboard with real visuals
  if (status === "approved" && dashboardData) {
    const { visuals, visualsData, filterOptions } = dashboardData;
    const users = filterOptions?.users || [];
    const products = filterOptions?.products || [];
    const selectedUser = users.find(u => u.id === userId);
    const selectedProduct = products.find(p => p.id === productId);

    const handlePresetSelect = (p: DatePreset) => {
      setPresetState(p);
    };

    const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
      if (range) {
        setCustomRange({ from: range.from, to: range.to });
        if (range.from && range.to) {
          setPresetState("custom");
          setDatePickerOpen(false);
        }
      }
    };

    const resetFilters = () => {
      setPresetState("year");
      setUserId("all");
      setProductId("all");
      setCustomRange({ from: undefined, to: undefined });
    };

    return (
      <div className="min-h-screen bg-background">
        <div className="border-b px-6 py-4 flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">{dashboardData.dashboard?.name || "Painel Compartilhado"}</h1>
          <span className="ml-auto flex items-center gap-3">
            <ZoomControls zoom={zoom} onZoomChange={setZoom} min={50} max={250} step={10} />
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              Somente leitura
            </span>
          </span>
        </div>

        {/* Filter Bar */}
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {/* Date Filter */}
            {!datePickerOpen ? (
              <DropdownMenu open={dateDropdownOpen} onOpenChange={setDateDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 shrink-0">
                    <CalendarDays className="h-4 w-4" />
                    {dateLabel}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {PRESETS.map((p) => (
                    <DropdownMenuItem
                      key={p.value}
                      onClick={() => handlePresetSelect(p.value)}
                      className={cn(preset === p.value && "bg-accent")}
                    >
                      {p.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setDateDropdownOpen(false);
                      setTimeout(() => setDatePickerOpen(true), 100);
                    }}
                  >
                    Personalizado...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 shrink-0">
                    <CalendarDays className="h-4 w-4" />
                    {dateLabel}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customRange.from || new Date()}
                    selected={customRange}
                    onSelect={handleDateSelect}
                    numberOfMonths={2}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}

            {/* Date range display */}
            {preset !== "custom" && (
              <span className="text-sm text-muted-foreground hidden md:inline shrink-0">
                {format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })} - {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
              </span>
            )}

            <div className="h-4 w-px bg-border mx-1 hidden md:block shrink-0" />

            {/* User Filter */}
            {users.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant={userId !== "all" ? "secondary" : "outline"} size="sm" className="gap-2 shrink-0">
                    <User className="h-4 w-4" />
                    {selectedUser?.name || "Todos os Vendedores"}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-64 overflow-auto">
                  <DropdownMenuItem onClick={() => setUserId("all")} className={cn(userId === "all" && "bg-accent")}>
                    Todos os Vendedores
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {users.map((user) => (
                    <DropdownMenuItem
                      key={user.id}
                      onClick={() => setUserId(user.id)}
                      className={cn(userId === user.id && "bg-accent")}
                    >
                      {user.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Product Filter */}
            {products.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant={productId !== "all" ? "secondary" : "outline"} size="sm" className="gap-2 shrink-0">
                    <Filter className="h-4 w-4" />
                    {selectedProduct?.name || "Todos os Produtos"}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-64 overflow-auto">
                  <DropdownMenuItem onClick={() => setProductId("all")} className={cn(productId === "all" && "bg-accent")}>
                    Todos os Produtos
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {products.map((product) => (
                    <DropdownMenuItem
                      key={product.id}
                      onClick={() => setProductId(product.id)}
                      className={cn(productId === product.id && "bg-accent")}
                    >
                      {product.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Reset */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-2 text-muted-foreground shrink-0">
                <RotateCcw className="h-4 w-4" />
                Limpar
              </Button>
            )}

            {/* Loading indicator */}
            {filtersLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
            )}
          </div>
        </div>

        <div className="p-4 text-[14px] overflow-auto">
          <div style={{
            zoom: zoom / 100,
            transformOrigin: 'top left',
          }}>
            {visuals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-4 opacity-30" />
                <p>Este painel ainda não possui visuais.</p>
              </div>
            ) : (
              <SharedVisualsGrid visuals={visuals} visualsData={visualsData} />
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Grid Layout for Shared Visuals ──────────────────────────────────────────

function getMinHeight(chartType: string): number {
  if (["number", "scorecard", "kpi"].includes(chartType)) return 120;
  if (["table", "ranking", "data_table"].includes(chartType)) return 300;
  if (chartType === "map") return 400;
  if (chartType === "gauge") return 200;
  if (chartType === "funnel") return 360;
  return 280;
}

function isGauge(visual: VisualItem) {
  return visual.chart_type === "gauge";
}

function isScorecard(visual: VisualItem) {
  return ["number", "scorecard", "kpi"].includes(visual.chart_type || "bar");
}

interface SharedVisualRow {
  visuals: VisualItem[];
  isAllScorecards: boolean;
  isAllCompact: boolean;
}

function groupVisualsIntoRows(visuals: VisualItem[]): SharedVisualRow[] {
  if (visuals.length === 0) return [];

  const allScorecards = visuals.filter(isScorecard);
  const allGauges = visuals.filter(isGauge);
  const regularVisuals = visuals.filter((visual) => !isScorecard(visual) && !isGauge(visual));
  const rows: SharedVisualRow[] = [];

  if (allScorecards.length > 0) {
    rows.push({
      visuals: allScorecards.sort((a, b) => (a.layout?.x ?? 0) - (b.layout?.x ?? 0)),
      isAllScorecards: true,
      isAllCompact: true,
    });
  }

  if (allGauges.length > 0) {
    rows.push({
      visuals: allGauges.sort((a, b) => (a.layout?.x ?? 0) - (b.layout?.x ?? 0)),
      isAllScorecards: false,
      isAllCompact: true,
    });
  }

  if (regularVisuals.length > 0) {
    const sorted = [...regularVisuals].sort((a, b) => {
      const ay = a.layout?.y ?? 0;
      const by = b.layout?.y ?? 0;
      if (ay !== by) return ay - by;
      return (a.layout?.x ?? 0) - (b.layout?.x ?? 0);
    });

    let currentRow: VisualItem[] = [sorted[0]];
    let currentY = sorted[0].layout?.y ?? 0;

    for (let i = 1; i < sorted.length; i++) {
      const visualY = sorted[i].layout?.y ?? 0;
      if (Math.abs(visualY - currentY) <= 5) {
        currentRow.push(sorted[i]);
      } else {
        rows.push({
          visuals: currentRow,
          isAllScorecards: false,
          isAllCompact: false,
        });
        currentRow = [sorted[i]];
        currentY = visualY;
      }
    }

    rows.push({
      visuals: currentRow,
      isAllScorecards: false,
      isAllCompact: false,
    });
  }

  return rows;
}

function SharedVisualsGrid({
  visuals,
  visualsData,
}: {
  visuals: VisualItem[];
  visualsData: Record<string, { data: AggregatedDataPoint[]; drilldownData?: DrilldownRecord[] }>;
}) {
  const isMobile = useIsMobile();

  const sortedVisuals = [...visuals].sort((a, b) => {
    const ay = a.layout?.y ?? 0;
    const by = b.layout?.y ?? 0;
    if (ay !== by) return ay - by;
    return (a.layout?.x ?? 0) - (b.layout?.x ?? 0);
  });

  const rows = groupVisualsIntoRows(visuals);

  if (isMobile) {
    return (
      <div className="space-y-3">
        {sortedVisuals.map((visual) => {
          const vData = visualsData[visual.id];
          const data = vData?.data || [];
          const drilldownData = vData?.drilldownData || [];
          const chartType = visual.chart_type || "bar";

          return (
            <div
              key={visual.id}
              className="w-full rounded-lg overflow-hidden"
              style={{ minHeight: getMinHeight(chartType) }}
            >
              <SharedVisualCard
                visual={visual}
                data={data}
                drilldownData={drilldownData}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, rowIndex) => {
        const shouldNotWrap = row.isAllScorecards || row.isAllCompact;
        const totalWidth = row.visuals.reduce((sum, visual) => sum + (visual.layout?.w ?? 24), 0);

        return (
          <div
            key={rowIndex}
            className="flex gap-3"
            style={{ flexWrap: shouldNotWrap ? "nowrap" : "wrap" }}
          >
            {row.visuals.map((visual) => {
              const vData = visualsData[visual.id];
              const data = vData?.data || [];
              const drilldownData = vData?.drilldownData || [];
              const chartType = visual.chart_type || "bar";
              const visualWidth = visual.layout?.w ?? 24;
              const visualColSpan = visual.layout?.col_span;
              const flexGrow = shouldNotWrap
                ? visualColSpan === "1/2"
                  ? 2
                  : visualColSpan === "1/3"
                    ? 1.33
                    : 1
                : 1;

              const flexStyle = shouldNotWrap
                ? {
                    flex: `${flexGrow} 1 0`,
                    minWidth: 0,
                    minHeight: getMinHeight(chartType),
                  }
                : {
                    flex: `1 1 ${(visualWidth / totalWidth) * 100}%`,
                    minWidth: 300,
                    minHeight: getMinHeight(chartType),
                    maxWidth: "100%" as const,
                  };

              return (
                <div
                  key={visual.id}
                  className="overflow-hidden rounded-lg"
                  style={flexStyle}
                >
                  <SharedVisualCard
                    visual={visual}
                    data={data}
                    drilldownData={drilldownData}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
