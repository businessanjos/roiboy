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
  CalendarCheck,
  UserX,
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
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar className="h-12 w-12 flex-shrink-0">
              <AvatarImage src={rep.user_avatar || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(rep.user_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground truncate">{rep.user_name}</h3>
              <p className="text-xs text-muted-foreground truncate">{rep.user_email}</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Calls */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="h-4 w-4 text-info" />
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
          <div className="bg-success/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-4 w-4 text-success" />
              <span className="text-xs font-medium text-success">Ganhos</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-success">{rep.won_deals}</span>
              <span className="text-xs text-muted-foreground">({formatCurrency(rep.won_value)})</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-success" />
              <span className="text-xs font-medium text-success">
                {rep.conversion_rate.toFixed(0)}% conversão
              </span>
            </div>
          </div>

          {/* Tasks */}
          <div className="bg-muted/50 rounded-lg p-3 overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-warning flex-shrink-0" />
              <span className="text-xs font-medium text-muted-foreground">Atividades</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold">{rep.completed_tasks}</span>
              <span className="text-xs text-muted-foreground">/ {rep.total_tasks}</span>
            </div>
            {rep.pending_tasks > 0 && (
              <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0 h-4 border-warning text-warning whitespace-nowrap">
                {rep.pending_tasks} pendentes
              </Badge>
            )}
          </div>
        </div>

        {/* Scheduling Metrics */}
        {(rep.scheduled_calls > 0 || rep.noshow_calls > 0) && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-indigo-500/10 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CalendarCheck className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-medium text-muted-foreground">Agendamentos</span>
              </div>
              <span className="text-lg font-bold">{rep.scheduled_calls}</span>
            </div>
            <div className={`rounded-lg p-3 ${rep.noshow_calls > 0 ? 'bg-danger/10' : 'bg-muted/50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <UserX className={`h-4 w-4 ${rep.noshow_calls > 0 ? 'text-danger' : 'text-muted-foreground'}`} />
                <span className="text-xs font-medium text-muted-foreground">No-Show</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-bold ${rep.noshow_calls > 0 ? 'text-danger' : ''}`}>{rep.noshow_calls}</span>
                {rep.scheduled_calls > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({Math.round((rep.noshow_calls / rep.scheduled_calls) * 100)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Contagem real de tarefas (sem dedupe por negócio) */}
        {(rep.meetings_held_raw > 0 ||
          rep.scheduled_calls_raw > 0 ||
          rep.noshow_calls_raw > 0 ||
          rep.scheduled_completed_raw > 0) && (
          <div className="rounded-lg border border-dashed p-3 mb-4 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Contagem real de tarefas
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <span className="text-muted-foreground">Reuniões realizadas</span>
              <span className="text-right font-medium">
                {rep.meetings_held_raw}
                {rep.meetings_held_raw !== rep.meetings_held && (
                  <span className="text-muted-foreground"> (únicas: {rep.meetings_held})</span>
                )}
              </span>
              <span className="text-muted-foreground">Agendadas concluídas</span>
              <span className="text-right font-medium">{rep.scheduled_completed_raw}</span>
              <span className="text-muted-foreground">Agendamentos criados</span>
              <span className="text-right font-medium">
                {rep.scheduled_calls_raw}
                {rep.scheduled_calls_raw !== rep.scheduled_calls && (
                  <span className="text-muted-foreground"> (únicos: {rep.scheduled_calls})</span>
                )}
              </span>
              <span className="text-muted-foreground">No-show</span>
              <span className="text-right font-medium">
                {rep.noshow_calls_raw}
                {rep.noshow_calls_raw !== rep.noshow_calls && (
                  <span className="text-muted-foreground"> (únicos: {rep.noshow_calls})</span>
                )}
              </span>
              <span className="font-medium">Total de reuniões</span>
              <span className="text-right font-semibold">
                {rep.meetings_held_raw + rep.scheduled_completed_raw}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug pt-1">
              Divergência: o painel mostra{" "}
              <strong>{rep.meetings_held}</strong> porque deduplica por negócio (
              {Math.max(0, rep.meetings_held_raw - rep.meetings_held)} repetidas no mesmo
              negócio) e ignora {rep.scheduled_completed_raw} tarefas "Agendada" já concluídas.
            </p>
          </div>
        )}
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
