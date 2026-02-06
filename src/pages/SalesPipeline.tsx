import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useDeals, Deal, DealStage } from "@/hooks/useDeals";
import { useLeads } from "@/hooks/useLeads";
import { useSectorUsers } from "@/hooks/useSectorUsers";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { notifyContractCreated } from "@/hooks/useContractNotifications";
import { useRequiredFieldsValidation } from "@/hooks/useRequiredFieldsValidation";
import {
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
import { RequiredFieldsModal } from "@/components/sales/RequiredFieldsModal";
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
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import LeadsTab from "@/components/sales/LeadsTab";

export default function SalesPipeline() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useCurrentUser();
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
  } = useDeals();
  
  const { leads, loading: leadsLoading, refetch: refetchLeads } = useLeads();
  const { users: salesUsers } = useSectorUsers({ sectorId: "vendas" });
  const { isAdmin } = usePermissions();
  const { validateDealOutcome } = useRequiredFieldsValidation();

  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [isStagesManagerOpen, setIsStagesManagerOpen] = useState(false);
  const [isFieldsDialogOpen, setIsFieldsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activeTab, setActiveTab] = useState('open');
  const [mainTab, setMainTab] = useState<'prospeccao' | 'pipeline'>('pipeline');
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null);
  const [wonMonthFilter, setWonMonthFilter] = useState<string>('all');
  const [lostMonthFilter, setLostMonthFilter] = useState<string>('all');
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
  }>({
    open: false,
    dealId: "",
    dealTitle: "",
    outcomeType: "won",
    missingFields: [],
  });

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
    applyFilterToDeals(openDeals, activeFilter, searchTerm), 
    [openDeals, activeFilter, searchTerm]
  );
  const filteredWonDeals = useMemo(() => 
    applyFilterToDeals(wonDeals, activeFilter, searchTerm), 
    [wonDeals, activeFilter, searchTerm]
  );
  const filteredLostDeals = useMemo(() => 
    applyFilterToDeals(lostDeals, activeFilter, searchTerm), 
    [lostDeals, activeFilter, searchTerm]
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

  // Filter won deals by selected month
  const filteredWonDealsByMonth = useMemo(() => {
    let result = filteredWonDeals;
    
    if (wonMonthFilter !== 'all') {
      result = result.filter(deal => {
        if (!deal.won_at) return false;
        const date = new Date(deal.won_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return key === wonMonthFilter;
      });
    }
    
    // Sort by won_at descending (most recent first)
    return [...result].sort((a, b) => {
      const dateA = a.won_at ? new Date(a.won_at).getTime() : 0;
      const dateB = b.won_at ? new Date(b.won_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [filteredWonDeals, wonMonthFilter]);

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

  // Filter lost deals by selected month
  const filteredLostDealsByMonth = useMemo(() => {
    if (lostMonthFilter === 'all') return filteredLostDeals;
    return filteredLostDeals.filter(deal => {
      if (!deal.lost_at) return false;
      const date = new Date(deal.lost_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return key === lostMonthFilter;
    });
  }, [filteredLostDeals, lostMonthFilter]);

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

  const handleDealMove = async (dealId: string, newStageId: string): Promise<boolean> => {
    return await moveDeal(dealId, newStageId);
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
    if (!skipValidation && currentUser?.account_id) {
      const validation = await validateDealOutcome(dealId, "won", currentUser.account_id);
      if (!validation.canMoveToStage && validation.missingFields.length > 0) {
        setOutcomeRequiredFieldsModal({
          open: true,
          dealId,
          dealTitle: deal.title,
          outcomeType: "won",
          missingFields: validation.missingFields,
        });
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

      // STEP 6: NOW mark as won (only after all validations passed)
      await markAsWon(dealId);
      
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

  const handleMarkAsLost = async (dealId: string, reason?: string, skipValidation = false) => {
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

    await markAsLost(dealId, reason);
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
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[500px] w-[300px] flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Comercial</h1>
            <p className="text-muted-foreground text-xs">
              Gerencie prospecção e negociações
            </p>
          </div>
          <div className="flex items-center gap-2">
            {mainTab === 'pipeline' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsStagesManagerOpen(true)}
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  Etapas
                </Button>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFieldsDialogOpen(true)}
                  >
                    <Settings2 className="h-4 w-4 mr-2" />
                    Campos
                  </Button>
                )}
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <Button
                    variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setViewMode('kanban')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                <Button onClick={() => setIsNewDealOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Negociação
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'prospeccao' | 'pipeline')}>
          <TabsList>
            <TabsTrigger value="prospeccao" className="gap-2">
              <Users className="h-4 w-4" />
              Prospecção
              <Badge variant="secondary">{leads.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-2">
              <Target className="h-4 w-4" />
              Pipeline
              <Badge variant="secondary">{openDeals.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="prospeccao" className="mt-4">
            <LeadsTab />
          </TabsContent>

          <TabsContent value="pipeline" className="mt-4 space-y-4">
            {/* Tag Filter and Tabs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                <TabsList>
                  <TabsTrigger value="open" className="gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Em Aberto
                    <Badge variant="secondary">{filteredOpenDeals.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="won" className="gap-2">
                    <Trophy className="h-4 w-4" />
                    Ganhas
                    <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700">
                      {filteredWonDeals.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="lost" className="gap-2">
                    <XCircle className="h-4 w-4" />
                    Perdidas
                    <Badge variant="secondary" className="bg-red-500/20 text-red-700">
                      {filteredLostDeals.length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Filters */}
              <div className="flex items-center gap-2">
                {/* Unified Filter Button */}
                <PipelineFilterButton
                  salesUsers={salesUsers}
                  stages={stages}
                  activeFilter={activeFilter}
                  onFilterChange={setActiveFilter}
                  availableTags={availableTags}
                />
                
                {/* Search bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar nome ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 w-[220px] bg-background border-border"
                  />
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
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

              <TabsContent value="won" className="mt-0 space-y-4">
                {/* Summary and Month Filter */}
                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Ganhas</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(filteredWonTotal)}
                      </p>
                    </div>
                    <div className="h-10 w-px bg-emerald-500/20" />
                    <div>
                      <p className="text-sm text-muted-foreground">Negócios</p>
                      <p className="text-xl font-semibold">
                        {filteredWonDealsByMonth.length}
                      </p>
                    </div>
                  </div>
                  
                  {/* Month Filter */}
                  <Select value={wonMonthFilter} onValueChange={setWonMonthFilter}>
                    <SelectTrigger className="w-[200px] bg-background">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Todos os meses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os meses</SelectItem>
                      {availableWonMonths.map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <DealListView 
                  deals={filteredWonDealsByMonth} 
                  stages={stages}
                  onDealClick={handleDealClick} 
                  showStatus
                />
              </TabsContent>

              <TabsContent value="lost" className="mt-0 space-y-4">
                {/* Summary and Month Filter - Red Style */}
                <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Perdidas</p>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(filteredLostTotal)}
                      </p>
                    </div>
                    <div className="h-10 w-px bg-red-500/20" />
                    <div>
                      <p className="text-sm text-muted-foreground">Negócios</p>
                      <p className="text-xl font-semibold">
                        {filteredLostDealsByMonth.length}
                      </p>
                    </div>
                  </div>
                  
                  {/* Month Filter */}
                  <Select value={lostMonthFilter} onValueChange={setLostMonthFilter}>
                    <SelectTrigger className="w-[200px] bg-background">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Todos os meses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os meses</SelectItem>
                      {availableLostMonths.map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
    </>
  );
}

// Simple list view component
function DealListView({ 
  deals, 
  stages,
  onDealClick,
  showStatus = false,
}: { 
  deals: Deal[];
  stages: DealStage[];
  onDealClick: (deal: Deal) => void;
  showStatus?: boolean;
}) {
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
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
                className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onDealClick(deal)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={deal.responsible_user?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {deal.responsible_user?.name
                          ?.split(" ")
                          .map(n => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className="w-2 h-8 rounded-full"
                      style={{ backgroundColor: stage?.color || '#6b7280' }}
                    />
                    <div>
                      <p className="font-medium">{deal.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {deal.client?.full_name || deal.lead?.full_name || deal.contact_name || 'Sem contato'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {stage && (
                      <Badge
                        variant="outline"
                        style={{ 
                          borderColor: stage.color,
                          color: stage.color,
                        }}
                      >
                        {stage.name}
                      </Badge>
                    )}
                    {showStatus && (
                      <Badge
                        variant={deal.status === 'won' ? 'default' : 'destructive'}
                        className={deal.status === 'won' ? 'bg-emerald-500' : ''}
                      >
                        {deal.status === 'won' ? 'Ganha' : 'Perdida'}
                      </Badge>
                    )}
                    {/* Won date - shown only for won deals */}
                    {deal.status === 'won' && deal.won_at && (
                      <div className="flex items-center gap-1 text-sm text-emerald-600">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {new Date(deal.won_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    )}
                    <span className="font-semibold">
                      {formatCurrency(deal.value)}
                    </span>
                  </div>
                </div>
                
                {/* Loss Reason - shown only for lost deals */}
                {deal.status === 'lost' && deal.lost_reason && (
                  <div className="mt-3 ml-[52px]">
                    <div 
                      className={cn(
                        "text-xs text-muted-foreground bg-destructive/10 rounded px-2.5 py-2 border border-destructive/20",
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
                        className="text-xs text-muted-foreground hover:text-foreground mt-1.5 hover:underline"
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
