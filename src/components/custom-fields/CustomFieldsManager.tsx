import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, GripVertical, Settings2, Pencil, X, CheckCircle2, ListChecks, Calendar, Hash, Type, ToggleLeft } from "lucide-react";
import { toast } from "sonner";

export interface CustomField {
  id: string;
  name: string;
  field_type: "select" | "boolean" | "multi_select" | "number" | "currency" | "text" | "date";
  options: FieldOption[];
  is_required: boolean;
  display_order: number;
  is_active: boolean;
}

export interface FieldOption {
  value: string;
  label: string;
  color: string;
}

const FIELD_TYPES = [
  { value: "select", label: "Seleção única", icon: CheckCircle2 },
  { value: "multi_select", label: "Seleção múltipla", icon: ListChecks },
  { value: "date", label: "Data", icon: Calendar },
  { value: "text", label: "Texto", icon: Type },
  { value: "number", label: "Número", icon: Hash },
  { value: "boolean", label: "Sim/Não", icon: ToggleLeft },
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

interface CustomFieldsManagerProps {
  onFieldsChange?: () => void;
}

export function CustomFieldsManager({ onFieldsChange }: CustomFieldsManagerProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchFields = async () => {
    const { data, error } = await supabase
      .from("custom_fields")
      .select("*")
      .eq("is_active", true)
      .order("display_order");

    if (!error && data) {
      const mappedFields: CustomField[] = data.map(f => ({
        id: f.id,
        name: f.name,
        field_type: f.field_type as CustomField["field_type"],
        options: (f.options as unknown as FieldOption[]) || [],
        is_required: f.is_required,
        display_order: f.display_order,
        is_active: f.is_active,
      }));
      setFields(mappedFields);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFields();
  }, []);

  const resetForm = () => {
    setName("");
    setFieldType("select");
    setOptions([
      { value: "opt_1", label: "", color: "green" },
      { value: "opt_2", label: "", color: "red" },
    ]);
    setIsRequired(false);
    setEditingField(null);
  };

  const openEditDialog = (field: CustomField) => {
    setEditingField(field);
    setName(field.name);
    setFieldType(field.field_type);
    setOptions(field.options?.length ? field.options : [
      { value: "opt_1", label: "", color: "green" },
      { value: "opt_2", label: "", color: "red" },
    ]);
    setIsRequired(field.is_required);
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

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome do campo é obrigatório");
      return;
    }

    const needsOptions = fieldType === "select" || fieldType === "multi_select";
    const validOptions = options.filter(opt => opt.label.trim());

    if (needsOptions && validOptions.length === 0) {
      toast.error("Adicione pelo menos uma opção");
      return;
    }

    try {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (!userData) {
        toast.error("Usuário não encontrado");
        return;
      }

      const fieldData = {
        account_id: userData.account_id,
        name: name.trim(),
        field_type: fieldType,
        options: needsOptions ? validOptions.map(opt => ({
          ...opt,
          label: opt.label.trim(),
          value: opt.value || `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        })) : [],
        is_required: isRequired,
        display_order: editingField?.display_order ?? fields.length,
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
      fetchFields();
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
  const currentFieldType = FIELD_TYPES.find(t => t.value === fieldType);
  const FieldIcon = currentFieldType?.icon || CheckCircle2;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Campos Personalizados</h3>
          <p className="text-sm text-muted-foreground">
            Crie campos para acompanhar o processo dos clientes
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Campo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
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
                      <div className="flex items-center gap-2">
                        <FieldIcon className="h-4 w-4 text-muted-foreground" />
                        <SelectValue />
                      </div>
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
                <Switch checked={isRequired} onCheckedChange={setIsRequired} />
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
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : fields.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <Settings2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Nenhum campo criado</p>
          <p className="text-sm text-muted-foreground">
            Crie campos personalizados para acompanhar seus clientes
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field) => {
            const fieldTypeInfo = FIELD_TYPES.find(t => t.value === field.field_type);
            const TypeIcon = fieldTypeInfo?.icon || CheckCircle2;
            return (
              <div
                key={field.id}
                className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
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
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(field)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(field.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
