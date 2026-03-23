import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Deal, DealStage } from "@/hooks/useDeals";
import { DealCard } from "./DealCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ActivityStatus } from "@/hooks/useBatchDealActivityStatus";
import { Users, Clock, MessageSquare, CheckCircle, XCircle, ArrowDown } from "lucide-react";

interface DealKanbanColumnProps {
  stage: DealStage;
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
  conversionRate?: number;
  faturamentoMap?: Record<string, string>;
  itemVendaMap?: Record<string, string>;
  isDragActive?: boolean;
  activityStatusGetter?: (dealId: string) => ActivityStatus;
}

const getStageIcon = (stageName: string, color: string) => {
  const lowerName = stageName.toLowerCase();
  const iconClass = "h-3.5 w-3.5";
  
  if (lowerName.includes('lead') || lowerName.includes('cadastr') || lowerName.includes('novo')) {
    return <Users className={iconClass} style={{ color }} />;
  }
  if (lowerName.includes('trial') || lowerName.includes('qualific')) {
    return <Clock className={iconClass} style={{ color }} />;
  }
  if (lowerName.includes('follow') || lowerName.includes('proposta') || lowerName.includes('negocia')) {
    return <MessageSquare className={iconClass} style={{ color }} />;
  }
  if (lowerName.includes('ativo') || lowerName.includes('ganho') || lowerName.includes('fechamento')) {
    return <CheckCircle className={iconClass} style={{ color }} />;
  }
  if (lowerName.includes('cancel') || lowerName.includes('perdid')) {
    return <XCircle className={iconClass} style={{ color }} />;
  }
  return <Users className={iconClass} style={{ color }} />;
};

export function DealKanbanColumn({ stage, deals, onDealClick, conversionRate, faturamentoMap, itemVendaMap, isDragActive = false, activityStatusGetter }: DealKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
    }).format(value);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 min-w-[180px] sm:min-w-[200px] max-w-[280px] sm:max-w-[320px] flex flex-col transition-all duration-200",
        // When drag is active but NOT over this column — subtle pulse hint
        isDragActive && !isOver && "opacity-80",
        // When hovering over this column — strong highlight
        isOver && "opacity-100 scale-[1.02]"
      )}
    >
      {/* Column Header */}
      <div 
        className={cn(
          "flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg transition-all duration-200",
          isOver && "shadow-md",
        )}
        style={isOver ? {
          backgroundColor: `${stage.color}25`,
          boxShadow: `0 0 0 2px ${stage.color}60`,
        } : undefined}
      >
        {getStageIcon(stage.name, stage.color)}
        <span className={cn(
          "font-medium text-xs truncate flex-1 min-w-0 transition-colors",
          isOver && "font-semibold"
        )}>{stage.name}</span>
        {isOver && (
          <ArrowDown 
            className="h-3.5 w-3.5 animate-bounce flex-shrink-0" 
            style={{ color: stage.color }} 
          />
        )}
        <Badge 
          variant="secondary" 
          className={cn(
            "text-[10px] w-5 h-5 p-0 font-semibold rounded-full flex items-center justify-center flex-shrink-0 transition-all",
            isOver && "scale-110"
          )}
          style={{ 
            backgroundColor: `${stage.color}20`,
            color: stage.color,
          }}
        >
          {deals.length}
        </Badge>
        {totalValue > 0 && (
          <span className="text-[11px] font-bold text-muted-foreground truncate max-w-[80px]" title={formatCurrency(totalValue)}>
            {formatCurrency(totalValue)}
          </span>
        )}
        {conversionRate !== undefined ? (
          <span className="text-[9px] text-muted-foreground/70 tabular-nums w-6 text-right flex-shrink-0">
            {conversionRate}%
          </span>
        ) : (
          <span className="w-6 flex-shrink-0" />
        )}
      </div>

      {/* Cards Container */}
      <div 
        className={cn(
          "flex-1 space-y-2 p-1.5 rounded-lg transition-all duration-200 overflow-y-auto overflow-x-hidden border-2 border-transparent",
          // Drop target highlight
          isOver && "border-dashed bg-primary/5",
          // Drag active but not over — show it's a valid drop target
          isDragActive && !isOver && "border-dashed border-border/40 bg-muted/5"
        )}
        style={isOver ? {
          borderColor: `${stage.color}50`,
          backgroundColor: `${stage.color}08`,
        } : undefined}
      >
        <SortableContext
          items={deals.map(d => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.length === 0 ? (
            <div className={cn(
              "flex items-center justify-center h-20 text-[10px] border border-dashed rounded-md transition-all duration-200",
              isOver 
                ? "text-foreground font-medium bg-primary/5 border-primary/30" 
                : "text-muted-foreground border-border/40 bg-muted/10",
              isDragActive && !isOver && "bg-muted/20 border-border/60"
            )}
            style={isOver ? { borderColor: `${stage.color}40`, color: stage.color } : undefined}
            >
              {isOver ? "Solte aqui!" : "Arraste negociações aqui"}
            </div>
          ) : (
            deals.map(deal => (
              <DealCard
                key={deal.id}
                deal={deal}
                onClick={() => onDealClick(deal)}
                faturamentoLabel={faturamentoMap?.[deal.id]}
                itemVendaLabel={itemVendaMap?.[deal.id]}
                activityStatus={activityStatusGetter?.(deal.id)}
              />
            ))
          )}
        </SortableContext>
      </div>

      {/* Column Footer with Total */}
      {deals.length > 0 && (
        <div className="mt-2 px-1 py-1.5 border-t border-border/30">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Total</span>
            <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
