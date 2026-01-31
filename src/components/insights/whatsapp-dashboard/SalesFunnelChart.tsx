import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter } from "lucide-react";

interface StageData {
  name: string;
  count: number;
  color: string;
  conversionPct: number;
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

  // For a true funnel: calculate cumulative conversion from stage 1
  // First stage = 100% width, subsequent stages shrink based on conversion rate
  const maxCount = Math.max(...stages.map(s => s.count), 1);
  
  // Calculate metrics for each stage
  const stagesWithMetrics = stages.map((stage, index) => {
    // Conversion rate: this stage count / previous stage count
    const prevCount = index > 0 ? stages[index - 1].count : stage.count;
    const conversionFromPrev = index === 0 ? 100 : (prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : 0);
    
    // Width: relative to the max count in the funnel (so largest stage is 100%)
    // This creates a proper funnel shape where each bar width reflects its volume
    const widthPct = Math.max((stage.count / maxCount) * 100, 15); // min 15% width for visibility
    
    return {
      ...stage,
      conversionFromPrev,
      widthPct,
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
        {stagesWithMetrics.map((stage, index) => (
          <div 
            key={stage.name}
            className="flex flex-col items-center"
          >
            {/* Funnel bar - centered to create funnel shape */}
            <div 
              className="h-9 rounded-md flex items-center justify-between px-3 transition-all"
              style={{ 
                width: `${stage.widthPct}%`,
                minWidth: '140px',
                backgroundColor: stage.color,
              }}
            >
              <span className="text-sm font-medium text-white truncate">
                {stage.name}
              </span>
              <div className="flex items-center gap-2 ml-2">
                <span className="text-sm font-bold text-white">
                  {stage.count}
                </span>
                {index > 0 && (
                  <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded text-white">
                    {stage.conversionFromPrev}%
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
