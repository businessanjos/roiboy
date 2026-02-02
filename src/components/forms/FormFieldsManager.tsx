import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, GripVertical, Pencil, X, CheckCircle2, ListChecks, Calendar, Hash, Type, ToggleLeft, Users, Instagram, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
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

export interface FormField {
  id: string;
  name: string;
  field_type: "select" | "boolean" | "multi_select" | "number" | "currency" | "text" | "date" | "user" | "instagram" | "location" | "multi_instagram";
  options: FieldOption[];
  is_required: boolean;
  display_order: number;
}

export interface FieldOption {
  value: string;
  label: string;
  color: string;
}

interface FormFieldWithOrder extends FormField {
  form_field_id: string;
}

const FIELD_TYPES = [
  { value: "select", label: "Seleção única", icon: CheckCircle2 },
  { value: "multi_select", label: "Seleção múltipla", icon: ListChecks },
  { value: "user", label: "Responsável", icon: Users },
  { value: "date", label: "Data", icon: Calendar },
  { value: "text", label: "Texto", icon: Type },
  { value: "number", label: "Número", icon: Hash },
  { value: "boolean", label: "Sim/Não", icon: ToggleLeft },
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "multi_instagram", label: "Múltiplos Instagrams", icon: Instagram },
  { value: "location", label: "Localização", icon: MapPin },
];

const COLOR_OPTIONS = [
  { value: "green", label: "Verde", class: "bg-emerald-500" },
  { value: "red", label: "Vermelho", class: "bg-red-500" },
  { value: "yellow", label: "Amarelo", class: "bg-amber-500" },
  { value: "blue", label: "Azul", class: "bg-blue-500" },
  { value: "purple", label: "Roxo", class: "bg-purple-500" },
  { value: "pink", label: "Rosa", class: "bg-pink-500" },
  { value: "orange", label: "Laranja", class: "bg-orange-500" },
  { value: "gray", label: "Cinza", class: "bg-gray-500" },
];

