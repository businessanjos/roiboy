import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Lock, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface RsvpFormField {
  key: string;
  label: string;
  type: "text" | "tel" | "email" | "number" | "select";
  required: boolean;
  enabled: boolean;
  options?: string[]; // for select type
}

const DEFAULT_FIELDS: RsvpFormField[] = [
  { key: "name", label: "Nome completo", type: "text", required: true, enabled: true },
  { key: "phone", label: "Telefone (WhatsApp)", type: "tel", required: true, enabled: true },
  { key: "email", label: "E-mail", type: "email", required: true, enabled: true },
  { key: "rg", label: "RG", type: "text", required: true, enabled: true },
];

const LOCKED_KEYS = ["name", "phone"]; // Always required and enabled

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  currentFields: RsvpFormField[] | null;
  onSaved: () => void;
}

export default function RsvpFieldsEditor({ open, onOpenChange, eventId, currentFields, onSaved }: Props) {
  const [fields, setFields] = useState<RsvpFormField[]>(currentFields || DEFAULT_FIELDS);
  const [saving, setSaving] = useState(false);

  const isLocked = (key: string) => LOCKED_KEYS.includes(key);
  const isDefault = (key: string) => ["name", "phone", "email", "rg"].includes(key);

  const handleToggleEnabled = (index: number) => {
    if (isLocked(fields[index].key)) return;
    setFields(prev => prev.map((f, i) => 
      i === index ? { ...f, enabled: !f.enabled, required: !f.enabled ? f.required : false } : f
    ));
  };

  const handleToggleRequired = (index: number) => {
    if (isLocked(fields[index].key)) return;
    if (!fields[index].enabled) return;
    setFields(prev => prev.map((f, i) => 
      i === index ? { ...f, required: !f.required } : f
    ));
  };

  const handleLabelChange = (index: number, label: string) => {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, label } : f));
  };

  const handleAddField = () => {
    const newKey = `custom_${Date.now()}`;
    setFields(prev => [...prev, {
      key: newKey,
      label: "",
      type: "text",
      required: false,
      enabled: true,
    }]);
  };

  const handleRemoveField = (index: number) => {
    if (isDefault(fields[index].key)) return;
    setFields(prev => prev.filter((_, i) => i !== index));
  };

  const handleTypeChange = (index: number, type: RsvpFormField["type"]) => {
    setFields(prev => prev.map((f, i) => 
      i === index ? { ...f, type, options: type === "select" ? [""] : undefined } : f
    ));
  };

  const handleOptionChange = (fieldIndex: number, optIndex: number, value: string) => {
    setFields(prev => prev.map((f, i) => {
      if (i !== fieldIndex || !f.options) return f;
      const newOpts = [...f.options];
      newOpts[optIndex] = value;
      return { ...f, options: newOpts };
    }));
  };

  const handleAddOption = (fieldIndex: number) => {
    setFields(prev => prev.map((f, i) => {
      if (i !== fieldIndex) return f;
      return { ...f, options: [...(f.options || []), ""] };
    }));
  };

  const handleRemoveOption = (fieldIndex: number, optIndex: number) => {
    setFields(prev => prev.map((f, i) => {
      if (i !== fieldIndex || !f.options) return f;
      return { ...f, options: f.options.filter((_, oi) => oi !== optIndex) };
    }));
  };

  const handleSave = async () => {
    // Validate: all enabled custom fields must have labels
    const invalid = fields.find(f => f.enabled && !f.label.trim());
    if (invalid) {
      toast.error("Todos os campos ativos devem ter um nome/label");
      return;
    }

    // Validate select fields have at least one option
    const invalidSelect = fields.find(f => f.enabled && f.type === "select" && (!f.options || f.options.filter(o => o.trim()).length < 1));
    if (invalidSelect) {
      toast.error("Campos de seleção precisam de pelo menos uma opção");
      return;
    }

    setSaving(true);
    try {
      // Clean up options (remove empty strings)
      const cleanFields = fields.map(f => ({
        ...f,
        options: f.type === "select" ? f.options?.filter(o => o.trim()) : undefined,
      }));

      const { error } = await supabase
        .from("events")
        .update({ rsvp_form_fields: cleanFields as any })
        .eq("id", eventId);

      if (error) throw error;

      toast.success("Campos do formulário salvos!");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving RSVP fields:", error);
      toast.error("Erro ao salvar campos do formulário");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFields(DEFAULT_FIELDS);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Campos do Formulário RSVP</DialogTitle>
          <DialogDescription>
            Configure quais informações serão solicitadas no link de confirmação de presença
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.key}
              className={`border rounded-lg p-3 space-y-2 ${!field.enabled ? "opacity-50 bg-muted/30" : ""}`}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  {isDefault(field.key) ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{field.label}</span>
                      {isLocked(field.key) && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Lock className="h-3 w-3" />
                          Fixo
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <Input
                      value={field.label}
                      onChange={(e) => handleLabelChange(index, e.target.value)}
                      placeholder="Nome do campo"
                      className="h-8 text-sm"
                    />
                  )}
                </div>

                {!isLocked(field.key) && (
                  <Switch
                    checked={field.enabled}
                    onCheckedChange={() => handleToggleEnabled(index)}
                  />
                )}

                {!isDefault(field.key) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveField(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {field.enabled && !isLocked(field.key) && (
                <div className="flex items-center gap-4 pl-6">
                  {!isDefault(field.key) && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Tipo:</Label>
                      <Select
                        value={field.type}
                        onValueChange={(v) => handleTypeChange(index, v as RsvpFormField["type"])}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto</SelectItem>
                          <SelectItem value="number">Número</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="select">Seleção</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={field.required}
                      onCheckedChange={() => handleToggleRequired(index)}
                      className="scale-75"
                    />
                    <Label className="text-xs text-muted-foreground">Obrigatório</Label>
                  </div>
                </div>
              )}

              {/* Select options */}
              {field.enabled && field.type === "select" && field.options && (
                <div className="pl-6 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Opções:</Label>
                  {field.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-1">
                      <Input
                        value={opt}
                        onChange={(e) => handleOptionChange(index, optIdx, e.target.value)}
                        placeholder={`Opção ${optIdx + 1}`}
                        className="h-7 text-xs flex-1"
                      />
                      {field.options!.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRemoveOption(index, optIdx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => handleAddOption(index)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar opção
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleAddField}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar campo personalizado
        </Button>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Restaurar padrão
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Campos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
