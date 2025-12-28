import { useState } from "react";
import { useDeals, Deal, DealStage } from "@/hooks/useDeals";
import { DealKanban } from "@/components/sales/DealKanban";
import { DealDialog } from "@/components/sales/DealDialog";
import { DealStagesManager } from "@/components/sales/DealStagesManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus, 
  TrendingUp, 
  Trophy, 
  XCircle,
  Settings2,
  LayoutGrid,
  List,
  Users,
  Clock,
  MessageSquare,
  CheckCircle,
  RefreshCw
} from "lucide-react";

export default function SalesPipeline() {
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
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [isStagesManagerOpen, setIsStagesManagerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activeTab, setActiveTab] = useState('open');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleDealClick = (deal: Deal) => {
    setSelectedDeal(deal);
  };

  const handleDealMove = async (dealId: string, newStageId: string): Promise<boolean> => {
    return await moveDeal(dealId, newStageId);
  };

  const handleSaveDeal = async (data: any) => {
    if (selectedDeal) {
      await updateDeal(selectedDeal.id, data);
    } else {
      await createDeal(data);
    }
    setSelectedDeal(null);
    setIsNewDealOpen(false);
  };

  const handleMarkAsWon = async (dealId: string) => {
    await markAsWon(dealId);
    setSelectedDeal(null);
  };

  const handleMarkAsLost = async (dealId: string, reason?: string) => {
    await markAsLost(dealId, reason);
    setSelectedDeal(null);
  };

  const handleDeleteDeal = async (dealId: string) => {
    await deleteDeal(dealId);
    setSelectedDeal(null);
  };

  const handleReopen = async (dealId: string) => {
    await reopenDeal(dealId);
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

        {/* Funnel Stats - Compact */}
        <div className="flex items-center gap-0 overflow-x-auto border rounded-lg bg-muted/30 p-1">
          {stages.map((stage, index) => {
            const dealsInStage = openDeals.filter(d => d.stage_id === stage.id);
            const prevStageDeals = index > 0 
              ? openDeals.filter(d => d.stage_id === stages[index - 1].id).length 
              : openDeals.length;
            const conversionRate = prevStageDeals > 0 
              ? Math.round((dealsInStage.length / prevStageDeals) * 100) 
              : 0;
            
            return (
              <div key={stage.id} className="flex items-center gap-2 px-3 py-1.5 min-w-fit border-r border-border/50 last:border-r-0">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ 
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: stage.color,
                    backgroundColor: `${stage.color}15`,
                    color: stage.color
                  }}
                >
                  {dealsInStage.length}
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">{stage.name}</span>
                {index > 0 && (
                  <span className="text-[10px] text-muted-foreground">{conversionRate}%</span>
                )}
              </div>
            );
          })}
          
          {/* Won */}
          <div className="flex items-center gap-2 px-3 py-1.5 min-w-fit border-r border-border/50">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500 flex items-center justify-center bg-emerald-500/10 text-xs font-bold text-emerald-500">
              {wonDeals.length}
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">Ganhas</span>
          </div>
          
          {/* Lost */}
          <div className="flex items-center gap-2 px-3 py-1.5 min-w-fit">
            <div className="w-8 h-8 rounded-full border-2 border-red-500 flex items-center justify-center bg-red-500/10 text-xs font-bold text-red-500">
              {lostDeals.length}
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">Perdidas</span>
          </div>
        </div>

        {/* Tabs for different deal statuses */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="open" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Em Aberto
              <Badge variant="secondary">{openDeals.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="won" className="gap-2">
              <Trophy className="h-4 w-4" />
              Ganhas
              <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700">
                {wonDeals.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="lost" className="gap-2">
              <XCircle className="h-4 w-4" />
              Perdidas
              <Badge variant="secondary" className="bg-red-500/20 text-red-700">
                {lostDeals.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="mt-4">
            {viewMode === 'kanban' ? (
              <DealKanban
                stages={stages}
                deals={openDeals}
                onDealClick={handleDealClick}
                onDealMove={handleDealMove}
              />
            ) : (
              <DealListView 
                deals={openDeals} 
                stages={stages}
                onDealClick={handleDealClick} 
              />
            )}
          </TabsContent>

          <TabsContent value="won" className="mt-4">
            <DealListView 
              deals={wonDeals} 
              stages={stages}
              onDealClick={handleDealClick} 
              showStatus
            />
          </TabsContent>

          <TabsContent value="lost" className="mt-4">
            <DealListView 
              deals={lostDeals} 
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

      {/* Edit Deal Dialog */}
      <DealDialog
        open={!!selectedDeal}
        onOpenChange={(open) => !open && setSelectedDeal(null)}
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
