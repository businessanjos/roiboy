import { BarChart3, Bot, Clock, CheckCircle2, MessageSquare, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function EverDashboardTab() {
  return (
    <div className="p-6 space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Conversas IA hoje"
          value="—"
          icon={<MessageSquare className="h-4 w-4" />}
          color="violet"
        />
        <MetricCard
          title="Taxa de resolução"
          value="—"
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="green"
        />
        <MetricCard
          title="Tempo médio resposta"
          value="—"
          icon={<Clock className="h-4 w-4" />}
          color="blue"
        />
        <MetricCard
          title="Transferências p/ humano"
          value="—"
          icon={<TrendingUp className="h-4 w-4" />}
          color="amber"
        />
      </div>

      {/* Placeholder */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
            <BarChart3 className="h-8 w-8 text-violet-500" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">Dashboard de Métricas</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Estatísticas de uso da IA, taxa de resolução, tempo de resposta, 
            feedback das sugestões e mais. Os dados aparecerão conforme a IA começar a atender.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    violet: "bg-violet-500/10 text-violet-500",
    green: "bg-emerald-500/10 text-emerald-500",
    blue: "bg-blue-500/10 text-blue-500",
    amber: "bg-amber-500/10 text-amber-500",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
