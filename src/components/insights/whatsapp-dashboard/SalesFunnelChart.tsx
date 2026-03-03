import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, SlidersHorizontal } from "lucide-react";

interface StageData {
  name: string;
  count: number;
  color: string;
  conversionPct: number;
  wonCount?: number;
}

interface SalesFunnelChartProps {
  stages: StageData[];
  isLoading?: boolean;
  hiddenStages?: Set<string>;
  onHiddenStagesChange?: (hiddenStages: Set<string>) => void;
}

export function SalesFunnelChart({ stages, isLoading, hiddenStages: externalHidden, onHiddenStagesChange }: SalesFunnelChartProps) {
  const [internalHidden, setInternalHidden] = useState<Set<string>>(new Set());
  const hiddenStages = externalHidden ?? internalHidden;
  const setHiddenStages = onHiddenStagesChange ?? setInternalHidden;

  // Calculate total won deals
  const totalWonDeals = stages.reduce((sum, s) => sum + (s.wonCount || 0), 0);

  // All stages including Venda
  const allStagesWithVenda = [
    ...stages,
    {
      name: 'Venda',
      count: totalWonDeals,
      color: '#10b981',
      conversionPct: 0,
      wonCount: totalWonDeals,
    }
  ];

  const visibleCount = allStagesWithVenda.filter(s => !hiddenStages.has(s.name)).length;

  const toggleStage = (name: string) => {
    setHiddenStages(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        // Prevent hiding all
        if (visibleCount <= 1) return prev;
        next.add(name);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Funil de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 flex flex-col items-center">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" style={{ width: `${100 - i * 12}%` }} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter to visible stages only
  const visibleStages = allStagesWithVenda.filter(s => !hiddenStages.has(s.name));

  // Calculate cumulative counts (from bottom to top) on visible stages
  const cumulativeCounts: number[] = [];
  for (let i = visibleStages.length - 1; i >= 0; i--) {
    const belowTotal = i < visibleStages.length - 1 ? cumulativeCounts[i + 1] : 0;
    cumulativeCounts[i] = visibleStages[i].count + belowTotal;
  }

  const maxCumulative = cumulativeCounts[0] || 1;

  const stagesWithMetrics = visibleStages.map((stage, index) => {
    const cumulativeCount = cumulativeCounts[index];
    const prevCumulative = index > 0 ? cumulativeCounts[index - 1] : cumulativeCount;
    const conversionFromPrev = index === 0 ? 100 : (prevCumulative > 0 ? Math.round((cumulativeCount / prevCumulative) * 100) : 0);
    const widthPct = Math.max((cumulativeCount / maxCumulative) * 100, 15);

    return {
      ...stage,
      cumulativeCount,
      conversionFromPrev,
      widthPct,
      isVendaStage: stage.name === 'Venda',
    };
  });

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Funil de Vendas
        </CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-3" align="end">
            <p className="text-xs font-medium text-muted-foreground mb-2">Etapas visíveis</p>
            <div className="space-y-1.5">
              {allStagesWithVenda.map((stage) => {
                const isVisible = !hiddenStages.has(stage.name);
                const isLastVisible = isVisible && visibleCount <= 1;
                return (
                  <label
                    key={stage.name}
                    className="flex items-center gap-2 cursor-pointer rounded px-1.5 py-1 hover:bg-accent text-sm"
                  >
                    <Checkbox
                      checked={isVisible}
                      disabled={isLastVisible}
                      onCheckedChange={() => toggleStage(stage.name)}
                    />
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="truncate">{stage.name}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {stagesWithMetrics.map((stage, index) => {
          const overallPct = Math.round((stage.cumulativeCount / maxCumulative) * 100);
          const stagePct = index === 0 ? 100 : stage.conversionFromPrev;
          return (
            <div key={stage.name} className="w-full flex justify-center items-center">
              <div className="flex items-center gap-1.5" style={{ width: `${stage.widthPct}%`, minWidth: '200px' }}>
                <span className="text-xs font-semibold text-muted-foreground w-10 text-right shrink-0">
                  {stagePct}%
                </span>
                <div
                  className={`h-10 rounded-md flex items-center justify-between px-4 transition-all flex-1 ${stage.isVendaStage ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}`}
                  style={{ backgroundColor: stage.color }}
                >
                  <span className="text-sm font-medium text-white flex items-center gap-1.5">
                    {stage.isVendaStage && '🏆'}
                    {stage.name}
                  </span>
                  <span className="text-sm font-bold text-white ml-2 shrink-0">
                    {stage.isVendaStage ? stage.count : stage.cumulativeCount}
                  </span>
                </div>
                <span className="text-xs font-semibold text-muted-foreground w-10 shrink-0">
                  {stage.isVendaStage ? Math.round((stage.count / maxCumulative) * 100) : overallPct}%
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
