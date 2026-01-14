import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Check, X, User, Instagram, MapPin, Pencil } from "lucide-react";
import { LocationAutocomplete, LocationValue } from "./LocationAutocomplete";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CustomField } from "./CustomFieldsManager";
import { FieldValueBadge } from "./FieldValueBadge";

interface DealFieldValueEditorProps {
  field: CustomField;
  dealId: string;
  accountId: string;
  currentValue: any;
  onValueChange: (fieldId: string, newValue: any) => void;
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
}

const getColorClasses = (color: string, selected: boolean) => {
  const baseClasses: Record<string, { bg: string; hover: string; selected: string }> = {
    green: { bg: "bg-emerald-500/10", hover: "hover:bg-emerald-500/20", selected: "bg-emerald-500 text-white" },
    red: { bg: "bg-red-500/10", hover: "hover:bg-red-500/20", selected: "bg-red-500 text-white" },
    yellow: { bg: "bg-amber-500/10", hover: "hover:bg-amber-500/20", selected: "bg-amber-500 text-white" },
    blue: { bg: "bg-blue-500/10", hover: "hover:bg-blue-500/20", selected: "bg-blue-500 text-white" },
    purple: { bg: "bg-purple-500/10", hover: "hover:bg-purple-500/20", selected: "bg-purple-500 text-white" },
    pink: { bg: "bg-pink-500/10", hover: "hover:bg-pink-500/20", selected: "bg-pink-500 text-white" },
    orange: { bg: "bg-orange-500/10", hover: "hover:bg-orange-500/20", selected: "bg-orange-500 text-white" },
    gray: { bg: "bg-gray-500/10", hover: "hover:bg-gray-500/20", selected: "bg-gray-500 text-white" },
  };
  const colors = baseClasses[color] || baseClasses.gray;
  return selected ? colors.selected : `${colors.bg} ${colors.hover}`;
};

