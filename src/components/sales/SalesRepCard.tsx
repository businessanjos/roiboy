import { memo, forwardRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Phone, 
  Target, 
  Trophy, 
  CheckCircle2, 
  Users,
  Clock,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { SalesRepMetrics } from "@/hooks/useSalesTeamMetrics";

interface SalesRepCardProps {
  rep: SalesRepMetrics;
  onViewDetails: (rep: SalesRepMetrics) => void;
}

export const SalesRepCard = memo(forwardRef<HTMLDivElement, SalesRepCardProps>(
  function SalesRepCard({ rep, onViewDetails }, ref) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      return `${mins}min`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}min`;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const callSuccessRate = rep.total_calls > 0 
    ? Math.round((rep.answered_calls / rep.total_calls) * 100) 
    : 0;

  return (
    <Card ref={ref} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onViewDetails(rep)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={rep.user_avatar || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(rep.user_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-foreground">{rep.user_name}</h3>
              <p className="text-xs text-muted-foreground">{rep.user_email}</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Calls */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Ligações</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold">{rep.total_calls}</span>
              <span className="text-xs text-muted-foreground">({formatDuration(rep.total_call_duration)})</span>
            </div>
            {rep.total_calls > 0 && (
              <div className="mt-1.5">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-muted-foreground">Taxa atendimento</span>
                  <span className="font-medium">{callSuccessRate}%</span>
                </div>
                <Progress value={callSuccessRate} className="h-1" />
              </div>
            )}
          </div>

          {/* Deals */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-medium text-muted-foreground">Negócios</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold">{rep.open_deals}</span>
              <span className="text-xs text-muted-foreground">abertos</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pipeline: {formatCurrency(rep.pipeline_value)}
            </p>
          </div>

          {/* Won */}
          <div className="bg-emerald-500/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600">Ganhos</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-emerald-600">{rep.won_deals}</span>
              <span className="text-xs text-muted-foreground">({formatCurrency(rep.won_value)})</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600">
                {rep.conversion_rate.toFixed(0)}% conversão
              </span>
            </div>
          </div>

          {/* Tasks */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Tarefas</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold">{rep.completed_tasks}</span>
              <span className="text-xs text-muted-foreground">/ {rep.total_tasks}</span>
            </div>
            {rep.pending_tasks > 0 && (
              <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0 h-4 border-amber-500 text-amber-600">
                {rep.pending_tasks} pendentes
              </Badge>
            )}
          </div>
        </div>

        {/* Leads */}
        {rep.assigned_leads > 0 && (
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {rep.assigned_leads} leads atribuídos
              </span>
            </div>
            {rep.converted_leads > 0 && (
              <Badge variant="secondary" className="text-xs">
                {rep.converted_leads} convertidos
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}));
