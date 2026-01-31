import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter } from "lucide-react";

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
}

export function SalesFunnelChart({ stages, isLoading }: SalesFunnelChartProps) {
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

  // For a true funnel: calculate CUMULATIVE totals from bottom to top
  // Each stage = its count + all stages below it (representing leads that passed through)
  
  // Calculate total won deals
  const totalWonDeals = stages.reduce((sum, s) => sum + (s.wonCount || 0), 0);
  
  // Add "Venda" as the final stage
  const stagesWithVenda = [
    ...stages,
    {
      name: 'Venda',
      count: totalWonDeals,
      color: '#10b981', // emerald-500
      conversionPct: 0,
      wonCount: totalWonDeals,
    }
  ];
  
  // Calculate cumulative counts (from bottom to top)
  const cumulativeCounts: number[] = [];
  for (let i = stagesWithVenda.length - 1; i >= 0; i--) {
    const belowTotal = i < stagesWithVenda.length - 1 ? cumulativeCounts[i + 1] : 0;
    cumulativeCounts[i] = stagesWithVenda[i].count + belowTotal;
  }
  
  const maxCumulative = cumulativeCounts[0] || 1; // First stage has the highest cumulative
  
  // Calculate metrics for each stage
  const stagesWithMetrics = stagesWithVenda.map((stage, index) => {
    const cumulativeCount = cumulativeCounts[index];
    const prevCumulative = index > 0 ? cumulativeCounts[index - 1] : cumulativeCount;
    
    // Conversion rate: this cumulative / previous cumulative (always <= 100%)
    const conversionFromPrev = index === 0 ? 100 : (prevCumulative > 0 ? Math.round((cumulativeCount / prevCumulative) * 100) : 0);
    
    // Width: relative to the first stage cumulative (funnel narrows down)
    const widthPct = Math.max((cumulativeCount / maxCumulative) * 100, 15); // min 15% width for visibility
    
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
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Funil de Vendas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {stagesWithMetrics.map((stage, index) => {
          return (
            <div 
              key={stage.name}
              className="flex flex-col items-center gap-0.5"
            >
              {/* Funnel bar - centered to create funnel shape */}
              <div 
                className={`h-10 rounded-md flex items-center justify-between px-4 transition-all ${stage.isVendaStage ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}`}
                style={{ 
                  width: `${stage.widthPct}%`,
                  minWidth: '180px',
                  backgroundColor: stage.color,
                }}
              >
                <span className="text-sm font-medium text-white flex items-center gap-1.5">
                  {stage.isVendaStage && '🏆'}
                  {stage.name}
                </span>
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-sm font-bold text-white">
                    {stage.isVendaStage ? stage.count : stage.cumulativeCount}
                  </span>
                  {index > 0 && (
                    <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded text-white">
                      {stage.conversionFromPrev}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
