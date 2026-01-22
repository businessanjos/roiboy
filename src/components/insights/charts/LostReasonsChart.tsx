import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightInfoPopover } from "../InsightInfoPopover";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface LostReasonsChartProps {
  data: Array<{ reason: string; count: number; value: number }>;
  isLoading?: boolean;
}

const COLORS = [
  "hsl(var(--destructive))",
  "#f97316",
  "#eab308",
  "#84cc16",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3">
        <p className="font-medium">{data.reason}</p>
        <p className="text-sm">
          {data.count} {data.count === 1 ? "negócio" : "negócios"}
        </p>
        <p className="text-destructive font-bold">
          -{new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(data.value)}
        </p>
      </div>
    );
  }
  return null;
};

export function LostReasonsChart({ data, isLoading }: LostReasonsChartProps) {
  const totalLost = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">
          Motivos de Perda
        </CardTitle>
        <InsightInfoPopover metricKey="lost-reasons" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhum negócio perdido no período 🎉
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="reason"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={50}
                  paddingAngle={2}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {data.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
              {data.slice(0, 5).map((item, index) => (
                <div key={item.reason} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                    {item.reason}
                  </span>
                </div>
              ))}
            </div>
            
            <p className="text-center text-sm text-muted-foreground mt-3">
              Total: {totalLost} {totalLost === 1 ? "negócio perdido" : "negócios perdidos"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
