import { formatValue } from "@/lib/formula-evaluator";
import { FormatType } from "../visual-builder/types";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ConfigurableScorecardProps {
  data: Array<{ name: string; value: number; count?: number }>;
  formatting: {
    type: FormatType;
    decimals: number;
  };
  title?: string;
}

export function ConfigurableScorecard({ data, formatting, title }: ConfigurableScorecardProps) {
  // Sum all values for scorecard
  const totalValue = data.reduce((acc, item) => acc + item.value, 0);
  const totalCount = data.reduce((acc, item) => acc + (item.count || 0), 0);
  const formattedValue = formatValue(totalValue, formatting.type, formatting.decimals);

  return (
    <div className="flex flex-col items-center justify-center h-full py-4">
      <p className="text-4xl font-bold text-foreground mb-2">{formattedValue}</p>
      {totalCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {totalCount} {totalCount === 1 ? 'registro' : 'registros'}
        </p>
      )}
    </div>
  );
}
