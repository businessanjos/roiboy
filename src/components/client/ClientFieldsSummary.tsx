import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldValueEditor } from "@/components/custom-fields/FieldValueEditor";
import { CustomFieldsManager, CustomField } from "@/components/custom-fields/CustomFieldsManager";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
  Layers, 
  Loader2, 
  ToggleLeft, 
  Hash, 
  DollarSign, 
  Calendar, 
  List, 
  ListChecks, 
  Users, 
  Type,
  CheckCircle2,
  Circle,
  Plus,
  X,
  GripVertical,
  Instagram,
  MapPin,
  Settings2,
} from "lucide-react";

interface ClientFieldValue {
  field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_json: any;
}

interface ClientFieldsSummaryProps {
  clientId: string;
  expanded?: boolean;
}

interface FieldOption {
  id: string;
  label: string;
  color: string;
}

const FIELD_TYPES = [
  { value: "text", label: "Texto", icon: Type },
  { value: "number", label: "Número", icon: Hash },
  { value: "currency", label: "Moeda", icon: DollarSign },
  { value: "date", label: "Data", icon: Calendar },
  { value: "boolean", label: "Sim/Não", icon: ToggleLeft },
  { value: "select", label: "Seleção única", icon: List },
  { value: "multi_select", label: "Seleção múltipla", icon: ListChecks },
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "multi_instagram", label: "Múltiplos Instagrams", icon: Instagram },
  { value: "location", label: "Localização", icon: MapPin },
  { value: "user", label: "Responsável", icon: Users },
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