// Sortable field item component
function SortableFieldItem({
  field,
  onEdit,
  onDelete,
}: {
  field: FormFieldWithOrder;
  onEdit: (field: FormFieldWithOrder) => void;
  onDelete: (id: string) => void;
}) {
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

  const fieldTypeInfo = FIELD_TYPES.find(t => t.value === field.field_type);
  const TypeIcon = fieldTypeInfo?.icon || CheckCircle2;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{field.name}</span>
          <Badge variant="outline" className="text-xs gap-1">
            <TypeIcon className="h-3 w-3" />
            {fieldTypeInfo?.label || field.field_type}
          </Badge>
          {field.is_required && (
            <Badge variant="secondary" className="text-xs">Obrigatório</Badge>
          )}
        </div>
        {field.options && field.options.length > 0 && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {field.options.slice(0, 5).map((opt) => (
              <span
                key={opt.value}
                className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                  opt.color === "green" ? "bg-emerald-500/20 text-emerald-700" :
                  opt.color === "red" ? "bg-red-500/20 text-red-700" :
                  opt.color === "yellow" ? "bg-amber-500/20 text-amber-700" :
                  opt.color === "blue" ? "bg-blue-500/20 text-blue-700" :
                  opt.color === "purple" ? "bg-purple-500/20 text-purple-700" :
                  opt.color === "pink" ? "bg-pink-500/20 text-pink-700" :
                  opt.color === "orange" ? "bg-orange-500/20 text-orange-700" :
                  "bg-gray-500/20 text-gray-700"
                }`}
              >
                {opt.label}
              </span>
            ))}
            {field.options.length > 5 && (
              <span className="text-xs text-muted-foreground">+{field.options.length - 5}</span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => onEdit(field)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(field.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

interface FormFieldsManagerProps {
  formId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFieldsChange?: () => void;
}

export function FormFieldsManager({ 
  formId,
  open, 
  onOpenChange,
  onFieldsChange 
}: FormFieldsManagerProps) {
  const { currentUser } = useCurrentUser();
  const [fields, setFields] = useState<FormFieldWithOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Field dialog state
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormFieldWithOrder | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<FormField["field_type"]>("text");
  const [options, setOptions] = useState<FieldOption[]>([
    { value: "opt_1", label: "", color: "green" },
    { value: "opt_2", label: "", color: "red" },
  ]);
  const [isRequired, setIsRequired] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchFields = async () => {
    if (!currentUser?.account_id || !formId) return;
    
    setLoading(true);
    try {
      // Fetch fields linked to this form via form_fields junction table
      const { data, error } = await supabase
        .from("form_fields")
        .select(`
          id,
          display_order,
          field_id,
          custom_fields!inner (
            id,
            name,
            field_type,
            options,
            is_required
          )
        `)
        .eq("form_id", formId)
        .order("display_order");

      if (error) throw error;

      const mappedFields: FormFieldWithOrder[] = (data || []).map(ff => ({
        id: ff.custom_fields.id,
        form_field_id: ff.id,
        name: ff.custom_fields.name,
        field_type: ff.custom_fields.field_type as FormField["field_type"],
        options: (ff.custom_fields.options as unknown as FieldOption[]) || [],
        is_required: ff.custom_fields.is_required,
        display_order: ff.display_order,
      }));
      
      setFields(mappedFields);
    } catch (error: any) {
      console.error("Error fetching form fields:", error);
      toast.error("Erro ao carregar campos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && formId) {
      fetchFields();
    }
  }, [open, formId, currentUser?.account_id]);

  const resetForm = () => {
    setName("");
    setFieldType("text");
    setOptions([
      { value: "opt_1", label: "", color: "green" },
      { value: "opt_2", label: "", color: "red" },
    ]);
    setIsRequired(false);
    setEditingField(null);
  };

  const openEditDialog = (field: FormFieldWithOrder) => {
    setEditingField(field);
    setName(field.name);
    setFieldType(field.field_type);
    setOptions(field.options?.length ? field.options : [
      { value: "opt_1", label: "", color: "green" },
      { value: "opt_2", label: "", color: "red" },
    ]);
    setIsRequired(field.is_required);
    setFieldDialogOpen(true);
  };

  const addOption = () => {
    const nextColor = COLOR_OPTIONS[options.length % COLOR_OPTIONS.length].value;
    setOptions([...options, { value: `opt_${Date.now()}`, label: "", color: nextColor }]);
  };

  const updateOption = (index: number, updates: Partial<FieldOption>) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], ...updates };
    setOptions(newOptions);
  };

  const removeOption = (index: number) => {
    if (options.length > 1) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);

      const newFields = arrayMove(fields, oldIndex, newIndex);
      setFields(newFields);

      // Update display_order in form_fields table
      try {
        const updates = newFields.map((field, index) => ({
          id: field.form_field_id,
          display_order: index,
        }));

        for (const update of updates) {
          await supabase
            .from("form_fields")
            .update({ display_order: update.display_order })
            .eq("id", update.id);
        }
        
        onFieldsChange?.();
      } catch (error) {
        console.error("Error updating field order:", error);
        toast.error("Erro ao reordenar campos");
      }
    }
  };

  const saveField = async () => {
    if (!name.trim()) {
      toast.error("Nome do campo é obrigatório");
      return;
    }
    
    if (!currentUser?.account_id) return;

    setSaving(true);
    try {
      // Buscar sector_id do formulário para definir flags corretas
      const { data: formData } = await supabase
        .from("forms")
        .select("sector_id")
        .eq("id", formId)
        .single();

      // Definir flags baseado no setor do formulário
      const sectorFlags = {
        show_in_clients: formData?.sector_id === 'operacoes',
        show_in_deals: formData?.sector_id === 'vendas',
        show_in_leads: formData?.sector_id === 'marketing',
      };

      const needsOptions = ["select", "multi_select"].includes(fieldType);
      const validOptions = needsOptions 
        ? options.filter(opt => opt.label.trim()).map(opt => ({
            ...opt,
            value: opt.value || `opt_${Date.now()}_${Math.random()}`
          }))
        : [];

      if (editingField) {
        // Update existing custom_field
        const { error } = await supabase
          .from("custom_fields")
          .update({
            name: name.trim(),
            field_type: fieldType,
            options: validOptions,
            is_required: isRequired,
          })
          .eq("id", editingField.id);

        if (error) throw error;
        toast.success("Campo atualizado!");
      } else {
        // Create new custom_field
        const { data: newField, error: createError } = await supabase
          .from("custom_fields")
          .insert({
            account_id: currentUser.account_id,
            name: name.trim(),
            field_type: fieldType,
            options: validOptions,
            is_required: isRequired,
            is_active: true,
            show_in_clients: sectorFlags.show_in_clients,
            show_in_deals: sectorFlags.show_in_deals,
            show_in_leads: sectorFlags.show_in_leads,
          })
          .select("id")
          .single();

        if (createError) throw createError;

        // Link to form via form_fields
        const maxOrder = fields.length > 0 
          ? Math.max(...fields.map(f => f.display_order)) + 1 
          : 0;

        const { error: linkError } = await supabase
          .from("form_fields")
          .insert({
            form_id: formId,
            field_id: newField.id,
            display_order: maxOrder,
          });

        if (linkError) throw linkError;
        toast.success("Campo criado!");
      }

      setFieldDialogOpen(false);
      resetForm();
      fetchFields();
      onFieldsChange?.();
    } catch (error: any) {
      console.error("Error saving field:", error);
      toast.error(error.message || "Erro ao salvar campo");
    } finally {
      setSaving(false);
    }
  };

  const deleteField = async (fieldId: string) => {
    if (!confirm("Tem certeza que deseja excluir este campo do formulário?")) return;

    try {
      const field = fields.find(f => f.id === fieldId);
      if (!field) return;

      // Delete from form_fields junction (this will just unlink)
      const { error: unlinkError } = await supabase
        .from("form_fields")
        .delete()
        .eq("id", field.form_field_id);

      if (unlinkError) throw unlinkError;

      // Optionally delete the custom_field itself if it's not used elsewhere
      // For now, we'll keep the custom_field but just unlink it
      
      toast.success("Campo removido do formulário!");
      fetchFields();
      onFieldsChange?.();
    } catch (error: any) {
      console.error("Error deleting field:", error);
      toast.error("Erro ao excluir campo");
    }
  };

  const needsOptions = ["select", "multi_select"].includes(fieldType);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerenciar Campos do Formulário</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : fields.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Nenhum campo criado para este formulário.
                </p>
                <Button onClick={() => { resetForm(); setFieldDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Campo
                </Button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map(f => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <SortableFieldItem
                        key={field.id}
                        field={field}
                        onEdit={openEditDialog}
                        onDelete={deleteField}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button onClick={() => { resetForm(); setFieldDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Campo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Field Dialog */}
      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingField ? "Editar Campo" : "Novo Campo"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="fieldName">Nome do Campo *</Label>
              <Input
                id="fieldName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Data de Nascimento"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Campo</Label>
              <Select value={fieldType} onValueChange={(v) => setFieldType(v as FormField["field_type"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsOptions && (
              <div className="space-y-2">
                <Label>Opções</Label>
                <div className="space-y-2">
                  {options.map((opt, index) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <Select
                        value={opt.color}
                        onValueChange={(color) => updateOption(index, { color })}
                      >
                        <SelectTrigger className="w-[100px]">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${COLOR_OPTIONS.find(c => c.value === opt.color)?.class || "bg-gray-500"}`} />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {COLOR_OPTIONS.map((color) => (
                            <SelectItem key={color.value} value={color.value}>
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${color.class}`} />
                                {color.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={opt.label}
                        onChange={(e) => updateOption(index, { label: e.target.value })}
                        placeholder="Nome da opção"
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(index)}
                        disabled={options.length <= 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addOption}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Opção
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between py-2">
              <Label>Campo Obrigatório</Label>
              <Switch checked={isRequired} onCheckedChange={setIsRequired} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveField} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingField ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
