import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { usePersistedFilter } from "@/hooks/usePersistedFilter";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useDeals, Deal, DealStage } from "@/hooks/useDeals";
import { usePipelines } from "@/hooks/usePipelines";
import { useLeads } from "@/hooks/useLeads";
import { useSectorUsers } from "@/hooks/useSectorUsers";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { notifyContractCreated } from "@/hooks/useContractNotifications";
import { useRequiredFieldsValidation } from "@/hooks/useRequiredFieldsValidation";
import { useLossReasons } from "@/hooks/useLossReasons";
import {
  DEAL_FIELD_IDS,
  NEGOTIATION_REQUIRED_FIELDS,
  fetchDealCustomFieldValues,
  updateClientWithDealData,
  getContractDataFromDealFields,
  formatDealCustomFieldsForTimeline,
  expandBreakdownToInstallments,
} from "@/utils/dealToClientContractMapping";
import { DealKanban } from "@/components/sales/DealKanban";
import { DealDialog } from "@/components/sales/DealDialog";
import { DealDetailSheet } from "@/components/sales/DealDetailSheet";
import { DealStagesManager } from "@/components/sales/DealStagesManager";
import { CustomFieldsManager } from "@/components/custom-fields/CustomFieldsManager";
import { CustomField } from "@/components/custom-fields/CustomFieldsManager";
import { PipelineFilterButton } from "@/components/sales/PipelineFilterButton";
import { PipelineDebugDialog } from "@/components/sales/PipelineDebugDialog";
import { ActiveFilterChips } from "@/components/sales/ActiveFilterChips";
import type { CustomFieldOption } from "@/components/sales/PipelineFilterDialog";
import { PipelineSelector } from "@/components/sales/PipelineSelector";
import { RequiredFieldsModal } from "@/components/sales/RequiredFieldsModal";
import { PipelineExportDialog } from "@/components/sales/PipelineExportDialog";
import { ActiveFilter, applyFilterToDeals, normalizeForSearch } from "@/hooks/usePipelineFilters";
import { useBatchDealActivityStatus } from "@/hooks/useBatchDealActivityStatus";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/renewals/MultiSelectFilter";
import { buildTitleTagOptions, getTitleTagInfo } from "@/lib/sales/titleTags";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Plus, 
  TrendingUp, 
  Trophy, 
  XCircle,
  Settings2,
  LayoutGrid,
  List,
  Users,
  Target,
  Search,
  Calendar,
  Download,
  MoreVertical,
  Columns3,
  SlidersHorizontal,
  DollarSign,
  BarChart3,
  Package,
  User,
  ChevronDown,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, isWithinInterval, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, addMonths, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import LeadsTab from "@/components/sales/LeadsTab";
import { MeetingScheduleDialog } from "@/components/sales/videocall/MeetingScheduleDialog";
import { DeletedDealsDrawer } from "@/components/sales/DeletedDealsDrawer";
import { isManagementUser } from "@/lib/access/managementRoles";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Trash2 as Trash2Icon } from "lucide-react";


