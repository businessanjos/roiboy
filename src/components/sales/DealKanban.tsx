import { useEffect, useMemo, useState } from "react";
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
import { ZappNavigationProvider } from "@/contexts/ZappNavigationContext";
import { useRequiredFieldsValidation } from "@/hooks/useRequiredFieldsValidation";
import { RequiredFieldsModal } from "./RequiredFieldsModal";
import { CustomField } from "@/components/custom-fields/CustomFieldsManager";
import { supabase } from "@/integrations/supabase/client";

interface DealKanbanProps {
  stages: DealStage[];
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
  onDealMove: (dealId: string, newStageId: string) => Promise<boolean>;
}

interface RequiredFieldsModalState {
  open: boolean;
  dealId: string;
  dealTitle: string;
  targetStageId: string;
  targetStageName: string;
  missingFields: CustomField[];
  accountId: string;
}

export function DealKanban({ stages, deals, onDealClick, onDealMove }: DealKanbanProps) {
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const { validateDealMove } = useRequiredFieldsValidation();
  const [requiredFieldsModal, setRequiredFieldsModal] = useState<RequiredFieldsModalState | null>(null);
  const [faturamentoMap, setFaturamentoMap] = useState<Record<string, string>>({});
  const [itemVendaMap, setItemVendaMap] = useState<Record<string, string>>({});

  const FATURAMENTO_FIELD_ID = 'ed5c7c0e-0740-4945-b982-70a593ffae0c';
  const ITEM_VENDA_FIELD_ID = '033b91fb-3add-4c96-aec9-567fefbd0fb2';
  const CHUNK_SIZE = 200;

  // Stabilize dependency to avoid unnecessary re-fetches
  const dealIdsKey = useMemo(() => deals.map(d => d.id).sort().join(','), [deals]);

  useEffect(() => {
    if (deals.length === 0) return;

    const dealIds = deals.map(d => d.id);

    // Split array into chunks to avoid URL length limits
    const chunk = <T,>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    const fetchFieldMap = async (fieldId: string): Promise<Record<string, string>> => {
      const idChunks = chunk(dealIds, CHUNK_SIZE);

      const [chunkedResults, fieldRes] = await Promise.all([
        Promise.all(
          idChunks.map(ids =>
            supabase
              .from("deal_field_values")
              .select("deal_id, value_text")
              .eq("field_id", fieldId)
              .in("deal_id", ids)
              .not("value_text", "is", null)
          )
        ),
        supabase
          .from("custom_fields")
          .select("options")
          .eq("id", fieldId)
          .single(),
      ]);

      const optionMap: Record<string, string> = {};
      if (fieldRes.data?.options && Array.isArray(fieldRes.data.options)) {
        (fieldRes.data.options as Array<{ value: string; label: string }>).forEach(opt => {
          optionMap[opt.value] = opt.label;
        });
      }

      const map: Record<string, string> = {};
      for (const res of chunkedResults) {
        if (res.error) {
          console.error('[DealKanban] Error fetching field values:', res.error);
          continue;
        }
        if (res.data) {
          res.data.forEach(v => {
            if (v.value_text) {
              map[v.deal_id] = optionMap[v.value_text] || v.value_text;
            }
          });
        }
      }
      return map;
    };

    const resolveProductUUIDs = async (map: Record<string, string>) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const unresolvedUUIDs = [...new Set(
        Object.values(map).filter(value => uuidRegex.test(value))
      )];

      if (unresolvedUUIDs.length === 0) return map;

      const idChunks = chunk(unresolvedUUIDs, CHUNK_SIZE);
      const chunkedResults = await Promise.all(
        idChunks.map(ids =>
          supabase.from("products").select("id, name").in("id", ids)
        )
      );

      const productMap: Record<string, string> = {};
      for (const res of chunkedResults) {
        if (res.data) {
          res.data.forEach(p => { productMap[p.id] = p.name; });
        }
      }

      if (Object.keys(productMap).length === 0) return map;

      const resolved = { ...map };
      for (const [dealId, value] of Object.entries(resolved)) {
        if (productMap[value]) {
          resolved[dealId] = productMap[value];
        }
      }
      return resolved;
    };

    Promise.all([
      fetchFieldMap(FATURAMENTO_FIELD_ID),
      fetchFieldMap(ITEM_VENDA_FIELD_ID).then(resolveProductUUIDs),
    ]).then(([fatMap, itemMap]) => {
      setFaturamentoMap(fatMap);
      setItemVendaMap(itemMap);
    }).catch(err => {
      console.error('[DealKanban] Failed to fetch field maps:', err);
    });
  }, [dealIdsKey]);

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

    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    // Check if dropped on a column
    let targetStage = stages.find(s => s.id === overId);
    
    // Check if dropped on another deal
    if (!targetStage) {
      const targetDeal = deals.find(d => d.id === overId);
      if (targetDeal && targetDeal.stage_id) {
        targetStage = stages.find(s => s.id === targetDeal.stage_id);
      }
    }

    if (!targetStage || deal.stage_id === targetStage.id) return;

    // Validate required fields for target stage
    const validation = await validateDealMove(dealId, targetStage.id, deal.account_id);
    
    if (!validation.canMoveToStage) {
      // Open modal to fill missing required fields
      setRequiredFieldsModal({
        open: true,
        dealId,
        dealTitle: deal.title,
        targetStageId: targetStage.id,
        targetStageName: targetStage.name,
        missingFields: validation.missingFields,
        accountId: deal.account_id,
      });
      return;
    }
    
    // Move normally
    await onDealMove(dealId, targetStage.id);
  };

  const handleRequiredFieldsComplete = async () => {
    if (requiredFieldsModal) {
      await onDealMove(requiredFieldsModal.dealId, requiredFieldsModal.targetStageId);
      setRequiredFieldsModal(null);
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
    <ZappNavigationProvider>
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
                faturamentoMap={faturamentoMap}
                itemVendaMap={itemVendaMap}
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

      {/* Required Fields Modal */}
      {requiredFieldsModal && (
        <RequiredFieldsModal
          open={requiredFieldsModal.open}
          onOpenChange={(open) => !open && setRequiredFieldsModal(null)}
          dealId={requiredFieldsModal.dealId}
          dealTitle={requiredFieldsModal.dealTitle}
          targetStageName={requiredFieldsModal.targetStageName}
          missingFields={requiredFieldsModal.missingFields}
          accountId={requiredFieldsModal.accountId}
          onComplete={handleRequiredFieldsComplete}
        />
      )}
    </ZappNavigationProvider>
  );
}
