import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowRight, CheckSquare, AlertTriangle, ChevronRight, Package, User } from "lucide-react";
import { toast } from "sonner";
import { useStageChecklistItems, useClientChecklistProgress, useToggleChecklistItem, getChecklistStatus, hasPendingInPreviousStages } from "@/hooks/useStageChecklist";
import { StageChecklistEditor } from "./StageChecklistEditor";

interface ClientStage {
  id: string;
  name: string;
  color: string;
  display_order: number;
}

interface Client {
  id: string;
  full_name: string;
  phone_e164: string;
  emails?: any;
  company_name?: string;
  avatar_url?: string;
  stage_id?: string | null;
  status: string;
  client_products?: Array<{
    product_id: string;
    products?: { id: string; name: string };
  }>;
}

interface OnboardingOrchestratedProps {
  clients: Client[];
  stages: ClientStage[];
  accountId: string;
  onStageChange: (clientId: string, stageId: string | null) => Promise<void>;
  onRefreshStages: () => void;
}

export function OnboardingOrchestrated({ 
  clients, 
  stages, 
  accountId, 
  onStageChange,
  onRefreshStages 
}: OnboardingOrchestratedProps) {
  const [checklistEditorOpen, setChecklistEditorOpen] = useState(false);
  const [updatingClient, setUpdatingClient] = useState<string | null>(null);

  // Sort stages by display_order
  const sortedStages = useMemo(() => 
    [...stages].sort((a, b) => a.display_order - b.display_order), 
    [stages]
  );

  // Fetch checklist data
  const stageIds = useMemo(() => sortedStages.map(s => s.id), [sortedStages]);
  const clientIds = useMemo(() => clients.map(c => c.id), [clients]);

  const { data: checklistItems = [] } = useStageChecklistItems(stageIds);
  const { data: checklistProgress = [] } = useClientChecklistProgress(clientIds);
  const toggleChecklistItem = useToggleChecklistItem();

  // Filter only clients that are in onboarding (have a stage)
  const onboardingClients = useMemo(() => 
    clients.filter(c => c.stage_id !== null && c.stage_id !== undefined),
    [clients]
  );

  // Handle stage change with checklist validation
  const handleStageChange = async (clientId: string, newStageId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const currentStageId = client.stage_id;
    if (!currentStageId || newStageId === currentStageId) return;

    const currentStageOrder = sortedStages.find(s => s.id === currentStageId)?.display_order ?? -1;
    const newStageOrder = sortedStages.find(s => s.id === newStageId)?.display_order ?? -1;

    // Only check if moving forward
    if (newStageOrder > currentStageOrder) {
      const currentStatus = getChecklistStatus(clientId, currentStageId, checklistItems, checklistProgress);
      
      if (currentStatus.total > 0 && currentStatus.completed < currentStatus.total) {
        toast.error("Complete todos os itens do checklist antes de avançar para a próxima etapa");
        return;
      }
    }

    setUpdatingClient(clientId);
    try {
      await onStageChange(clientId, newStageId);
      toast.success("Etapa atualizada");
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error("Erro ao atualizar etapa");
    } finally {
      setUpdatingClient(null);
    }
  };

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  // Get stage by id
  const getStage = (stageId: string | null | undefined) => {
    if (!stageId) return null;
    return sortedStages.find(s => s.id === stageId);
  };

  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <CheckSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Configure seu Onboarding Orquestrado</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          Primeiro, crie etapas no Kanban para poder gerenciar o onboarding dos seus clientes aqui.
        </p>
        <Button onClick={() => setChecklistEditorOpen(true)}>
          Gerenciar Checklist
        </Button>
        <StageChecklistEditor
          open={checklistEditorOpen}
          onOpenChange={setChecklistEditorOpen}
          stages={stages}
          accountId={accountId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <User className="h-3 w-3" />
            {onboardingClients.length} cliente(s) em onboarding
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => setChecklistEditorOpen(true)}>
          <CheckSquare className="h-4 w-4 mr-2" />
          Gerenciar Checklist
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Cliente</TableHead>
              <TableHead className="w-[200px]">Etapa Atual</TableHead>
              <TableHead className="w-[150px]">Progresso</TableHead>
              <TableHead className="w-[100px]">Checklist</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {onboardingClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhum cliente em onboarding. Atribua uma etapa aos clientes para começar.
                </TableCell>
              </TableRow>
            ) : (
              onboardingClients.map((client) => {
                const stage = getStage(client.stage_id);
                const status = client.stage_id 
                  ? getChecklistStatus(client.id, client.stage_id, checklistItems, checklistProgress)
                  : { total: 0, completed: 0, isComplete: true };
                const currentStage = sortedStages.find(s => s.id === client.stage_id);
                const hasPendingPrevious = client.stage_id && currentStage
                  ? hasPendingInPreviousStages(client.id, currentStage.display_order, sortedStages, checklistItems, checklistProgress)
                  : false;

                // Get items for current stage
                const stageItems = checklistItems.filter(item => item.stage_id === client.stage_id);
                const completedItemIds = checklistProgress
                  .filter(p => p.client_id === client.id && p.completed_at !== null)
                  .map(p => p.checklist_item_id);

                return (
                  <TableRow key={client.id}>
                    {/* Client info */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={client.avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-muted">
                            {getInitials(client.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{client.full_name}</p>
                            {hasPendingPrevious && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Pendências em etapas anteriores</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {client.company_name || client.phone_e164}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Stage selector */}
                    <TableCell>
                      <Select
                        value={client.stage_id || ""}
                        onValueChange={(value) => handleStageChange(client.id, value)}
                        disabled={updatingClient === client.id}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione uma etapa">
                            {stage && (
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: stage.color }}
                                />
                                <span className="truncate">{stage.name}</span>
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {sortedStages.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: s.color }}
                                />
                                <span>{s.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Progress */}
                    <TableCell>
                      {status.total > 0 ? (
                        <div className="space-y-1">
                          <Progress 
                            value={(status.completed / status.total) * 100} 
                            className="h-2"
                          />
                          <p className="text-xs text-muted-foreground">
                            {status.completed}/{status.total} itens
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem checklist</span>
                      )}
                    </TableCell>

                    {/* Checklist popover */}
                    <TableCell>
                      {stageItems.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-1">
                              <CheckSquare className="h-4 w-4" />
                              <span className="text-xs">{status.completed}/{status.total}</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80" align="end">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-sm">Checklist - {stage?.name}</h4>
                                <Badge 
                                  variant={status.isComplete ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {status.completed}/{status.total}
                                </Badge>
                              </div>
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {stageItems.map((item) => {
                                  const isCompleted = completedItemIds.includes(item.id);
                                  return (
                                    <label
                                      key={item.id}
                                      className="flex items-start gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                                    >
                                      <Checkbox
                                        checked={isCompleted}
                                        onCheckedChange={() => {
                                          toggleChecklistItem.mutate({
                                            clientId: client.id,
                                            checklistItemId: item.id,
                                            accountId,
                                            completed: !isCompleted,
                                          });
                                        }}
                                        className="mt-0.5"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-sm ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                                          {item.title}
                                        </p>
                                        {item.description && (
                                          <p className="text-xs text-muted-foreground mt-0.5">
                                            {item.description}
                                          </p>
                                        )}
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/clients/${client.id}`}>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Checklist Editor */}
      <StageChecklistEditor
        open={checklistEditorOpen}
        onOpenChange={setChecklistEditorOpen}
        stages={stages}
        accountId={accountId}
      />
    </div>
  );
}
