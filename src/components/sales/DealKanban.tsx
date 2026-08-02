import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { Deal, DealStage } from "@/hooks/useDeals";
import { DealKanbanColumn } from "./DealKanbanColumn";
import { DealCard } from "./DealCard";
import { ZappNavigationProvider } from "@/contexts/ZappNavigationContext";
import { useRequiredFieldsValidation } from "@/hooks/useRequiredFieldsValidation";
import { RequiredFieldsModal } from "./RequiredFieldsModal";
import { CustomField } from "@/components/custom-fields/CustomFieldsManager";
import { supabase } from "@/integrations/supabase/client";
import { useBatchDealActivityStatus } from "@/hooks/useBatchDealActivityStatus";
import { resolveProductMap } from "./productColorResolver";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, Check } from "lucide-react";

interface DealKanbanProps {
  stages: DealStage[];
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
  onDealMove: (dealId: string, newStageId: string) => Promise<boolean>;
  showActivityCounts?: boolean;
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

export function DealKanban({ stages, deals, onDealClick, onDealMove, showActivityCounts = false }: DealKanbanProps) {
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const { validateDealMove } = useRequiredFieldsValidation();
  const [requiredFieldsModal, setRequiredFieldsModal] = useState<RequiredFieldsModalState | null>(null);
  const [faturamentoMap, setFaturamentoMap] = useState<Record<string, string>>({});
  const [itemVendaMap, setItemVendaMap] = useState<Record<string, { name: string; color: string | null }>>({});
  const isMobile = useIsMobile();
  const [mobileStageId, setMobileStageId] = useState<string | null>(null);
  const activeStageId = mobileStageId && stages.some(s => s.id === mobileStageId) ? mobileStageId : stages[0]?.id;
  const activeStageIndex = stages.findIndex(s => s.id === activeStageId);
  const activeStage = activeStageIndex >= 0 ? stages[activeStageIndex] : undefined;

  // Batch fetch activity statuses for ALL deals in a single query
  const dealActivityRefs = useMemo(() => deals.map(d => ({ id: d.id, lead_id: d.lead_id, client_id: d.client_id })), [deals]);
  const { getStatus: getActivityStatus } = useBatchDealActivityStatus(dealActivityRefs);

  const FATURAMENTO_FIELD_ID = 'ed5c7c0e-0740-4945-b982-70a593ffae0c';
  const ITEM_VENDA_FIELD_ID = '033b91fb-3add-4c96-aec9-567fefbd0fb2';
  const CHUNK_SIZE = 200;

  // Stabilize dependency to avoid unnecessary re-fetches
  const dealIdsKey = useMemo(() => deals.map(d => d.id).sort().join(','), [deals]);

  useEffect(() => {
    if (deals.length === 0) return;

    const dealIds = deals.map(d => d.id);

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

    const resolveProductUUIDs = async (map: Record<string, string>): Promise<Record<string, { name: string; color: string | null }>> => {
      // Fetch ALL products once — small table, lets us match by id, slug, or name
      const { data: allProducts } = await supabase
        .from("products")
        .select("id, name, color");

      return resolveProductMap(map, allProducts || []);
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
        distance: 5,
      },
    })
  );

  const measuring = {
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  };

  const dealsByStage = useMemo(() => {
    const grouped: Record<string, Deal[]> = {};
    
    stages.forEach(stage => {
      grouped[stage.id] = [];
    });
    
    const noStageDealsList: Deal[] = [];
    
    deals.forEach(deal => {
      if (deal.stage_id && grouped[deal.stage_id]) {
        grouped[deal.stage_id].push(deal);
      } else if (stages.length > 0) {
        noStageDealsList.push(deal);
      }
    });
    
    if (stages.length > 0 && noStageDealsList.length > 0) {
      grouped[stages[0].id] = [...noStageDealsList, ...grouped[stages[0].id]];
    }
    
    return grouped;
  }, [stages, deals]);

