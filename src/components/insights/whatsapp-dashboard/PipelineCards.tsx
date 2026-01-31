import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";

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
  // Calculate CUMULATIVE counts for proper funnel visualization
  // Each stage = its count + all stages below it (representing leads that passed through)
  const cumulativeCounts: number[] = [];
  for (let i = stages.length - 1; i >= 0; i--) {
    const belowTotal = i < stages.length - 1 ? cumulativeCounts[i + 1] : 0;
    cumulativeCounts[i] = stages[i].count + belowTotal;
  }
  
  // Total leads = cumulative at first stage (top of funnel)
  const totalLeads = cumulativeCounts[0] || 0;
  const baseCount = Math.max(totalLeads, 1);

  if (isLoading) {
    return (
      <CollapsibleSection
        title="Pipeline de Conversão"
        subtitle="Análise detalhada do funil de vendas"
        rightContent={
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Leads</p>
            <div className="h-8 w-16 bg-muted rounded animate-pulse" />
          </div>
        }
      >
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
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      title="Pipeline de Conversão"
      subtitle="Análise detalhada do funil de vendas"
      rightContent={
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Leads</p>
          <p className="text-3xl font-bold">{totalLeads}</p>
        </div>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stages.map((stage, index) => {
          const cumulativeCount = cumulativeCounts[index];
          const prevCumulative = index > 0 ? cumulativeCounts[index - 1] : cumulativeCount;
          
          // Conversion: this cumulative / previous cumulative (always <= 100%)
          const conversionPct = index === 0 ? 100 : (prevCumulative > 0 ? Math.round((cumulativeCount / prevCumulative) * 100) : 0);
          
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

                {/* Cumulative count with conversion */}
                <div className="flex items-baseline gap-1 mb-1">
                  <p className="text-2xl font-bold">{cumulativeCount}</p>
                  {!isFirstStage && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      ({stage.count} nesta etapa)
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
    </CollapsibleSection>
  );
}
