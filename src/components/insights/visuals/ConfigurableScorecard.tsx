import { formatValueWithScale } from "@/lib/formula-evaluator";
import { FormatType, DisplayScale } from "../visual-builder/types";
import { VisualConfig } from "../visual-builder/types";

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
  // Sum all values for scorecard
  const totalValue = data.reduce((acc, item) => acc + item.value, 0);
  const totalCount = data.reduce((acc, item) => acc + (item.count || 0), 0);
  
  const isSalesCycle = config?.measure?.aggregation === 'sales_cycle';
  
  // Use new formatting function with scale support
  const formattedValue = isSalesCycle
    ? `${totalValue}`
    : formatValueWithScale(
        totalValue, 
        formatting.type, 
        formatting.decimals,
        formatting.displayScale || 'auto'
      );

  // Calculate responsive font size based on value length
  const fontSize = formattedValue.length > 15 
    ? 'text-2xl' 
    : formattedValue.length > 10 
      ? 'text-3xl' 
      : 'text-4xl';

  return (
    <div className="flex flex-col items-center justify-center h-full py-4 px-2 overflow-hidden">
      <p className={`${fontSize} font-bold text-foreground mb-2 text-center break-words w-full`}>
        {formattedValue}
        {isSalesCycle && <span className="text-lg font-normal text-muted-foreground ml-1">dias</span>}
      </p>
      {totalCount > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {totalCount.toLocaleString('pt-BR')} {totalCount === 1 ? 'registro' : 'registros'}
        </p>
      )}
    </div>
  );
}
