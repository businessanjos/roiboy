import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

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
  // Calculate total leads (first stage count)
  const totalLeads = stages.length > 0 ? stages[0].count : 0;
  const baseCount = Math.max(totalLeads, 1);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pipeline de Conversão</h2>
            <p className="text-sm text-muted-foreground">Análise detalhada do funil de vendas</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Leads</p>
            <div className="h-8 w-16 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-8 bg-muted rounded w-1/2 mb-1" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pipeline de Conversão</h2>
          <p className="text-sm text-muted-foreground">Análise detalhada do funil de vendas</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Leads</p>
          <p className="text-3xl font-bold">{totalLeads}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stages.map((stage, index) => {
          const conversionPct = index === 0 ? 100 : Math.round((stage.count / baseCount) * 100);
          const prevCount = index > 0 ? stages[index - 1].count : stage.count;
          const growth = prevCount > 0 ? Math.round(((stage.count - prevCount) / prevCount) * 100) : 0;
          const isPositive = growth >= 0;
          const isFirstStage = index === 0;
          
          return (
            <Card 
              key={stage.name} 
              className="relative overflow-hidden"
              style={{ 
                backgroundColor: `${stage.color}20`,
                borderColor: stage.color,
                borderWidth: '1px'
              }}
            >
              <CardContent className="p-4">
                {/* Stage indicator dot and name */}
                <div className="flex items-center gap-2 mb-2">
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  <p className="text-xs font-medium text-muted-foreground truncate" title={stage.name}>
                    {stage.name}
                  </p>
                </div>

                {/* Count with total reference */}
                <div className="flex items-baseline gap-1 mb-1">
                  <p className="text-2xl font-bold">{stage.count}</p>
                  {!isFirstStage && (
                    <span className="text-sm text-muted-foreground">/ {baseCount}</span>
                  )}
                  {/* Growth indicator */}
                  {!isFirstStage && (
                    <span className={cn(
                      "text-xs flex items-center ml-auto",
                      isPositive ? "text-green-500" : "text-red-500"
                    )}>
                      {isPositive ? (
                        <TrendingUp className="h-3 w-3 mr-0.5" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-0.5" />
                      )}
                      {isPositive ? '+' : ''}{growth}%
                    </span>
                  )}
                </div>

                {/* Conversion percentage */}
                <p className="text-xs text-muted-foreground">
                  {isFirstStage ? 'Base do Funil' : `${conversionPct}% Conversão`}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
