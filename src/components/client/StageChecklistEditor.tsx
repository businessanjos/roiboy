import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, CheckSquare, GripVertical, Layers, Check, X, Calendar, AlertCircle, ExternalLink } from "lucide-react";
import { format, isPast, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  useStageChecklistItems,
  useManageChecklistItems,
  StageChecklistItem,
  ChecklistActionType,
  CHECKLIST_ACTION_LABELS,
} from "@/hooks/useStageChecklist";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ClientStage {
  id: string;
  name: string;
  color: string;
  display_order: number;
}

interface StageChecklistEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: ClientStage[];
  accountId: string;
  onRefresh?: () => void;
}

const STAGE_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#64748b"
];

interface SortableStageItemProps {
  stage: ClientStage;
  index: number;
  editingStage: ClientStage | null;
  setEditingStage: (stage: ClientStage | null) => void;
  handleUpdateStage: () => void;
  handleDeleteStage: (id: string) => void;
  savingStage: boolean;
  itemCount: number;
}

function SortableStageItem({
  stage,
  index,
  editingStage,
  setEditingStage,
  handleUpdateStage,
  handleDeleteStage,
  savingStage,
  itemCount,
}: SortableStageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isEditing = editingStage?.id === stage.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 border rounded-lg bg-muted/30",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      {isEditing ? (
        <>
          <div
            className="w-5 h-5 rounded-full shrink-0 cursor-pointer ring-2 ring-offset-1"
            style={{ backgroundColor: editingStage.color }}
          />
          <Input
            value={editingStage.name}
            onChange={(e) =>
              setEditingStage({ ...editingStage, name: e.target.value })
            }
            className="flex-1 h-8"
            autoFocus
          />
          <div className="flex gap-1">
            {STAGE_COLORS.slice(0, 6).map((color) => (
              <button
                key={color}
                type="button"
                className={cn(
                  "w-5 h-5 rounded-full transition-all",
                  editingStage.color === color && "ring-2 ring-offset-1 ring-primary"
                )}
                style={{ backgroundColor: color }}
                onClick={() => setEditingStage({ ...editingStage, color })}
              />
            ))}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleUpdateStage}
            disabled={savingStage}
          >
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setEditingStage(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <button
            className="cursor-grab active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="text-xs text-muted-foreground w-5 text-center">
            {index + 1}
          </span>
          <div
            className="w-4 h-4 rounded-full shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <span className="flex-1 font-medium text-sm">{stage.name}</span>
          <span className="text-xs text-muted-foreground">
            {itemCount} itens
          </span>
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
  );
}

