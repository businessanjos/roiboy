import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Loader2, Mail, Clock, ShieldCheck, ShieldX, CalendarDays, ChevronDown, User, Filter, RotateCcw } from "lucide-react";
import { SharedVisualCard } from "@/components/insights/visuals/SharedVisualCard";
import GridLayout from "react-grid-layout";
import { getCompactor } from "react-grid-layout/core";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
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
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, startOfQuarter, endOfQuarter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const freePositionCompactor = getCompactor(null, true, false);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type ViewState = "loading" | "email_form" | "pending" | "approved" | "rejected" | "error";
type DatePreset = "today" | "week" | "month" | "last_month" | "quarter" | "year" | "custom";

interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SharedFilters {
  preset: DatePreset;
  startDate: string;
  endDate: string;
  userId: string;
  productId: string;
}

interface FilterOption {
  id: string;
  name: string;
}

const ROW_HEIGHT = 20;
const COLS = 48;

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta Semana" },
  { value: "month", label: "Este Mês" },
  { value: "last_month", label: "Mês Passado" },
  { value: "quarter", label: "Este Trimestre" },
  { value: "year", label: "Este Ano" },
];

function getPresetDates(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "today": return { start: now, end: now };
    case "week": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "month": return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month": { const lm = subMonths(now, 1); return { start: startOfMonth(lm), end: endOfMonth(lm) }; }
    case "quarter": return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "year":
    default:
      return { start: startOfYear(now), end: endOfYear(now) };
  }
}

function getDefaultFilters(): SharedFilters {
  const { start, end } = getPresetDates("year");
  return {
    preset: "year",
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    userId: "all",
    productId: "all",
  };
}

function getPresetLabel(preset: DatePreset): string {
  return PRESETS.find(p => p.value === preset)?.label || "Personalizado";
}

function visualToLayoutItem(visual: any, index: number): LayoutItem {
  const layout = visual.layout;
  if (layout) {
    if (layout.scale === 48) {
      return { i: visual.id, x: layout.x, y: layout.y, w: layout.w, h: layout.h };
    }
    return { i: visual.id, x: layout.x * 4, y: layout.y * 5, w: layout.w * 4, h: layout.h * 5 };
  }
  return { i: visual.id, x: (index % 2) * 26, y: Math.floor(index / 2) * 27, w: 24, h: 25 };
}

