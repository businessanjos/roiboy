import { BarChart3, LineChart, PieChart, Hash, Trophy, Phone, Gauge, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { ChartType, CHART_TYPE_OPTIONS } from "./types";

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (value: ChartType) => void;
}

const ICON_MAP: Record<ChartType, React.ElementType> = {
  bar: BarChart3,
  bar_horizontal: BarChart3,
  bar_stacked: BarChart3,
  line: LineChart,
  pie: PieChart,
  number: Hash,
  scorecard: Hash,
  ranking: Trophy,
  call_commercial: Phone,
  gauge: Gauge,
  indicator: Activity,
};

export function ChartTypeSelector({ value, onChange }: ChartTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Tipo de Visualização</Label>
      
      <div className="grid grid-cols-4 gap-2">
        {CHART_TYPE_OPTIONS.map((option) => {
          const Icon = ICON_MAP[option.value];
          const isSelected = value === option.value;
          
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <Icon className={cn(
                "h-5 w-5",
                (option.value === 'bar_horizontal' || option.value === 'bar_stacked') && "rotate-90",
                isSelected ? "text-primary" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-xs",
                isSelected ? "text-primary font-medium" : "text-muted-foreground"
              )}>
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
