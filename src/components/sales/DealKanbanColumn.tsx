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
}

const getStageIcon = (stageName: string, color: string) => {
  const lowerName = stageName.toLowerCase();
  const iconClass = "h-4 w-4";
  
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

export function DealKanbanColumn({ stage, deals, onDealClick }: DealKanbanColumnProps) {
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
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {getStageIcon(stage.name, stage.color)}
          <span className="font-medium text-xs truncate">{stage.name}</span>
        </div>
        <Badge 
          variant="secondary" 
          className="text-[10px] px-1.5 py-0 font-semibold rounded-full flex-shrink-0"
          style={{ 
            backgroundColor: `${stage.color}20`,
            color: stage.color,
          }}
        >
          {deals.length}
        </Badge>
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
        <div className="mt-3 px-2 py-2 border-t border-border/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total</span>
            <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
