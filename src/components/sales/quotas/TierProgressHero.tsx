import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserMonthlyTier, TIER_LADDER } from "@/hooks/useUserMonthlyTier";
import { Crown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function TierProgressHero() {
  const { sales, tier, nextTier, salesToNext, isLoading, monthLabel } = useUserMonthlyTier();

  if (isLoading) {
    return <Skeleton className="h-28 w-full rounded-xl" />;
  }

  // Compute progress within current tier band (relative to next tier)
  const progress = nextTier
    ? Math.min(100, ((sales - tier.minSales) / Math.max(1, nextTier.minSales - tier.minSales)) * 100)
    : 100;

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-0 text-white shadow-lg",
        "bg-gradient-to-br",
        tier.gradient,
      )}
    >
      {/* Decorative shimmer */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.25),transparent_60%)] pointer-events-none" />
      <div className="absolute -right-8 -top-8 text-[140px] opacity-15 leading-none select-none pointer-events-none">
        {tier.emoji}
      </div>

      <div className="relative p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] opacity-80">
              <Crown className="h-3 w-3" />
              Seu nível em {monthLabel}
            </div>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl sm:text-4xl font-bold drop-shadow-sm">{tier.label}</span>
              <span className="text-sm opacity-80">
                {sales} {sales === 1 ? "venda" : "vendas"} este mês
              </span>
            </div>
          </div>
          {nextTier && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide opacity-70 flex items-center gap-1 justify-end">
                <TrendingUp className="h-3 w-3" />
                Próximo
              </div>
              <div className="text-sm font-semibold mt-0.5">{nextTier.label} {nextTier.emoji}</div>
              <div className="text-[11px] opacity-80">
                {salesToNext > 0
                  ? `${salesToNext} ${salesToNext === 1 ? "venda" : "vendas"} para subir`
                  : "Pronto para subir!"}
              </div>
            </div>
          )}
        </div>

        {/* Tier progress bar */}
        <div className="space-y-1.5">
          <div className="h-2 rounded-full bg-black/25 overflow-hidden backdrop-blur-sm">
            <div
              className="h-full bg-white/90 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Tier ladder dots */}
          <div className="flex justify-between gap-1 pt-1">
            {TIER_LADDER.slice(1).map((t) => {
              const reached = sales >= t.minSales;
              const isCurrent = t.key === tier.key;
              return (
                <div
                  key={t.key}
                  className="flex flex-col items-center gap-0.5 flex-1 min-w-0"
                  title={`${t.label} — ${t.minSales}+ vendas`}
                >
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-all",
                      reached ? "bg-white" : "bg-white/30",
                      isCurrent && "ring-2 ring-white/60 scale-125",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[9px] uppercase tracking-wide truncate w-full text-center",
                      reached ? "opacity-90" : "opacity-50",
                      isCurrent && "font-semibold",
                    )}
                  >
                    {t.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