export function DealFieldValueEditor({ field, dealId, accountId, currentValue, onValueChange }: DealFieldValueEditorProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localValue, setLocalValue] = useState<any>(currentValue);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  
  // States for multi-instagram field (moved to top level to follow hooks rules)
  const [newInstagramHandle, setNewInstagramHandle] = useState("");
  const [editingInstagramIndex, setEditingInstagramIndex] = useState<number | null>(null);
  const [editInstagramValue, setEditInstagramValue] = useState("");

  // Fetch team users when opening user field
  useEffect(() => {
    if (field.field_type === "user" && open) {
      fetchTeamUsers();
    }
  }, [field.field_type, open]);

  const fetchTeamUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email")
      .order("name");
    
    if (!error && data) {
      setTeamUsers(data);
    }
  };

  const saveValue = async (newValue: any) => {
    // Validate accountId before saving
    if (!accountId || accountId.length < 36) {
      console.error("[DealFieldValueEditor] Invalid accountId:", accountId);
      toast.error("Erro: Usuário não carregado. Aguarde e tente novamente.");
      return;
    }

    setSaving(true);
    try {
      // Determine which value column to use
      let valueData: any = {
        account_id: accountId,
        deal_id: dealId,
        field_id: field.id,
        value_text: null,
        value_number: null,
        value_boolean: null,
        value_date: null,
        value_json: null,
      };

      switch (field.field_type) {
        case "boolean":
          valueData.value_boolean = newValue;
          break;
        case "number":
        case "currency":
          valueData.value_number = newValue;
          break;
        case "date":
          valueData.value_date = newValue;
          break;
        case "select":
        case "text":
        case "instagram":
          valueData.value_text = newValue;
          break;
        case "multi_select":
        case "user":
        case "location":
        case "multi_instagram":
          valueData.value_json = newValue;
          break;
      }

      const { error } = await supabase
        .from("deal_field_values")
        .upsert(valueData, { onConflict: "deal_id,field_id" });

      if (error) throw error;

      onValueChange(field.id, newValue);
      setOpen(false);
    } catch (error: any) {
      console.error("Error saving field value:", error);
      toast.error("Erro ao salvar valor");
    } finally {
      setSaving(false);
    }
  };

  // Boolean field - simple toggle
  if (field.field_type === "boolean") {
    return (
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <button className="cursor-pointer hover:opacity-80 transition-opacity">
            <FieldValueBadge field={field} value={currentValue} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex flex-col gap-1">
            <button
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                currentValue === true ? "bg-emerald-500 text-white" : "hover:bg-muted"
              }`}
              onClick={() => saveValue(true)}
              disabled={saving}
            >
              <Check className="h-4 w-4" />
              Sim
            </button>
            <button
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                currentValue === false ? "bg-red-500 text-white" : "hover:bg-muted"
              }`}
              onClick={() => saveValue(false)}
              disabled={saving}
            >
              <X className="h-4 w-4" />
              Não
            </button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Select field
  if (field.field_type === "select") {
    return (
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <button className="cursor-pointer hover:opacity-80 transition-opacity">
            <FieldValueBadge field={field} value={currentValue} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()}>
            {field.options.map((option) => (
              <button
                key={option.value}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${getColorClasses(option.color, currentValue === option.value)}`}
                onClick={() => saveValue(option.value)}
                disabled={saving}
              >
                {option.label}
              </button>
            ))}
            <button
              className="flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-muted text-muted-foreground"
              onClick={() => saveValue(null)}
              disabled={saving}
            >
              Limpar
            </button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Multi-select field
  if (field.field_type === "multi_select") {
    const selectedValues = Array.isArray(currentValue) ? currentValue : [];
    
    const toggleOption = (optionValue: string) => {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter(v => v !== optionValue)
        : [...selectedValues, optionValue];
      saveValue(newValues);
    };

    return (
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <button className="cursor-pointer hover:opacity-80 transition-opacity">
            <FieldValueBadge field={field} value={currentValue} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()}>
            {field.options.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <button
                  key={option.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${getColorClasses(option.color, isSelected)}`}
                  onClick={() => toggleOption(option.value)}
                  disabled={saving}
                >
                  <Checkbox checked={isSelected} className="pointer-events-none" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // User field - select team members
  if (field.field_type === "user") {
    const selectedUserIds = Array.isArray(currentValue) ? currentValue : [];
    
    const toggleUser = (userId: string) => {
      const newValues = selectedUserIds.includes(userId)
        ? selectedUserIds.filter(id => id !== userId)
        : [...selectedUserIds, userId];
      saveValue(newValues);
    };

    return (
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <button className="cursor-pointer hover:opacity-80 transition-opacity">
            <FieldValueBadge field={field} value={currentValue} teamUsers={teamUsers.length ? teamUsers : undefined} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()}>
            {teamUsers.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                Carregando...
              </div>
            ) : (
              teamUsers.map((user) => {
                const isSelected = selectedUserIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                      isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                    onClick={() => toggleUser(user.id)}
                    disabled={saving}
                  >
                    <Checkbox checked={isSelected} className="pointer-events-none" />
                    <User className="h-4 w-4" />
                    <span className="truncate">{user.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Number / Currency field
  if (field.field_type === "number" || field.field_type === "currency") {
    return (
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <button className="cursor-pointer hover:opacity-80 transition-opacity text-left">
            <FieldValueBadge field={field} value={currentValue} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-3" align="start">
          <div className="space-y-2">
            <Input
              type="number"
              value={localValue ?? ""}
              onChange={(e) => setLocalValue(e.target.value ? parseFloat(e.target.value) : null)}
              placeholder={field.field_type === "currency" ? "R$ 0,00" : "0"}
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => saveValue(localValue)} disabled={saving}>
                Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Date field
  if (field.field_type === "date") {
    return (
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <button className="cursor-pointer hover:opacity-80 transition-opacity text-left">
            <FieldValueBadge field={field} value={currentValue} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={currentValue ? new Date(currentValue) : undefined}
            onSelect={(date) => saveValue(date ? format(date, "yyyy-MM-dd") : null)}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Text field
  if (field.field_type === "text") {
    return (
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <button className="cursor-pointer hover:opacity-80 transition-opacity text-left max-w-32">
            <FieldValueBadge field={field} value={currentValue} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-2">
            <Input
              value={localValue ?? ""}
              onChange={(e) => setLocalValue(e.target.value || null)}
              placeholder="Digite..."
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => saveValue(localValue)} disabled={saving}>
                Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Instagram field
  if (field.field_type === "instagram") {
    return (
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <button className="cursor-pointer hover:opacity-80 transition-opacity text-left">
            <FieldValueBadge field={field} value={currentValue} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Instagram className="h-4 w-4 text-pink-500" />
              <Input
                value={localValue ?? ""}
                onChange={(e) => setLocalValue(e.target.value || null)}
                placeholder="@usuario"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => saveValue(localValue)} disabled={saving}>
                Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Multi-Instagram field
  if (field.field_type === "multi_instagram") {
    const instagrams = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);

    const addInstagram = () => {
      if (!newInstagramHandle.trim()) return;
      const handle = newInstagramHandle.replace(/^@/, '').trim();
      if (handle && !instagrams.includes(handle)) {
        saveValue([...instagrams, handle]);
        setNewInstagramHandle("");
      }
    };

    const removeInstagram = (index: number) => {
      const newValues = instagrams.filter((_, i) => i !== index);
      saveValue(newValues);
    };

    const updateInstagram = (index: number) => {
      if (!editInstagramValue.trim()) return;
      const handle = editInstagramValue.replace(/^@/, '').trim();
      if (handle) {
        const newValues = [...instagrams];
        newValues[index] = handle;
        saveValue(newValues);
      }
      setEditingInstagramIndex(null);
      setEditInstagramValue("");
    };

    const startEditing = (index: number, currentHandle: string) => {
      setEditingInstagramIndex(index);
      setEditInstagramValue(currentHandle);
    };

    const cancelEditing = () => {
      setEditingInstagramIndex(null);
      setEditInstagramValue("");
    };

    return (
      <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          cancelEditing();
        }
      }} modal={true}>
        <PopoverTrigger asChild>
          <button className="cursor-pointer hover:opacity-80 transition-opacity text-left">
            <FieldValueBadge 
              field={field} 
              value={currentValue} 
              onRemoveInstagram={(index) => {
                const newValues = instagrams.filter((_, i) => i !== index);
                saveValue(newValues);
              }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <div className="space-y-3">
            {/* Existing instagrams */}
            {instagrams.length > 0 && (
              <div className="flex flex-col gap-2">
                {instagrams.map((ig, index) => (
                  editingInstagramIndex === index ? (
                    // Editing mode
                    <div key={index} className="flex items-center gap-1">
                      <Instagram className="h-4 w-4 text-pink-500 flex-shrink-0" />
                      <Input
                        value={editInstagramValue}
                        onChange={(e) => setEditInstagramValue(e.target.value)}
                        className="h-8 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            updateInstagram(index);
                          }
                          if (e.key === "Escape") {
                            cancelEditing();
                          }
                        }}
                      />
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-8 p-0"
                        onClick={() => updateInstagram(index)}
                        disabled={saving}
                      >
                        <Check className="h-4 w-4 text-emerald-500" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-8 p-0"
                        onClick={cancelEditing}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    // View mode
                    <div
                      key={index}
                      className="flex items-center justify-between px-2 py-1.5 rounded bg-pink-500/10 border border-pink-500/20"
                    >
                      <a
                        href={`https://instagram.com/${ig}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-pink-600 dark:text-pink-400 hover:underline text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Instagram className="h-3.5 w-3.5" />
                        @{ig}
                      </a>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(index, ig);
                          }}
                          className="p-1 hover:bg-pink-500/20 rounded transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-pink-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeInstagram(index);
                          }}
                          className="p-1 hover:bg-red-500/20 rounded transition-colors"
                          title="Remover"
                        >
                          <X className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
            
            {/* Add new instagram */}
            <div className="flex items-center gap-2">
              <Instagram className="h-4 w-4 text-pink-500 flex-shrink-0" />
              <Input
                value={newInstagramHandle}
                onChange={(e) => setNewInstagramHandle(e.target.value)}
                placeholder="@usuario"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addInstagram();
                  }
                }}
              />
              <Button size="sm" onClick={addInstagram} disabled={saving || !newInstagramHandle.trim()}>
                Adicionar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Location field
  if (field.field_type === "location") {
    return (
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <button className="cursor-pointer hover:opacity-80 transition-opacity text-left">
            <FieldValueBadge field={field} value={currentValue} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <LocationAutocomplete
            value={currentValue as LocationValue}
            onChange={(value) => saveValue(value)}
            disabled={saving}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return <FieldValueBadge field={field} value={currentValue} />;
}
