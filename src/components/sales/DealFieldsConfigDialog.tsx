import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { GripVertical, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FieldConfig {
  id: string;
  name: string;
  field_type: string;
  show_in_deals: boolean;
  display_order: number;
}

interface SortableFieldItemProps {
  field: FieldConfig;
  onToggle: (id: string) => void;
}

function SortableFieldItem({ field, onToggle }: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-background border rounded-lg"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm font-medium">{field.name}</span>
      <Switch
        checked={field.show_in_deals}
        onCheckedChange={() => onToggle(field.id)}
      />
    </div>
  );
}

interface DealFieldsConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onSave: () => void;
}

export function DealFieldsConfigDialog({
  open,
  onOpenChange,
  accountId,
  onSave,
}: DealFieldsConfigDialogProps) {
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (open && accountId) {
      fetchFields();
    }
  }, [open, accountId]);

  const fetchFields = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("custom_fields")
        .select("id, name, field_type, show_in_deals, display_order")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;

      setFields(
        (data || []).map((f) => ({
          id: f.id,
          name: f.name,
          field_type: f.field_type,
          show_in_deals: f.show_in_deals ?? false,
          display_order: f.display_order ?? 0,
        }))
      );
    } catch (error) {
      console.error("Error fetching fields:", error);
      toast.error("Erro ao carregar campos");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (fieldId: string) => {
    setFields((prev) =>
      prev.map((f) =>
        f.id === fieldId ? { ...f, show_in_deals: !f.show_in_deals } : f
      )
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);

    setFields(arrayMove(fields, oldIndex, newIndex));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update all fields with new order and visibility
      const updates = fields.map((field, index) => ({
        id: field.id,
        display_order: index,
        show_in_deals: field.show_in_deals,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("custom_fields")
          .update({
            display_order: update.display_order,
            show_in_deals: update.show_in_deals,
          })
          .eq("id", update.id);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Personalizar Campos do Negócio</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Arraste para reordenar e use o switch para ocultar/exibir campos.
        </p>

        <div className="space-y-2 max-h-[400px] overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum campo personalizado encontrado
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {fields.map((field) => (
                  <SortableFieldItem
                    key={field.id}
                    field={field}
                    onToggle={handleToggle}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        <DialogFooter>
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
