import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Trophy, TrendingUp, ShoppingCart, Target, DollarSign } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { FormatType, VisualConfig } from "../visual-builder/types";
import { PresentationOptions } from "./RankingPresentationDialog";
import { RoyLogo } from "@/components/ui/roy-logo";
import { cn } from "@/lib/utils";

interface AggregatedDataPoint {
  name: string;
  value: number;
  count?: number;
  color?: string;
}

interface UserAvatar {
  name: string;
  avatar_url: string | null;
}

interface RankingPresentationViewProps {
  title: string;
  data: AggregatedDataPoint[];
  formatting: { type: FormatType; decimals: number };
  options: PresentationOptions;
  dashboardId?: string;
  onClose: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatValue(value: number, type: FormatType, decimals: number): string {
  if (type === "currency") {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  if (type === "percentage") return `${value.toFixed(decimals)}%`;
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const MEDAL_EMOJI: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };
const PODIUM_GRADIENTS: Record<number, string> = {
  0: "from-primary to-primary/80",
  1: "from-muted-foreground/60 to-muted-foreground/40",
  2: "from-accent to-accent/80",
};
const PODIUM_BORDER: Record<number, string> = {
  0: "border-primary",
  1: "border-muted-foreground/50",
  2: "border-accent",
};
const PODIUM_HEIGHTS: Record<number, number> = { 0: 200, 1: 150, 2: 110 };

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="text-right">
      <div className="text-2xl font-bold tabular-nums text-foreground">{time}</div>
      <div className="text-xs text-muted-foreground capitalize">{date}</div>
    </div>
  );
}

