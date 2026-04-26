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
  fetchDealCustomFieldValues,
  updateClientWithDealData,
  getContractDataFromDealFields,
  formatDealCustomFieldsForTimeline,
} from "@/utils/dealToClientContractMapping";
import { DealKanban } from "@/components/sales/DealKanban";
import { DealDialog } from "@/components/sales/DealDialog";
import { DealDetailSheet } from "@/components/sales/DealDetailSheet";
import { DealStagesManager } from "@/components/sales/DealStagesManager";
import { CustomFieldsManager } from "@/components/custom-fields/CustomFieldsManager";
import { CustomField } from "@/components/custom-fields/CustomFieldsManager";
import { PipelineFilterButton } from "@/components/sales/PipelineFilterButton";
import { PipelineSelector } from "@/components/sales/PipelineSelector";
import { RequiredFieldsModal } from "@/components/sales/RequiredFieldsModal";
import { PipelineExportDialog } from "@/components/sales/PipelineExportDialog";
import { ActiveFilter, applyFilterToDeals } from "@/hooks/usePipelineFilters";
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
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import LeadsTab from "@/components/sales/LeadsTab";
import { MeetingScheduleDialog } from "@/components/sales/videocall/MeetingScheduleDialog";
import { OperationBriefingModal } from "@/components/operations/OperationBriefingModal";

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
    totalPipelineValue,
    weightedPipelineValue,
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
  
  const { users: salesUsers } = useSectorUsers({ sectorId: "vendas" });
  const { isAdmin } = usePermissions();
  const { validateDealOutcome } = useRequiredFieldsValidation();

  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [isStagesManagerOpen, setIsStagesManagerOpen] = useState(false);
  const [isFieldsDialogOpen, setIsFieldsDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
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
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null);
  const [wonMonthFilter, setWonMonthFilter] = usePersistedFilter<string>("salesPipeline", "wonMonthFilter", "all");
  const [wonDateStart, setWonDateStart] = usePersistedFilter<string>("salesPipeline", "wonDateStart", "");
  const [wonDateEnd, setWonDateEnd] = usePersistedFilter<string>("salesPipeline", "wonDateEnd", "");
  const [wonDatePopoverOpen, setWonDatePopoverOpen] = useState(false);
  const [wonSellerFilter, setWonSellerFilter] = usePersistedFilter<string>("salesPipeline", "wonSellerFilter", "all");
  const [wonProductFilter, setWonProductFilter] = usePersistedFilter<string>("salesPipeline", "wonProductFilter", "all");
  const [lostMonthFilter, setLostMonthFilter] = usePersistedFilter<string>("salesPipeline", "lostMonthFilter", "all");
  const [lostReasonFilter, setLostReasonFilter] = usePersistedFilter<string>("salesPipeline", "lostReasonFilter", "all");
  const [lostSellerFilter, setLostSellerFilter] = usePersistedFilter<string>("salesPipeline", "lostSellerFilter", "all");
  const [lostProductFilter, setLostProductFilter] = usePersistedFilter<string>("salesPipeline", "lostProductFilter", "all");
  
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

      const mergedMap: Record<string, { productId: string; productName: string; isUpsell?: boolean }> = { ...contractMap };
      outcomeDeals.forEach((deal) => {
        if (mergedMap[deal.id]) {
          // Also flag as upsell if deal title contains "upsell"
          if (!mergedMap[deal.id].isUpsell && deal.title?.toLowerCase().includes('upsell')) {
            mergedMap[deal.id].isUpsell = true;
          }
          return;
        }

        const rawValue = fallbackRawMap[deal.id];
        if (!rawValue) return;

        mergedMap[deal.id] = {
          productId: rawValue,
          productName: optionMap[rawValue] || productNameById[rawValue] || rawValue,
          isUpsell: deal.title?.toLowerCase().includes('upsell'),
        };
      });

      setDealProductMap(mergedMap);
    };

    fetchWonDealProductMap().catch((error) => {
      console.error('[SalesPipeline] Error fetching won deal product map:', error);
      setDealProductMap({});
    });
  }, [currentUser?.account_id, outcomeDealIds]);
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

  // State for the Operation Briefing modal (required to win)
  const [briefingModal, setBriefingModal] = useState<{
    open: boolean;
    dealId: string;
    clientId: string | null;
    dealTitle: string;
  }>({ open: false, dealId: "", clientId: null, dealTitle: "" });

  // Handle URL query param to open deal detail automatically
  useEffect(() => {
    const dealIdFromUrl = searchParams.get('deal');
    
    if (dealIdFromUrl && deals.length > 0 && !loading) {
      const deal = deals.find(d => d.id === dealIdFromUrl);
      if (deal) {
        setSelectedDeal(deal);
        setIsDetailOpen(true);
        // Clear the query param after opening
        searchParams.delete('deal');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, deals, loading, setSearchParams]);

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

  const allDealIds = useMemo(() => deals.map(d => d.id).join(','), [deals]);

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

  // Apply unified filter to deals
  const filteredOpenDeals = useMemo(() => 
    applyFilterToDeals(openDeals, activeFilter, searchTerm, openDealProductMap), 
    [openDeals, activeFilter, searchTerm, openDealProductMap]
  );
  const filteredWonDeals = useMemo(() => 
    applyFilterToDeals(wonDeals, null, searchTerm, openDealProductMap), 
    [wonDeals, searchTerm, openDealProductMap]
  );
  const filteredLostDeals = useMemo(() => 
    applyFilterToDeals(lostDeals, null, searchTerm, openDealProductMap), 
    [lostDeals, searchTerm, openDealProductMap]
  );

  // Available months for won deals filter
  const availableWonMonths = useMemo(() => {
    const monthsSet = new Map<string, string>();
    wonDeals.forEach(deal => {
      if (deal.won_at) {
        const date = new Date(deal.won_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
        monthsSet.set(key, label.charAt(0).toUpperCase() + label.slice(1));
      }
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

  // Available products for won deals filter (deduplicated by name)
  const availableWonProducts = useMemo(() => {
    const productsMap = new Map<string, string>();
    const seenNames = new Set<string>();
    wonDeals.forEach(deal => {
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

    if (wonSellerFilter !== 'all') {
      result = result.filter(deal => deal.responsible_user_id === wonSellerFilter);
    }

    if (wonProductFilter !== 'all') {
      // Find the selected product name for cross-source matching
      const selectedEntry = availableWonProducts.find(([id]) => id === wonProductFilter);
      const selectedName = selectedEntry?.[1]?.trim().toLowerCase();
      result = result.filter(deal => {
        const product = dealProductMap[deal.id];
        if (!product) return false;
        return product.productId === wonProductFilter || 
               product.productName.trim().toLowerCase() === selectedName;
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
    if (lostReasonFilter !== 'all') {
      result = result.filter(deal => {
        if (deal.loss_reason_id === lostReasonFilter) return true;
        const matchedReason = lossReasons.find(r => r.id === lostReasonFilter);
        if (matchedReason && deal.lost_reason?.includes(matchedReason.name)) return true;
        return false;
      });
    }
    if (lostSellerFilter !== 'all') {
      result = result.filter(deal => deal.responsible_user_id === lostSellerFilter);
    }
    if (lostProductFilter !== 'all') {
      const selectedEntry = availableLostProducts.find(([id]) => id === lostProductFilter);
      const selectedName = selectedEntry?.[1]?.trim().toLowerCase();
      result = result.filter(deal => {
        const product = dealProductMap[deal.id];
        if (!product) return false;
        return product.productId === lostProductFilter || 
               product.productName.trim().toLowerCase() === selectedName;
      });
    }
    return result;
  }, [filteredLostDeals, lostMonthFilter, lostReasonFilter, lossReasons, lostSellerFilter, lostProductFilter, availableLostProducts, dealProductMap]);

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

    // Validate required fields + briefing for "won" outcome (unless skipping after modal fill)
    if (!skipValidation && currentUser?.account_id) {
      const validation = await validateDealOutcome(dealId, "won", currentUser.account_id);

      // Check briefing completeness in parallel
      const { data: briefing } = await supabase
        .from("deal_operation_briefings")
        .select("is_complete")
        .eq("deal_id", dealId)
        .maybeSingle();
      const briefingIncomplete = !briefing?.is_complete;

      const hasMissingFields = !validation.canMoveToStage && validation.missingFields.length > 0;

      if (hasMissingFields || briefingIncomplete) {
        setOutcomeRequiredFieldsModal({
          open: true,
          dealId,
          dealTitle: deal.title,
          outcomeType: "won",
          missingFields: hasMissingFields ? validation.missingFields : [],
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
        
        const contractData = {
          client_id: clientId,
          account_id: currentUser.account_id,
          deal_id: dealId, // Link contract to deal for reopening logic
          start_date: today,
          value: deal.value || 0,
          contract_type: 'Compra',
          status: 'active',
          receivables_generated: false, // Ensures it goes to reconciliation queue
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
            // Send notifications to operations and financial teams
            await notifyContractCreated({
              contractId: newContract.id,
              clientName,
              contractValue: deal.value || 0,
              fromDeal: true,
              createdByUserId: currentUser.id,
              accountId: currentUser.account_id,
            });
          }
        }
      }

      // STEP 6: NOW mark as won (only after all validations passed)
      await markAsWon(dealId);
      
      // STEP 7: Omie OS Integration (non-blocking fire-and-forget)
      if (currentUser?.account_id) {
        try {
          const { data: omieSettings } = await supabase
            .from('omie_settings')
            .select('is_enabled')
            .eq('account_id', currentUser.account_id)
            .maybeSingle();
          
          if (omieSettings?.is_enabled) {
            supabase.functions.invoke('create-omie-os', {
              body: { deal_id: dealId, account_id: currentUser.account_id },
            }).then(({ data, error }) => {
              if (error || data?.error) {
                toast.error(`Omie OS: ${error?.message || data?.error || 'Erro desconhecido'}`);
              } else {
                toast.success(`OS criada no Omie! ID: ${data?.omie_os_id || 'OK'}`);
              }
            });
          }
        } catch (omieErr) {
          console.error("[MarkAsWon] Omie integration error:", omieErr);
          // Non-blocking
        }
      }
      
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold">Comercial</h1>
              <p className="text-muted-foreground text-xs hidden sm:block">
                Gerencie prospecção e negociações
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {mainTab === 'pipeline' && (
              <>
                {/* View toggle - desktop only */}
                <div className="hidden sm:flex items-center border rounded-lg overflow-hidden">
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

        {/* Main Tabs */}
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'prospeccao' | 'pipeline')}>
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:flex">
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

          <TabsContent value="prospeccao" className="mt-3 sm:mt-4">
            <LeadsTab />
          </TabsContent>

          <TabsContent value="pipeline" className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
            {/* Pipeline Selector + Sub-tabs Row */}
            <div className="space-y-3">
              {/* Pipeline selector row + unified filters */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <PipelineSelector
                    pipelines={pipelines}
                    activePipelineId={activePipelineId}
                    onSelect={setActivePipelineId}
                    onCreate={createPipeline}
                    onUpdate={updatePipeline}
                    onDelete={deletePipeline}
                  />
                  
                  {/* Filters */}
                  <div className="flex items-center gap-2">
                    {activeTab === 'open' && (
                      <PipelineFilterButton
                        salesUsers={salesUsers}
                        stages={stages}
                        activeFilter={activeFilter}
                        onFilterChange={setActiveFilter}
                        availableTags={availableTags}
                        products={pipelineProducts}
                      />
                    )}
                    <div className="relative hidden sm:block">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar negócio..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-8 w-[200px] bg-background border-border text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Contextual filters for won/lost tabs */}
                {activeTab === 'won' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Date filter: months + custom range */}
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
                          {/* Presets */}
                          <div className="border-b sm:border-b-0 sm:border-r p-2 space-y-0.5 min-w-[150px]">
                            <Button
                              variant={wonMonthFilter === 'all' ? 'secondary' : 'ghost'}
                              size="sm"
                              className="w-full justify-start text-xs h-7"
                              onClick={() => { setWonMonthFilter('all'); setWonDateStart(''); setWonDateEnd(''); setWonDatePopoverOpen(false); }}
                            >
                              Todas as datas
                            </Button>
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
                          {/* Custom range calendar */}
                          <div className="p-2">
                            <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Período personalizado</p>
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
                    <Select value={wonSellerFilter} onValueChange={setWonSellerFilter}>
                      <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs bg-background">
                        <User className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="Todos os vendedores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os vendedores</SelectItem>
                        {availableWonSellers.map(([id, name]) => (
                          <SelectItem key={id} value={id}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={wonProductFilter} onValueChange={setWonProductFilter}>
                      <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs bg-background">
                        <Package className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="Todos os produtos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os produtos</SelectItem>
                        {availableWonProducts.map(([id, name]) => (
                          <SelectItem key={id} value={id}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {activeTab === 'lost' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={lostMonthFilter} onValueChange={setLostMonthFilter}>
                      <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs bg-background">
                        <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="Todos os meses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os meses</SelectItem>
                        {availableLostMonths.map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
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
                    <Select value={lostSellerFilter} onValueChange={setLostSellerFilter}>
                      <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs bg-background">
                        <User className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="Todos os vendedores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os vendedores</SelectItem>
                        {availableLostSellers.map(([id, name]) => (
                          <SelectItem key={id} value={id}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={lostProductFilter} onValueChange={setLostProductFilter}>
                      <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs bg-background">
                        <Package className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="Todos os produtos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os produtos</SelectItem>
                        {availableLostProducts.map(([id, name]) => (
                          <SelectItem key={id} value={id}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Summary metrics - compact inline */}
              {activeTab === 'open' && (
                <div className="flex items-center gap-3 sm:gap-5 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-muted-foreground">{filteredOpenDeals.length} negócios</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold">{formatCurrency(totalPipelineValue)}</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Ponderado:</span>
                    <span className="font-medium">{formatCurrency(weightedPipelineValue)}</span>
                  </div>
                </div>
              )}
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
                    deals={filteredOpenDeals}
                    onDealClick={handleDealClick}
                    onDealMove={handleDealMove}
                  />
                ) : (
                  <DealListView 
                    deals={filteredOpenDeals} 
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
                </div>

                <DealListView 
                  deals={filteredWonDealsByMonth} 
                  stages={stages}
                  onDealClick={handleDealClick} 
                  showStatus
                  dealProductMap={dealProductMap}
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

      {/* Operation Briefing Modal — required to win deals */}
      <OperationBriefingModal
        open={briefingModal.open}
        onOpenChange={(open) => setBriefingModal(prev => ({ ...prev, open }))}
        dealId={briefingModal.dealId}
        clientId={briefingModal.clientId}
        dealTitle={briefingModal.dealTitle}
        onCompleted={() => {
          // Re-attempt marking as won, now with briefing complete
          handleMarkAsWon(briefingModal.dealId);
        }}
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
}: { 
  deals: Deal[];
  stages: DealStage[];
  onDealClick: (deal: Deal) => void;
  showStatus?: boolean;
  dealProductMap?: Record<string, { productId: string; productName: string; isUpsell?: boolean }>;
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
                          'Eternum MVP': '#d4a937',
                          'Rykas Mentoring': '#6A5ACD',
                          'Eternum Private': '#1C1C1C',
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
