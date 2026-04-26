import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, GripVertical, Settings2, Pencil, X, CheckCircle2, ListChecks, Calendar, Hash, Type, ToggleLeft, Users, Instagram, MapPin, FolderPlus, Check, ChevronDown, ChevronRight, Folder, Search, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface FolderConfig {
  id: string;
  name: string;
  display_order: number;
  is_expanded: boolean;
  isNew?: boolean;
}

export interface CustomField {
  id: string;
  name: string;
  field_type: "select" | "boolean" | "multi_select" | "number" | "currency" | "text" | "date" | "user" | "instagram" | "location" | "multi_instagram";
  options: FieldOption[];
  is_required: boolean;
  display_order: number;
  is_active: boolean;
  show_in_clients?: boolean;
  show_in_deals?: boolean;
  show_in_leads?: boolean;
  folder_id?: string | null;
}

export interface FieldOption {
  value: string;
  label: string;
  color: string;
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
  field: CustomField;
  onEdit: (field: CustomField) => void;
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
          {field.show_in_clients === false && (
            <Badge variant="outline" className="text-xs text-muted-foreground">Só formulários</Badge>
          )}
        </div>
        {field.options.length > 0 && (
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

type SectorContext = "clients" | "deals" | "leads";

interface CustomFieldsManagerProps {
  onFieldsChange?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  sectorContext?: SectorContext;
}

const SECTOR_COLUMN_MAP: Record<SectorContext, string> = {
  clients: "show_in_clients",
  deals: "show_in_deals",
  leads: "show_in_leads",
};

const SECTOR_TITLE_MAP: Record<SectorContext, string> = {
  clients: "Campos de Clientes (Operações)",
  deals: "Campos de Negócios (Vendas)",
  leads: "Campos de Leads (Vendas)",
};

export function CustomFieldsManager({ 
  onFieldsChange, 
  open: externalOpen, 
  onOpenChange: externalOnOpenChange,
  sectorContext = "clients" 
}: CustomFieldsManagerProps) {
  const { currentUser } = useCurrentUser();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [folders, setFolders] = useState<FolderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalDialogOpen, setInternalDialogOpen] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Folder creation state
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  
  // Use external control if provided, otherwise internal
  const isControlled = externalOpen !== undefined;
  const managerOpen = isControlled ? externalOpen : internalDialogOpen;
  const setManagerOpen = isControlled 
    ? (open: boolean) => {
        externalOnOpenChange?.(open);
        if (!open) setSearchQuery(""); // Clear search when closing
      }
    : setInternalDialogOpen;
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<CustomField["field_type"]>("select");
  const [options, setOptions] = useState<FieldOption[]>([
    { value: "opt_1", label: "", color: "green" },
    { value: "opt_2", label: "", color: "red" },
  ]);
  const [isRequired, setIsRequired] = useState(false);
  const [showInClients, setShowInClients] = useState(true);
  
  // Deal stages for required stage selection
  const [dealStages, setDealStages] = useState<{id: string, name: string}[]>([]);
  const [requiredStages, setRequiredStages] = useState<string[]>(["all"]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchFields = async () => {
    if (!currentUser?.account_id) return;
    
    // Fetch folders
    const { data: foldersData } = await supabase
      .from("custom_field_folders")
      .select("*")
      .eq("account_id", currentUser.account_id)
      .order("display_order");
    
    if (foldersData) {
      setFolders(foldersData.map(f => ({
        id: f.id,
        name: f.name,
        display_order: f.display_order,
        is_expanded: f.is_expanded ?? true,
      })));
    }
    
    // Determine the visibility column based on sector context
    const visibilityColumn = SECTOR_COLUMN_MAP[sectorContext] as "show_in_clients" | "show_in_deals" | "show_in_leads";
    
    // Fetch fields filtered by sector context
    let query = supabase
      .from("custom_fields")
      .select("*")
      .eq("account_id", currentUser.account_id)
      .eq("is_active", true)
      .order("display_order");
    
    // Apply sector-specific filter
    if (visibilityColumn === "show_in_clients") {
      query = query.eq("show_in_clients", true);
    } else if (visibilityColumn === "show_in_deals") {
      query = query.eq("show_in_deals", true);
    } else {
      query = query.eq("show_in_leads", true);
    }
    
    const { data, error } = await query;

    if (!error && data) {
      const mappedFields: CustomField[] = data.map(f => ({
        id: f.id,
        name: f.name,
        field_type: f.field_type as CustomField["field_type"],
        options: (f.options as unknown as FieldOption[]) || [],
        is_required: f.is_required,
        display_order: f.display_order,
        is_active: f.is_active,
        show_in_clients: f.show_in_clients,
        show_in_deals: f.show_in_deals,
        show_in_leads: f.show_in_leads,
        folder_id: f.folder_id,
      }));
      setFields(mappedFields);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (currentUser?.account_id) {
      fetchFields();
    }
  }, [currentUser?.account_id]);

  // Reusable function to fetch deal stages
  const fetchDealStages = async (): Promise<{id: string, name: string}[]> => {
    if (!currentUser?.account_id) return [];
    try {
      const { data, error } = await supabase
        .from("deal_stages")
        .select("id, name")
        .eq("account_id", currentUser.account_id)
        .eq("is_active", true)
        .order("display_order");
      
      if (error) {
        console.error("[CustomFieldsManager] Error fetching deal stages:", error);
        return dealStages; // keep existing
      }
      
      if (data) {
        setDealStages(data);
        return data;
      }
      return [];
    } catch (err) {
      console.error("[CustomFieldsManager] Exception fetching deal stages:", err);
      return dealStages;
    }
  };

  // Fetch deal stages on mount
  useEffect(() => {
    if (currentUser?.account_id) {
      fetchDealStages();
    }
  }, [sectorContext, currentUser?.account_id]);

  // Refetch fields AND stages when dialog opens
  useEffect(() => {
    if (managerOpen && currentUser?.account_id) {
      fetchFields();
      fetchDealStages();
    }
  }, [managerOpen]);
  
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !currentUser?.account_id) return;
    
    try {
      const { data, error } = await supabase
        .from("custom_field_folders")
        .insert({
          account_id: currentUser.account_id,
          name: newFolderName.trim(),
          display_order: folders.length,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setFolders(prev => [...prev, {
        id: data.id,
        name: data.name,
        display_order: data.display_order,
        is_expanded: true,
      }]);
      
      setNewFolderName("");
      setShowNewFolderInput(false);
      toast.success("Pasta criada!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar pasta");
    }
  };
  
  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta pasta? Os campos serão movidos para fora da pasta.")) {
      return;
    }
    
    try {
      // Move fields out of folder
      await supabase
        .from("custom_fields")
        .update({ folder_id: null })
        .eq("folder_id", folderId);
      
      // Delete folder
      const { error } = await supabase
        .from("custom_field_folders")
        .delete()
        .eq("id", folderId);
      
      if (error) throw error;
      
      setFolders(prev => prev.filter(f => f.id !== folderId));
      setFields(prev => prev.map(f => f.folder_id === folderId ? { ...f, folder_id: null } : f));
      toast.success("Pasta excluída!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir pasta");
    }
  };
  
  const handleRenameFolder = async (folderId: string, newName: string) => {
    if (!newName.trim()) return;
    
    try {
      const { error } = await supabase
        .from("custom_field_folders")
        .update({ name: newName.trim() })
        .eq("id", folderId);
      
      if (error) throw error;
      
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: newName.trim() } : f));
    } catch (error: any) {
      toast.error(error.message || "Erro ao renomear pasta");
    }
  };
  
  const toggleFolderExpanded = (folderId: string) => {
    setFolders(prev => prev.map(f => 
      f.id === folderId ? { ...f, is_expanded: !f.is_expanded } : f
    ));
  };

  const resetForm = () => {
    setName("");
    setFieldType("select");
    setOptions([
      { value: "opt_1", label: "", color: "green" },
      { value: "opt_2", label: "", color: "red" },
    ]);
    setIsRequired(false);
    setShowInClients(true);
    setRequiredStages(["all"]);
    setEditingField(null);
  };

  const openEditDialog = async (field: CustomField & { show_in_clients?: boolean }) => {
    setEditingField(field);
    setName(field.name);
    setFieldType(field.field_type);
    setOptions(field.options?.length ? field.options : [
      { value: "opt_1", label: "", color: "green" },
      { value: "opt_2", label: "", color: "red" },
    ]);
    setIsRequired(field.is_required);
    setShowInClients(field.show_in_clients !== false);
    
    // Fetch required_stages for this field
    if (field.show_in_deals && field.id) {
      // Ensure deal stages are loaded before processing required_stages
      let currentStages = dealStages;
      if (currentStages.length === 0) {
        currentStages = await fetchDealStages();
      }

      const { data } = await supabase
        .from("custom_fields")
        .select("required_stages")
        .eq("id", field.id)
        .single();
      
      if (data?.required_stages && Array.isArray(data.required_stages)) {
        const stages = data.required_stages as string[];
        // Legacy: convert "all" to all individual stage IDs
        if (stages.includes("all")) {
          const outcomes = stages.filter(s => s === "won" || s === "lost");
          const allStageIds = currentStages.map(s => s.id);
          setRequiredStages([...allStageIds, ...outcomes]);
        } else {
          setRequiredStages(stages);
        }
      } else {
        setRequiredStages([]);
      }
    } else {
      setRequiredStages([]);
    }
    
    setDialogOpen(true);
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

      // Update display_order in database
      try {
        const updates = newFields.map((field, index) => ({
          id: field.id,
          display_order: index,
        }));

        for (const update of updates) {
          await supabase
            .from("custom_fields")
            .update({ display_order: update.display_order })
            .eq("id", update.id);
        }

        onFieldsChange?.();
      } catch (error: any) {
        toast.error("Erro ao reordenar campos");
        fetchFields(); // Revert on error
      }
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome do campo é obrigatório");
      return;
    }

    const needsOpts = fieldType === "select" || fieldType === "multi_select";
    const validOptions = options.filter(opt => opt.label.trim());

    if (needsOpts && validOptions.length === 0) {
      toast.error("Adicione pelo menos uma opção");
      return;
    }

    try {
      if (!currentUser?.account_id) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      // Set visibility flags based on sector context
      const fieldData: any = {
        account_id: currentUser.account_id,
        name: name.trim(),
        field_type: fieldType,
        options: needsOpts ? validOptions.map(opt => ({
          ...opt,
          label: opt.label.trim(),
          value: opt.value || `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        })) : [],
        is_required: isRequired,
        // For editing: preserve existing sector flags; For new fields: only enable current sector
        show_in_clients: editingField?.show_in_clients ?? (sectorContext === "clients"),
        show_in_deals: editingField?.show_in_deals ?? (sectorContext === "deals"),
        show_in_leads: editingField?.show_in_leads ?? (sectorContext === "leads"),
        display_order: editingField?.display_order ?? fields.length,
        // Add required_stages for deals context
        required_stages: isRequired && (editingField?.show_in_deals ?? sectorContext === "deals") ? requiredStages : null,
      };

      if (editingField) {
        const { error } = await supabase
          .from("custom_fields")
          .update(fieldData)
          .eq("id", editingField.id);

        if (error) throw error;
        toast.success("Campo atualizado!");
      } else {
        const { error } = await supabase
          .from("custom_fields")
          .insert(fieldData);

        if (error) throw error;
        toast.success("Campo criado!");
      }

      setDialogOpen(false);
      resetForm();
      await fetchFields();
      onFieldsChange?.();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar campo");
    }
  };

  const handleDelete = async (fieldId: string) => {
    if (!confirm("Tem certeza que deseja excluir este campo? Os valores dos clientes serão perdidos.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("custom_fields")
        .update({ is_active: false })
        .eq("id", fieldId);

      if (error) throw error;
      toast.success("Campo excluído!");
      fetchFields();
      onFieldsChange?.();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir campo");
    }
  };

  const needsOptions = fieldType === "select" || fieldType === "multi_select";

  // Componente de diálogo para criação/edição de campo
  const fieldDialog = (
    <Dialog open={dialogOpen} onOpenChange={(open) => {
      setDialogOpen(open);
      if (!open) {
        resetForm();
      } else if (!editingField) {
        // Ao abrir para CRIAR (não editar), reseta o formulário
        resetForm();
      }
    }}>
      <DialogTrigger asChild>
        <Button size="sm" className={isControlled ? "ml-auto" : ""}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Campo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingField ? "Editar campo" : "Adicionar campo"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Title and Type in same row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">
                Título do campo <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Prioridade, etapa, status..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Tipo de campo</Label>
              <Select value={fieldType} onValueChange={(v) => setFieldType(v as CustomField["field_type"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(({ value, label, icon: Icon }) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {needsOptions && (
            <div className="space-y-3">
              <Label className="text-sm">
                Opções <span className="text-destructive">*</span>
              </Label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={option.color}
                      onValueChange={(color) => updateOption(index, { color })}
                    >
                      <SelectTrigger className="w-10 h-9 p-0 justify-center border-0 bg-transparent hover:bg-muted">
                        <div className={`w-5 h-5 rounded-full ${COLOR_OPTIONS.find(c => c.value === option.color)?.class || "bg-gray-500"}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_OPTIONS.map((color) => (
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full ${color.class}`} />
                              {color.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Digite o título da opção"
                      value={option.label}
                      onChange={(e) => updateOption(index, { label: e.target.value })}
                      className="flex-1 border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                    />
                    {options.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => removeOption(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addOption}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Adicionar uma opção
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div>
              <Label className="text-sm">Obrigatório</Label>
              <p className="text-xs text-muted-foreground">Campo deve ser preenchido</p>
            </div>
            <Switch checked={isRequired} onCheckedChange={(checked) => {
              setIsRequired(checked);
              if (!checked) {
                setRequiredStages([]);
              }
            }} />
          </div>

          {/* Stage selector for required fields - only for deals context */}
          {isRequired && (editingField?.show_in_deals ?? sectorContext === "deals") && dealStages.length > 0 && (
            <div className="space-y-2 pl-3 border-l-2 border-primary/20 ml-1">
              <Label className="text-sm text-muted-foreground">Obrigatório em quais etapas?</Label>
              <div className="space-y-2">
                {/* "All stages" toggle - selects/deselects all individual stages */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="stage-all"
                    checked={dealStages.length > 0 && dealStages.every(s => requiredStages.includes(s.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        // Select all individual stage IDs, keep won/lost
                        setRequiredStages(prev => {
                          const outcomes = prev.filter(s => s === "won" || s === "lost");
                          const allStageIds = dealStages.map(s => s.id);
                          return [...allStageIds, ...outcomes];
                        });
                      } else {
                        // Remove all stage IDs, keep won/lost
                        setRequiredStages(prev => prev.filter(s => s === "won" || s === "lost"));
                      }
                    }}
                    className="h-4 w-4 rounded border-input bg-background"
                  />
                  <label htmlFor="stage-all" className="text-sm font-medium cursor-pointer">
                    Todas as etapas
                  </label>
                </div>
                
                {/* Individual stages - always visible */}
                {dealStages.map(stage => (
                  <div key={stage.id} className="flex items-center gap-2 pl-4">
                    <input
                      type="checkbox"
                      id={`stage-${stage.id}`}
                      checked={requiredStages.includes(stage.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRequiredStages(prev => [...prev, stage.id]);
                        } else {
                          setRequiredStages(prev => prev.filter(id => id !== stage.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-input bg-background"
                    />
                    <label htmlFor={`stage-${stage.id}`} className="text-sm cursor-pointer">
                      {stage.name}
                    </label>
                  </div>
                ))}

                {/* Separator */}
                <div className="border-t my-2" />

                {/* Won option */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="stage-won"
                    checked={requiredStages.includes("won")}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setRequiredStages(prev => [...prev, "won"]);
                      } else {
                        setRequiredStages(prev => prev.filter(id => id !== "won"));
                      }
                    }}
                    className="h-4 w-4 rounded border-input bg-background"
                  />
                  <label htmlFor="stage-won" className="text-sm cursor-pointer flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-emerald-500" />
                    Ao dar Ganho
                  </label>
                </div>

                {/* Lost option */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="stage-lost"
                    checked={requiredStages.includes("lost")}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setRequiredStages(prev => [...prev, "lost"]);
                      } else {
                        setRequiredStages(prev => prev.filter(id => id !== "lost"));
                      }
                    }}
                    className="h-4 w-4 rounded border-input bg-background"
                  />
                  <label htmlFor="stage-lost" className="text-sm cursor-pointer flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                    Ao dar Perdido
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div>
              <Label className="text-sm">Exibir em clientes</Label>
              <p className="text-xs text-muted-foreground">Campo aparece na ficha do cliente</p>
            </div>
            <Switch checked={showInClients} onCheckedChange={setShowInClients} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            {editingField ? "Salvar" : "Criar Campo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Filter fields based on search query
  const filteredFields = searchQuery.trim()
    ? fields.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.options.some(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : fields;

  // Campos sem pasta (using filtered fields)
  const fieldsWithoutFolder = filteredFields.filter(f => !f.folder_id);
  
  // Função para renderizar campos de uma pasta
  const renderFolderFields = (folderId: string) => {
    const folderFields = filteredFields.filter(f => f.folder_id === folderId);
    if (folderFields.length === 0) {
      return (
        <div className="text-center py-3 text-muted-foreground text-sm">
          Arraste campos para esta pasta
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {folderFields.map((field) => (
          <SortableFieldItem
            key={field.id}
            field={field}
            onEdit={openEditDialog}
            onDelete={handleDelete}
          />
        ))}
      </div>
    );
  };

  // Lista de campos com scroll independente
  const fieldsList = loading ? (
    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
  ) : fields.length === 0 && folders.length === 0 ? (
    <div className="text-center py-8 border-2 border-dashed rounded-lg">
      <Settings2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
      <p className="text-muted-foreground">Nenhum campo criado</p>
      <p className="text-sm text-muted-foreground">
        Crie campos personalizados para acompanhar seus clientes
      </p>
    </div>
  ) : (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Pastas */}
        {folders.map((folder) => (
          <FolderSection
            key={folder.id}
            folder={folder}
            onToggleExpand={() => toggleFolderExpanded(folder.id)}
            onRename={(name) => handleRenameFolder(folder.id, name)}
            onDelete={() => handleDeleteFolder(folder.id)}
          >
            <SortableContext items={filteredFields.filter(f => f.folder_id === folder.id).map(f => f.id)} strategy={verticalListSortingStrategy}>
              {renderFolderFields(folder.id)}
            </SortableContext>
          </FolderSection>
        ))}
        
        {/* Campos sem pasta */}
        {fieldsWithoutFolder.length > 0 && (
          <div className="space-y-2">
            {folders.length > 0 && (
              <h4 className="text-sm font-medium text-muted-foreground">Sem pasta</h4>
            )}
            <SortableContext items={fieldsWithoutFolder.map(f => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {fieldsWithoutFolder.map((field) => (
                  <SortableFieldItem
                    key={field.id}
                    field={field}
                    onEdit={openEditDialog}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </div>
        )}
      </div>
    </DndContext>
  );

  const content = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        {!isControlled && (
          <div>
            <h3 className="text-lg font-medium">Campos Personalizados</h3>
            <p className="text-sm text-muted-foreground">
              Crie campos para acompanhar o processo dos clientes
            </p>
          </div>
        )}
        {fieldDialog}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar campos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9"
        />
      </div>
      {fieldsList}
    </div>
  );

  // If externally controlled, wrap in a Dialog with fixed header and scrollable content
  if (isControlled) {
    return (
      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
          <div className="flex flex-col h-full max-h-[90vh]">
            {/* Header fixo */}
            <div className="flex-shrink-0 p-6 pb-0">
              <DialogHeader>
                <DialogTitle>Configurar {SECTOR_TITLE_MAP[sectorContext]}</DialogTitle>
              </DialogHeader>
            </div>
            
            {/* Barra de pesquisa */}
            <div className="flex-shrink-0 px-6 pt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar campos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {/* Botões Nova Pasta e Novo Campo - fixos */}
            <div className="flex-shrink-0 px-6 pt-4 pb-4 border-b">
              <div className="flex items-center gap-2 justify-end">
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
                    <Button size="sm" variant="ghost" onClick={handleCreateFolder}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setShowNewFolderInput(false);
                      setNewFolderName("");
                    }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewFolderInput(true)}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Nova Pasta
                  </Button>
                )}
                {fieldDialog}
              </div>
            </div>
            
            {/* Área de scroll - SOMENTE esta parte rola */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
              {fieldsList}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return content;
}

// Componente de seção de pasta
function FolderSection({
  folder,
  onToggleExpand,
  onRename,
  onDelete,
  children,
}: {
  folder: FolderConfig;
  onToggleExpand: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  
  const handleSaveRename = () => {
    if (editName.trim() && editName.trim() !== folder.name) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };
  
  return (
    <div className="border rounded-lg">
      <div className="flex items-center gap-2 p-3 bg-muted/50">
        <button onClick={onToggleExpand} className="text-muted-foreground hover:text-foreground">
          {folder.is_expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <Folder className="h-4 w-4 text-muted-foreground" />
        
        {isEditing ? (
          <div className="flex-1 flex items-center gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename();
                if (e.key === "Escape") {
                  setIsEditing(false);
                  setEditName(folder.name);
                }
              }}
              onBlur={handleSaveRename}
            />
          </div>
        ) : (
          <span 
            className="flex-1 font-medium text-sm cursor-pointer hover:underline"
            onClick={() => {
              setEditName(folder.name);
              setIsEditing(true);
            }}
          >
            {folder.name}
          </span>
        )}
        
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      
      {folder.is_expanded && (
        <div className="p-3 pt-2">
          {children}
        </div>
      )}
    </div>
  );
}
