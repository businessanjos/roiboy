import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightInfoPopover } from "../InsightInfoPopover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

interface SalesByUserChartProps {
  data: Array<{ name: string; value: number; count: number }>;
  isLoading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

const colors = [
  "bg-primary",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
];

export function SalesByUserChart({ data, isLoading }: SalesByUserChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">
          Vendas por Vendedor
        </CardTitle>
        <InsightInfoPopover metricKey="sales-by-user" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-2 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhuma venda no período
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((user, index) => (
              <div key={user.name} className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={`${colors[index % colors.length]} text-white text-xs`}>
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">
                      {user.name}
                    </span>
                    <span className="text-sm font-bold text-primary ml-2">
                      {formatCurrency(user.value)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={(user.value / maxValue) * 100}
                      className="h-2"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {user.count} {user.count === 1 ? "venda" : "vendas"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
