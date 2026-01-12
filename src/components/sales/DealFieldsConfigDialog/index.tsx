import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SortableFieldItem } from "./SortableFieldItem";
import { SortableFolderItem } from "./SortableFolderItem";
import { FieldConfig, FolderConfig } from "./types";

interface DealFieldsConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onSave: () => void;
}

function UnfolderedDropZone({ isOver }: { isOver: boolean }) {
  return (
    <div
      className={`text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg transition-colors ${
        isOver ? "border-primary bg-primary/5" : "border-muted"
      }`}
    >
      Arraste campos para remover de pastas
    </div>
  );
}

export function DealFieldsConfigDialog({
  open,
  onOpenChange,
  accountId,
  onSave,
}: DealFieldsConfigDialogProps) {
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [folders, setFolders] = useState<FolderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { setNodeRef: setUnfolderedRef, isOver: isOverUnfoldered } = useDroppable({
    id: "unfoldered-zone",
    data: { type: "unfoldered" },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (open && accountId) {
      fetchData();
    }
  }, [open, accountId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fieldsResult, foldersResult] = await Promise.all([
        supabase
          .from("custom_fields")
          .select("id, name, field_type, show_in_deals, display_order, folder_id")
          .eq("account_id", accountId)
          .eq("is_active", true)
          .order("display_order"),
        supabase
          .from("custom_field_folders")
          .select("id, name, display_order, is_expanded")
          .eq("account_id", accountId)
          .order("display_order"),
      ]);

      if (fieldsResult.error) throw fieldsResult.error;
      if (foldersResult.error) throw foldersResult.error;

      setFields(
        (fieldsResult.data || []).map((f) => ({
          id: f.id,
          name: f.name,
          field_type: f.field_type,
          show_in_deals: f.show_in_deals ?? false,
          display_order: f.display_order ?? 0,
          folder_id: f.folder_id,
        }))
      );

      setFolders(
        (foldersResult.data || []).map((f) => ({
          id: f.id,
          name: f.name,
          display_order: f.display_order,
          is_expanded: f.is_expanded,
        }))
      );
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleField = (fieldId: string) => {
    setFields((prev) =>
      prev.map((f) =>
        f.id === fieldId ? { ...f, show_in_deals: !f.show_in_deals } : f
      )
    );
  };

  const handleToggleFolderExpand = (folderId: string) => {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId ? { ...f, is_expanded: !f.is_expanded } : f
      )
    );
  };

  const handleRenameFolder = (folderId: string, name: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, name } : f))
    );
  };

  const handleDeleteFolder = (folderId: string) => {
    // Move all fields from this folder to unfoldered
    setFields((prev) =>
      prev.map((f) => (f.folder_id === folderId ? { ...f, folder_id: null } : f))
    );
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    const newFolder: FolderConfig = {
      id: `temp-${Date.now()}`,
      name: newFolderName.trim(),
      display_order: folders.length,
      is_expanded: true,
    };

    setFolders((prev) => [...prev, newFolder]);
    setNewFolderName("");
    setShowNewFolderInput(false);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // If dragging a field over a folder drop zone
    if (activeData?.type === "field" && overData?.type === "folder-drop") {
      const newFolderId = overData.folderId;
      setFields((prev) =>
        prev.map((f) =>
          f.id === active.id ? { ...f, folder_id: newFolderId } : f
        )
      );
    }

    // If dragging a field to unfoldered zone
    if (activeData?.type === "field" && overData?.type === "unfoldered") {
      setFields((prev) =>
        prev.map((f) => (f.id === active.id ? { ...f, folder_id: null } : f))
      );
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Reorder folders
    if (activeData?.type === "folder" && overData?.type === "folder") {
      const oldIndex = folders.findIndex((f) => `folder-${f.id}` === active.id);
      const newIndex = folders.findIndex((f) => `folder-${f.id}` === over.id);
      setFolders(arrayMove(folders, oldIndex, newIndex));
      return;
    }

    // Reorder fields within same folder or unfoldered section
    if (activeData?.type === "field") {
      const activeField = fields.find((f) => f.id === active.id);
      const overField = fields.find((f) => f.id === over.id);

      if (activeField && overField && activeField.folder_id === overField.folder_id) {
        const sameFolderFields = fields.filter(
          (f) => f.folder_id === activeField.folder_id
        );
        const oldIndex = sameFolderFields.findIndex((f) => f.id === active.id);
        const newIndex = sameFolderFields.findIndex((f) => f.id === over.id);

        const reordered = arrayMove(sameFolderFields, oldIndex, newIndex);
        
        setFields((prev) => {
          const otherFields = prev.filter(
            (f) => f.folder_id !== activeField.folder_id
          );
          return [...otherFields, ...reordered];
        });
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save folders (create new ones, update existing)
      for (const folder of folders) {
        if (folder.id.startsWith("temp-")) {
          // Create new folder
          const { data, error } = await supabase
            .from("custom_field_folders")
            .insert({
              account_id: accountId,
              name: folder.name,
              display_order: folders.indexOf(folder),
              is_expanded: folder.is_expanded,
            })
            .select("id")
            .single();

          if (error) throw error;

          // Update fields that reference this temp folder
          const newFolderId = data.id;
          setFields((prev) =>
            prev.map((f) =>
              f.folder_id === folder.id ? { ...f, folder_id: newFolderId } : f
            )
          );
          folder.id = newFolderId; // Update for field saving
        } else {
          // Update existing folder
          const { error } = await supabase
            .from("custom_field_folders")
            .update({
              name: folder.name,
              display_order: folders.indexOf(folder),
              is_expanded: folder.is_expanded,
            })
            .eq("id", folder.id);

          if (error) throw error;
        }
      }

      // Delete folders that were removed
      const existingFolderIds = folders.map((f) => f.id).filter((id) => !id.startsWith("temp-"));
      const { data: currentFolders } = await supabase
        .from("custom_field_folders")
        .select("id")
        .eq("account_id", accountId);

      const foldersToDelete = (currentFolders || [])
        .filter((f) => !existingFolderIds.includes(f.id))
        .map((f) => f.id);

      if (foldersToDelete.length > 0) {
        await supabase
          .from("custom_field_folders")
          .delete()
          .in("id", foldersToDelete);
      }

      // Update all fields with new order, visibility, and folder assignment
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        const { error } = await supabase
          .from("custom_fields")
          .update({
            display_order: i,
            show_in_deals: field.show_in_deals,
            folder_id: field.folder_id?.startsWith("temp-") ? null : field.folder_id,
          })
          .eq("id", field.id);

        if (error) throw error;
      }

      toast.success("Configuração salva com sucesso!");
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving configuration:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const unfolderedFields = fields.filter((f) => !f.folder_id);
  const activeField = activeId ? fields.find((f) => f.id === activeId) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Personalizar Campos do Negócio</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground flex-shrink-0">
          Arraste para reordenar, use o switch para ocultar/exibir campos, e organize em pastas.
        </p>

        <div className="flex items-center gap-2 flex-shrink-0">
          {showNewFolderInput ? (
            <div className="flex-1 flex items-center gap-2">
              <Input
                placeholder="Nome da pasta"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="h-8"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") {
                    setShowNewFolderInput(false);
                    setNewFolderName("");
                  }
                }}
              />
              <Button size="sm" onClick={handleCreateFolder}>
                Criar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowNewFolderInput(false);
                  setNewFolderName("");
                }}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNewFolderInput(true)}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Nova Pasta
            </Button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : fields.length === 0 && folders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum campo personalizado encontrado
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              {/* Folders */}
              <SortableContext
                items={folders.map((f) => `folder-${f.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {folders.map((folder) => (
                  <SortableFolderItem
                    key={folder.id}
                    folder={folder}
                    fields={fields}
                    onToggleField={handleToggleField}
                    onToggleExpand={handleToggleFolderExpand}
                    onRename={handleRenameFolder}
                    onDelete={handleDeleteFolder}
                  />
                ))}
              </SortableContext>

              {/* Unfoldered section */}
              {unfolderedFields.length > 0 || folders.length > 0 ? (
                <div className="mt-4">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Sem pasta
                  </div>
                  <div ref={setUnfolderedRef}>
                    {unfolderedFields.length === 0 ? (
                      <UnfolderedDropZone isOver={isOverUnfoldered} />
                    ) : (
                      <SortableContext
                        items={unfolderedFields.map((f) => f.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-1">
                          {unfolderedFields.map((field) => (
                            <SortableFieldItem
                              key={field.id}
                              field={field}
                              onToggle={handleToggleField}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    )}
                  </div>
                </div>
              ) : null}

              <DragOverlay>
                {activeField ? (
                  <div className="flex items-center gap-3 p-3 bg-background border rounded-lg shadow-lg">
                    <span className="text-sm font-medium">{activeField.name}</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