export default function SharedInsightsDashboard() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ViewState>("loading");
  const [email, setEmail] = useState(() => localStorage.getItem(`shared-dash-email-${token}`) || "");
  const [dashboardName, setDashboardName] = useState("");
  const [dashboard, setDashboard] = useState<any>(null);
  const [visuals, setVisuals] = useState<any[]>([]);
  const [visualsData, setVisualsData] = useState<Record<string, AggregatedDataPoint[]>>({});
  const [stackedVisualsData, setStackedVisualsData] = useState<Record<string, { data: any[]; seriesKeys: string[] }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const [filters, setFilters] = useState<SharedFilters>(getDefaultFilters);
  const [filterOptions, setFilterOptions] = useState<{ users: FilterOption[]; products: FilterOption[] }>({ users: [], products: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dateRange, setDateRangeLocal] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(filters.startDate),
    to: new Date(filters.endDate),
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setGridWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [state]);

  const callEdge = useCallback(
    async (method: string, path: string, body?: any) => {
      const url = `${SUPABASE_URL}/functions/v1/shared-dashboard${path}`;
      const opts: RequestInit = {
        method,
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(url, opts);
      return res.json();
    },
    []
  );

  const buildFilterQuery = useCallback((baseEmail: string, filterState: SharedFilters) => {
    let path = `?token=${token}&email=${encodeURIComponent(baseEmail)}`;
    path += `&startDate=${filterState.startDate}&endDate=${filterState.endDate}`;
    if (filterState.userId !== "all") path += `&userId=${filterState.userId}`;
    if (filterState.productId !== "all") path += `&productId=${filterState.productId}`;
    return path;
  }, [token]);

  const fetchApprovedData = useCallback(async (filterState: SharedFilters, emailAddr: string) => {
    const path = buildFilterQuery(emailAddr, filterState);
    const data = await callEdge("GET", path);
    if (data.status === "approved") {
      setDashboard(data.dashboard);
      setVisuals(data.visuals || []);
      setVisualsData(data.visualsData || {});
      setStackedVisualsData(data.stackedVisualsData || {});
      if (data.filterOptions) setFilterOptions(data.filterOptions);
    }
    return data;
  }, [buildFilterQuery, callEdge]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const data = await callEdge("GET", `?token=${token}`);
      if (data.error) { setErrorMsg(data.error); setState("error"); return; }
      setDashboardName(data.dashboard_name || "Painel");

      const savedEmail = localStorage.getItem(`shared-dash-email-${token}`);
      if (savedEmail) {
        setEmail(savedEmail);
        const statusData = await fetchApprovedData(getDefaultFilters(), savedEmail);
        if (statusData.status === "approved") { setState("approved"); }
        else if (statusData.status === "pending") { setState("pending"); }
        else if (statusData.status === "rejected") { setState("rejected"); }
        else { setState("email_form"); }
      } else { setState("email_form"); }
    })();
  }, [token, callEdge, fetchApprovedData]);

  // Re-fetch when filters change (only when approved)
  useEffect(() => {
    if (state !== "approved" || !token || !email) return;
    let cancelled = false;
    setRefreshing(true);
    fetchApprovedData(filters, email).finally(() => {
      if (!cancelled) setRefreshing(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.startDate, filters.endDate, filters.userId, filters.productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !token) return;
    setSubmitting(true);
    try {
      const data = await callEdge("POST", "", { share_token: token, email: email.trim() });
      if (data.error) {
        setErrorMsg(data.error);
        setSubmitting(false);
        return;
      }
      localStorage.setItem(`shared-dash-email-${token}`, email.trim().toLowerCase());
      if (data.status === "approved") {
        await fetchApprovedData(filters, email.trim());
        setState("approved");
      } else if (data.status === "rejected") { setState("rejected"); }
      else { setState("pending"); }
    } catch {
      setErrorMsg("Erro ao enviar solicitação");
    } finally { setSubmitting(false); }
  };

  useEffect(() => {
    if (state !== "pending" || !token || !email) return;
    const interval = setInterval(async () => {
      try {
        const data = await callEdge("GET", `?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&status_only=true`);
        if (data.status === "approved") {
          setState("approved");
          clearInterval(interval);
          fetchApprovedData(filters, email);
        } else if (data.status === "rejected") {
          setState("rejected");
          clearInterval(interval);
        }
      } catch {
        // Ignore polling errors to keep retrying
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [state, token, email, callEdge, fetchApprovedData, filters]);

  const gridLayout = useMemo(() =>
    visuals.map((v, i) => visualToLayoutItem(v, i)),
    [visuals]
  );

  // Filter handlers
  const handlePresetChange = (preset: DatePreset) => {
    const { start, end } = getPresetDates(preset);
    setFilters(prev => ({ ...prev, preset, startDate: start.toISOString(), endDate: end.toISOString() }));
  };

  const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range) {
      setDateRangeLocal({ from: range.from, to: range.to });
      if (range.from && range.to) {
        setFilters(prev => ({
          ...prev,
          preset: "custom",
          startDate: range.from!.toISOString(),
          endDate: range.to!.toISOString(),
        }));
        setDatePickerOpen(false);
      }
    }
  };

  const selectedUser = filterOptions.users.find(u => u.id === filters.userId);
  const selectedProduct = filterOptions.products.find(p => p.id === filters.productId);
  const hasActiveFilters = filters.userId !== "all" || filters.productId !== "all";

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center w-full text-left">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 w-full text-left">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <ShieldX className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link inválido</h2>
            <p className="text-muted-foreground">{errorMsg || "Este link de compartilhamento não existe ou foi desativado."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "email_form") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 w-full text-left">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>{dashboardName}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Informe seu email para solicitar acesso a este painel.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="email" placeholder="seu@email.com" className="pl-10" value={email} onChange={(e) => { setEmail(e.target.value); setErrorMsg(""); }} required />
              </div>
              {errorMsg && (
                <p className="text-sm text-destructive text-center">{errorMsg}</p>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Solicitar Acesso
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 w-full text-left">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4 animate-pulse" />
            <h2 className="text-xl font-semibold mb-2">Aguardando Aprovação</h2>
            <p className="text-muted-foreground">Sua solicitação foi enviada. O administrador do painel irá revisar seu acesso.</p>
            <p className="text-xs text-muted-foreground mt-3">Esta página atualiza automaticamente.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "rejected") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 w-full text-left">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <ShieldX className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Recusado</h2>
            <p className="text-muted-foreground">O administrador do painel recusou sua solicitação de acesso.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                localStorage.removeItem(`shared-dash-email-${token}`);
                setEmail("");
                setErrorMsg("");
                setState("email_form");
              }}
            >
              Solicitar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Approved — show dashboard with pre-computed data
  return (
    <div className="min-h-screen bg-background w-full text-left">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{dashboard?.name || dashboardName}</h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
              <span>Visualização somente leitura</span>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 p-4 bg-card border rounded-lg relative">
          {refreshing && (
            <div className="absolute top-2 right-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Date Preset */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                {getPresetLabel(filters.preset)}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {PRESETS.map((preset) => (
                <DropdownMenuItem
                  key={preset.value}
                  onClick={() => handlePresetChange(preset.value)}
                  className={cn(filters.preset === preset.value && "bg-accent")}
                >
                  {preset.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setDatePickerOpen(true);
                    }}
                  >
                    Personalizado...
                  </DropdownMenuItem>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={handleDateSelect}
                    numberOfMonths={2}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date Range Display */}
          {filters.preset !== "custom" && (
            <span className="text-sm text-muted-foreground hidden md:inline">
              {format(new Date(filters.startDate), "dd/MM/yyyy", { locale: ptBR })} -{" "}
              {format(new Date(filters.endDate), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          )}

          <div className="h-4 w-px bg-border mx-2 hidden md:block" />

          {/* User Filter */}
          {filterOptions.users.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={filters.userId !== "all" ? "secondary" : "outline"}
                  size="sm"
                  className="gap-2"
                >
                  <User className="h-4 w-4" />
                  {selectedUser?.name || "Todos os Vendedores"}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-auto">
                <DropdownMenuItem
                  onClick={() => setFilters(prev => ({ ...prev, userId: "all" }))}
                  className={cn(filters.userId === "all" && "bg-accent")}
                >
                  Todos os Vendedores
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {filterOptions.users.map((user) => (
                  <DropdownMenuItem
                    key={user.id}
                    onClick={() => setFilters(prev => ({ ...prev, userId: user.id }))}
                    className={cn(filters.userId === user.id && "bg-accent")}
                  >
                    {user.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Product Filter */}
          {filterOptions.products.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={filters.productId !== "all" ? "secondary" : "outline"}
                  size="sm"
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  {selectedProduct?.name || "Todos os Produtos"}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-auto">
                <DropdownMenuItem
                  onClick={() => setFilters(prev => ({ ...prev, productId: "all" }))}
                  className={cn(filters.productId === "all" && "bg-accent")}
                >
                  Todos os Produtos
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {filterOptions.products.map((product) => (
                  <DropdownMenuItem
                    key={product.id}
                    onClick={() => setFilters(prev => ({ ...prev, productId: product.id }))}
                    className={cn(filters.productId === product.id && "bg-accent")}
                  >
                    {product.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Reset */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters(prev => ({ ...prev, userId: "all", productId: "all" }))}
              className="gap-2 text-muted-foreground"
            >
              <RotateCcw className="h-4 w-4" />
              Limpar filtros
            </Button>
          )}
        </div>

        <div ref={containerRef} className="shared-insights-grid">
          {visuals.length > 0 && gridWidth > 0 ? (
            <>
              <GridLayout
                className="layout"
                layout={gridLayout}
                width={gridWidth}
                gridConfig={{
                  cols: COLS,
                  rowHeight: ROW_HEIGHT,
                  margin: [0, 0] as [number, number],
                  containerPadding: [0, 0] as [number, number],
                }}
                dragConfig={{ enabled: false }}
                resizeConfig={{ enabled: false }}
                compactor={freePositionCompactor}
              >
                {visuals.map((visual) => (
                  <div key={visual.id} className="h-full">
                    <SharedVisualCard
                      visual={visual}
                      data={visualsData[visual.id] || []}
                      stackedData={stackedVisualsData[visual.id]?.data}
                      stackedSeriesKeys={stackedVisualsData[visual.id]?.seriesKeys}
                    />
                  </div>
                ))}
              </GridLayout>
              <style>{`
                .shared-insights-grid .react-grid-item {
                  transition: none;
                }
                .shared-insights-grid .react-grid-placeholder {
                  display: none !important;
                }
              `}</style>
            </>
          ) : visuals.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Este painel não possui visuais configurados.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