export default function SalesPipeline() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useCurrentUser();
  
  const {
    pipelines,
    activePipelineId,
    activePipeline,
    setActivePipelineId,
    createPipeline,
    updatePipeline,
    deletePipeline,
  } = usePipelines();

  const {
    stages,
    deals,
    loading,
    stagesLoading,
    openDeals,
    wonDeals,
    lostDeals,
    totalWonValue,
    fetchDeals,
    createDeal,
    updateDeal,
    moveDeal,
    deleteDeal,
    markAsWon,
    markAsLost,
    reopenDeal,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
  } = useDeals(activePipelineId);
  
  const { users: salesUsersRaw } = useSectorUsers({ sectorId: "vendas" });
  const salesUsers = useMemo(
    () => salesUsersRaw.filter(u => !["Bruna Pieri", "Arthur Mudri"].includes(u.name?.trim() ?? "")),
    [salesUsersRaw],
  );
  const { isAdmin } = usePermissions();
  const { validateDealOutcome } = useRequiredFieldsValidation();

  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [isStagesManagerOpen, setIsStagesManagerOpen] = useState(false);
  const [isFieldsDialogOpen, setIsFieldsDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isDeletedDrawerOpen, setIsDeletedDrawerOpen] = useState(false);
  const { isSuperAdmin } = useSuperAdmin();
  const canSeeDeleted = isManagementUser(currentUser as any, !!isSuperAdmin);
  // No celular a lista é a leitura natural (estilo app); no desktop, kanban.
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(
    () => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'list' : 'kanban')
  );
  const [activeTab, setActiveTab] = useState('open');
  const [mainTab, setMainTab] = useState<'prospeccao' | 'pipeline'>('pipeline');

  // Defer full leads loading until prospeccao tab is active
  const { leads, loading: leadsLoading, refetch: refetchLeads } = useLeads({ enabled: mainTab === 'prospeccao' });
  
  // Lightweight count query for badge (doesn't fetch all data)
  const [leadsCount, setLeadsCount] = useState<number | null>(null);
  const leadsCountFetched = useRef(false);
  useEffect(() => {
    if (leadsCountFetched.current || !currentUser?.account_id) return;
    leadsCountFetched.current = true;
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', currentUser.account_id)
      .then(({ count }) => {
        setLeadsCount(count ?? 0);
      });
  }, [currentUser?.account_id]);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchMode, setSearchMode] = usePersistedFilter<"contains" | "exact">("salesPipeline", "searchMode", "contains");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);
  const [dealSearchCustomBlobs, setDealSearchCustomBlobs] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null);
  const [activitySort, setActivitySort] = usePersistedFilter<'none' | 'pending_desc' | 'pending_asc' | 'total_desc' | 'total_asc'>("salesPipeline", "activitySort", "none");
  const [titleTagFilter, setTitleTagFilter] = usePersistedFilter<string[]>("salesPipeline", "titleTagFilter", []);
  const [openDatePreset, setOpenDatePreset] = usePersistedFilter<string>("salesPipeline", "openDatePreset", "all");
  const [openDateStart, setOpenDateStart] = usePersistedFilter<string>("salesPipeline", "openDateStart", "");
  const [openDateEnd, setOpenDateEnd] = usePersistedFilter<string>("salesPipeline", "openDateEnd", "");
  const [openDatePopoverOpen, setOpenDatePopoverOpen] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = usePersistedFilter<boolean>("salesPipeline", "filtersCollapsed", false);
  const [wonMonthFilter, setWonMonthFilter] = usePersistedFilter<string>("salesPipeline", "wonMonthFilter", "all");
  const [wonDateStart, setWonDateStart] = usePersistedFilter<string>("salesPipeline", "wonDateStart", "");
  const [filterCustomFields, setFilterCustomFields] = useState<CustomFieldOption[]>([]);
  useEffect(() => {
    if (!currentUser?.account_id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("custom_fields")
        .select("id, name, field_type, options")
        .eq("account_id", currentUser.account_id)
        .eq("show_in_deals", true)
        .eq("is_active", true);
      if (cancelled) return;
      setFilterCustomFields(
        (data || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          field_type: f.field_type,
          options: Array.isArray(f.options) ? f.options : null,
        }))
      );
    })();
    return () => { cancelled = true; };
  }, [currentUser?.account_id]);
  const [wonDateEnd, setWonDateEnd] = usePersistedFilter<string>("salesPipeline", "wonDateEnd", "");
  const [wonDatePopoverOpen, setWonDatePopoverOpen] = useState(false);
  const [wonSellerFilter, setWonSellerFilter] = usePersistedFilter<string[]>("salesPipeline", "wonSellerFilterMulti", []);
  const [wonProductFilter, setWonProductFilter] = usePersistedFilter<string[]>("salesPipeline", "wonProductFilterMulti", []);
  const [lostMonthFilter, setLostMonthFilter] = usePersistedFilter<string>("salesPipeline", "lostMonthFilter", "all");
  const [lostCreatedMonthFilter, setLostCreatedMonthFilter] = usePersistedFilter<string>("salesPipeline", "lostCreatedMonthFilter", "all");
  const [lostReasonFilter, setLostReasonFilter] = usePersistedFilter<string>("salesPipeline", "lostReasonFilter", "all");
  const [lostSellerFilter, setLostSellerFilter] = usePersistedFilter<string[]>("salesPipeline", "lostSellerFilterMulti", []);
  const [lostProductFilter, setLostProductFilter] = usePersistedFilter<string[]>("salesPipeline", "lostProductFilterMulti", []);
  
  // Fetch deal→product mapping from contracts for won AND lost deals
  const [dealProductMap, setDealProductMap] = useState<Record<string, { productId: string; productName: string; isUpsell?: boolean }>>({});
  
  // Stabilize dependency to prevent infinite re-fetch
  const outcomeDeals = useMemo(() => [...wonDeals, ...lostDeals], [wonDeals, lostDeals]);
  const outcomeDealIds = useMemo(() => outcomeDeals.map(d => d.id).join(','), [outcomeDeals]);
  
  useEffect(() => {
    if (!currentUser?.account_id || outcomeDeals.length === 0) {
      setDealProductMap({});
      return;
    }

    const dealIds = outcomeDeals.map((deal) => deal.id);

    const chunk = <T,>(items: T[], size: number) => {
      const chunks: T[][] = [];
      for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
      }
      return chunks;
    };

    const fetchWonDealProductMap = async () => {
      const dealIdChunks = chunk(dealIds, 200);

      const [contractResults, itemVendaResults, fieldResult] = await Promise.all([
        Promise.all(
          dealIdChunks.map((ids) =>
            supabase
              .from('client_contracts')
              .select('deal_id, product_id, contract_type, product:products!client_contracts_product_id_fkey(id, name)')
              .in('deal_id', ids)
              .not('product_id', 'is', null)
          )
        ),
        Promise.all(
          dealIdChunks.map((ids) =>
            supabase
              .from('deal_field_values')
              .select('deal_id, value_text')
              .eq('field_id', DEAL_FIELD_IDS.ITEM_VENDA)
              .in('deal_id', ids)
              .not('value_text', 'is', null)
          )
        ),
        supabase
          .from('custom_fields')
          .select('options')
          .eq('id', DEAL_FIELD_IDS.ITEM_VENDA)
          .maybeSingle(),
      ]);

      const contractMap: Record<string, { productId: string; productName: string; isUpsell?: boolean }> = {};
      contractResults.forEach(({ data, error }) => {
        if (error) throw error;
        (data || []).forEach((contract: any) => {
          if (contract.deal_id && contract.product) {
            contractMap[contract.deal_id] = {
              productId: contract.product.id,
              productName: contract.product.name,
              isUpsell: contract.contract_type === 'upsell',
            };
          }
        });
      });

      const optionMap: Record<string, string> = {};
      if (fieldResult.error) throw fieldResult.error;
      if (Array.isArray(fieldResult.data?.options)) {
        (fieldResult.data.options as Array<{ value: string; label: string }>).forEach((option) => {
          optionMap[option.value] = option.label;
        });
      }

      const fallbackRawMap: Record<string, string> = {};
      itemVendaResults.forEach(({ data, error }) => {
        if (error) throw error;
        (data || []).forEach((fieldValue) => {
          if (fieldValue.deal_id && fieldValue.value_text) {
            fallbackRawMap[fieldValue.deal_id] = fieldValue.value_text;
          }
        });
      });

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const unresolvedProductIds = [...new Set(Object.values(fallbackRawMap).filter((value) => uuidRegex.test(value)))];
      const productNameById: Record<string, string> = {};

      if (unresolvedProductIds.length > 0) {
        const productIdChunks = chunk(unresolvedProductIds, 200);
        const productResults = await Promise.all(
          productIdChunks.map((ids) =>
            supabase
              .from('products')
              .select('id, name')
              .in('id', ids)
          )
        );

        productResults.forEach(({ data, error }) => {
          if (error) throw error;
          (data || []).forEach((product) => {
            productNameById[product.id] = product.name;
          });
        });
      }

      const mergedMap: Record<string, { productId: string; productName: string; isUpsell?: boolean }> = {};
      outcomeDeals.forEach((deal) => {
        const rawValue = fallbackRawMap[deal.id];
        const contractProduct = contractMap[deal.id];
        const isUpsell = contractProduct?.isUpsell || deal.title?.toLowerCase().includes('upsell');

        // The deal's "Item da Venda" is the source of truth for labels/filters.
        // The generated contract may point to the parent/base product, which would
        // incorrectly merge renewal SKUs like "Ren. Rykas Mentoring" into "Rykas Mentoring".
        if (rawValue) {
          mergedMap[deal.id] = {
            productId: rawValue,
            productName: optionMap[rawValue] || productNameById[rawValue] || rawValue,
            isUpsell,
          };
          return;
        }

        if (contractProduct) {
          mergedMap[deal.id] = { ...contractProduct, isUpsell };
        }
      });

      setDealProductMap(mergedMap);
    };

    fetchWonDealProductMap().catch((error) => {
      console.error('[SalesPipeline] Error fetching won deal product map:', error);
      setDealProductMap({});
    });
  }, [currentUser?.account_id, outcomeDealIds]);

  // Fetch structured negotiation fields for WON deals to flag incomplete records.
  const [negotiationStatusMap, setNegotiationStatusMap] = useState<Record<string, string[]>>({});
  // Include updated_at so inline edits to Parcelas / Forma de Pagamento re-run the check
  const wonDealIdsKey = useMemo(
    () => wonDeals.map((d: any) => `${d.id}:${d.updated_at || ''}`).join(','),
    [wonDeals]
  );

  useEffect(() => {
    if (wonDeals.length === 0) {
      setNegotiationStatusMap({});
      return;
    }
    const dealIds = wonDeals.map((d) => d.id);
    const fieldIds = NEGOTIATION_REQUIRED_FIELDS.map((f) => f.id);

    const chunk = <T,>(arr: T[], size: number) => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    (async () => {
      try {
        const chunks = chunk(dealIds, 200);
        const results = await Promise.all(
          chunks.map((ids) =>
            supabase
              .from('deal_field_values')
              .select('deal_id, field_id, value_text, value_number')
              .in('deal_id', ids)
              .in('field_id', fieldIds)
          )
        );

        // Map deal_id -> Set of filled field_ids
        const filled: Record<string, Set<string>> = {};
        results.forEach(({ data, error }) => {
          if (error) throw error;
          (data || []).forEach((row: any) => {
            const meta = NEGOTIATION_REQUIRED_FIELDS.find((f) => f.id === row.field_id);
            if (!meta) return;
            const isFilled = meta.kind === 'number'
              ? row.value_number !== null && row.value_number !== undefined
              : row.value_text !== null && row.value_text !== '' && row.value_text !== undefined;
            if (!isFilled) return;
            if (!filled[row.deal_id]) filled[row.deal_id] = new Set();
            filled[row.deal_id].add(row.field_id);
          });
        });

        const VALOR_ENTRADA_ID = '86c93211-5013-48a6-affe-e53d81931cb6';
        const map: Record<string, string[]> = {};
        const dealById = new Map(wonDeals.map((d: any) => [d.id, d]));
        dealIds.forEach((id) => {
          const deal: any = dealById.get(id);
          const nativeEntrada =
            (Number(deal?.entry_value) || 0) > 0 ||
            (Number(deal?.received_value) || 0) > 0;
          const missing = NEGOTIATION_REQUIRED_FIELDS
            .filter((f) => {
              if (filled[id]?.has(f.id)) return false;
              // Cash Collect / entry_value nativo do deal supre "Valor de Entrada"
              if (f.id === VALOR_ENTRADA_ID && nativeEntrada) return false;
              return true;
            })
            .map((f) => f.label);
          if (missing.length > 0) map[id] = missing;
        });
        setNegotiationStatusMap(map);
      } catch (err) {
        console.error('[SalesPipeline] Error fetching negotiation status:', err);
        setNegotiationStatusMap({});
      }
    })();
  }, [wonDealIdsKey]);

  // Realtime: refresh badge when Parcelas / Forma de Pagamento are edited inline
  useEffect(() => {
    if (wonDeals.length === 0) return;
    const wonIds = new Set(wonDeals.map((d: any) => d.id));
    const fieldIds = new Set(NEGOTIATION_REQUIRED_FIELDS.map((f) => f.id));
    const channel = supabase
      .channel('negotiation-status-refresh')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deal_field_values' },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row) return;
          if (!wonIds.has(row.deal_id)) return;
          if (!fieldIds.has(row.field_id)) return;
          // Bump a re-run by mutating a version counter via state setter
          setNegotiationRefreshTick((t) => t + 1);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [wonDealIdsKey]);

  const [negotiationRefreshTick, setNegotiationRefreshTick] = useState(0);
  useEffect(() => {
    if (negotiationRefreshTick === 0) return;
    // Re-run the negotiation status fetch by re-reading current deals
    (async () => {
      try {
        const dealIds = wonDeals.map((d: any) => d.id);
        const fieldIds = NEGOTIATION_REQUIRED_FIELDS.map((f) => f.id);
        if (dealIds.length === 0) return;
        const { data, error } = await supabase
          .from('deal_field_values')
          .select('deal_id, field_id, value_text, value_number')
          .in('deal_id', dealIds)
          .in('field_id', fieldIds);
        if (error) throw error;
        const filled: Record<string, Set<string>> = {};
        (data || []).forEach((row: any) => {
          const meta = NEGOTIATION_REQUIRED_FIELDS.find((f) => f.id === row.field_id);
          if (!meta) return;
          const isFilled = meta.kind === 'number'
            ? row.value_number !== null && row.value_number !== undefined
            : row.value_text !== null && row.value_text !== '' && row.value_text !== undefined;
          if (!isFilled) return;
          if (!filled[row.deal_id]) filled[row.deal_id] = new Set();
          filled[row.deal_id].add(row.field_id);
        });
        const VALOR_ENTRADA_ID = '86c93211-5013-48a6-affe-e53d81931cb6';
        const map: Record<string, string[]> = {};
        const dealById = new Map(wonDeals.map((d: any) => [d.id, d]));
        dealIds.forEach((id) => {
          const deal: any = dealById.get(id);
          const nativeEntrada =
            (Number(deal?.entry_value) || 0) > 0 ||
            (Number(deal?.received_value) || 0) > 0;
          const missing = NEGOTIATION_REQUIRED_FIELDS
            .filter((f) => {
              if (filled[id]?.has(f.id)) return false;
              if (f.id === VALOR_ENTRADA_ID && nativeEntrada) return false;
              return true;
            })
            .map((f) => f.label);
          if (missing.length > 0) map[id] = missing;
        });
        setNegotiationStatusMap(map);
      } catch (err) {
        console.error('[SalesPipeline] Error refreshing negotiation status:', err);
      }
    })();
  }, [negotiationRefreshTick]);

  // State to prevent double-click on "Mark as Won" button
  const [processingWonDealId, setProcessingWonDealId] = useState<string | null>(null);
  
  // State for required fields validation modal on won/lost
  const [outcomeRequiredFieldsModal, setOutcomeRequiredFieldsModal] = useState<{
    open: boolean;
    dealId: string;
    dealTitle: string;
    outcomeType: "won" | "lost";
    missingFields: CustomField[];
    pendingLostReason?: string;
    clientId?: string | null;
  }>({
    open: false,
    dealId: "",
    dealTitle: "",
    outcomeType: "won",
    missingFields: [],
    clientId: null,
  });


  // Handle URL query param to open deal detail automatically.
  // If the deal belongs to a different pipeline, switch to it first.
  useEffect(() => {
    const dealIdFromUrl = searchParams.get('deal');
    if (!dealIdFromUrl) return;

    if (deals.length > 0 && !loading) {
      const deal = deals.find(d => d.id === dealIdFromUrl);
      if (deal) {
        setSelectedDeal(deal);
        setIsDetailOpen(true);
        searchParams.delete('deal');
        setSearchParams(searchParams, { replace: true });
        return;
      }
    }

    // Deal not in current pipeline — look up its pipeline_id and switch
    let cancelled = false;
    supabase
      .from('deals')
      .select('pipeline_id')
      .eq('id', dealIdFromUrl)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data?.pipeline_id) return;
        if (data.pipeline_id !== activePipelineId) {
          setActivePipelineId(data.pipeline_id);
        }
      });
    return () => { cancelled = true; };
  }, [searchParams, deals, loading, setSearchParams, activePipelineId, setActivePipelineId]);


  useEffect(() => {
    if (!selectedDeal) return;

    const refreshedSelectedDeal = deals.find((deal) => deal.id === selectedDeal.id);

    if (refreshedSelectedDeal) {
      setSelectedDeal(refreshedSelectedDeal);
    }
  }, [deals, selectedDeal]);

  // Fetch products list and open deal→product mapping
  const [pipelineProducts, setPipelineProducts] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [openDealProductMap, setOpenDealProductMap] = useState<Record<string, string>>({});
  const [dealCustomFieldValues, setDealCustomFieldValues] = useState<Record<string, Record<string, string>>>({});

  const allDealIds = useMemo(() => deals.map(d => d.id).join(','), [deals]);
  const dealSearchRelationKey = useMemo(
    () => deals.map(d => `${d.id}:${d.lead_id || ''}:${d.client_id || ''}`).join(','),
    [deals]
  );

  useEffect(() => {
    if (!currentUser?.account_id) return;

    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, color')
        .eq('account_id', currentUser.account_id)
        .eq('is_active', true)
        .order('name');
      setPipelineProducts(data || []);
    };

    const fetchDealProducts = async () => {
      if (deals.length === 0) {
        setOpenDealProductMap({});
        return;
      }
      const dealIds = deals.map(d => d.id);
      const batchSize = 200;
      const map: Record<string, string> = {};

      for (let i = 0; i < dealIds.length; i += batchSize) {
        const batch = dealIds.slice(i, i + batchSize);
        const { data } = await supabase
          .from('deal_field_values')
          .select('deal_id, value_text')
          .eq('field_id', DEAL_FIELD_IDS.ITEM_VENDA)
          .in('deal_id', batch)
          .not('value_text', 'is', null);

        (data || []).forEach(row => {
          if (row.deal_id && row.value_text) {
            map[row.deal_id] = row.value_text;
          }
        });
      }
      setOpenDealProductMap(map);
    };

    fetchProducts();
    fetchDealProducts();
  }, [currentUser?.account_id, allDealIds]);

  // Fetch custom field values for fields referenced by the active filter
  const customFieldIdsInFilter = useMemo(() => {
    const ids = new Set<string>();
    (activeFilter?.conditions || []).forEach(c => {
      if (typeof c.field === 'string' && c.field.startsWith('custom:')) {
        ids.add(c.field.slice('custom:'.length));
      }
    });
    return Array.from(ids).sort().join(',');
  }, [activeFilter]);

  useEffect(() => {
    if (!customFieldIdsInFilter || deals.length === 0) {
      setDealCustomFieldValues({});
      return;
    }
    const fieldIds = customFieldIdsInFilter.split(',').filter(Boolean);
    const dealIds = deals.map(d => d.id);
    const batchSize = 200;
    const result: Record<string, Record<string, string>> = {};
    (async () => {
      for (let i = 0; i < dealIds.length; i += batchSize) {
        const batch = dealIds.slice(i, i + batchSize);
        const { data } = await supabase
          .from('deal_field_values')
          .select('deal_id, field_id, value_text, value_number, value_date, value_json, value_boolean')
          .in('field_id', fieldIds)
          .in('deal_id', batch);
        (data || []).forEach((row: any) => {
          if (!row.deal_id || !row.field_id) return;
          if (!result[row.deal_id]) result[row.deal_id] = {};
          let normalized = '';
          if (row.value_text != null && row.value_text !== '') {
            normalized = String(row.value_text);
          } else if (row.value_number != null) {
            normalized = String(row.value_number);
          } else if (row.value_date != null) {
            normalized = String(row.value_date);
          } else if (row.value_boolean != null) {
            normalized = row.value_boolean ? 'true' : 'false';
          } else if (Array.isArray(row.value_json)) {
            // multi_select: wrap with pipes for unambiguous "contains" lookup
            normalized = '|' + row.value_json.map(String).join('|') + '|';
          } else if (row.value_json != null) {
            normalized = JSON.stringify(row.value_json);
          }
          result[row.deal_id][row.field_id] = normalized;
        });
      }
      setDealCustomFieldValues(result);
    })();
  }, [customFieldIdsInFilter, allDealIds]);

  // Fetch ALL searchable secondary data for the current deals when the user is
  // actively searching — enables the search box to match what appears in the
  // deal drawer/timeline too (observações, atividades, tarefas, lead/client).
  // Only fires while a term is typed to keep the query cost bounded.
  // Mapa field_id -> (option value -> label) para traduzir chaves de select/multi_select
  // em rótulos legíveis no blob de busca (usuário digita "Rykas Pass", banco tem "rykas_pass").
  const customFieldOptionLabels = useMemo(() => {
    const m: Record<string, Record<string, string>> = {};
    for (const f of filterCustomFields) {
      if (!f.options || !Array.isArray(f.options)) continue;
      const inner: Record<string, string> = {};
      for (const opt of f.options as any[]) {
        if (opt && opt.value != null && opt.label != null) {
          inner[String(opt.value)] = String(opt.label);
        }
      }
      if (Object.keys(inner).length) m[f.id] = inner;
    }
    return m;
  }, [filterCustomFields]);

  // Gate por booleano — o conteúdo dos blobs não depende do termo em si,
  // apenas do conjunto de deals. Evita refetch a cada tecla digitada.
  const isSearchingActive = debouncedSearchTerm.trim().length >= 2;

  // Cache em memória por chave de relacionamento — trocar de pipeline e voltar
  // não refaz as consultas enquanto o conjunto de deals for o mesmo.
  const searchBlobCacheRef = useRef<Map<string, Record<string, string>>>(new Map());

  useEffect(() => {
    if (!isSearchingActive || deals.length === 0 || !currentUser?.account_id) {
      setDealSearchCustomBlobs({});
      return;
    }
    const cacheKey = `${currentUser.account_id}::${dealSearchRelationKey}`;
    const cached = searchBlobCacheRef.current.get(cacheKey);
    if (cached) {
      setDealSearchCustomBlobs(cached);
      return;
    }

    let cancelled = false;
    (async () => {
      const dealIds = deals.map(d => d.id);
      const leadToDealIds = new Map<string, string[]>();
      const clientToDealIds = new Map<string, string[]>();
      for (const deal of deals) {
        if (deal.lead_id) {
          const ids = leadToDealIds.get(deal.lead_id) || [];
          ids.push(deal.id);
          leadToDealIds.set(deal.lead_id, ids);
        }
        if (deal.client_id) {
          const ids = clientToDealIds.get(deal.client_id) || [];
          ids.push(deal.id);
          clientToDealIds.set(deal.client_id, ids);
        }
      }
      const batchSize = 500;
      const acc: Record<string, string[]> = {};
      const accountId = currentUser.account_id;

      const pushParts = (dealId: string | null | undefined, parts: unknown[]) => {
        if (!dealId) return;
        const clean = parts
          .flatMap((value) => {
            if (value === null || value === undefined || value === '') return [];
            if (Array.isArray(value)) return value.map(v => typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));
            if (typeof value === 'object') return [JSON.stringify(value)];
            return [String(value)];
          })
          .filter(Boolean);
        if (!clean.length) return;
        if (!acc[dealId]) acc[dealId] = [];
        acc[dealId].push(...clean);
      };

      const chunk = <T,>(arr: T[], size: number): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };

      const dealBatches = chunk(dealIds, batchSize);
      const leadBatches = chunk(Array.from(leadToDealIds.keys()), batchSize);
      const clientBatches = chunk(Array.from(clientToDealIds.keys()), batchSize);

      // Dispara TODAS as consultas em paralelo (6 tabelas × N batches).
      const [
        dfvResults,
        activitiesResults,
        tasksResults,
        leadsResults,
        leadTimelineResults,
        clientsResults,
        followupsResults,
      ] = await Promise.all([
        Promise.all(dealBatches.map(batch =>
          supabase.from('deal_field_values')
            .select('deal_id, field_id, value_text, value_number, value_date, value_boolean, value_json')
            .eq('account_id', accountId).in('deal_id', batch).limit(50000)
        )),
        Promise.all(dealBatches.map(batch =>
          supabase.from('deal_activities')
            .select('deal_id, title, content, old_value, new_value')
            .eq('account_id', accountId).in('deal_id', batch).limit(50000)
        )),
        Promise.all(dealBatches.map(batch =>
          supabase.from('internal_tasks')
            .select(`deal_id, title, description,
              assigned_user:users!internal_tasks_assigned_to_fkey(name),
              custom_status:task_statuses!internal_tasks_custom_status_id_fkey(name),
              activity_type:activity_types!internal_tasks_activity_type_id_fkey(name)`)
            .eq('account_id', accountId).in('deal_id', batch).limit(50000)
        )),
        Promise.all(leadBatches.map(batch =>
          supabase.from('leads')
            .select('id, full_name, phone, email, emails, additional_phones, instagram, instagrams, source, notes, mql, canal, revenue_range, company_name, business_segment, business_niche, city, state, business_city, business_state, tags')
            .eq('account_id', accountId).in('id', batch).limit(50000)
        )),
        Promise.all(leadBatches.map(batch =>
          supabase.from('lead_timeline')
            .select('lead_id, title, description, event_type, metadata')
            .eq('account_id', accountId).in('lead_id', batch).limit(50000)
        )),
        Promise.all(clientBatches.map(batch =>
          supabase.from('clients')
            .select('id, full_name, phone_e164, emails, additional_phones, instagram, instagrams, notes, company_name, business_segment, business_niche, city, state, business_city, business_state, tags')
            .eq('account_id', accountId).in('id', batch).limit(50000)
        )),
        Promise.all(clientBatches.map(batch =>
          supabase.from('client_followups')
            .select('client_id, title, content, type')
            .eq('account_id', accountId).in('client_id', batch).limit(50000)
        )),
      ]);

      if (cancelled) return;

      // Processa deal_field_values
      for (const res of dfvResults) {
        if (res.error) { console.error('[SalesPipeline] custom field blob fetch error:', res.error); continue; }
        (res.data || []).forEach((row: any) => {
          if (!row.deal_id) return;
          const parts: string[] = [];
          const labelMap = row.field_id ? customFieldOptionLabels[row.field_id] : undefined;
          if (row.value_text != null && row.value_text !== '') {
            const raw = String(row.value_text);
            parts.push(raw);
            if (labelMap && labelMap[raw]) parts.push(labelMap[raw]);
          }
          if (row.value_number != null) parts.push(String(row.value_number));
          if (row.value_date != null) parts.push(String(row.value_date));
          if (row.value_boolean != null) parts.push(row.value_boolean ? 'sim true verdadeiro' : 'nao não false falso');
          if (row.value_json != null) {
            try {
              if (Array.isArray(row.value_json)) {
                for (const v of row.value_json) {
                  if (v == null) continue;
                  const s = typeof v === 'string' ? v : (typeof v === 'object' ? JSON.stringify(v) : String(v));
                  parts.push(s);
                  if (labelMap && labelMap[s]) parts.push(labelMap[s]);
                }
              } else if (typeof row.value_json === 'string') {
                parts.push(row.value_json);
                if (labelMap && labelMap[row.value_json]) parts.push(labelMap[row.value_json]);
              } else {
                parts.push(JSON.stringify(row.value_json));
              }
            } catch { /* ignore */ }
          }
          pushParts(row.deal_id, parts);
        });
      }

      for (const res of activitiesResults) {
        if (res.error) { console.error('[SalesPipeline] activity search blob fetch error:', res.error); continue; }
        (res.data || []).forEach((row: any) => {
          pushParts(row.deal_id, [row.title, row.content, row.old_value, row.new_value]);
        });
      }

      for (const res of tasksResults) {
        if (res.error) { console.error('[SalesPipeline] task search blob fetch error:', res.error); continue; }
        (res.data || []).forEach((row: any) => {
          pushParts(row.deal_id, [row.title, row.description, row.activity_type?.name, row.custom_status?.name, row.assigned_user?.name]);
        });
      }

      for (const res of leadsResults) {
        if (res.error) { console.error('[SalesPipeline] lead search blob fetch error:', res.error); continue; }
        (res.data || []).forEach((lead: any) => {
          const ids = leadToDealIds.get(lead.id) || [];
          ids.forEach((dealId) => pushParts(dealId, [
            lead.full_name, lead.phone, lead.email, lead.emails, lead.additional_phones,
            lead.instagram, lead.instagrams, lead.source, lead.notes, lead.mql, lead.canal,
            lead.revenue_range, lead.company_name, lead.business_segment, lead.business_niche,
            lead.city, lead.state, lead.business_city, lead.business_state, lead.tags,
          ]));
        });
      }

      for (const res of leadTimelineResults) {
        if (res.error) { console.error('[SalesPipeline] lead timeline search blob fetch error:', res.error); continue; }
        (res.data || []).forEach((event: any) => {
          const ids = leadToDealIds.get(event.lead_id) || [];
          ids.forEach((dealId) => pushParts(dealId, [event.title, event.description, event.event_type, event.metadata]));
        });
      }

      for (const res of clientsResults) {
        if (res.error) { console.error('[SalesPipeline] client search blob fetch error:', res.error); continue; }
        (res.data || []).forEach((client: any) => {
          const ids = clientToDealIds.get(client.id) || [];
          ids.forEach((dealId) => pushParts(dealId, [
            client.full_name, client.phone_e164, client.emails, client.additional_phones,
            client.instagram, client.instagrams, client.notes, client.company_name,
            client.business_segment, client.business_niche, client.city, client.state,
            client.business_city, client.business_state, client.tags,
          ]));
        });
      }

      for (const res of followupsResults) {
        if (res.error) { console.error('[SalesPipeline] client followup search blob fetch error:', res.error); continue; }
        (res.data || []).forEach((followup: any) => {
          const ids = clientToDealIds.get(followup.client_id) || [];
          ids.forEach((dealId) => pushParts(dealId, [followup.title, followup.content, followup.type]));
        });
      }

      if (cancelled) return;
      const combined: Record<string, string> = {};
      for (const [id, arr] of Object.entries(acc)) {
        const normalized = normalizeForSearch(arr.join(' | '));
        const digits = normalized.replace(/\D/g, '');
        combined[id] = digits ? `${normalized} | ${digits}` : normalized;
      }
      // Cache LRU simples — mantém no máximo 5 combinações
      if (searchBlobCacheRef.current.size >= 5) {
        const firstKey = searchBlobCacheRef.current.keys().next().value;
        if (firstKey) searchBlobCacheRef.current.delete(firstKey);
      }
      searchBlobCacheRef.current.set(cacheKey, combined);
      setDealSearchCustomBlobs(combined);
    })();
    return () => { cancelled = true; };
  }, [isSearchingActive, dealSearchRelationKey, currentUser?.account_id, customFieldOptionLabels]);


  // Base search blob (in-memory, no DB): title, notes, contact/client/lead,
  // responsible, stage, tags, product name.
  const dealBaseSearchBlobs = useMemo(() => {
    const map: Record<string, string> = {};
    deals.forEach(d => {
      const parts = [
        d.title,
        d.notes,
        d.source,
        d.contact_name,
        d.contact_phone,
        d.contact_email,
        d.client?.full_name,
        d.client?.phone_e164,
        d.lead?.full_name,
        d.lead?.phone,
        d.lead?.email,
        d.responsible_user?.name,
        d.sdr_user?.name,
        d.stage?.name,
        (d.tags || []).join(' '),
        openDealProductMap[d.id] || '',
      ].filter(Boolean).map(v => String(v));
      const normalized = normalizeForSearch(parts.join(' | '));
      // Anexa versão só-dígitos: permite buscar telefone digitando "11987654321"
      // mesmo quando armazenado como "+55 (11) 98765-4321" ou "+5511987654321".
      const digits = normalized.replace(/\D/g, '');
      map[d.id] = digits ? `${normalized} | ${digits}` : normalized;
    });
    return map;
  }, [deals, openDealProductMap]);

  const dealSearchBlobs = useMemo(() => {
    const out: Record<string, string> = {};
    const ids = new Set([...Object.keys(dealBaseSearchBlobs), ...Object.keys(dealSearchCustomBlobs)]);
    ids.forEach(id => {
      out[id] = (dealBaseSearchBlobs[id] || '') + ' | ' + (dealSearchCustomBlobs[id] || '');
    });
    return out;
  }, [dealBaseSearchBlobs, dealSearchCustomBlobs]);

  const searchOptions = useMemo(() => ({ mode: searchMode, blobs: dealSearchBlobs }), [searchMode, dealSearchBlobs]);




  // Extract unique tags from all deals
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    deals.forEach(deal => {
      if (deal.tags && Array.isArray(deal.tags)) {
        deal.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [deals]);

  // Batch activity statuses to support "Próxima atividade em" and "Sem atividades" filters.
  // Pass lead_id too, because tasks can be linked to the lead instead of directly to the deal.
  const dealActivityRefs = useMemo(() => openDeals.map(d => ({ id: d.id, lead_id: d.lead_id, client_id: d.client_id })), [openDeals]);
  const { statusMap: activityStatusMap, isLoading: activityStatusLoading } = useBatchDealActivityStatus(dealActivityRefs);

  const dealNextActivityMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    Object.entries(activityStatusMap).forEach(([id, s]) => {
      m[id] = s?.nextDueDate ?? null;
    });
    return m;
  }, [activityStatusMap]);

  const dealTaskCountMap = useMemo(() => {
    const m: Record<string, number> = {};
    Object.entries(activityStatusMap).forEach(([id, s]) => {
      m[id] = s?.totalActivities ?? 0;
    });
    return m;
  }, [activityStatusMap]);

  const dealPendingCountMap = useMemo(() => {
    const m: Record<string, number> = {};
    Object.entries(activityStatusMap).forEach(([id, s]) => {
      m[id] = s?.pendingCount ?? 0;
    });
    return m;
  }, [activityStatusMap]);

  // Pending-activity metadata per deal (type name + status name) for the
  // "Tipo/Status de atividade pendente" custom filter fields.
  const [dealPendingTypesMap, setDealPendingTypesMap] = useState<Record<string, string[]>>({});
  const [dealPendingStatusesMap, setDealPendingStatusesMap] = useState<Record<string, string[]>>({});
  const openDealIdsKey = useMemo(() => openDeals.map(d => d.id).sort().join(','), [openDeals]);
  useEffect(() => {
    const ids = openDealIdsKey ? openDealIdsKey.split(',') : [];
    if (ids.length === 0) {
      setDealPendingTypesMap({});
      setDealPendingStatusesMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      const CHUNK = 500;
      const typesMap: Record<string, Set<string>> = {};
      const statusMap: Record<string, Set<string>> = {};
      for (let i = 0; i < ids.length; i += CHUNK) {
        const batch = ids.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from('internal_tasks')
          .select(`deal_id, completed_at,
            activity_type:activity_types!internal_tasks_activity_type_id_fkey(name),
            custom_status:task_statuses!internal_tasks_custom_status_id_fkey(name, is_completed_status)`)
          .in('deal_id', batch)
          .is('completed_at', null)
          .limit(50000);
        if (error) { console.error('[SalesPipeline] pending activity meta fetch error:', error); continue; }
        (data || []).forEach((row: any) => {
          if (!row.deal_id) return;
          if (row.custom_status?.is_completed_status) return; // truly pending only
          const typeName = row.activity_type?.name?.trim();
          const statusName = row.custom_status?.name?.trim();
          if (typeName) {
            (typesMap[row.deal_id] ||= new Set()).add(typeName.toLowerCase());
          }
          if (statusName) {
            (statusMap[row.deal_id] ||= new Set()).add(statusName.toLowerCase());
          }
        });
      }
      if (cancelled) return;
      const asArr = (m: Record<string, Set<string>>) => Object.fromEntries(
        Object.entries(m).map(([k, v]) => [k, Array.from(v)])
      );
      setDealPendingTypesMap(asArr(typesMap));
      setDealPendingStatusesMap(asArr(statusMap));
    })();
    return () => { cancelled = true; };
  }, [openDealIdsKey]);

  const activeFilterNeedsActivityCounts = useMemo(() => {
    if (activitySort !== 'none') return true;
    return (activeFilter?.conditions || []).some((condition) =>
      condition.field === 'next_activity_date' ||
      condition.field === 'total_tasks' ||
      condition.field === 'pending_tasks' ||
      condition.field === 'pending_activity_type' ||
      condition.field === 'pending_activity_status'
    );
  }, [activeFilter, activitySort]);


  // Range de datas para filtro do pipeline aberto (criação do negócio)
  const openDateRange = useMemo<{ start: Date; end: Date } | null>(() => {
    const now = new Date();
    switch (openDatePreset) {
      case 'today': return { start: startOfDay(now), end: endOfDay(now) };
      case 'this_week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'this_month': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month': { const d = subMonths(now, 1); return { start: startOfMonth(d), end: endOfMonth(d) }; }
      case 'this_quarter': return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case 'this_year': return { start: startOfYear(now), end: endOfYear(now) };
      case 'custom':
        if (openDateStart && openDateEnd) return { start: startOfDay(new Date(openDateStart)), end: endOfDay(new Date(openDateEnd)) };
        return null;
      default: return null;
    }
  }, [openDatePreset, openDateStart, openDateEnd]);

  const openDateLabel = useMemo(() => {
    switch (openDatePreset) {
      case 'today': return 'Hoje';
      case 'this_week': return 'Esta semana';
      case 'this_month': return 'Este mês';
      case 'last_month': return 'Mês passado';
      case 'this_quarter': return 'Este trimestre';
      case 'this_year': return 'Este ano';
      case 'custom':
        if (openDateStart && openDateEnd) return `${format(new Date(openDateStart), 'dd/MM/yy')} - ${format(new Date(openDateEnd), 'dd/MM/yy')}`;
        return 'Personalizado';
      default: return 'Todas as datas';
    }
  }, [openDatePreset, openDateStart, openDateEnd]);

  // Deals após aplicar filtro do vendedor/busca/data (mas antes do filtro de origem).
  // Usado como base para as opções do filtro de origem e como base do filtro final.
  const dealsBeforeTagFilter = useMemo(() => {
    if (activityStatusLoading && activeFilterNeedsActivityCounts) return [];
    const base = applyFilterToDeals(openDeals, activeFilter, debouncedSearchTerm, openDealProductMap, dealCustomFieldValues, dealNextActivityMap, searchOptions, dealTaskCountMap, dealPendingCountMap, dealPendingTypesMap, dealPendingStatusesMap);
    if (!openDateRange) return base;
    return base.filter(d => {
      if (!d.created_at) return false;
      const created = new Date(d.created_at);
      return isWithinInterval(created, { start: openDateRange.start, end: openDateRange.end });
    });
  }, [activityStatusLoading, activeFilterNeedsActivityCounts, openDeals, activeFilter, debouncedSearchTerm, openDealProductMap, dealCustomFieldValues, dealNextActivityMap, dealTaskCountMap, dealPendingCountMap, dealPendingTypesMap, dealPendingStatusesMap, openDateRange, searchOptions]);


  // Opções do filtro de origem — respeitam os demais filtros ativos.
  const titleTagOptions = useMemo(() => buildTitleTagOptions(dealsBeforeTagFilter), [dealsBeforeTagFilter]);

  // Apply unified filter to deals
  const filteredOpenDeals = useMemo(() => {
    if (!titleTagFilter.length) return dealsBeforeTagFilter;
    const selected = new Set(titleTagFilter);
    return dealsBeforeTagFilter.filter(d => {
      const info = getTitleTagInfo(d.title);
      return info ? selected.has(info.key) : false;
    });
  }, [dealsBeforeTagFilter, titleTagFilter]);

  // Sort by activity metrics when the user chose a non-default option.
  // Kanban preserves stage grouping — sorting only reorders cards inside each column.
  const sortedOpenDeals = useMemo(() => {
    if (activitySort === 'none') return filteredOpenDeals;
    const pendingOf = (id: string) => dealPendingCountMap[id] ?? 0;
    const totalOf = (id: string) => dealTaskCountMap[id] ?? 0;
    const cmp = (a: Deal, b: Deal) => {
      switch (activitySort) {
        case 'pending_desc': return pendingOf(b.id) - pendingOf(a.id);
        case 'pending_asc':  return pendingOf(a.id) - pendingOf(b.id);
        case 'total_desc':   return totalOf(b.id) - totalOf(a.id);
        case 'total_asc':    return totalOf(a.id) - totalOf(b.id);
        default: return 0;
      }
    };
    return [...filteredOpenDeals].sort(cmp);
  }, [filteredOpenDeals, activitySort, dealPendingCountMap, dealTaskCountMap]);

  const filteredOpenTotalValue = useMemo(
    () => filteredOpenDeals.reduce((sum, deal) => sum + (deal.value || 0), 0),
    [filteredOpenDeals],
  );

  const filteredOpenWeightedValue = useMemo(
    () => filteredOpenDeals.reduce((sum, deal) => {
      const stageProbability = (deal as any).stage?.probability ?? 0;
      const probability = (deal.probability && deal.probability > 0) ? deal.probability : stageProbability;
      return sum + ((deal.value || 0) * probability / 100);
    }, 0),
    [filteredOpenDeals],
  );

  const filteredWonDeals = useMemo(() =>
    applyFilterToDeals(wonDeals, null, debouncedSearchTerm, openDealProductMap, undefined, undefined, searchOptions),
    [wonDeals, debouncedSearchTerm, openDealProductMap, searchOptions]
  );
  const filteredLostDeals = useMemo(() =>
    applyFilterToDeals(lostDeals, null, debouncedSearchTerm, openDealProductMap, undefined, undefined, searchOptions),
    [lostDeals, debouncedSearchTerm, openDealProductMap, searchOptions]
  );

  // Available months for won deals filter (always include current month)
  const availableWonMonths = useMemo(() => {
    const monthsSet = new Map<string, string>();
    const addMonth = (date: Date) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
      monthsSet.set(key, label.charAt(0).toUpperCase() + label.slice(1));
    };
    // Always include current month so it can be selected even with no deals yet
    addMonth(new Date());
    wonDeals.forEach(deal => {
      if (deal.won_at) addMonth(new Date(deal.won_at));
    });
    return Array.from(monthsSet.entries())
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [wonDeals]);

  // Available sellers for won deals filter
  const availableWonSellers = useMemo(() => {
    const sellersMap = new Map<string, string>();
    wonDeals.forEach(deal => {
      if (deal.responsible_user_id && deal.responsible_user?.name) {
        sellersMap.set(deal.responsible_user_id, deal.responsible_user.name);
      }
    });
    return Array.from(sellersMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [wonDeals]);

  // Available products for won deals filter — dedupe by full name (keeps "Ren." separate from regular)
  const availableWonProducts = useMemo(() => {
    const byName = new Map<string, string>(); // nameKey -> displayName (uses first productId seen)
    const nameToId = new Map<string, string>();
    wonDeals.forEach(deal => {
      const product = dealProductMap[deal.id];
      if (product) {
        const nameKey = product.productName.trim().toLowerCase();
        if (!byName.has(nameKey)) {
          byName.set(nameKey, product.productName.trim());
          nameToId.set(nameKey, product.productId);
        }
      }
    });
    return Array.from(byName.entries())
      .map(([nameKey, displayName]) => [nameToId.get(nameKey)!, displayName] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [wonDeals, dealProductMap]);

  // Filter won deals by selected month, seller, and product
  const filteredWonDealsByMonth = useMemo(() => {
    let result = filteredWonDeals;
    
    if (wonMonthFilter === 'custom' && wonDateStart && wonDateEnd) {
      const start = startOfDay(new Date(wonDateStart));
      const end = endOfDay(new Date(wonDateEnd));
      result = result.filter(deal => {
        if (!deal.won_at) return false;
        return isWithinInterval(new Date(deal.won_at), { start, end });
      });
    } else if (wonMonthFilter !== 'all' && wonMonthFilter !== 'custom') {
      result = result.filter(deal => {
        if (!deal.won_at) return false;
        const date = new Date(deal.won_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return key === wonMonthFilter;
      });
    }

    if (wonSellerFilter.length > 0) {
      result = result.filter(deal => deal.responsible_user_id && wonSellerFilter.includes(deal.responsible_user_id));
    }

    if (wonProductFilter.length > 0) {
      const selectedNames = new Set(
        wonProductFilter
          .map(id => availableWonProducts.find(([pid]) => pid === id)?.[1]?.trim().toLowerCase())
          .filter(Boolean) as string[]
      );
      const selectedIds = new Set(wonProductFilter);
      result = result.filter(deal => {
        const product = dealProductMap[deal.id];
        if (!product) return false;
        return selectedIds.has(product.productId) || selectedNames.has(product.productName.trim().toLowerCase());
      });
    }
    
    // Sort by won_at descending (most recent first)
    return [...result].sort((a, b) => {
      const dateA = a.won_at ? new Date(a.won_at).getTime() : 0;
      const dateB = b.won_at ? new Date(b.won_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [filteredWonDeals, wonMonthFilter, wonSellerFilter, wonProductFilter, dealProductMap, wonDateStart, wonDateEnd]);

  const filteredWonTotal = useMemo(() => {
    return filteredWonDealsByMonth.reduce((sum, deal) => sum + (deal.value || 0), 0);
  }, [filteredWonDealsByMonth]);

  // Available months for lost deals filter
  const availableLostMonths = useMemo(() => {
    const monthsSet = new Map<string, string>();
    lostDeals.forEach(deal => {
      if (deal.lost_at) {
        const date = new Date(deal.lost_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
        monthsSet.set(key, label.charAt(0).toUpperCase() + label.slice(1));
      }
    });
    return Array.from(monthsSet.entries())
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [lostDeals]);

  // Available creation months for lost deals filter
  const availableLostCreatedMonths = useMemo(() => {
    const monthsSet = new Map<string, string>();
    lostDeals.forEach(deal => {
      if (deal.created_at) {
        const date = new Date(deal.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
        monthsSet.set(key, label.charAt(0).toUpperCase() + label.slice(1));
      }
    });
    return Array.from(monthsSet.entries())
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [lostDeals]);

  // Use structured loss reasons from hook
  const { reasons: lossReasons } = useLossReasons();

  // Available sellers for lost deals filter
  const availableLostSellers = useMemo(() => {
    const sellersMap = new Map<string, string>();
    lostDeals.forEach(deal => {
      if (deal.responsible_user_id && deal.responsible_user?.name) {
        sellersMap.set(deal.responsible_user_id, deal.responsible_user.name);
      }
    });
    return Array.from(sellersMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [lostDeals]);

  // Available products for lost deals filter (deduplicated by name)
  const availableLostProducts = useMemo(() => {
    const productsMap = new Map<string, string>();
    const seenNames = new Set<string>();
    lostDeals.forEach(deal => {
      const product = dealProductMap[deal.id];
      if (product) {
        const normalizedName = product.productName.trim().toLowerCase();
        if (!seenNames.has(normalizedName)) {
          seenNames.add(normalizedName);
          productsMap.set(product.productId, product.productName);
        }
      }
    });
    return Array.from(productsMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [lostDeals, dealProductMap]);

  // Filter lost deals by selected month, reason, seller, and product
  const filteredLostDealsByMonth = useMemo(() => {
    let result = filteredLostDeals;
    if (lostMonthFilter !== 'all') {
      result = result.filter(deal => {
        if (!deal.lost_at) return false;
        const date = new Date(deal.lost_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return key === lostMonthFilter;
      });
    }
    if (lostCreatedMonthFilter !== 'all') {
      result = result.filter(deal => {
        if (!deal.created_at) return false;
        const date = new Date(deal.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return key === lostCreatedMonthFilter;
      });
    }
    if (lostReasonFilter !== 'all') {
      result = result.filter(deal => {
        if (deal.loss_reason_id === lostReasonFilter) return true;
        const matchedReason = lossReasons.find(r => r.id === lostReasonFilter);
        if (matchedReason && deal.lost_reason?.includes(matchedReason.name)) return true;
        return false;
      });
    }
    if (lostSellerFilter.length > 0) {
      result = result.filter(deal => deal.responsible_user_id && lostSellerFilter.includes(deal.responsible_user_id));
    }
    if (lostProductFilter.length > 0) {
      const selectedNames = new Set(
        lostProductFilter
          .map(id => availableLostProducts.find(([pid]) => pid === id)?.[1]?.trim().toLowerCase())
          .filter(Boolean) as string[]
      );
      const selectedIds = new Set(lostProductFilter);
      result = result.filter(deal => {
        const product = dealProductMap[deal.id];
        if (!product) return false;
        return selectedIds.has(product.productId) || selectedNames.has(product.productName.trim().toLowerCase());
      });
    }
    return result;
  }, [filteredLostDeals, lostMonthFilter, lostCreatedMonthFilter, lostReasonFilter, lossReasons, lostSellerFilter, lostProductFilter, availableLostProducts, dealProductMap]);

  // Cohort breakdown: created in the same month it was lost vs. carried over from previous months
  const lostCohortStats = useMemo(() => {
    const monthKey = (value?: string | null) => {
      if (!value) return null;
      const d = new Date(value);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    let sameMonth = 0;
    let carriedOver = 0;
    let unknown = 0;
    filteredLostDealsByMonth.forEach(deal => {
      const created = monthKey(deal.created_at);
      const lost = monthKey(deal.lost_at);
      if (!created || !lost) { unknown++; return; }
      if (created === lost) sameMonth++;
      else carriedOver++;
    });
    return { sameMonth, carriedOver, unknown, total: filteredLostDealsByMonth.length };
  }, [filteredLostDealsByMonth]);

  const filteredLostTotal = useMemo(() => {
    return filteredLostDealsByMonth.reduce((sum, deal) => sum + (deal.value || 0), 0);
  }, [filteredLostDealsByMonth]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleDealClick = (deal: Deal) => {
    setSelectedDeal(deal);
    setIsDetailOpen(true);
  };

  const handleEditFromDetail = () => {
    setIsDetailOpen(false);
    // Small delay to ensure Sheet closes before Dialog opens
    setTimeout(() => {
      setIsEditDialogOpen(true);
    }, 100);
  };

  // Meeting schedule dialog state
  const [meetingDialog, setMeetingDialog] = useState<{
    open: boolean;
    dealId?: string;
    leadId?: string;
    clientId?: string;
    participantName?: string;
    participantPhone?: string;
    stageName?: string;
  }>({ open: false });

  const handleDealMove = async (dealId: string, newStageId: string, newPipelineId?: string): Promise<boolean> => {
    const result = await moveDeal(dealId, newStageId, newPipelineId);
    
    if (result) {
      // Check if target stage name contains "reunião" or "reuniao"
      const targetStage = stages.find(s => s.id === newStageId);
      const stageName = targetStage?.name?.toLowerCase() || "";
      if (stageName.includes("reunião") || stageName.includes("reuniao")) {
        const deal = deals.find(d => d.id === dealId);
        setMeetingDialog({
          open: true,
          dealId,
          leadId: deal?.lead_id || undefined,
          clientId: deal?.client_id || undefined,
          participantName: deal?.contact_name || deal?.lead?.full_name || deal?.client?.full_name || "",
          participantPhone: deal?.contact_phone || deal?.lead?.phone || deal?.client?.phone_e164 || "",
          stageName: targetStage?.name,
        });
      }
    }
    
    return result;
  };

  const handleSaveDeal = async (data: any, sendNotification?: boolean) => {
    if (isEditDialogOpen && selectedDeal) {
      await updateDeal(selectedDeal.id, data);
    } else {
      const newDeal = await createDeal(data);
      
      // Send notification to responsible user if checkbox was checked
      if (sendNotification && newDeal && data.responsible_user_id && currentUser) {
        // Only notify if responsible is different from creator
        if (data.responsible_user_id !== currentUser.id) {
          try {
            await supabase.from("notifications").insert({
              account_id: currentUser.account_id,
              user_id: data.responsible_user_id,
              type: "new_deal",
              title: "📊 Novo negócio atribuído",
              content: `"${data.title}" foi atribuído a você`,
              link: `/pipeline`,
              source_type: "deal",
              source_id: newDeal.id,
              triggered_by_user_id: currentUser.id,
            });
          } catch (error) {
            console.error("Error sending deal notification:", error);
          }
        }
      }
    }
    setSelectedDeal(null);
    setIsEditDialogOpen(false);
    setIsNewDealOpen(false);
  };

  const handleMarkAsWon = async (dealId: string, skipValidation = false) => {
    // CRITICAL FIX: Prevent double-click
    if (processingWonDealId) {
      toast.warning("Aguarde, processando negócio anterior...");
      return;
    }

    // Find the deal to get client/lead info
    const deal = deals.find(d => d.id === dealId);
    if (!deal) {
      toast.error("Negociação não encontrada");
      return;
    }

    // Validate required fields for "won" outcome (unless skipping after modal fill)
    // Briefing operacional é OPCIONAL — não bloqueia o ganho
    if (!skipValidation && currentUser?.account_id) {
      const validation = await validateDealOutcome(dealId, "won", currentUser.account_id);

      const hasMissingFields = !validation.canMoveToStage && validation.missingFields.length > 0;

      if (hasMissingFields) {
        setOutcomeRequiredFieldsModal({
          open: true,
          dealId,
          dealTitle: deal.title,
          outcomeType: "won",
          missingFields: validation.missingFields,
          clientId: deal.client_id ?? null,
        } as any);
        return;
      }
    }

    setProcessingWonDealId(dealId);

    try {
      let clientId = deal.client_id;
      
      // Fetch deal custom field values BEFORE conversion
      const dealFieldValues = await fetchDealCustomFieldValues(dealId);
      
      // STEP 1: Convert lead to client if necessary
      if (deal.lead_id && !deal.client_id) {
        // 1. Fetch lead data to check status and phone
        const { data: lead } = await supabase
          .from('leads')
          .select('phone, account_id, converted_to_client_id, status')
          .eq('id', deal.lead_id)
          .single();
        
        // 2. If lead was already converted, use existing client
        if (lead?.converted_to_client_id) {
          clientId = lead.converted_to_client_id;
        } else if (lead?.phone) {
          // 3. Check if client with same phone already exists
          const { data: existingClient } = await supabase
            .from('clients')
            .select('id')
            .eq('account_id', lead.account_id)
            .eq('phone_e164', lead.phone)
            .maybeSingle();
          
          if (existingClient) {
            // 4. Use existing client and mark lead as converted
            clientId = existingClient.id;
            await supabase
              .from('leads')
              .update({ 
                converted_to_client_id: existingClient.id,
                converted_at: new Date().toISOString(),
                status: 'converted'
              })
              .eq('id', deal.lead_id);
            toast.success("Lead vinculado ao cliente existente!");
          } else {
            // 5. No existing client, do normal conversion
            const { data: convertedClient, error: convertError } = await supabase
              .rpc('convert_lead_to_client', { p_lead_id: deal.lead_id });
            
            // CRITICAL FIX: Validate both error AND null return
            if (convertError || !convertedClient) {
              console.error("[MarkAsWon] Error converting lead:", convertError || "RPC returned null");
              toast.error("Erro ao converter lead para cliente. Verifique os dados do lead.");
              return; // Block flow
            }
            clientId = convertedClient;
            toast.success("Lead convertido para cliente!");
          }
        } else {
          // Lead has no phone, try normal conversion
          const { data: convertedClient, error: convertError } = await supabase
            .rpc('convert_lead_to_client', { p_lead_id: deal.lead_id });
          
          // CRITICAL FIX: Validate both error AND null return
          if (convertError || !convertedClient) {
            console.error("[MarkAsWon] Error converting lead:", convertError || "RPC returned null");
            toast.error("Erro ao converter lead para cliente. Verifique os dados do lead.");
            return; // Block flow
          }
          clientId = convertedClient;
          toast.success("Lead convertido para cliente!");
        }
        
        // STEP 2: CRITICAL VALIDATION - Ensure we have a valid clientId
        if (!clientId) {
          console.error("[MarkAsWon] CRITICAL: clientId is null after conversion attempt for deal:", dealId);
          toast.error("Erro crítico: Não foi possível obter o ID do cliente. Tente novamente.");
          return; // Block flow - DO NOT proceed without clientId
        }
        
        // STEP 3: Update deal with client_id
        const { error: updateDealError } = await supabase
          .from('deals')
          .update({ client_id: clientId })
          .eq('id', dealId);
        
        if (updateDealError) {
          console.error("[MarkAsWon] Error updating deal with client_id:", updateDealError);
          // Continue even with error here, since client was created
        }
      }

      // STEP 4: Update client with deal custom field data (Instagram, City, Bonus)
      if (clientId && currentUser?.account_id) {
        await updateClientWithDealData(clientId, currentUser.account_id, dealFieldValues);
        
        // Save salesperson (sales_user_id) from deal to client
        // responsible_user_id remains NULL so client goes to Operations triage queue
        if (deal.responsible_user_id) {
          const { error: salesUserError } = await supabase
            .from('clients')
            .update({ sales_user_id: deal.responsible_user_id })
            .eq('id', clientId);
          
          if (salesUserError) {
            console.error("[MarkAsWon] Error setting sales_user_id:", salesUserError);
          }
        }
      }

      // STEP 4.1: Create automatic onboarding tasks for new client
      if (clientId && currentUser?.account_id) {
        try {
          const { createClientOnboardingTasks } = await import("@/utils/clientOnboardingAutomation");
          await createClientOnboardingTasks({
            clientId,
            accountId: currentUser.account_id,
            userId: currentUser.id,
          });
          console.log("[MarkAsWon] Onboarding tasks created for new client");
        } catch (onboardingError) {
          console.error("[MarkAsWon] Error creating onboarding tasks:", onboardingError);
          // Non-blocking - continue the flow
        }
      }

      // STEP 4.5: Transfer "Call Comercial Concluída" notes to client timeline
      if (clientId && currentUser?.account_id) {
        try {
          // 1. Find the "Call Comercial Concluída" activity type
          const { data: activityType } = await supabase
            .from("activity_types")
            .select("id")
            .eq("account_id", currentUser.account_id)
            .eq("name", "Call Comercial Concluída")
            .maybeSingle();

          if (activityType?.id) {
            // 2. Fetch completed tasks of this type for this deal
            const { data: callTasks } = await supabase
              .from("internal_tasks")
              .select("id, title, description, completed_at, created_by")
              .eq("deal_id", dealId)
              .eq("activity_type_id", activityType.id)
              .not("completed_at", "is", null)
              .not("description", "is", null)
              .order("completed_at", { ascending: true });

            // 3. Transfer each task's notes to client timeline
            if (callTasks && callTasks.length > 0) {
              const followupsToInsert = callTasks
                .filter(task => task.description?.trim())
                .map(task => ({
                  account_id: currentUser.account_id,
                  client_id: clientId,
                  user_id: task.created_by || currentUser.id,
                  type: "note" as const,
                  title: `📞 ${task.title || "Call Comercial Concluída"}`,
                  content: task.description?.trim(),
                }));

              if (followupsToInsert.length > 0) {
                const { error: followupsError } = await supabase
                  .from("client_followups")
                  .insert(followupsToInsert);

                if (followupsError) {
                  console.error("[MarkAsWon] Error transferring call notes:", followupsError);
                } else {
                  console.log(`[MarkAsWon] Transferred ${followupsToInsert.length} call notes to client timeline`);
                }
              }
            }
          }
        } catch (transferError) {
          console.error("[MarkAsWon] Error in call notes transfer:", transferError);
          // Don't block the flow - this is a non-critical enhancement
        }
      }

      // STEP 4.6: Transfer Deal Custom Fields to client timeline
      if (clientId && currentUser?.account_id) {
        try {
          const customFieldsText = await formatDealCustomFieldsForTimeline(dealId, currentUser.account_id);
          
          if (customFieldsText) {
            const { error: fieldsNoteError } = await supabase
              .from("client_followups")
              .insert({
                account_id: currentUser.account_id,
                client_id: clientId,
                user_id: currentUser.id,
                type: "note",
                title: "📋 Dados da Negociação",
                content: customFieldsText,
              });
            
            if (fieldsNoteError) {
              console.error("[MarkAsWon] Error transferring custom fields:", fieldsNoteError);
            } else {
              console.log("[MarkAsWon] Custom fields transferred to client timeline");
            }
          }
        } catch (fieldsError) {
          console.error("[MarkAsWon] Error in custom fields transfer:", fieldsError);
          // Non-blocking - continue the flow
        }
      }

      // STEP 4.7: Transfer Instagram and Informação para Operação individually to client timeline
      if (clientId && currentUser?.account_id) {
        try {
          // Find the specific custom fields by name
          const { data: specificFields } = await supabase
            .from("custom_fields")
            .select("id, name, field_type")
            .eq("account_id", currentUser.account_id)
            .eq("show_in_deals", true)
            .eq("is_active", true)
            .in("name", ["Instagram", "Informação para Operação"]);

          if (specificFields && specificFields.length > 0) {
            for (const field of specificFields) {
              const { data: fieldValue } = await supabase
                .from("deal_field_values")
                .select("value_text")
                .eq("deal_id", dealId)
                .eq("field_id", field.id)
                .maybeSingle();

              const value = fieldValue?.value_text;
              if (value && value.trim()) {
                const isInstagram = field.name === "Instagram";
                const title = isInstagram ? "📸 Instagram do Negócio" : "📌 Informação para Operação";

                await supabase
                  .from("client_followups")
                  .insert({
                    account_id: currentUser.account_id,
                    client_id: clientId,
                    user_id: currentUser.id,
                    type: "note",
                    title,
                    content: value.trim(),
                  });

                console.log(`[MarkAsWon] ${field.name} transferred to client timeline`);
              }
            }
          }
        } catch (specificFieldsError) {
          console.error("[MarkAsWon] Error transferring specific fields:", specificFieldsError);
          // Non-blocking
        }
      }

      // STEP 5: Create contract BEFORE marking as won
      let contractCreated = false;
      if (clientId && currentUser?.account_id) {
        const today = new Date().toISOString().split('T')[0];
        const clientName = deal.client?.full_name || deal.lead?.full_name || deal.contact_name || "";
        
        // Get contract data from deal custom fields
        const contractDataFromDeal = await getContractDataFromDealFields(dealFieldValues);

        // === Validação: "Item da Venda" precisa resolver para um produto real ===
        const rawItemVenda = (dealFieldValues.itemVenda ?? "").toString().trim();
        if (!rawItemVenda) {
          toast.error(
            "Este negócio não tem 'Item da Venda' preenchido. Volte ao card do negócio, escolha o produto vendido e tente novamente.",
            { duration: 8000 }
          );
          return;
        }
        if (!contractDataFromDeal.product_id) {
          const detail = contractDataFromDeal.product_mapping_error
            ? `\nMotivo: ${contractDataFromDeal.product_mapping_error}\n`
            : "";
          const proceed = window.confirm(
            `Não consegui mapear "${rawItemVenda}" para um produto ativo no catálogo.${detail}\n` +
            `• Verifique se o produto existe em Configurações → Produtos e está ativo.\n` +
            `• Se o nome/label mudou, atualize o mapeamento ou renomeie o produto exatamente igual.\n\n` +
            `Continuar mesmo assim criará um contrato SEM produto vinculado (comissão, dashboards por produto e badges não vão funcionar).\n\n` +
            `Deseja continuar assim mesmo?`
          );
          if (!proceed) {
            toast.error("Ganho cancelado. Corrija o Item da Venda antes de continuar.");
            return;
          }
          toast.warning(`Contrato será criado sem produto vinculado (Item da Venda: "${rawItemVenda}")`, { duration: 8000 });
        }


        const contractData = {
          client_id: clientId,
          account_id: currentUser.account_id,
          deal_id: dealId, // Link contract to deal for reopening logic
          start_date: today,
          value: deal.value || 0,
          contract_type: 'Compra',
          status: 'active',
          receivables_generated: false, // será marcado true logo abaixo após preparar installments_detail (ou fallback)

          notes: `Contrato gerado automaticamente do negócio: ${deal.title}`,
          product_id: contractDataFromDeal.product_id || null,
          payment_method: contractDataFromDeal.payment_method || null,
          negotiation_description: contractDataFromDeal.negotiation_description || null,
        };


        // Anti-duplicate check: verify no contract exists for this deal
        const { data: existingContract } = await supabase
          .from("client_contracts")
          .select("id")
          .eq("deal_id", dealId)
          .maybeSingle();

        if (existingContract) {
          console.warn("[MarkAsWon] Contract already exists for deal:", dealId, "- skipping creation");
          contractCreated = true; // Contract exists, treat as success
        } else {
          const { data: newContract, error: contractError } = await supabase
            .from("client_contracts")
            .insert(contractData)
            .select("id")
            .single();

          if (contractError) {
            console.error("[MarkAsWon] Error creating contract:", contractError);
            // Ask user if they want to continue without contract
            const continueWithoutContract = window.confirm(
              "Houve um erro ao criar o contrato. Deseja marcar como ganho mesmo assim?\n\n" +
              "Você precisará criar o contrato manualmente depois."
            );
            if (!continueWithoutContract) {
              return; // User cancelled - don't proceed
            }
            toast.warning("Negócio será marcado como ganho, mas o contrato precisará ser criado manualmente.");
          } else if (newContract) {
            contractCreated = true;

            // STEP 5.1: If this is a renewal deal, link to parent contract and register renewal outcome
            try {
              const { data: dealRenewalInfo } = await supabase
                .from("deals")
                .select("source, source_contract_id, tags")
                .eq("id", dealId)
                .maybeSingle();

              const isRenewalDeal =
                dealRenewalInfo?.source === "contract_renewal" ||
                (Array.isArray(dealRenewalInfo?.tags) && dealRenewalInfo!.tags.includes("renovação"));

              if (isRenewalDeal && dealRenewalInfo?.source_contract_id) {
                const parentContractId = dealRenewalInfo.source_contract_id;

                // Link new contract to the parent (so it's treated as a child renewal)
                const { error: linkError } = await supabase
                  .from("client_contracts")
                  .update({ parent_contract_id: parentContractId })
                  .eq("id", newContract.id);

                if (linkError) {
                  console.error("[MarkAsWon] Error linking parent_contract_id:", linkError);
                }

                // Upsert renewal_outcomes as 'renewed' so /renewals reflects the closure
                const { data: existingOutcome } = await supabase
                  .from("renewal_outcomes")
                  .select("id")
                  .eq("contract_id", parentContractId)
                  .maybeSingle();

                const outcomePayload = {
                  account_id: currentUser.account_id,
                  client_id: clientId,
                  contract_id: parentContractId,
                  outcome: "renewed",
                  new_contract_id: newContract.id,
                  renewal_value: deal.value || 0,
                  resolved_at: new Date().toISOString(),
                  resolved_by: currentUser.id,
                  loss_reason: null,
                  loss_notes: `Renovado automaticamente via deal ganho: ${deal.title}`,
                };

                if (existingOutcome?.id) {
                  const { error: updErr } = await supabase
                    .from("renewal_outcomes")
                    .update(outcomePayload)
                    .eq("id", existingOutcome.id);
                  if (updErr) console.error("[MarkAsWon] Error updating renewal_outcome:", updErr);
                } else {
                  const { error: insErr } = await supabase
                    .from("renewal_outcomes")
                    .insert(outcomePayload);
                  if (insErr) console.error("[MarkAsWon] Error inserting renewal_outcome:", insErr);
                }

                console.log("[MarkAsWon] Renewal loop closed for parent contract:", parentContractId);
              }
            } catch (renewalErr) {
              console.error("[MarkAsWon] Error closing renewal loop:", renewalErr);
              // Non-blocking
            }

            // Send notifications to operations and financial teams
            await notifyContractCreated({
              contractId: newContract.id,
              clientName,
              contractValue: deal.value || 0,
              fromDeal: true,
              createdByUserId: currentUser.id,
              accountId: currentUser.account_id,
            });

            // STEP 5.2: Auto-generate installments in financial if we have enough data.
            // Priority order:
            //   1) "Detalhamento de Pagamento" (PaymentBreakdownComposer) — one row per
            //      method with amount + installments + first_due_date. Expanded into
            //      the full flat installments_detail array.
            //   2) Legacy simple "Parcelas" field: distributes (deal.value − received)
            //      evenly, starting 30 days from today.
            // In both cases the "Negociação" tab still lets the user fine-tune before
            // the receivables are actually created.
            try {
              const totalValue = Number(deal.value) || 0;
              const received = Number((deal as any).received_value) || 0;
              const paymentMethod = contractDataFromDeal.payment_method;
              const breakdown = dealFieldValues.paymentBreakdown;

              let installmentsDetail: Array<{ amount: number; due_date: string; method: string }> = [];
              let firstDueIso: string | null = null;

              if (breakdown && breakdown.length > 0) {
                installmentsDetail = expandBreakdownToInstallments(breakdown);
                firstDueIso = installmentsDetail[0]?.due_date || null;
              } else {
                const parcelas = dealFieldValues.parcelas || 0;
                const toInstallment = Math.max(0, totalValue - received);
                if (parcelas > 0 && toInstallment > 0 && paymentMethod) {
                  const today = new Date();
                  const firstDue = addDays(today, 30);
                  const per = Math.round((toInstallment / parcelas) * 100) / 100;
                  const parcelasDetail = Array.from({ length: parcelas }).map((_, i) => ({
                    amount: per,
                    due_date: format(addMonths(firstDue, i), "yyyy-MM-dd"),
                    method: paymentMethod,
                  }));
                  // Entrada (Cash Collect): quando já houve valor recebido, ela vira
                  // a 1ª parcela do plano — total efetivo = Entrada + N parcelas.
                  if (received > 0) {
                    const entradaIso = format(today, "yyyy-MM-dd");
                    installmentsDetail = [
                      { amount: received, due_date: entradaIso, method: "entrada" },
                      ...parcelasDetail,
                    ];
                    firstDueIso = entradaIso;
                  } else {
                    installmentsDetail = parcelasDetail;
                    firstDueIso = format(firstDue, "yyyy-MM-dd");
                  }
                }
              }

              if (installmentsDetail.length > 0 && firstDueIso) {
                const { error: prepErr } = await supabase
                  .from("client_contracts")
                  .update({
                    installments_count: installmentsDetail.length,
                    first_due_date: firstDueIso,
                    installments_detail: installmentsDetail,
                  })
                  .eq("id", newContract.id);

                if (prepErr) {
                  console.error("[MarkAsWon] Auto-installments prep error:", prepErr);
                } else {
                  const { error: flagErr } = await supabase
                    .from("client_contracts")
                    .update({
                      receivables_generated: true,
                      receivables_generated_at: new Date().toISOString(),
                    })
                    .eq("id", newContract.id);

                  if (flagErr) {
                    console.error("[MarkAsWon] Auto-installments flag error:", flagErr);
                  } else {
                    console.log(`[MarkAsWon] Auto-generated ${installmentsDetail.length} installment(s) from ${breakdown?.length ? "breakdown" : "parcelas"} starting ${firstDueIso}`);
                    toast.success(`${installmentsDetail.length} parcela(s) geradas automaticamente no financeiro`);
                  }
                }
              } else {
                console.log("[MarkAsWon] Sem breakdown/parcelas — disparando geração de recebíveis a partir do valor do contrato");
                const { error: fallbackFlagErr } = await supabase
                  .from("client_contracts")
                  .update({
                    receivables_generated: true,
                    receivables_generated_at: new Date().toISOString(),
                  })
                  .eq("id", newContract.id);
                if (fallbackFlagErr) {
                  console.error("[MarkAsWon] Fallback receivables flag error:", fallbackFlagErr);
                } else {
                  toast.success("Recebíveis do contrato gerados automaticamente no financeiro");
                }
              }
            } catch (autoErr) {
              console.error("[MarkAsWon] Error auto-generating installments:", autoErr);
              // Non-blocking — user can still generate manually in the Negociação tab.
            }
          }

        }
      }

      // STEP 6: NOW mark as won (only after all validations passed)
      await markAsWon(dealId);
      

      // STEP 7: (Omie OS integration removed)

      setIsDetailOpen(false);
      setSelectedDeal(null);

      
      if (contractCreated) {
        toast.success("🎉 Negócio ganho! Contrato enviado para a fila de conciliação.");
      } else if (clientId) {
        toast.success("🎉 Negócio ganho!");
      } else {
        toast.success("Negociação marcada como ganha!");
      }
    } catch (error) {
      console.error("[MarkAsWon] Error marking deal as won:", error);
      toast.error("Erro ao processar ganho. Tente novamente.");
    } finally {
      setProcessingWonDealId(null);
    }
  };

  const handleMarkAsLost = async (dealId: string, reason?: string, lossData?: { lossReasonId?: string; lossSubReasonId?: string; lossNotes?: string } | boolean) => {
    // Handle backward compat: if lossData is boolean, it's the old skipValidation flag
    const skipValidation = typeof lossData === 'boolean' ? lossData : false;
    const structuredLossData = typeof lossData === 'object' ? lossData : undefined;

    // Find the deal for validation
    const deal = deals.find(d => d.id === dealId);
    if (!deal) {
      toast.error("Negociação não encontrada");
      return;
    }

    // Validate required fields for "lost" outcome (unless skipping after modal fill)
    if (!skipValidation && currentUser?.account_id) {
      const validation = await validateDealOutcome(dealId, "lost", currentUser.account_id);
      if (!validation.canMoveToStage && validation.missingFields.length > 0) {
        setOutcomeRequiredFieldsModal({
          open: true,
          dealId,
          dealTitle: deal.title,
          outcomeType: "lost",
          missingFields: validation.missingFields,
          pendingLostReason: reason,
        });
        return;
      }
    }

    await markAsLost(dealId, reason, structuredLossData);
    setIsDetailOpen(false);
    setSelectedDeal(null);
  };

  // Callback when required fields are filled for won/lost outcome
  const handleOutcomeRequiredFieldsComplete = async () => {
    const { dealId, outcomeType, pendingLostReason } = outcomeRequiredFieldsModal;
    
    setOutcomeRequiredFieldsModal(prev => ({ ...prev, open: false }));
    
    if (outcomeType === "won") {
      // Re-call handleMarkAsWon with skip validation flag
      await handleMarkAsWon(dealId, true);
    } else {
      // Re-call handleMarkAsLost with skip validation flag
      await handleMarkAsLost(dealId, pendingLostReason, true);
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    await deleteDeal(dealId);
    setIsEditDialogOpen(false);
    setSelectedDeal(null);
  };

  const handleReopen = async (dealId: string) => {
    await reopenDeal(dealId);
    setIsDetailOpen(false);
    setSelectedDeal(null);
  };

  if (loading || stagesLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-36 sm:w-48" />
          <Skeleton className="h-8 sm:h-10 w-24 sm:w-32" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 sm:h-24" />
          ))}
        </div>
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[400px] sm:h-[500px] w-[200px] sm:w-[300px] flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Main Tabs */}
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'prospeccao' | 'pipeline')}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <TabsList className="grid grid-cols-2 sm:flex">
              <TabsTrigger value="prospeccao" className="gap-1.5 text-xs sm:text-sm">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Prospecção
                <Badge variant="secondary" className="text-[10px] sm:text-xs">{mainTab === 'prospeccao' ? leads.length : (leadsCount ?? '...')}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pipeline" className="gap-1.5 text-xs sm:text-sm">
                <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Pipeline
                <Badge variant="secondary" className="text-[10px] sm:text-xs">{openDeals.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {mainTab === 'pipeline' && (
                <>
                  {/* View toggle - desktop only */}
                  <div className="flex items-center border rounded-lg overflow-hidden">
                    <Button
                      variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="rounded-none h-8"
                      onClick={() => setViewMode('kanban')}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="rounded-none h-8"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Config dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => setIsStagesManagerOpen(true)}>
                        <Columns3 className="h-4 w-4 mr-2" />
                        Gerenciar Etapas
                      </DropdownMenuItem>
                      {isAdmin && (
                        <DropdownMenuItem onClick={() => setIsFieldsDialogOpen(true)}>
                          <SlidersHorizontal className="h-4 w-4 mr-2" />
                          Campos Personalizados
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setIsExportDialogOpen(true)}>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar Pipeline
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button size="sm" className="h-8 sm:h-9 gap-1.5" onClick={() => setIsNewDealOpen(true)}>
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Novo Deal</span>
                  </Button>
                </>
              )}
            </div>
          </div>


          <TabsContent value="prospeccao" className="mt-3 sm:mt-4">
            <LeadsTab />
          </TabsContent>

          <TabsContent value="pipeline" className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
            {/* Pipeline Selector + Sub-tabs Row */}
            <div className="space-y-3">
              {/* Pipeline selector row + unified filters */}
              <div className="flex flex-col gap-2">
                <div className={cn("gap-2 sm:gap-3", filtersCollapsed ? "flex flex-wrap items-center" : "flex flex-col")}>
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-none">
                  <PipelineSelector
                    pipelines={pipelines}
                    activePipelineId={activePipelineId}
                    onSelect={setActivePipelineId}
                    onCreate={createPipeline}
                    onUpdate={updatePipeline}
                    onDelete={deletePipeline}
                  />
                  </div>
                  
                  
                  {/* Filters toolbar */}
                  <div className={filtersCollapsed ? "flex-1 min-w-0 w-full sm:w-auto" : "w-full"}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:flex-wrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full sm:w-auto justify-center sm:justify-start gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                        onClick={() => setFiltersCollapsed(!filtersCollapsed)}
                        aria-expanded={!filtersCollapsed}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Filtros e busca
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !filtersCollapsed && "rotate-180")} />
                      </Button>
                      {activeTab === 'open' && (
                        <div className="flex items-center justify-center sm:justify-start gap-4 sm:gap-5 text-xs sm:text-sm w-full sm:w-auto">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                            <span className="text-muted-foreground">{filteredOpenDeals.length} negócios</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-semibold">{formatCurrency(filteredOpenTotalValue)}</span>
                          </div>
                          <div className="hidden sm:flex items-center gap-1.5">
                            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Ponderado:</span>
                            <span className="font-medium">{formatCurrency(filteredOpenWeightedValue)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                  {!filtersCollapsed && (
                  <div className="flex flex-wrap items-end gap-3 bg-card border border-border rounded-xl p-3 shadow-sm w-full mt-2">
                    {activeTab === 'open' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Avançado</label>
                        <div className="flex items-center gap-2">
                          <PipelineFilterButton
                            salesUsers={salesUsers}
                            stages={stages}
                            activeFilter={activeFilter}
                            onFilterChange={setActiveFilter}
                            availableTags={availableTags}
                            products={pipelineProducts}
                            previewDeals={openDeals}
                            previewProductMap={openDealProductMap}
                            previewCustomFieldValues={dealCustomFieldValues}
                            previewNextActivityMap={dealNextActivityMap}
                            previewTaskCountMap={dealTaskCountMap}
                            previewPendingCountMap={dealPendingCountMap}
                            previewPendingTypesMap={dealPendingTypesMap}
                            previewPendingStatusesMap={dealPendingStatusesMap}

                          />
                          {canSeeDeleted && (
                            <PipelineDebugDialog
                              deals={openDeals}
                              activityStatusMap={activityStatusMap}
                              isLoading={activityStatusLoading}
                            />
                          )}
                        </div>
                      </div>
                    )}
                    {activeTab === 'open' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Ordenar por atividade</label>
                        <Select value={activitySort} onValueChange={(v) => setActivitySort(v as typeof activitySort)}>
                          <SelectTrigger className={cn("h-10 w-full sm:w-[240px]", activitySort !== 'none' && "border-primary/60 text-primary")}>
                            <SelectValue placeholder="Padrão" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Padrão (sem ordenação)</SelectItem>
                            <SelectItem value="pending_desc">Atividades pendentes (maior → menor)</SelectItem>
                            <SelectItem value="pending_asc">Atividades pendentes (menor → maior)</SelectItem>
                            <SelectItem value="total_desc">Total de atividades (maior → menor)</SelectItem>
                            <SelectItem value="total_asc">Total de atividades (menor → maior)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {activeTab === 'open' && titleTagOptions.length > 0 && (
                      <MultiSelectFilter
                        label="Origem"
                        placeholder="Todas as origens"
                        width="w-full sm:w-[220px]"
                        options={titleTagOptions.map(o => ({ value: o.value, label: `${o.label} (${o.count})` }))}
                        selected={titleTagFilter}
                        onChange={setTitleTagFilter}
                      />
                    )}
                    {activeTab === 'open' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Período</label>
                        <Popover open={openDatePopoverOpen} onOpenChange={setOpenDatePopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn(
                              "h-10 text-sm font-normal bg-background justify-start gap-2 min-w-[180px]",
                              openDatePreset !== 'all' && "border-primary/60 text-primary bg-primary/5"
                            )}>
                              <Calendar className="h-4 w-4 opacity-70" />
                              {openDateLabel}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <div className="flex flex-col sm:flex-row">
                              <div className="border-b sm:border-b-0 sm:border-r p-2 space-y-0.5 min-w-[170px]">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 pt-1 pb-1">Criado em</p>
                                {([
                                  { key: 'all', label: 'Todas as datas' },
                                  { key: 'today', label: 'Hoje' },
                                  { key: 'this_week', label: 'Esta semana' },
                                  { key: 'this_month', label: 'Este mês' },
                                  { key: 'last_month', label: 'Mês passado' },
                                  { key: 'this_quarter', label: 'Este trimestre' },
                                  { key: 'this_year', label: 'Este ano' },
                                ] as const).map(p => (
                                  <Button
                                    key={p.key}
                                    variant={openDatePreset === p.key ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="w-full justify-start text-xs h-7"
                                    onClick={() => {
                                      setOpenDatePreset(p.key);
                                      setOpenDateStart('');
                                      setOpenDateEnd('');
                                      setOpenDatePopoverOpen(false);
                                    }}
                                  >
                                    {p.label}
                                  </Button>
                                ))}
                              </div>
                              <div className="p-2">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-1 pb-1">Período personalizado</p>
                                <CalendarComponent
                                  mode="range"
                                  selected={openDateStart && openDateEnd ? { from: new Date(openDateStart), to: new Date(openDateEnd) } : undefined}
                                  onSelect={(range) => {
                                    if (range?.from) {
                                      setOpenDateStart(range.from.toISOString());
                                      setOpenDateEnd(range.to ? range.to.toISOString() : range.from.toISOString());
                                      if (range.to) {
                                        setOpenDatePreset('custom');
                                        setOpenDatePopoverOpen(false);
                                      }
                                    }
                                  }}
                                  numberOfMonths={1}
                                  locale={ptBR}
                                  className="pointer-events-auto"
                                />
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}

                    <div className="flex flex-col gap-1 flex-1 min-w-[260px]">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Pesquisa</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={searchMode === 'exact' ? "Correspondência exata..." : "Buscar em qualquer campo do card..."}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 pr-[135px] h-10 w-full bg-muted/40 border-border text-sm focus:bg-background transition-colors"
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                              title="Modo de busca"
                            >
                              {searchMode === 'exact' ? 'Exato' : 'Contém'}
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => setSearchMode('contains')}>
                              <Check className={cn("h-4 w-4 mr-2", searchMode !== 'contains' && "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="text-sm">O nome contém</span>
                                <span className="text-[11px] text-muted-foreground">Busca em qualquer parte do card</span>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSearchMode('exact')}>
                              <Check className={cn("h-4 w-4 mr-2", searchMode !== 'exact' && "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="text-sm">Correspondência exata</span>
                                <span className="text-[11px] text-muted-foreground">Palavra ou termo idêntico</span>
                              </div>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>


                    {canSeeDeleted && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-transparent select-none px-1">.</label>
                        <Button
                          variant="outline"
                          className="h-10 gap-2 text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 hover:border-destructive/30 transition-colors"
                          onClick={() => setIsDeletedDrawerOpen(true)}
                          title="Ver negócios excluídos"
                        >
                          <Trash2Icon className="h-4 w-4" />
                          Excluídos
                        </Button>
                      </div>
                    )}
                  </div>
                  )}
                  </div>
                </div>

                {/* Active filter chips (only for open pipeline view) */}
                {activeTab === 'open' && (
                  <ActiveFilterChips
                    activeFilter={activeFilter}
                    searchTerm={searchTerm}
                    onSearchClear={() => setSearchTerm("")}
                    onFilterChange={setActiveFilter}
                    salesUsers={salesUsers}
                    stages={stages}
                    customFields={filterCustomFields}
                  />
                )}


                {/* Contextual filters for won/lost tabs */}
                {activeTab === 'won' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Date filter: presets + months + custom range */}
                    <Popover open={wonDatePopoverOpen} onOpenChange={setWonDatePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn(
                          "w-full sm:w-auto h-8 text-xs bg-background justify-start",
                          wonMonthFilter !== 'all' && "border-primary text-primary"
                        )}>
                          <Calendar className="h-3.5 w-3.5 mr-1.5" />
                          {wonMonthFilter === 'all' && 'Todas as datas'}
                          {wonMonthFilter === 'custom' && wonDateStart && wonDateEnd && 
                            `${format(new Date(wonDateStart), "dd/MM/yy")} - ${format(new Date(wonDateEnd), "dd/MM/yy")}`
                          }
                          {wonMonthFilter !== 'all' && wonMonthFilter !== 'custom' && (() => {
                            const entry = availableWonMonths.find(([k]) => k === wonMonthFilter);
                            return entry ? entry[1] : wonMonthFilter;
                          })()}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="flex flex-col sm:flex-row">
                          {/* Quick presets */}
                          <div className="border-b sm:border-b-0 sm:border-r p-2 space-y-0.5 min-w-[160px]">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 pt-1 pb-1">Atalhos</p>
                            {([
                              { label: 'Todas as datas', run: () => { setWonMonthFilter('all'); setWonDateStart(''); setWonDateEnd(''); } },
                              { label: 'Hoje', run: () => { const d = new Date(); setWonMonthFilter('custom'); setWonDateStart(startOfDay(d).toISOString()); setWonDateEnd(endOfDay(d).toISOString()); } },
                              { label: 'Esta semana', run: () => { const d = new Date(); setWonMonthFilter('custom'); setWonDateStart(startOfWeek(d, { weekStartsOn: 1 }).toISOString()); setWonDateEnd(endOfWeek(d, { weekStartsOn: 1 }).toISOString()); } },
                              { label: 'Este mês', run: () => { const d = new Date(); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; setWonMonthFilter(k); setWonDateStart(''); setWonDateEnd(''); } },
                              { label: 'Mês passado', run: () => { const d = subMonths(new Date(), 1); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; setWonMonthFilter(k); setWonDateStart(''); setWonDateEnd(''); } },
                              { label: 'Este trimestre', run: () => { const d = new Date(); setWonMonthFilter('custom'); setWonDateStart(startOfQuarter(d).toISOString()); setWonDateEnd(endOfQuarter(d).toISOString()); } },
                              { label: 'Este ano', run: () => { const d = new Date(); setWonMonthFilter('custom'); setWonDateStart(startOfYear(d).toISOString()); setWonDateEnd(endOfYear(d).toISOString()); } },
                            ] as const).map(p => (
                              <Button
                                key={p.label}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-xs h-7"
                                onClick={() => { p.run(); setWonDatePopoverOpen(false); }}
                              >
                                {p.label}
                              </Button>
                            ))}
                          </div>
                          {/* Months list (scrollable) */}
                          <div className="border-b sm:border-b-0 sm:border-r p-2 min-w-[170px]">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 pt-1 pb-1">Meses</p>
                            <div className="max-h-[260px] overflow-y-auto space-y-0.5 pr-1">
                              {availableWonMonths.map(([key, label]) => (
                                <Button
                                  key={key}
                                  variant={wonMonthFilter === key ? 'secondary' : 'ghost'}
                                  size="sm"
                                  className="w-full justify-start text-xs h-7"
                                  onClick={() => { setWonMonthFilter(key); setWonDateStart(''); setWonDateEnd(''); setWonDatePopoverOpen(false); }}
                                >
                                  {label}
                                </Button>
                              ))}
                            </div>
                          </div>
                          {/* Custom range calendar */}
                          <div className="p-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-1 pb-1">Período personalizado</p>
                            <CalendarComponent
                              mode="range"
                              selected={wonDateStart && wonDateEnd ? { from: new Date(wonDateStart), to: new Date(wonDateEnd) } : undefined}
                              onSelect={(range) => {
                                if (range?.from) {
                                  setWonDateStart(range.from.toISOString());
                                  setWonDateEnd(range.to ? range.to.toISOString() : range.from.toISOString());
                                  if (range.to) {
                                    setWonMonthFilter('custom');
                                    setWonDatePopoverOpen(false);
                                  }
                                }
                              }}
                              numberOfMonths={1}
                              locale={ptBR}
                              className="pointer-events-auto"
                            />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <MultiSelectFilter
                      label=""
                      placeholder="Todos os vendedores"
                      width="w-full sm:w-[180px]"
                      options={availableWonSellers.map(([id, name]) => ({ value: id, label: name }))}
                      selected={wonSellerFilter}
                      onChange={setWonSellerFilter}
                    />
                    <MultiSelectFilter
                      label=""
                      placeholder="Todos os produtos"
                      width="w-full sm:w-[180px]"
                      options={availableWonProducts.map(([id, name]) => ({ value: id, label: name }))}
                      selected={wonProductFilter}
                      onChange={setWonProductFilter}
                    />
                  </div>
                )}

                {activeTab === 'lost' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={lostCreatedMonthFilter} onValueChange={setLostCreatedMonthFilter}>
                      <SelectTrigger className="w-full sm:w-[190px] h-8 text-xs bg-background">
                        <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="Criado em: todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Criado em: todos os meses</SelectItem>
                        {availableLostCreatedMonths.map(([key, label]) => (
                          <SelectItem key={key} value={key}>Criado em: {label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={lostMonthFilter} onValueChange={setLostMonthFilter}>
                      <SelectTrigger className="w-full sm:w-[190px] h-8 text-xs bg-background">
                        <XCircle className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="Perdido em: todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Perdido em: todos os meses</SelectItem>
                        {availableLostMonths.map(([key, label]) => (
                          <SelectItem key={key} value={key}>Perdido em: {label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={lostReasonFilter} onValueChange={setLostReasonFilter}>
                      <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs bg-background">
                        <XCircle className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="Todos os motivos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os motivos</SelectItem>
                        {lossReasons.map((reason) => (
                          <SelectItem key={reason.id} value={reason.id}>{reason.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <MultiSelectFilter
                      label=""
                      placeholder="Todos os vendedores"
                      width="w-full sm:w-[180px]"
                      options={availableLostSellers.map(([id, name]) => ({ value: id, label: name }))}
                      selected={lostSellerFilter}
                      onChange={setLostSellerFilter}
                    />
                    <MultiSelectFilter
                      label=""
                      placeholder="Todos os produtos"
                      width="w-full sm:w-[180px]"
                      options={availableLostProducts.map(([id, name]) => ({ value: id, label: name }))}
                      selected={lostProductFilter}
                      onChange={setLostProductFilter}
                    />
                    {(lostCreatedMonthFilter !== 'all' || lostMonthFilter !== 'all') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground"
                        onClick={() => { setLostCreatedMonthFilter('all'); setLostMonthFilter('all'); }}
                      >
                        Limpar meses
                      </Button>
                    )}
                    <div className="w-full flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="secondary" className="font-normal">
                        Total: <span className="font-semibold ml-1">{lostCohortStats.total}</span>
                      </Badge>
                      <Badge variant="secondary" className="font-normal bg-amber-500/15 text-amber-700 dark:text-amber-400">
                        Criados e perdidos no mesmo mês: <span className="font-semibold ml-1">{lostCohortStats.sameMonth}</span>
                      </Badge>
                      <Badge variant="secondary" className="font-normal bg-sky-500/15 text-sky-700 dark:text-sky-400">
                        Criados em meses anteriores: <span className="font-semibold ml-1">{lostCohortStats.carriedOver}</span>
                      </Badge>
                      {lostCohortStats.unknown > 0 && (
                        <Badge variant="outline" className="font-normal">
                          Sem data: <span className="font-semibold ml-1">{lostCohortStats.unknown}</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Resumo agora vive na linha do botão de filtros (sem duplicar) */}

            </div>

            {/* Status sub-tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex h-9">
                <TabsTrigger value="open" className="gap-1 text-xs sm:text-sm sm:gap-1.5 h-7">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Em Aberto
                  <Badge variant="secondary" className="text-[10px] ml-0.5">{filteredOpenDeals.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="won" className="gap-1 text-xs sm:text-sm sm:gap-1.5 h-7">
                  <Trophy className="h-3.5 w-3.5" />
                  Ganhas
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700 text-[10px] ml-0.5">
                    {filteredWonDeals.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="lost" className="gap-1 text-xs sm:text-sm sm:gap-1.5 h-7">
                  <XCircle className="h-3.5 w-3.5" />
                  Perdidas
                  <Badge variant="secondary" className="bg-red-500/20 text-red-700 text-[10px] ml-0.5">
                    {filteredLostDealsByMonth.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="open" className="mt-0">
                {viewMode === 'kanban' ? (
                  <DealKanban
                    stages={stages}
                    deals={sortedOpenDeals}
                    onDealClick={handleDealClick}
                    onDealMove={handleDealMove}
                    showActivityCounts={activeFilterNeedsActivityCounts}
                  />
                ) : (
                  <DealListView 
                    deals={sortedOpenDeals} 
                    stages={stages}
                    onDealClick={handleDealClick} 
                  />
                )}
              </TabsContent>

              <TabsContent value="won" className="mt-0 space-y-3 sm:space-y-4">
                {/* Summary stats */}
                <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 sm:p-4">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Total de Ganhas</p>
                    <p className="text-lg sm:text-2xl font-bold text-emerald-600">
                      {formatCurrency(filteredWonTotal)}
                    </p>
                  </div>
                  <div className="h-8 sm:h-10 w-px bg-emerald-500/20" />
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Negócios</p>
                    <p className="text-lg sm:text-xl font-semibold">
                      {filteredWonDealsByMonth.length}
                    </p>
                  </div>
                  <div className="h-8 sm:h-10 w-px bg-emerald-500/20" />
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Ciclo Médio</p>
                    <p className="text-lg sm:text-xl font-semibold">
                      {(() => {
                        const dealsWithCycle = filteredWonDealsByMonth.filter(d => d.won_at && d.created_at);
                        if (dealsWithCycle.length === 0) return "—";
                        const totalDays = dealsWithCycle.reduce((sum, d) => {
                          const days = Math.round((new Date(d.won_at!).getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24));
                          return sum + days;
                        }, 0);
                        const avg = Math.round(totalDays / dealsWithCycle.length);
                        return `${avg} dias`;
                      })()}
                    </p>
                  </div>
                  <div className="h-8 sm:h-10 w-px bg-emerald-500/20" />
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Ticket Médio</p>
                    <p className="text-lg sm:text-xl font-semibold">
                      {filteredWonDealsByMonth.length > 0
                        ? formatCurrency(filteredWonTotal / filteredWonDealsByMonth.length)
                        : "—"}
                    </p>
                  </div>
                  {(() => {
                    const incompleteCount = filteredWonDealsByMonth.filter(
                      (d) => (negotiationStatusMap[d.id]?.length ?? 0) > 0
                    ).length;
                    if (incompleteCount === 0) return null;
                    return (
                      <>
                        <div className="h-8 sm:h-10 w-px bg-emerald-500/20" />
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <div>
                            <p className="text-xs sm:text-sm text-muted-foreground">Negociação incompleta</p>
                            <p className="text-lg sm:text-xl font-semibold text-amber-600">
                              {incompleteCount}
                              <span className="text-xs sm:text-sm text-muted-foreground font-normal">
                                {" "}/ {filteredWonDealsByMonth.length}
                              </span>
                            </p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <DealListView 
                  deals={filteredWonDealsByMonth} 
                  stages={stages}
                  onDealClick={handleDealClick} 
                  showStatus
                  dealProductMap={dealProductMap}
                  negotiationStatusMap={negotiationStatusMap}
                />

              </TabsContent>

              <TabsContent value="lost" className="mt-0 space-y-3 sm:space-y-4">
                {/* Summary stats */}
                <div className="flex items-center gap-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 sm:p-4">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Total de Perdidas</p>
                    <p className="text-lg sm:text-2xl font-bold text-red-600">
                      {formatCurrency(filteredLostTotal)}
                    </p>
                  </div>
                  <div className="h-8 sm:h-10 w-px bg-red-500/20" />
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Negócios</p>
                    <p className="text-lg sm:text-xl font-semibold">
                      {filteredLostDealsByMonth.length}
                    </p>
                  </div>
                </div>

                <DealListView 
                  deals={filteredLostDealsByMonth} 
                  stages={stages}
                  onDealClick={handleDealClick} 
                  showStatus
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      {/* New Deal Dialog */}
      <DealDialog
        open={isNewDealOpen}
        onOpenChange={setIsNewDealOpen}
        stages={stages}
        onSave={handleSaveDeal}
      />

      {/* Deal Detail Sheet */}
      <DealDetailSheet
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        deal={selectedDeal}
        stages={stages}
        allDeals={deals}
        onEdit={handleEditFromDetail}
        onMarkAsWon={handleMarkAsWon}
        onMarkAsLost={handleMarkAsLost}
        onReopen={handleReopen}
        onStageChange={handleDealMove}
        onDealUpdated={fetchDeals}
        processingWonDealId={processingWonDealId}
      />

      {/* Edit Deal Dialog */}
      <DealDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setSelectedDeal(null);
        }}
        deal={selectedDeal}
        stages={stages}
        onSave={handleSaveDeal}
        onDelete={handleDeleteDeal}
        onMarkAsWon={handleMarkAsWon}
        onMarkAsLost={handleMarkAsLost}
        onReopen={handleReopen}
      />

      {/* Stages Manager */}
      <DealStagesManager
        open={isStagesManagerOpen}
        onOpenChange={setIsStagesManagerOpen}
        stages={stages}
        deals={deals}
        pipelineName={activePipeline?.name}
        onCreateStage={createStage}
        onUpdateStage={updateStage}
        onDeleteStage={deleteStage}
        onReorderStages={reorderStages}
      />

      {/* Custom Fields Manager (Admin only) - Deals context */}
      <CustomFieldsManager
        open={isFieldsDialogOpen}
        onOpenChange={setIsFieldsDialogOpen}
        sectorContext="deals"
      />

      {/* Export Dialog */}
      <PipelineExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        stages={stages}
        salesUsers={salesUsers}
      />

      {/* Deleted Deals Drawer (admin/gestão) */}
      {canSeeDeleted && (
        <DeletedDealsDrawer
          open={isDeletedDrawerOpen}
          onOpenChange={setIsDeletedDrawerOpen}
          onRestored={() => fetchDeals()}
        />
      )}

      {/* Required Fields Modal for Won/Lost outcomes */}
      <RequiredFieldsModal
        open={outcomeRequiredFieldsModal.open}
        onOpenChange={(open) => setOutcomeRequiredFieldsModal(prev => ({ ...prev, open }))}
        dealId={outcomeRequiredFieldsModal.dealId}
        dealTitle={outcomeRequiredFieldsModal.dealTitle}
        targetStageName=""
        missingFields={outcomeRequiredFieldsModal.missingFields}
        accountId={currentUser?.account_id || ""}
        onComplete={handleOutcomeRequiredFieldsComplete}
        outcomeType={outcomeRequiredFieldsModal.outcomeType}
        clientId={outcomeRequiredFieldsModal.clientId ?? null}
      />

      {/* Meeting Schedule Dialog - opens when deal moves to "reunião agendada" */}
      <MeetingScheduleDialog
        open={meetingDialog.open}
        onOpenChange={(open) => setMeetingDialog(prev => ({ ...prev, open }))}
        dealId={meetingDialog.dealId}
        leadId={meetingDialog.leadId}
        clientId={meetingDialog.clientId}
        participantName={meetingDialog.participantName}
        participantPhone={meetingDialog.participantPhone}
        stageName={meetingDialog.stageName}
      />
    </>
  );
}

// Simple list view component
function DealListView({ 
  deals, 
  stages,
  onDealClick,
  showStatus = false,
  dealProductMap,
  negotiationStatusMap,
}: { 
  deals: Deal[];
  stages: DealStage[];
  onDealClick: (deal: Deal) => void;
  showStatus?: boolean;
  dealProductMap?: Record<string, { productId: string; productName: string; isUpsell?: boolean }>;
  negotiationStatusMap?: Record<string, string[]>;
}) {
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const toggleExpanded = (dealId: string) => {
    setExpandedReasons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dealId)) {
        newSet.delete(dealId);
      } else {
        newSet.add(dealId);
      }
      return newSet;
    });
  };

  if (deals.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Nenhuma negociação encontrada
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {deals.map((deal) => {
            const stage = stages.find(s => s.id === deal.stage_id);
            const isExpanded = expandedReasons.has(deal.id);
            const hasLongReason = deal.lost_reason && deal.lost_reason.length > 80;
            
            return (
              <div
                key={deal.id}
                className="p-3 sm:p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onDealClick(deal)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                      <AvatarImage src={deal.responsible_user?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
                        {deal.responsible_user?.name
                          ?.split(" ")
                          .map(n => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className="w-1.5 sm:w-2 h-7 sm:h-8 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stage?.color || '#6b7280' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm sm:text-base truncate">{deal.title}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {deal.client?.full_name || deal.lead?.full_name || deal.contact_name || 'Sem contato'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 ml-[42px] sm:ml-0 flex-wrap">
                    {deal.status === 'won' ? (() => {
                      const product = dealProductMap?.[deal.id];
                      if (product) {
                        const productColorMap: Record<string, string> = {
                          'Eternum Club': '#0f172a',
                          'Ren. Eternum Club': '#0f172a',
                          'Eternum MVP': '#d4a937',
                          'Rykas Mentoring': '#6A5ACD',
                          'Ren. Rykas Mentoring': '#6A5ACD',
                          'Eternum Private': '#1C1C1C',
                          'Ren. Eternum Private': '#1C1C1C',
                          'Conselho': '#2F4F4F',
                        };
                        const color = productColorMap[product.productName] || '#059669';
                        return (
                          <>
                            <Badge
                              variant="outline"
                              className="text-[10px] sm:text-xs font-semibold"
                              style={{
                                borderColor: color,
                                color: '#fff',
                                backgroundColor: color,
                              }}
                            >
                              {product.productName}
                            </Badge>
                            {(product.isUpsell || deal.title?.toLowerCase().includes('upsell')) && (
                              <Badge
                                variant="outline"
                                className="text-[10px] sm:text-xs font-semibold"
                                style={{
                                  borderColor: '#FF8C00',
                                  color: '#fff',
                                  backgroundColor: '#FF8C00',
                                }}
                              >
                                Upsell
                              </Badge>
                            )}
                          </>
                        );
                      }
                      return (
                        <>
                          <Badge
                            variant="outline"
                            className="text-[10px] sm:text-xs text-muted-foreground border-muted-foreground/30 bg-muted/50"
                          >
                            Sem produto
                          </Badge>
                          {deal.title?.toLowerCase().includes('upsell') && (
                            <Badge
                              variant="outline"
                              className="text-[10px] sm:text-xs font-semibold"
                              style={{
                                borderColor: '#FF8C00',
                                color: '#fff',
                                backgroundColor: '#FF8C00',
                              }}
                            >
                              Upsell
                            </Badge>
                          )}
                        </>
                      );
                    })() : stage ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] sm:text-xs"
                        style={{ 
                          borderColor: stage.color,
                          color: stage.color,
                        }}
                      >
                        {stage.name}
                      </Badge>
                    ) : null}
                    {showStatus && (
                      <Badge
                        variant={deal.status === 'won' ? 'default' : 'destructive'}
                        className={cn("text-[10px] sm:text-xs", deal.status === 'won' ? 'bg-emerald-500' : '')}
                      >
                        {deal.status === 'won' ? 'Ganha' : 'Perdida'}
                      </Badge>
                    )}
                    {deal.status === 'won' && negotiationStatusMap?.[deal.id]?.length ? (
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="text-[10px] sm:text-xs gap-1 border-amber-500/60 text-amber-700 bg-amber-500/10"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Negociação incompleta
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="font-medium mb-1">Campos faltando:</p>
                            <ul className="list-disc list-inside text-xs">
                              {negotiationStatusMap[deal.id].map((label) => (
                                <li key={label}>{label}</li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                    {/* Won date - shown only for won deals */}
                    {deal.status === 'won' && deal.won_at && (
                      <div className="flex items-center gap-1 text-xs sm:text-sm text-emerald-600">
                        <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span>
                          {(() => {
                            const d = new Date(deal.won_at);
                            d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
                            return d.toLocaleDateString('pt-BR');
                          })()}
                        </span>
                      </div>
                    )}
                    {/* Created / Lost dates - shown only for lost deals */}
                    {deal.status === 'lost' && (
                      <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Criado: {deal.created_at ? new Date(deal.created_at).toLocaleDateString('pt-BR') : '—'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-destructive">
                          <Calendar className="h-3 w-3" />
                          <span>
                            Perdido: {deal.lost_at
                              ? (() => {
                                  const d = new Date(deal.lost_at);
                                  d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
                                  return d.toLocaleDateString('pt-BR');
                                })()
                              : '—'}
                          </span>
                        </div>
                      </div>
                    )}
                    <span className="font-semibold text-sm sm:text-base ml-auto sm:ml-0">
                      {formatCurrency(deal.value)}
                    </span>
                  </div>
                </div>
                
                {/* Loss Reason - shown only for lost deals */}
                {deal.status === 'lost' && deal.lost_reason && (
                  <div className="mt-2 sm:mt-3 ml-[42px] sm:ml-[52px]">
                    <div 
                      className={cn(
                        "text-xs text-muted-foreground bg-destructive/10 rounded px-2 sm:px-2.5 py-1.5 sm:py-2 border border-destructive/20",
                        !isExpanded && "line-clamp-1"
                      )}
                    >
                      <span className="font-medium text-destructive/80">Motivo:</span>{" "}
                      {deal.lost_reason}
                    </div>
                    {hasLongReason && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(deal.id);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground mt-1 sm:mt-1.5 hover:underline"
                      >
                        {isExpanded ? "Ver menos" : "Ver mais"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