export function StageChecklistEditor({
  open,
  onOpenChange,
  stages,
  accountId,
  onRefresh,
}: StageChecklistEditorProps) {
  const stageIds = stages.map((s) => s.id);
  const { data: checklistItems = [], isLoading } = useStageChecklistItems(stageIds);
  const { addItem, updateItem, deleteItem } = useManageChecklistItems(accountId);

  // Checklist state
  const [newItemStageId, setNewItemStageId] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemDueDate, setNewItemDueDate] = useState("");
  const [newItemActionType, setNewItemActionType] = useState<ChecklistActionType | "">("");
  const [editingItem, setEditingItem] = useState<StageChecklistItem | null>(null);

  // Stage management state
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#6366f1");
  const [editingStage, setEditingStage] = useState<ClientStage | null>(null);
  const [savingStage, setSavingStage] = useState(false);

  const sortedStages = [...stages].sort((a, b) => a.display_order - b.display_order);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Checklist handlers
  const handleAddItem = async (stageId: string) => {
    if (!newItemTitle.trim()) return;

    const stage = stages.find(s => s.id === stageId);

    try {
      await addItem.mutateAsync({
        stageId,
        title: newItemTitle.trim(),
        description: newItemDescription.trim() || undefined,
        dueDate: newItemDueDate || undefined,
        stageName: stage?.name,
        actionType: newItemActionType || undefined,
      });
      setNewItemTitle("");
      setNewItemDescription("");
      setNewItemDueDate("");
      setNewItemActionType("");
      setNewItemStageId(null);
      toast.success(newItemDueDate ? "Item adicionado e tarefa criada" : "Item adicionado");
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Erro ao adicionar item");
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !editingItem.title.trim()) return;

    const stage = stages.find(s => s.id === editingItem.stage_id);

    try {
      await updateItem.mutateAsync({
        itemId: editingItem.id,
        title: editingItem.title.trim(),
        description: editingItem.description || undefined,
        dueDate: editingItem.due_date,
        stageName: stage?.name,
        currentLinkedTaskId: editingItem.linked_task_id,
        actionType: editingItem.action_type,
      });
      setEditingItem(null);
      toast.success("Item atualizado");
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error("Erro ao atualizar item");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Tem certeza? O progresso dos clientes será perdido.")) return;

    try {
      await deleteItem.mutateAsync(itemId);
      toast.success("Item excluído");
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Erro ao excluir item");
    }
  };

  const getItemsForStage = (stageId: string) =>
    checklistItems
      .filter((item) => item.stage_id === stageId)
      .sort((a, b) => a.display_order - b.display_order);

  // Stage handlers
  const handleAddStage = async () => {
    if (!newStageName.trim()) return;
    
    setSavingStage(true);
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
      onRefresh?.();
      toast.success("Etapa criada");
    } catch (error) {
      console.error("Error adding stage:", error);
      toast.error("Erro ao criar etapa");
    } finally {
      setSavingStage(false);
    }
  };

  const handleUpdateStage = async () => {
    if (!editingStage || !editingStage.name.trim()) return;
    
    setSavingStage(true);
    try {
      const { error } = await supabase
        .from("client_stages")
        .update({ name: editingStage.name, color: editingStage.color })
        .eq("id", editingStage.id);

      if (error) throw error;

      setEditingStage(null);
      onRefresh?.();
      toast.success("Etapa atualizada");
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error("Erro ao atualizar etapa");
    } finally {
      setSavingStage(false);
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

      onRefresh?.();
      toast.success("Etapa excluída");
    } catch (error) {
      console.error("Error deleting stage:", error);
      toast.error("Erro ao excluir etapa");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = sortedStages.findIndex((s) => s.id === active.id);
    const newIndex = sortedStages.findIndex((s) => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedStages = arrayMove(sortedStages, oldIndex, newIndex);

    // Update display_order for all affected stages
    try {
      const updates = reorderedStages.map((stage, index) => ({
        id: stage.id,
        display_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from("client_stages")
          .update({ display_order: update.display_order })
          .eq("id", update.id);
      }

      onRefresh?.();
      toast.success("Ordem atualizada");
    } catch (error) {
      console.error("Error reordering stages:", error);
      toast.error("Erro ao reordenar etapas");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Onboarding Orquestrado
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="stages" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stages" className="gap-2">
              <Layers className="h-4 w-4" />
              Etapas
            </TabsTrigger>
            <TabsTrigger value="checklist" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              Checklist
            </TabsTrigger>
          </TabsList>

          {/* Stages Tab */}
          <TabsContent value="stages" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {/* Add new stage */}
                <div className="p-4 border rounded-lg space-y-3">
                  <Label className="text-sm font-medium">Nova Etapa</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome da etapa"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddStage()}
                    />
                    <Button 
                      onClick={handleAddStage} 
                      disabled={!newStageName.trim() || savingStage}
                      size="sm"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          "w-6 h-6 rounded-full transition-all",
                          newStageColor === color && "ring-2 ring-offset-2 ring-primary"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewStageColor(color)}
                      />
                    ))}
                  </div>
                </div>

                {/* Existing stages with drag and drop */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={sortedStages.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {sortedStages.map((stage, index) => (
                        <SortableStageItem
                          key={stage.id}
                          stage={stage}
                          index={index}
                          editingStage={editingStage}
                          setEditingStage={setEditingStage}
                          handleUpdateStage={handleUpdateStage}
                          handleDeleteStage={handleDeleteStage}
                          savingStage={savingStage}
                          itemCount={getItemsForStage(stage.id).length}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {sortedStages.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma etapa criada ainda. Adicione sua primeira etapa acima.
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Checklist Tab */}
          <TabsContent value="checklist" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {sortedStages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Crie etapas primeiro na aba "Etapas" para configurar o checklist.
                </div>
              ) : (
                <Accordion type="multiple" className="space-y-2">
                  {sortedStages.map((stage) => {
                    const stageItems = getItemsForStage(stage.id);
                    return (
                      <AccordionItem
                        key={stage.id}
                        value={stage.id}
                        className="border rounded-lg px-4"
                      >
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: stage.color }}
                            />
                            <span className="font-medium">{stage.name}</span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {stageItems.length} {stageItems.length === 1 ? "item" : "itens"}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="space-y-3">
                            {/* Existing items */}
                            {stageItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30"
                              >
                                {editingItem?.id === item.id ? (
                                  <div className="flex-1 space-y-2">
                                    <Input
                                      value={editingItem.title}
                                      onChange={(e) =>
                                        setEditingItem({ ...editingItem, title: e.target.value })
                                      }
                                      placeholder="Título do item"
                                    />
                                    <Textarea
                                      value={editingItem.description || ""}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          description: e.target.value,
                                        })
                                      }
                                      placeholder="Descrição (opcional)"
                                      rows={2}
                                    />
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-4 w-4 text-muted-foreground" />
                                      <Input
                                        type="date"
                                        value={editingItem.due_date || ""}
                                        onChange={(e) =>
                                          setEditingItem({
                                            ...editingItem,
                                            due_date: e.target.value || null,
                                          })
                                        }
                                        className="flex-1"
                                      />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                      <Select
                                        value={editingItem.action_type || ""}
                                        onValueChange={(value) =>
                                          setEditingItem({
                                            ...editingItem,
                                            action_type: value as ChecklistActionType || null,
                                          })
                                        }
                                      >
                                        <SelectTrigger className="flex-1">
                                          <SelectValue placeholder="Vincular a uma ação (opcional)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="">Nenhuma ação</SelectItem>
                                          {Object.entries(CHECKLIST_ACTION_LABELS).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>{label}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={handleUpdateItem}
                                        disabled={updateItem.isPending}
                                      >
                                        Salvar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingItem(null)}
                                      >
                                        Cancelar
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm">{item.title}</p>
                                      {item.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {item.description}
                                        </p>
                                      )}
                                      {item.due_date && (
                                        <div className={cn(
                                          "flex items-center gap-1 mt-1 text-xs",
                                          isPast(parseISO(item.due_date)) && !isToday(parseISO(item.due_date))
                                            ? "text-destructive"
                                            : isToday(parseISO(item.due_date))
                                              ? "text-amber-600"
                                              : "text-muted-foreground"
                                        )}>
                                          {isPast(parseISO(item.due_date)) && !isToday(parseISO(item.due_date)) && (
                                            <AlertCircle className="h-3 w-3" />
                                          )}
                                          <Calendar className="h-3 w-3" />
                                          <span>
                                            {format(parseISO(item.due_date), "dd/MM/yyyy", { locale: ptBR })}
                                          </span>
                                        </div>
                                      )}
                                      {item.action_type && (
                                        <div className="flex items-center gap-1 mt-1 text-xs text-primary">
                                          <ExternalLink className="h-3 w-3" />
                                          <span>{CHECKLIST_ACTION_LABELS[item.action_type]}</span>
                                        </div>
                                      )}
                                    </div>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => setEditingItem(item)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => handleDeleteItem(item.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            ))}

                            {/* Add new item form */}
                            {newItemStageId === stage.id ? (
                              <div className="p-3 rounded-lg border border-dashed border-primary/50 space-y-2">
                                <Input
                                  value={newItemTitle}
                                  onChange={(e) => setNewItemTitle(e.target.value)}
                                  placeholder="Ex: Enviar kit de boas-vindas"
                                  autoFocus
                                />
                                <Textarea
                                  value={newItemDescription}
                                  onChange={(e) => setNewItemDescription(e.target.value)}
                                  placeholder="Descrição ou instruções (opcional)"
                                  rows={2}
                                />
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <Input
                                    type="date"
                                    value={newItemDueDate}
                                    onChange={(e) => setNewItemDueDate(e.target.value)}
                                    placeholder="Prazo (opcional)"
                                    className="flex-1"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                  <Select
                                    value={newItemActionType}
                                    onValueChange={(value) => setNewItemActionType(value as ChecklistActionType | "")}
                                  >
                                    <SelectTrigger className="flex-1">
                                      <SelectValue placeholder="Vincular a uma ação (opcional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="">Nenhuma ação</SelectItem>
                                      {Object.entries(CHECKLIST_ACTION_LABELS).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>{label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddItem(stage.id)}
                                    disabled={!newItemTitle.trim() || addItem.isPending}
                                  >
                                    Adicionar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setNewItemStageId(null);
                                      setNewItemTitle("");
                                      setNewItemDescription("");
                                      setNewItemDueDate("");
                                      setNewItemActionType("");
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-dashed"
                                onClick={() => setNewItemStageId(stage.id)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar Item
                              </Button>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