  const conversionRates = useMemo(() => {
    const rates: Record<string, number> = {};
    const totalDeals = deals.length;
    
    stages.forEach((stage, index) => {
      const dealsInStage = dealsByStage[stage.id]?.length || 0;
      if (index === 0) {
        rates[stage.id] = totalDeals > 0 ? Math.round((dealsInStage / totalDeals) * 100) : 0;
      } else {
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
    
    await onDealMove(dealId, targetStage.id);
  };

  const handleRequiredFieldsComplete = async () => {
    if (requiredFieldsModal) {
      await onDealMove(requiredFieldsModal.dealId, requiredFieldsModal.targetStageId);
      setRequiredFieldsModal(null);
    }
  };

  // Mede o espaço realmente disponível abaixo do cabeçalho para o board mobile,
  // evitando altura fixa (que sobra ou corta conforme os filtros abrem/fecham).
  const mobileBoardRef = useRef<HTMLDivElement | null>(null);
  const [mobileBoardHeight, setMobileBoardHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!isMobile) {
      setMobileBoardHeight(null);
      return;
    }
    const measure = () => {
      const el = mobileBoardRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const bottomBar = 64; // barra de abas inferior + safe area
      const next = Math.max(240, Math.round(window.innerHeight - top - bottomBar));
      setMobileBoardHeight((prev) => (prev !== null && Math.abs(prev - next) < 2 ? prev : next));
    };
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    const ro = new ResizeObserver(measure);
    if (document.body) ro.observe(document.body);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      ro.disconnect();
    };
  }, [isMobile, activeStageId]);

  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Configure as etapas do pipeline para começar
      </div>
    );
  }

  const isDragActive = !!activeDeal;

  return (
    <ZappNavigationProvider>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        measuring={measuring}
      >
        {isMobile ? (
          <div className="w-full flex flex-col gap-2">
            {/* Stage selector - app style */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-10">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: activeStage?.color || undefined }}
                    />
                    <span className="truncate font-medium">{activeStage?.name || "Etapa"}</span>
                    <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold">
                      {(dealsByStage[activeStageId || ""] || []).length}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-60 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[calc(100vw-2rem)] max-h-[60vh] overflow-y-auto bg-popover z-50">
                {stages.map((stage) => {
                  const count = (dealsByStage[stage.id] || []).length;
                  return (
                    <DropdownMenuItem
                      key={stage.id}
                      onClick={() => setMobileStageId(stage.id)}
                      className="gap-2"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stage.color || undefined }}
                      />
                      <span className="truncate flex-1">{stage.name}</span>
                      <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold">{count}</span>
                      {stage.id === activeStageId && <Check className="h-3.5 w-3.5" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>


            <div
              ref={mobileBoardRef}
              className="w-full overflow-hidden"
              style={{ height: mobileBoardHeight ? `${mobileBoardHeight}px` : undefined }}
            >
              {activeStage && (
                <DealKanbanColumn
                  key={activeStage.id}
                  fullWidth
                  stage={activeStage}
                  deals={dealsByStage[activeStage.id] || []}
                  onDealClick={onDealClick}
                  conversionRate={activeStageIndex > 0 ? conversionRates[activeStage.id] : undefined}
                  faturamentoMap={faturamentoMap}
                  itemVendaMap={itemVendaMap}
                  isDragActive={isDragActive}
                  activityStatusGetter={getActivityStatus}
                  showActivityCounts={showActivityCounts}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="w-full h-[calc(100vh-220px)] overflow-x-auto -mx-1 px-1">
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
                  isDragActive={isDragActive}
                  activityStatusGetter={getActivityStatus}
                  showActivityCounts={showActivityCounts}
                />
              ))}
            </div>
          </div>
        )}


        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
          }}
        >
          {activeDeal && (
            <div className="rotate-2 scale-105 opacity-90">
              <DealCard deal={activeDeal} onClick={() => {}} isDragging />
            </div>
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
