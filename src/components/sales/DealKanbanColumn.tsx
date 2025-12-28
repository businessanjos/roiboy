import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Deal, DealStage } from "@/hooks/useDeals";
import { DealCard } from "./DealCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DealKanbanColumnProps {
  stage: DealStage;
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
}

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
    <Card
      ref={setNodeRef}
      className={cn(
        "w-[300px] flex-shrink-0 bg-muted/30 transition-colors",
        isOver && "ring-2 ring-primary bg-primary/5"
      )}
    >
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {deals.length}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {formatCurrency(totalValue)}
          </span>
        </div>
        {stage.probability > 0 && (
          <p className="text-xs text-muted-foreground">
            {stage.probability}% probabilidade
          </p>
        )}
      </CardHeader>
      <CardContent className="p-2 space-y-2 min-h-[400px]">
        <SortableContext
          items={deals.map(d => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-muted-foreground border-2 border-dashed rounded-lg">
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
      </CardContent>
    </Card>
  );
}
