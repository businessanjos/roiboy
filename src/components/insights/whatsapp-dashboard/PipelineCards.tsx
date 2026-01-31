import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StageData {
  name: string;
  count: number;
  value: number;
  color: string;
  conversionPct: number;
}

interface PipelineCardsProps {
  stages: StageData[];
  isLoading?: boolean;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `R$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$${(value / 1000).toFixed(0)}K`;
  }
  return `R$${value.toFixed(0)}`;
};

export function PipelineCards({ stages, isLoading }: PipelineCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-3">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-6 bg-muted rounded w-1/2 mb-1" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
      {stages.map((stage, index) => (
        <Card 
          key={stage.name} 
          className="relative overflow-hidden"
          style={{ borderTopColor: stage.color, borderTopWidth: '3px' }}
        >
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground truncate" title={stage.name}>
              {stage.name}
            </p>
            <p className="text-xl font-bold mt-1">{stage.count}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">
                {formatCurrency(stage.value)}
              </span>
              {index > 0 && (
                <span 
                  className={cn(
                    "text-xs font-medium px-1.5 py-0.5 rounded",
                    stage.conversionPct >= 50 ? "bg-green-500/20 text-green-400" :
                    stage.conversionPct >= 25 ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-red-500/20 text-red-400"
                  )}
                >
                  {stage.conversionPct}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
