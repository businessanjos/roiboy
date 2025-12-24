import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  GripVertical,
  Plus,
  MoreVertical,
  Settings2,
  Pencil,
  Trash2,
  Phone,
  Mail,
  Building2,
  ArrowRight,
  CheckSquare,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StageChecklistEditor } from "./StageChecklistEditor";
import {
  useStageChecklistItems,
  useClientChecklistProgress,
  useToggleChecklistItem,
  getChecklistStatus,
  hasPendingInPreviousStages,
  StageChecklistItem,
  ClientChecklistProgress,
} from "@/hooks/useStageChecklist";

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
  emails: string[] | null;
  company_name: string | null;
  avatar_url: string | null;
  stage_id: string | null;
  status: string;
  client_products?: Array<{
    products: { name: string } | null;
  }>;
}

interface ClientKanbanProps {
  clients: Client[];
  stages: ClientStage[];
  accountId: string;
  onStageChange: (clientId: string, stageId: string | null) => Promise<void>;
  onRefreshStages: () => void;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

interface SortableClientCardProps {
  client: Client;
  stages: ClientStage[];
  checklistItems: StageChecklistItem[];
  checklistProgress: ClientChecklistProgress[];
  accountId: string;
  onToggleItem: (clientId: string, itemId: string, completed: boolean) => void;
}

function SortableClientCard({ 
  client, 
  stages, 
  checklistItems, 
  checklistProgress, 
  accountId,
  onToggleItem,
}: SortableClientCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: client.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const primaryEmail = Array.isArray(client.emails) && client.emails.length > 0 
    ? client.emails[0] 
    : null;

  // Calculate checklist status
  const currentStage = stages.find(s => s.id === client.stage_id);
  const checklistStatus = client.stage_id 
    ? getChecklistStatus(client.id, client.stage_id, checklistItems, checklistProgress)
    : { total: 0, completed: 0, isComplete: true, hasItems: false };

  const hasPendingPrevious = currentStage 
    ? hasPendingInPreviousStages(
        client.id, 
        currentStage.display_order, 
        stages, 
        checklistItems, 
        checklistProgress
      )
    : false;

  // Get items for current stage
  const stageItems = client.stage_id 
    ? checklistItems.filter(item => item.stage_id === client.stage_id)
    : [];

  const clientProgressIds = checklistProgress
    .filter(p => p.client_id === client.id && p.completed_at)
    .map(p => p.checklist_item_id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border rounded-lg p-3 shadow-sm transition-all hover:shadow-md",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary",
        hasPendingPrevious && "ring-2 ring-amber-500/50"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 p-1 rounded hover:bg-muted cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start gap-2">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={client.avatar_url || undefined} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                {getInitials(client.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <Link 
                to={`/clients/${client.id}`}
                className="font-medium text-sm leading-snug hover:text-primary transition-colors line-clamp-1"
              >
                {client.full_name}
              </Link>
              {client.company_name && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3 w-3" />
                  <span className="truncate">{client.company_name}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {client.phone_e164}
            </span>
            {primaryEmail && (
              <span className="flex items-center gap-1 truncate max-w-[120px]">
                <Mail className="h-3 w-3" />
                {primaryEmail}
              </span>
            )}
          </div>

          {client.client_products && client.client_products.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {client.client_products.slice(0, 2).map((cp, idx) => (
                <Badge key={idx} variant="secondary" className="text-[9px] px-1.5 py-0">
                  {cp.products?.name}
                </Badge>
              ))}
              {client.client_products.length > 2 && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                  +{client.client_products.length - 2}
                </Badge>
              )}
            </div>
          )}

          {/* Checklist Status */}
          {checklistStatus.hasItems && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="w-full text-left">
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors">
                    {checklistStatus.isComplete ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-medium">
                          {checklistStatus.completed}/{checklistStatus.total} concluídos
                        </span>
                        {hasPendingPrevious && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Pendências em etapas anteriores</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <Progress 
                        value={(checklistStatus.completed / checklistStatus.total) * 100} 
                        className="h-1"
                      />
                    </div>
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <div className="p-3 border-b">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <ListChecks className="h-4 w-4" />
                    Checklist da Etapa
                  </h4>
                </div>
                <ScrollArea className="max-h-[200px]">
                  <div className="p-3 space-y-2">
                    {stageItems.map((item) => {
                      const isCompleted = clientProgressIds.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className={cn(
                            "flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors",
                            isCompleted ? "bg-green-50 dark:bg-green-950/20" : "hover:bg-muted"
                          )}
                        >
                          <Checkbox
                            checked={isCompleted}
                            onCheckedChange={(checked) => 
                              onToggleItem(client.id, item.id, !!checked)
                            }
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm",
                              isCompleted && "line-through text-muted-foreground"
                            )}>
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
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}

          {/* Warning for pending in previous stages */}
          {hasPendingPrevious && !checklistStatus.hasItems && (
            <div className="flex items-center gap-1.5 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[10px]">Pendências em etapas anteriores</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  stage: ClientStage | null;
  clients: Client[];
  isUncategorized?: boolean;
  stages: ClientStage[];
  checklistItems: StageChecklistItem[];
  checklistProgress: ClientChecklistProgress[];
  accountId: string;
  onToggleItem: (clientId: string, itemId: string, completed: boolean) => void;
}

function KanbanColumn({ 
  stage, 
  clients, 
  isUncategorized, 
  stages,
  checklistItems,
  checklistProgress,
  accountId,
  onToggleItem,
}: KanbanColumnProps) {
  const columnId = stage?.id || "uncategorized";
  const columnName = stage?.name || "Sem Etapa";
  const columnColor = stage?.color || "#94a3b8";

  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
  });

  // Calculate stage checklist stats
  const stageChecklistItems = stage 
    ? checklistItems.filter(item => item.stage_id === stage.id)
    : [];

  return (
    <Card 
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-w-[280px] max-w-[320px] h-full border-t-4 transition-all",
        isOver && "ring-2 ring-primary bg-primary/5"
      )}
      style={{ borderTopColor: columnColor }}
    >
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: columnColor }}
            />
            {columnName}
          </div>
          <div className="flex items-center gap-1">
            {stageChecklistItems.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-[10px] font-normal px-1.5">
                      <CheckSquare className="h-3 w-3 mr-1" />
                      {stageChecklistItems.length}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{stageChecklistItems.length} itens no checklist</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Badge variant="outline" className="text-xs font-normal">
              {clients.length}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto px-3 pb-3">
        <SortableContext items={clients.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {clients.map((client) => (
              <SortableClientCard 
                key={client.id} 
                client={client}
                stages={stages}
                checklistItems={checklistItems}
                checklistProgress={checklistProgress}
                accountId={accountId}
                onToggleItem={onToggleItem}
              />
            ))}
            {clients.length === 0 && (
              <div className={cn(
                "flex items-center justify-center h-24 border-2 border-dashed rounded-lg text-muted-foreground text-xs transition-colors",
                isOver && "border-primary bg-primary/10"
              )}>
                {isUncategorized ? "Arraste clientes aqui" : "Nenhum cliente"}
              </div>
            )}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
}

interface StageManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: ClientStage[];
  accountId: string;
  onRefresh: () => void;
}

function StageManagerDialog({ open, onOpenChange, stages, accountId, onRefresh }: StageManagerDialogProps) {
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);
  const [editingStage, setEditingStage] = useState<ClientStage | null>(null);

  const predefinedColors = [
    "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", 
    "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", 
    "#a855f7", "#d946ef", "#ec4899", "#64748b"
  ];

  const handleAddStage = async () => {
    if (!newStageName.trim()) return;
    
    setSaving(true);
    try {
      const maxOrder = stages.length > 0 
        ? Math.max(...stages.map(s => s.display_order)) 
        : -1;

      const { error } = await supabase.from("client_stages").insert({
        account_id: accountId,
        name: newStageName.trim(),
        color: newStageColor,
        display_order: maxOrder + 1,
      });

      if (error) throw error;

      setNewStageName("");
      setNewStageColor("#6366f1");
      onRefresh();
      toast.success("Etapa criada com sucesso");
    } catch (error) {
      console.error("Error adding stage:", error);
      toast.error("Erro ao criar etapa");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStage = async () => {
    if (!editingStage || !editingStage.name.trim()) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("client_stages")
        .update({ name: editingStage.name, color: editingStage.color })
        .eq("id", editingStage.id);

      if (error) throw error;

      setEditingStage(null);
      onRefresh();
      toast.success("Etapa atualizada");
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error("Erro ao atualizar etapa");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm("Tem certeza? Clientes nesta etapa ficarão sem etapa.")) return;
    
    try {
      const { error } = await supabase
        .from("client_stages")
        .delete()
        .eq("id", stageId);

      if (error) throw error;

      onRefresh();
      toast.success("Etapa excluída");
    } catch (error) {
      console.error("Error deleting stage:", error);
      toast.error("Erro ao excluir etapa");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Etapas do Onboarding</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new stage */}
          <div className="space-y-2">
            <Label>Nova Etapa</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nome da etapa"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                className="flex-1"
              />
              <input
                type="color"
                value={newStageColor}
                onChange={(e) => setNewStageColor(e.target.value)}
                className="h-10 w-10 rounded border cursor-pointer"
              />
              <Button onClick={handleAddStage} disabled={saving || !newStageName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-1 flex-wrap">
              {predefinedColors.map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
                    newStageColor === color ? "border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setNewStageColor(color)}
                />
              ))}
            </div>
          </div>

          {/* Existing stages */}
          <div className="space-y-2">
            <Label>Etapas Existentes</Label>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2 pr-4">
                {stages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma etapa criada
                  </p>
                ) : (
                  stages
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((stage) => (
                      <div key={stage.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                        {editingStage?.id === stage.id ? (
                          <>
                            <input
                              type="color"
                              value={editingStage.color}
                              onChange={(e) => setEditingStage({ ...editingStage, color: e.target.value })}
                              className="h-8 w-8 rounded cursor-pointer"
                            />
                            <Input
                              value={editingStage.name}
                              onChange={(e) => setEditingStage({ ...editingStage, name: e.target.value })}
                              className="flex-1 h-8"
                            />
                            <Button size="sm" variant="ghost" onClick={handleUpdateStage} disabled={saving}>
                              Salvar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingStage(null)}>
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            <div 
                              className="w-4 h-4 rounded-full shrink-0" 
                              style={{ backgroundColor: stage.color }}
                            />
                            <span className="flex-1 text-sm">{stage.name}</span>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7"
                              onClick={() => setEditingStage(stage)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteStage(stage.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClientKanban({ clients, stages, accountId, onStageChange, onRefreshStages }: ClientKanbanProps) {
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [checklistEditorOpen, setChecklistEditorOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch checklist data
  const stageIds = useMemo(() => stages.map(s => s.id), [stages]);
  const clientIds = useMemo(() => clients.map(c => c.id), [clients]);
  
  const { data: checklistItems = [] } = useStageChecklistItems(stageIds);
  const { data: checklistProgress = [] } = useClientChecklistProgress(clientIds);
  const toggleItem = useToggleChecklistItem();

  const handleToggleItem = useCallback((clientId: string, itemId: string, completed: boolean) => {
    toggleItem.mutate({
      clientId,
      checklistItemId: itemId,
      accountId,
      completed,
    });
  }, [toggleItem, accountId]);

  const clientsByStage = useMemo(() => {
    const result: Record<string, Client[]> = {
      uncategorized: [],
    };
    
    stages.forEach(stage => {
      result[stage.id] = [];
    });

    clients.forEach(client => {
      if (client.stage_id && result[client.stage_id]) {
        result[client.stage_id].push(client);
      } else {
        result.uncategorized.push(client);
      }
    });

    return result;
  }, [clients, stages]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const client = clients.find((c) => c.id === event.active.id);
    setActiveClient(client || null);
  }, [clients]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveClient(null);

    if (!over) return;

    const activeClient = clients.find((c) => c.id === active.id);
    if (!activeClient) return;

    // Find the column the client was dropped into
    let targetStageId: string | null = null;

    // Check if dropped over a client
    const overClient = clients.find((c) => c.id === over.id);
    if (overClient) {
      targetStageId = overClient.stage_id;
    } else {
      // Dropped over a column directly
      const overId = over.id as string;
      targetStageId = overId === "uncategorized" ? null : overId;
    }

    const currentStageId = activeClient.stage_id;
    
    // Only update if stage changed
    if (targetStageId !== currentStageId) {
      // Check if current stage has incomplete checklist items
      if (currentStageId) {
        const status = getChecklistStatus(activeClient.id, currentStageId, checklistItems, checklistProgress);
        if (status.hasItems && !status.isComplete) {
          toast.warning("Complete o checklist antes de mover para outra etapa", {
            description: `${status.completed}/${status.total} itens concluídos`
          });
          return;
        }
      }
      
      await onStageChange(activeClient.id, targetStageId);
    }
  }, [clients, onStageChange, checklistItems, checklistProgress]);

  const sortedStages = useMemo(() => 
    [...stages].sort((a, b) => a.display_order - b.display_order), 
    [stages]
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setChecklistEditorOpen(true)}>
          <CheckSquare className="h-4 w-4 mr-2" />
          Checklist
        </Button>
        <Button variant="outline" size="sm" onClick={() => setStageDialogOpen(true)}>
          <Settings2 className="h-4 w-4 mr-2" />
          Gerenciar Etapas
        </Button>
      </div>

      {stages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <ArrowRight className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Configure seu Funil de Onboarding</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Crie etapas personalizadas para organizar seus clientes no processo de onboarding.
          </p>
          <Button onClick={() => setStageDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Etapas
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 400px)" }}>
            {/* Uncategorized column first */}
            <KanbanColumn
              stage={null}
              clients={clientsByStage.uncategorized}
              isUncategorized
              stages={sortedStages}
              checklistItems={checklistItems}
              checklistProgress={checklistProgress}
              accountId={accountId}
              onToggleItem={handleToggleItem}
            />
            
            {/* Stage columns */}
            {sortedStages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                clients={clientsByStage[stage.id] || []}
                stages={sortedStages}
                checklistItems={checklistItems}
                checklistProgress={checklistProgress}
                accountId={accountId}
                onToggleItem={handleToggleItem}
              />
            ))}
          </div>

          <DragOverlay>
            {activeClient && (
              <div className="bg-card border rounded-lg p-3 shadow-xl ring-2 ring-primary opacity-90 w-[280px]">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px]">
                      {getInitials(activeClient.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-medium text-sm truncate">{activeClient.full_name}</p>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <StageManagerDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        stages={stages}
        accountId={accountId}
        onRefresh={onRefreshStages}
      />

      <StageChecklistEditor
        open={checklistEditorOpen}
        onOpenChange={setChecklistEditorOpen}
        stages={stages}
        accountId={accountId}
      />
    </div>
  );
}
