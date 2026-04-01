import { formatValueWithScale } from "@/lib/formula-evaluator";
import { FormatType, DisplayScale, FONT_SCALE_MULTIPLIERS } from "../visual-builder/types";
import { VisualConfig } from "../visual-builder/types";
import { useInsightsFilters } from "@/hooks/useInsightsFilters";
import { sumGoalsInRange } from "@/lib/monthRange";

interface ConfigurableScorecardProps {
  data: Array<{ name: string; value: number; count?: number }>;
  formatting: {
    type: FormatType;
    decimals: number;
    displayScale?: DisplayScale;
  };
  title?: string;
  config?: VisualConfig;
}

export function ConfigurableScorecard({ data, formatting, title, config }: ConfigurableScorecardProps) {
  const { filters } = useInsightsFilters();
  
  // Check if this is a "Meta" scorecard
  const isMetaScorecard = !!config?.gaugeConfig?.monthlyGoals && config?.measure?.aggregation === 'sum' && config?.measure?.field === 'meta';
  
  // Sum all values for scorecard
  const totalValue = isMetaScorecard
    ? sumGoalsInRange(config?.gaugeConfig?.monthlyGoals, filters.startDate, filters.endDate)
    : data.reduce((acc, item) => acc + item.value, 0);
  const totalCount = data.reduce((acc, item) => acc + (item.count || 0), 0);
  
  const isSalesCycle = config?.measure?.aggregation === 'sales_cycle';
  
  // Use new formatting function with scale support
  const formattedValue = isSalesCycle
    ? `${totalValue}`
    : formatValueWithScale(
        totalValue, 
        isMetaScorecard ? 'currency' : formatting.type, 
        formatting.decimals,
        formatting.displayScale || 'auto'
      );

  const m = FONT_SCALE_MULTIPLIERS[config?.appearance?.fontScale || 'normal'];

  // Calculate responsive font size based on value length and font scale
  const baseFontSize = formattedValue.length > 15 
    ? 24 
    : formattedValue.length > 10 
      ? 30 
      : 36;
  const scaledFontSize = Math.round(baseFontSize * m);
  const subtitleSize = Math.round(14 * m);
  const suffixSize = Math.round(18 * m);

  return (
    <div className="flex flex-col items-center justify-center h-full py-2 px-2 overflow-hidden">
      <p className="font-bold text-foreground mb-1 text-center break-words w-full" style={{ fontSize: `${scaledFontSize}px`, lineHeight: 1.1 }}>
        {formattedValue}
        {isSalesCycle && <span className="font-normal text-muted-foreground ml-1" style={{ fontSize: `${suffixSize}px` }}>dias</span>}
      </p>
      {totalCount > 0 && (
        <p className="text-muted-foreground text-center" style={{ fontSize: `${subtitleSize}px` }}>
          {totalCount.toLocaleString('pt-BR')} {totalCount === 1 ? 'registro' : 'registros'}
        </p>
      )}
    </div>
  );
}
