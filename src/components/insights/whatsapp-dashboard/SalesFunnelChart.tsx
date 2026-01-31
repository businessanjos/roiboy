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
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" style={{ width: `${100 - i * 12}%` }} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate base (first stage count)
  const baseCount = stages.length > 0 ? Math.max(stages[0].count, 1) : 1;
  
  // Calculate percentages relative to the previous stage
  const stagesWithMetrics = stages.map((stage, index) => {
    const prevCount = index > 0 ? stages[index - 1].count : stage.count;
    const conversionFromPrev = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : 0;
    const widthPct = Math.max((stage.count / baseCount) * 100, 5); // min 5% width for visibility
    
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
      <CardContent className="space-y-2">
        {stagesWithMetrics.map((stage, index) => (
          <div 
            key={stage.name}
            className="flex items-center gap-3"
          >
            {/* Funnel bar */}
            <div 
              className="h-9 rounded-r-md flex items-center justify-between px-3 transition-all"
              style={{ 
                width: `${stage.widthPct}%`,
                minWidth: '120px',
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
