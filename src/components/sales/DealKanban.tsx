import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { Deal, DealStage } from "@/hooks/useDeals";
import { DealKanbanColumn } from "./DealKanbanColumn";
import { DealCard } from "./DealCard";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface DealKanbanProps {
  stages: DealStage[];
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
  onDealMove: (dealId: string, newStageId: string) => Promise<boolean>;
}

export function DealKanban({ stages, deals, onDealClick, onDealMove }: DealKanbanProps) {
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const dealsByStage = useMemo(() => {
    const grouped: Record<string, Deal[]> = {};
    
    // Initialize all stages
    stages.forEach(stage => {
      grouped[stage.id] = [];
    });
    
    // Add deals without stage to first stage
    const noStageDealsList: Deal[] = [];
    
    deals.forEach(deal => {
      if (deal.stage_id && grouped[deal.stage_id]) {
        grouped[deal.stage_id].push(deal);
      } else if (stages.length > 0) {
        noStageDealsList.push(deal);
      }
    });
    
    // Add no-stage deals to first stage
    if (stages.length > 0 && noStageDealsList.length > 0) {
      grouped[stages[0].id] = [...noStageDealsList, ...grouped[stages[0].id]];
    }
    
    return grouped;
  }, [stages, deals]);

  // Calculate conversion rates
  const conversionRates = useMemo(() => {
    const rates: Record<string, number> = {};
    const totalDeals = deals.length;
    
    stages.forEach((stage, index) => {
      const dealsInStage = dealsByStage[stage.id]?.length || 0;
      if (index === 0) {
        // First stage: percentage of total
        rates[stage.id] = totalDeals > 0 ? Math.round((dealsInStage / totalDeals) * 100) : 0;
      } else {
        // Other stages: percentage from previous stage
        const prevStageDeals = dealsByStage[stages[index - 1].id]?.length || 0;
        rates[stage.id] = prevStageDeals > 0 ? Math.round((dealsInStage / prevStageDeals) * 100) : 0;
      }
    });
    
    return rates;
  }, [stages, dealsByStage, deals.length]);

  const handleDragStart = (event: DragStartEvent) => {
    const dealId = event.active.id as string;
    const deal = deals.find(d => d.id === dealId);
    if (deal) {
      setActiveDeal(deal);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) return;

    const dealId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    const targetStage = stages.find(s => s.id === overId);
    if (targetStage) {
      const deal = deals.find(d => d.id === dealId);
      if (deal && deal.stage_id !== targetStage.id) {
        await onDealMove(dealId, targetStage.id);
      }
      return;
    }

    // Check if dropped on another deal
    const targetDeal = deals.find(d => d.id === overId);
    if (targetDeal && targetDeal.stage_id) {
      const deal = deals.find(d => d.id === dealId);
      if (deal && deal.stage_id !== targetDeal.stage_id) {
        await onDealMove(dealId, targetDeal.stage_id);
      }
    }
  };

  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Configure as etapas do pipeline para começar
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full h-[calc(100vh-220px)] overflow-x-auto">
        <div className="flex gap-3 h-full min-w-max pr-4">
          {stages.map((stage, index) => (
            <DealKanbanColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage[stage.id] || []}
              onDealClick={onDealClick}
              conversionRate={index > 0 ? conversionRates[stage.id] : undefined}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeDeal && (
          <DealCard deal={activeDeal} onClick={() => {}} isDragging />
        )}
      </DragOverlay>
    </DndContext>
  );
}