const FIELD_TYPE_CONFIG: Record<string, { 
  icon: typeof Type; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  boolean: { 
    icon: ToggleLeft, 
    label: "Sim/Não", 
    color: "text-purple-500",
    bgColor: "bg-purple-500/10"
  },
  number: { 
    icon: Hash, 
    label: "Número", 
    color: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  currency: { 
    icon: DollarSign, 
    label: "Moeda", 
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10"
  },
  date: { 
    icon: Calendar, 
    label: "Data", 
    color: "text-orange-500",
    bgColor: "bg-orange-500/10"
  },
  select: { 
    icon: List, 
    label: "Seleção", 
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10"
  },
  multi_select: { 
    icon: ListChecks, 
    label: "Multi-seleção", 
    color: "text-pink-500",
    bgColor: "bg-pink-500/10"
  },
  user: { 
    icon: Users, 
    label: "Responsável", 
    color: "text-amber-500",
    bgColor: "bg-amber-500/10"
  },
  text: { 
    icon: Type, 
    label: "Texto", 
    color: "text-muted-foreground",
    bgColor: "bg-muted"
  },
  instagram: { 
    icon: Instagram, 
    label: "Instagram", 
    color: "text-pink-500",
    bgColor: "bg-pink-500/10"
  },
  multi_instagram: { 
    icon: Instagram, 
    label: "Múltiplos Instagrams", 
    color: "text-pink-500",
    bgColor: "bg-pink-500/10"
  },
  location: { 
    icon: MapPin, 
    label: "Localização", 
    color: "text-red-500",
    bgColor: "bg-red-500/10"
  },
};

export function ClientFieldsSummary({ clientId, expanded = false }: ClientFieldsSummaryProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Dialog state for adding new field
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldOptions, setNewFieldOptions] = useState<FieldOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const fetchData = async () => {
    try {
      // Get account ID
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (userData) {
        setAccountId(userData.account_id);
      }

      // Fetch active custom fields that should appear in clients
      const { data: fieldsData, error: fieldsError } = await supabase
        .from("custom_fields")
        .select("*")
        .eq("is_active", true)
        .eq("show_in_clients", true)
        .order("display_order");

      if (fieldsError) throw fieldsError;

      const parsedFields: CustomField[] = (fieldsData || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        field_type: f.field_type,
        options: Array.isArray(f.options) ? f.options : [],
        is_required: f.is_required,
        display_order: f.display_order,
        is_active: f.is_active,
      }));
      setFields(parsedFields);

      // Fetch field values for this client
      const { data: valuesData, error: valuesError } = await supabase
        .from("client_field_values")
        .select("*")
        .eq("client_id", clientId);

      if (valuesError) throw valuesError;

      // Map values by field_id
      const valuesMap: Record<string, any> = {};
      (valuesData || []).forEach((v: ClientFieldValue) => {
        const field = parsedFields.find((f) => f.id === v.field_id);
        if (field) {
          switch (field.field_type) {
            case "boolean":
              valuesMap[v.field_id] = v.value_boolean;
              break;
            case "number":
            case "currency":
              valuesMap[v.field_id] = v.value_number;
              break;
            case "date":
              valuesMap[v.field_id] = v.value_date;
              break;
            case "multi_select":
            case "user":
            case "location":
              valuesMap[v.field_id] = v.value_json;
              break;
            case "select":
            case "text":
            default:
              valuesMap[v.field_id] = v.value_text;
              break;
          }
        }
      });
      setFieldValues(valuesMap);
    } catch (error) {
      console.error("Error fetching custom fields:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (fieldId: string, newValue: any) => {
    setFieldValues((prev) => ({
      ...prev,
      [fieldId]: newValue,
    }));
  };

  const getFieldTypeConfig = (type: string) => {
    return FIELD_TYPE_CONFIG[type] || FIELD_TYPE_CONFIG.text;
  };

  const hasFieldValue = (field: CustomField) => {
    const value = fieldValues[field.id];
    if (value === null || value === undefined) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (value === "") return false;
    return true;
  };

  // Add new option for select fields
  const handleAddOption = () => {
    const newOption: FieldOption = {
      id: crypto.randomUUID(),
      label: "",
      color: "gray",
    };
    setNewFieldOptions([...newFieldOptions, newOption]);
  };

  const handleRemoveOption = (optionId: string) => {
    setNewFieldOptions(newFieldOptions.filter((opt) => opt.id !== optionId));
  };

  const handleOptionChange = (optionId: string, field: "label" | "color", value: string) => {
    setNewFieldOptions(
      newFieldOptions.map((opt) =>
        opt.id === optionId ? { ...opt, [field]: value } : opt
      )
    );
  };

  // Save new field
  const handleSaveNewField = async () => {
    if (!accountId || !newFieldName.trim()) {
      toast.error("Por favor, preencha o nome do campo");
      return;
    }

    // Validate options for select types
    if ((newFieldType === "select" || newFieldType === "multi_select") && newFieldOptions.length === 0) {
      toast.error("Adicione pelo menos uma opção para campos de seleção");
      return;
    }

    const hasEmptyOption = newFieldOptions.some((opt) => !opt.label.trim());
    if (hasEmptyOption) {
      toast.error("Todas as opções devem ter um nome");
      return;
    }

    try {
      setIsSaving(true);

      // Get the max display_order for new field
      const { data: maxOrderData } = await supabase
        .from("custom_fields")
        .select("display_order")
        .eq("account_id", accountId)
        .order("display_order", { ascending: false })
        .limit(1)
        .single();

      const newOrder = (maxOrderData?.display_order || 0) + 1;

      // Prepare options with display_order
      const optionsWithOrder = newFieldOptions.map((opt, index) => ({
        ...opt,
        display_order: index,
      }));

      const { error } = await supabase.from("custom_fields").insert({
        account_id: accountId,
        name: newFieldName.trim(),
        field_type: newFieldType,
        options: optionsWithOrder.length > 0 ? optionsWithOrder : null,
        is_active: true,
        show_in_clients: true,
        show_in_leads: false,
        display_order: newOrder,
      });

      if (error) throw error;

      toast.success("Campo criado com sucesso!");
      setIsAddDialogOpen(false);
      resetDialog();
      
      // Refresh fields
      await fetchData();
    } catch (error) {
      console.error("Error creating field:", error);
      toast.error("Erro ao criar campo");
    } finally {
      setIsSaving(false);
    }
  };

  const resetDialog = () => {
    setNewFieldName("");
    setNewFieldType("text");
    setNewFieldOptions([]);
  };

  const needsOptions = newFieldType === "select" || newFieldType === "multi_select";

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Carregando campos...</span>
      </div>
    );
  }

  // Count fields with values
  const filledCount = fields.filter(hasFieldValue).length;
  const progressPercent = fields.length > 0 ? Math.round((filledCount / fields.length) * 100) : 0;

  // Expanded view - visual card format for dedicated tab
  if (expanded) {
    return (
      <div className="flex flex-col h-full">
        {/* Fixed Header with Add Button */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Campos Personalizados</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsManagerOpen(true)}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Gerenciar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Campo
            </Button>
          </div>
        </div>

        {/* Fixed Progress Header */}
        {fields.length > 0 && (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/10 mb-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Preenchimento</span>
                <span className="text-sm text-muted-foreground">
                  {filledCount} de {fields.length} campos
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
            </div>
          </div>
        )}

        {/* Scrollable Fields Grid */}
        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-350px)] pr-2 -mr-2">
          {fields.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                <Layers className="h-8 w-8 opacity-50" />
              </div>
              <p className="font-medium">Nenhum campo personalizado</p>
              <p className="text-sm mt-1 mb-4">Clique em "Novo Campo" para criar.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((field) => {
                const config = getFieldTypeConfig(field.field_type);
                const Icon = config.icon;
                const value = fieldValues[field.id];
                const hasValue = hasFieldValue(field);

                return (
                  <div
                    key={field.id}
                    className={`group relative p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${
                      hasValue
                        ? "bg-card border-border hover:border-primary/30"
                        : "bg-muted/30 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40"
                    }`}
                  >
                    {/* Status indicator */}
                    <div className="absolute top-3 right-3">
                      {hasValue ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/30" />
                      )}
                    </div>

                    {/* Field Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${config.bgColor}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <h4 className={`font-medium text-sm truncate ${!hasValue && 'text-muted-foreground'}`}>
                          {field.name}
                        </h4>
                        <p className={`text-xs ${config.color}`}>
                          {config.label}
                        </p>
                      </div>
                    </div>

                    {/* Field Value */}
                    <div className="pl-11">
                      {accountId ? (
                        <FieldValueEditor
                          field={field}
                          clientId={clientId}
                          accountId={accountId}
                          currentValue={value}
                          onValueChange={handleValueChange}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Field Dialog */}
        <AddFieldDialog
          isOpen={isAddDialogOpen}
          onClose={() => {
            setIsAddDialogOpen(false);
            resetDialog();
          }}
          newFieldName={newFieldName}
          setNewFieldName={setNewFieldName}
          newFieldType={newFieldType}
          setNewFieldType={setNewFieldType}
          newFieldOptions={newFieldOptions}
          handleAddOption={handleAddOption}
          handleRemoveOption={handleRemoveOption}
          handleOptionChange={handleOptionChange}
          handleSaveNewField={handleSaveNewField}
          isSaving={isSaving}
          needsOptions={needsOptions}
        />

        {/* Custom Fields Manager Dialog */}
        <CustomFieldsManager
          open={isManagerOpen}
          onOpenChange={setIsManagerOpen}
          onFieldsChange={fetchData}
        />
      </div>
    );
  }

  // Compact view - grid format for summary
  return (
    <Card className="shadow-card mb-4 bg-muted/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Layers className="h-4 w-4" />
            Campos Personalizados
            <Badge variant="secondary" className="text-xs">
              {filledCount}/{fields.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setIsManagerOpen(true)}
              title="Gerenciar campos"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setIsAddDialogOpen(true)}
              title="Novo campo"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {fields.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <p>Nenhum campo</p>
            <Button
              variant="link"
              size="sm"
              className="mt-1"
              onClick={() => setIsAddDialogOpen(true)}
            >
              Criar primeiro campo
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-1 -mr-1">
            {fields.map((field) => {
              const value = fieldValues[field.id];
              const hasValue = hasFieldValue(field);

              return (
                <div
                  key={field.id}
                  className={`p-2 rounded-lg border transition-colors ${
                    hasValue
                      ? "bg-card border-border hover:border-primary/30"
                      : "bg-muted/50 border-border/50 hover:border-border"
                  }`}
                >
                  <p className="text-xs text-muted-foreground mb-1 truncate" title={field.name}>
                    {field.name}
                  </p>
                  {accountId ? (
                    <FieldValueEditor
                      field={field}
                      clientId={clientId}
                      accountId={accountId}
                      currentValue={value}
                      onValueChange={handleValueChange}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Add Field Dialog */}
      <AddFieldDialog
        isOpen={isAddDialogOpen}
        onClose={() => {
          setIsAddDialogOpen(false);
          resetDialog();
        }}
        newFieldName={newFieldName}
        setNewFieldName={setNewFieldName}
        newFieldType={newFieldType}
        setNewFieldType={setNewFieldType}
        newFieldOptions={newFieldOptions}
        handleAddOption={handleAddOption}
        handleRemoveOption={handleRemoveOption}
        handleOptionChange={handleOptionChange}
        handleSaveNewField={handleSaveNewField}
        isSaving={isSaving}
        needsOptions={needsOptions}
      />

      {/* Custom Fields Manager Dialog */}
      <CustomFieldsManager
        open={isManagerOpen}
        onOpenChange={setIsManagerOpen}
        onFieldsChange={fetchData}
      />
    </Card>
  );
}

// Separate dialog component for better organization
interface AddFieldDialogProps {
  isOpen: boolean;
  onClose: () => void;
  newFieldName: string;
  setNewFieldName: (name: string) => void;
  newFieldType: string;
  setNewFieldType: (type: string) => void;
  newFieldOptions: FieldOption[];
  handleAddOption: () => void;
  handleRemoveOption: (id: string) => void;
  handleOptionChange: (id: string, field: "label" | "color", value: string) => void;
  handleSaveNewField: () => void;
  isSaving: boolean;
  needsOptions: boolean;
}

function AddFieldDialog({
  isOpen,
  onClose,
  newFieldName,
  setNewFieldName,
  newFieldType,
  setNewFieldType,
  newFieldOptions,
  handleAddOption,
  handleRemoveOption,
  handleOptionChange,
  handleSaveNewField,
  isSaving,
  needsOptions,
}: AddFieldDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Campo Personalizado</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Field Name */}
          <div className="space-y-2">
            <Label htmlFor="field-name">Nome do campo</Label>
            <Input
              id="field-name"
              placeholder="Ex: Faturamento mensal"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
            />
          </div>

          {/* Field Type */}
          <div className="space-y-2">
            <Label>Tipo do campo</Label>
            <Select value={newFieldType} onValueChange={setNewFieldType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Options for select fields */}
          {needsOptions && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Opções</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddOption}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {newFieldOptions.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder={`Opção ${index + 1}`}
                      value={option.label}
                      onChange={(e) =>
                        handleOptionChange(option.id, "label", e.target.value)
                      }
                      className="flex-1"
                    />
                    <Select
                      value={option.color}
                      onValueChange={(value) =>
                        handleOptionChange(option.id, "color", value)
                      }
                    >
                      <SelectTrigger className="w-[100px]">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "h-3 w-3 rounded-full",
                              COLOR_OPTIONS.find((c) => c.value === option.color)
                                ?.class || "bg-gray-500"
                            )}
                          />
                          <span className="text-xs">
                            {COLOR_OPTIONS.find((c) => c.value === option.color)
                              ?.label || "Cor"}
                          </span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_OPTIONS.map((color) => (
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex items-center gap-2">
                              <div
                                className={cn("h-3 w-3 rounded-full", color.class)}
                              />
                              <span>{color.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleRemoveOption(option.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {newFieldOptions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Clique em "Adicionar" para criar opções
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSaveNewField} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              "Criar Campo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
