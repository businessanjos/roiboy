import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ScoreCardWidgetProps {
  value: number;
  format: "currency" | "percentage" | "number";
  label: string;
  trend?: number; // Percentage change
  previousValue?: number;
}

export function ScoreCardWidget({
  value,
  format,
  label,
  trend,
  previousValue,
}: ScoreCardWidgetProps) {
  const formatValue = (val: number) => {
    switch (format) {
      case "currency":
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
          notation: val >= 1000000 ? "compact" : "standard",
          maximumFractionDigits: val >= 1000000 ? 1 : 0,
        }).format(val);
      case "percentage":
        return `${val.toFixed(1)}%`;
      case "number":
        return new Intl.NumberFormat("pt-BR", {
          notation: val >= 10000 ? "compact" : "standard",
          maximumFractionDigits: 0,
        }).format(val);
      default:
        return val.toString();
    }
  };

  const getTrendIcon = () => {
    if (trend === undefined) return null;
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (trend === undefined) return "";
    if (trend > 0) return "text-green-500";
    if (trend < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-2">
      <div className="text-3xl md:text-4xl font-bold tracking-tight">
        {formatValue(value)}
      </div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
      
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-sm ${getTrendColor()}`}>
          {getTrendIcon()}
          <span>{trend > 0 ? "+" : ""}{trend.toFixed(1)}%</span>
          {previousValue !== undefined && (
            <span className="text-muted-foreground ml-1">
              vs. {formatValue(previousValue)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
