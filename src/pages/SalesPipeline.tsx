import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDeals, Deal, DealStage } from "@/hooks/useDeals";
import { DealKanban } from "@/components/sales/DealKanban";
import { DealDialog } from "@/components/sales/DealDialog";
import { DealDetailSheet } from "@/components/sales/DealDetailSheet";
import { DealStagesManager } from "@/components/sales/DealStagesManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Plus, 
  TrendingUp, 
  Trophy, 
  XCircle,
  Settings2,
  LayoutGrid,
  List,
  Tag,
  BookOpen,
} from "lucide-react";
import { PlaybookDialog } from "@/components/sales/PlaybookDialog";

export default function SalesPipeline() {
  const navigate = useNavigate();
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

  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [isStagesManagerOpen, setIsStagesManagerOpen] = useState(false);
  const [isPlaybookOpen, setIsPlaybookOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activeTab, setActiveTab] = useState('open');
  const [selectedTag, setSelectedTag] = useState<string>('all');

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

  // Filter deals by selected tag
  const filterDealsByTag = (dealsList: Deal[]) => {
    if (selectedTag === 'all') return dealsList;
    return dealsList.filter(deal => 
      deal.tags && Array.isArray(deal.tags) && deal.tags.includes(selectedTag)
    );
  };

  const filteredOpenDeals = filterDealsByTag(openDeals);
  const filteredWonDeals = filterDealsByTag(wonDeals);
  const filteredLostDeals = filterDealsByTag(lostDeals);

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

  const handleSaveDeal = async (data: any) => {
    if (isEditDialogOpen && selectedDeal) {
      await updateDeal(selectedDeal.id, data);
    } else {
      await createDeal(data);
    }
    setSelectedDeal(null);
    setIsEditDialogOpen(false);
    setIsNewDealOpen(false);
  };

  const handleMarkAsWon = async (dealId: string) => {
    // Find the deal to get client/lead info
    const deal = deals.find(d => d.id === dealId);
    if (!deal) {
      toast.error("Negociação não encontrada");
      return;
    }

    try {
      let clientId = deal.client_id;
      
      // If deal has lead_id but no client_id, convert lead to client first
      if (deal.lead_id && !deal.client_id) {
        const { data: convertedClient, error: convertError } = await supabase
          .rpc('convert_lead_to_client', { p_lead_id: deal.lead_id });
        
        if (convertError) {
          console.error("Error converting lead:", convertError);
          toast.error("Erro ao converter lead para cliente");
          return;
        }
        
        clientId = convertedClient;
        toast.success("Lead convertido para cliente!");
      }

      // Mark deal as won
      await markAsWon(dealId);
      
      setIsDetailOpen(false);
      setSelectedDeal(null);
      
      // Navigate to contracts page with query params to open new contract dialog
      if (clientId) {
        navigate(`/contracts?newContract=true&clientId=${clientId}&dealId=${dealId}&value=${deal.value || 0}`);
      } else {
        toast.success("Negociação marcada como ganha!");
      }
    } catch (error) {
      console.error("Error marking deal as won:", error);
      toast.error("Erro ao processar ganho");
    }
  };

  const handleMarkAsLost = async (dealId: string, reason?: string) => {
    await markAsLost(dealId, reason);
    setIsDetailOpen(false);
    setSelectedDeal(null);
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
            <h1 className="text-xl font-bold">Pipeline de Vendas</h1>
            <p className="text-muted-foreground text-xs">
              Gerencie suas negociações e oportunidades
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPlaybookOpen(true)}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Playbook
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsStagesManagerOpen(true)}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Etapas
            </Button>
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
          </div>
        </div>

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

          {/* Tag Filter */}
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Filtrar por tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as tags</SelectItem>
                {availableTags.map(tag => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTag !== 'all' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTag('all')}
                className="h-9 px-2"
              >
                Limpar
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>

          <TabsContent value="open" className="mt-4">
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

          <TabsContent value="won" className="mt-4">
            <DealListView 
              deals={filteredWonDeals} 
              stages={stages}
              onDealClick={handleDealClick} 
              showStatus
            />
          </TabsContent>

          <TabsContent value="lost" className="mt-4">
            <DealListView 
              deals={filteredLostDeals} 
              stages={stages}
              onDealClick={handleDealClick} 
              showStatus
            />
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
        onEdit={handleEditFromDetail}
        onMarkAsWon={handleMarkAsWon}
        onMarkAsLost={handleMarkAsLost}
        onReopen={handleReopen}
        onStageChange={handleDealMove}
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

      {/* Playbook Dialog */}
      <PlaybookDialog
        open={isPlaybookOpen}
        onOpenChange={setIsPlaybookOpen}
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
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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
            return (
              <div
                key={deal.id}
                className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onDealClick(deal)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-8 rounded-full"
                      style={{ backgroundColor: stage?.color || '#6b7280' }}
                    />
                    <div>
                      <p className="font-medium">{deal.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {deal.client?.full_name || deal.contact_name || 'Sem contato'}
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
                    <span className="font-semibold">
                      {formatCurrency(deal.value)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
