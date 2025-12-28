import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Deal, DealStage } from "@/hooks/useDeals";
import { DealCard } from "./DealCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Users, Clock, MessageSquare, CheckCircle, XCircle } from "lucide-react";

interface DealKanbanColumnProps {
  stage: DealStage;
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
  conversionRate?: number;
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

export function DealKanbanColumn({ stage, deals, onDealClick, conversionRate }: DealKanbanColumnProps) {
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
        "min-w-[160px] flex-1 flex flex-col transition-all",
        isOver && "scale-[1.01]"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center gap-1.5 mb-2 px-1 h-5">
        {getStageIcon(stage.name, stage.color)}
        <span className="font-medium text-xs truncate flex-1 min-w-0">{stage.name}</span>
        <Badge 
          variant="secondary" 
          className="text-[10px] w-5 h-5 p-0 font-semibold rounded-full flex items-center justify-center flex-shrink-0"
          style={{ 
            backgroundColor: `${stage.color}20`,
            color: stage.color,
          }}
        >
          {deals.length}
        </Badge>
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
          "flex-1 space-y-2 min-h-[350px] p-1 rounded-lg transition-colors",
          isOver && "bg-primary/5 ring-1 ring-primary/20"
        )}
      >
        <SortableContext
          items={deals.map(d => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-[10px] text-muted-foreground border border-dashed border-border/40 rounded-md bg-muted/10">
              Arraste negociações aqui
            </div>
          ) : (
            deals.map(deal => (
              <DealCard
                key={deal.id}
                deal={deal}
                onClick={() => onDealClick(deal)}
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
