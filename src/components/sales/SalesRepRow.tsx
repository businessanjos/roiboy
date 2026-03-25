import { memo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TableRow, TableCell } from "@/components/ui/table";
import { 
  Phone, 
  Trophy, 
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { SalesRepMetrics } from "@/hooks/useSalesTeamMetrics";

interface SalesRepRowProps {
  rep: SalesRepMetrics;
  onViewDetails: (rep: SalesRepMetrics) => void;
}

export const SalesRepRow = memo(function SalesRepRow({ rep, onViewDetails }: SalesRepRowProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}min`;
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const callSuccessRate = rep.total_calls > 0
    ? Math.round((rep.answered_calls / rep.total_calls) * 100)
    : 0;

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => onViewDetails(rep)}
    >
      {/* Name */}
      <TableCell className="py-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={rep.user_avatar || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {getInitials(rep.user_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{rep.user_name}</p>
          </div>
        </div>
      </TableCell>

      {/* Calls */}
      <TableCell className="text-center py-3">
        <div className="flex items-center justify-center gap-1">
          <span className="font-semibold text-sm">{rep.total_calls}</span>
          <span className="text-[10px] text-muted-foreground">({formatDuration(rep.total_call_duration)})</span>
        </div>
        {rep.total_calls > 0 && (
          <span className="text-[10px] text-muted-foreground">{callSuccessRate}% atend.</span>
        )}
      </TableCell>

      {/* Pipeline */}
      <TableCell className="text-center py-3">
        <span className="font-semibold text-sm">{rep.open_deals}</span>
        <p className="text-[10px] text-muted-foreground">{formatCurrency(rep.pipeline_value)}</p>
      </TableCell>

      {/* Won */}
      <TableCell className="text-center py-3">
        <div className="flex items-center justify-center gap-1">
          <span className="font-semibold text-sm text-emerald-600">{rep.won_deals}</span>
          <span className="text-[10px] text-muted-foreground">({formatCurrency(rep.won_value)})</span>
        </div>
        <div className="flex items-center justify-center gap-0.5">
          <TrendingUp className="h-3 w-3 text-emerald-500" />
          <span className="text-[10px] text-emerald-600 font-medium">{rep.conversion_rate.toFixed(0)}%</span>
        </div>
      </TableCell>

      {/* Tasks */}
      <TableCell className="text-center py-3">
        <span className="font-semibold text-sm">{rep.completed_tasks}</span>
        <span className="text-xs text-muted-foreground"> / {rep.total_tasks}</span>
        {rep.pending_tasks > 0 && (
          <div>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500 text-amber-600">
              {rep.pending_tasks} pend.
            </Badge>
          </div>
        )}
      </TableCell>

      {/* Scheduling */}
      <TableCell className="text-center py-3">
        <span className="font-semibold text-sm">{rep.scheduled_calls}</span>
        {rep.noshow_calls > 0 && (
          <div>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-red-500 text-red-600">
              {rep.noshow_calls} no-show
            </Badge>
          </div>
        )}
      </TableCell>

      {/* Leads */}
      <TableCell className="text-center py-3">
        <span className="font-semibold text-sm">{rep.assigned_leads}</span>
        {rep.converted_leads > 0 && (
          <span className="text-[10px] text-muted-foreground"> ({rep.converted_leads} conv.)</span>
        )}
      </TableCell>

      <TableCell className="py-3">
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
});
