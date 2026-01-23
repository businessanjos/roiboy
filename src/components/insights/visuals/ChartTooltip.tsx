import { formatValue } from "@/lib/formula-evaluator";
import { FormatType } from "../visual-builder/types";

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  formatting: {
    type: FormatType;
    decimals: number;
  };
  showCount?: boolean;
}

export function ChartTooltip({ active, payload, formatting, showCount }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  const value = payload[0].value;
  const formattedValue = formatValue(value, formatting.type, formatting.decimals);

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 min-w-[120px]">
      <p className="font-medium text-sm text-foreground mb-1">{data.name}</p>
      <p className="text-primary font-bold text-lg">{formattedValue}</p>
      {showCount && data.count !== undefined && (
        <p className="text-xs text-muted-foreground mt-1">
          {data.count} {data.count === 1 ? 'registro' : 'registros'}
        </p>
      )}
    </div>
  );
}
