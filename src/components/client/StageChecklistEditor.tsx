import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Plus, Trash2, Pencil, CheckSquare, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useStageChecklistItems,
  useManageChecklistItems,
  StageChecklistItem,
} from "@/hooks/useStageChecklist";

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
}

export function StageChecklistEditor({
  open,
  onOpenChange,
  stages,
  accountId,
}: StageChecklistEditorProps) {
  const stageIds = stages.map((s) => s.id);
  const { data: checklistItems = [], isLoading } = useStageChecklistItems(stageIds);
  const { addItem, updateItem, deleteItem } = useManageChecklistItems(accountId);

  const [newItemStageId, setNewItemStageId] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [editingItem, setEditingItem] = useState<StageChecklistItem | null>(null);

  const sortedStages = [...stages].sort((a, b) => a.display_order - b.display_order);

  const handleAddItem = async (stageId: string) => {
    if (!newItemTitle.trim()) return;

    try {
      await addItem.mutateAsync({
        stageId,
        title: newItemTitle.trim(),
        description: newItemDescription.trim() || undefined,
      });
      setNewItemTitle("");
      setNewItemDescription("");
      setNewItemStageId(null);
      toast.success("Item adicionado");
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Erro ao adicionar item");
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !editingItem.title.trim()) return;

    try {
      await updateItem.mutateAsync({
        itemId: editingItem.id,
        title: editingItem.title.trim(),
        description: editingItem.description || undefined,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Checklist por Etapa do Onboarding
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {sortedStages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma etapa criada. Crie etapas primeiro para configurar o checklist.
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