export function RankingPresentationView({
  title,
  data,
  formatting,
  options,
  dashboardId,
  onClose,
}: RankingPresentationViewProps) {
  const { currentUser } = useCurrentUser();
  const [avatars, setAvatars] = useState<Record<string, UserAvatar>>({});
  const [goalValue, setGoalValue] = useState<number | null>(null);

  // Fetch goal from sibling gauge visuals in the same dashboard
  useEffect(() => {
    if (!dashboardId) return;
    const fetchGoal = async () => {
      const { data: visuals } = await supabase
        .from("insights_visuals")
        .select("config")
        .eq("dashboard_id", dashboardId)
        .eq("chart_type", "gauge");
      if (visuals) {
        for (const v of visuals) {
          const cfg = v.config as unknown as VisualConfig | null;
          if (cfg?.gaugeConfig?.monthlyGoals) {
            const now = new Date();
            const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            const val = cfg.gaugeConfig.monthlyGoals[key];
            if (val && val > 0) {
              setGoalValue(val);
              return;
            }
            // Fallback: use any goal value
            const allGoals = Object.values(cfg.gaugeConfig.monthlyGoals);
            if (allGoals.length > 0) {
              setGoalValue(allGoals[allGoals.length - 1]);
              return;
            }
          }
        }
      }
    };
    fetchGoal();
  }, [dashboardId]);

  useEffect(() => {
    if (!currentUser?.account_id || data.length === 0) return;
    const fetchAvatars = async () => {
      const names = data.map((d) => d.name);
      const { data: users } = await supabase
        .from("users")
        .select("name, avatar_url")
        .eq("account_id", currentUser.account_id)
        .in("name", names);
      if (users) {
        const map: Record<string, UserAvatar> = {};
        for (const user of users) map[user.name] = user;
        setAvatars(map);
      }
    };
    fetchAvatars();
  }, [currentUser?.account_id, data]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // Compute KPIs
  const kpis = useMemo(() => {
    const totalRevenue = data.reduce((sum, d) => sum + d.value, 0);
    const totalSales = data.reduce((sum, d) => sum + (d.count || 0), 0);
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
    return { totalRevenue, totalSales, avgTicket };
  }, [data]);

  const goalProgress = goalValue && goalValue > 0 ? Math.min((kpis.totalRevenue / goalValue) * 100, 100) : null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const top3 = data.slice(0, 3);

  const podiumOrder =
    top3.length >= 2
      ? [top3[1], top3[0], ...(top3[2] ? [top3[2]] : [])]
      : top3;

  const displayName = (name: string) =>
    options.showNames ? name : "• • •";

  const content = (
    <div className="fixed inset-0 z-[9999] bg-background text-foreground flex flex-col overflow-hidden">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors z-10"
      >
        <X className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Header: Logo + Title + Clock */}
      <div className="flex items-center justify-between px-8 pt-6 pb-2 flex-shrink-0">
        <div className="flex items-center gap-4">
          <RoyLogo size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Atualizado em tempo real</p>
          </div>
        </div>
        <LiveClock />
      </div>

      {/* KPI Cards + Goal Progress */}
      <div className="px-8 py-3 flex-shrink-0 space-y-3">
        {/* KPI Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card rounded-xl p-4 border border-border flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Faturado</p>
              <p className={cn("text-lg font-bold text-foreground tabular-nums", options.blurNumbers && "blur-md select-none")}>
                {formatCompactCurrency(kpis.totalRevenue)}
              </p>
            </div>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nº de Vendas</p>
              <p className={cn("text-lg font-bold text-foreground tabular-nums", options.blurNumbers && "blur-md select-none")}>
                {kpis.totalSales}
              </p>
            </div>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ticket Médio</p>
              <p className={cn("text-lg font-bold text-foreground tabular-nums", options.blurNumbers && "blur-md select-none")}>
                {formatCompactCurrency(kpis.avgTicket)}
              </p>
            </div>
          </div>
        </div>

        {/* Goal Progress */}
        {goalProgress !== null && goalValue && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Meta do Mês</span>
              </div>
              <span className={cn("text-sm font-semibold text-foreground tabular-nums", options.blurNumbers && "blur-md select-none")}>
                {formatCompactCurrency(kpis.totalRevenue)} / {formatCompactCurrency(goalValue)}
              </span>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className={cn("text-xs text-muted-foreground tabular-nums", options.blurNumbers && "blur-md select-none")}>
                {goalProgress.toFixed(0)}% alcançado
              </span>
              <span className={cn("text-xs text-muted-foreground tabular-nums", options.blurNumbers && "blur-md select-none")}>
                Faltam {formatCompactCurrency(Math.max(goalValue - kpis.totalRevenue, 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main content: Podium + Table */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 px-8 pb-6 overflow-hidden min-h-0">
        {/* Podium */}
        {top3.length >= 2 && (
          <div className="lg:w-[40%] flex items-end justify-center gap-3 shrink-0 pb-4">
            {podiumOrder.map((item) => {
              const originalIndex = top3.indexOf(item);
              const gradient = PODIUM_GRADIENTS[originalIndex];
              const border = PODIUM_BORDER[originalIndex];
              const height = PODIUM_HEIGHTS[originalIndex];
              const order = originalIndex === 0 ? 2 : originalIndex === 1 ? 1 : 3;
              const avatar = avatars[item.name];

              return (
                <div key={item.name} className="flex flex-col items-center" style={{ order }}>
                  {options.showPhotos ? (
                    <Avatar className={cn("h-14 w-14 border-[3px] mb-2", border)}>
                      <AvatarImage src={avatar?.avatar_url || undefined} alt={item.name} />
                      <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                        {getInitials(item.name)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="h-14 w-14 mb-2" />
                  )}

                  <span className="font-medium text-sm text-foreground truncate max-w-[100px] text-center">
                    {options.showNames ? item.name.split(" ")[0] : "• • •"}
                  </span>

                  <span className={cn("text-xs text-muted-foreground font-medium tabular-nums mb-2", options.blurNumbers && "blur-md select-none")}>
                    {formatValue(item.value, formatting.type, formatting.decimals)}
                  </span>

                  <div
                    className={cn("w-[85px] rounded-t-xl bg-gradient-to-t flex items-center justify-center", gradient)}
                    style={{ height: `${height}px` }}
                  >
                    <span className="text-primary-foreground font-bold text-xl drop-shadow-sm">
                      {originalIndex + 1}º
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ranking table */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-border text-xs">
                <th className="text-left py-2.5 px-2 w-10">#</th>
                {options.showPhotos && <th className="w-10" />}
                <th className="text-left py-2.5 px-2">Vendedor</th>
                <th className="text-right py-2.5 px-2">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                const progress = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                const avatar = avatars[item.name];
                const medal = MEDAL_EMOJI[index];

                return (
                  <tr
                    key={item.name}
                    className={cn(
                      "border-b border-border/50 transition-colors",
                      index < 3 ? "bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <td className="py-2.5 px-2">
                      {medal ? (
                        <span className="text-lg">{medal}</span>
                      ) : (
                        <span className="text-muted-foreground font-medium text-xs ml-0.5">
                          {index + 1}º
                        </span>
                      )}
                    </td>
                    {options.showPhotos && (
                      <td className="py-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={avatar?.avatar_url || undefined} alt={item.name} />
                          <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
                            {getInitials(item.name)}
                          </AvatarFallback>
                        </Avatar>
                      </td>
                    )}
                    <td className="py-2.5 px-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground block truncate">
                          {displayName(item.name)}
                        </span>
                        <div className="w-full max-w-[250px] h-1.5 bg-muted rounded-full mt-1">
                          <div
                            className="h-full rounded-full bg-primary/70 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <span className={cn("font-semibold tabular-nums text-foreground", options.blurNumbers && "blur-md select-none")}>
                        {formatValue(item.value, formatting.type, formatting.decimals)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
