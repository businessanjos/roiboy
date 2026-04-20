import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CustomField } from "@/components/custom-fields/CustomFieldsManager";
import { InlineFieldInput } from "@/components/sales/InlineFieldInput";

interface RequiredFieldsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  dealTitle: string;
  targetStageName: string;
  missingFields: CustomField[];
  accountId: string;
  onComplete: () => void;
  /** Optional: "won" or "lost" - changes the dialog messaging */
  outcomeType?: "won" | "lost";
}

export function RequiredFieldsModal({
  open,
  onOpenChange,
  dealId,
  dealTitle,
  targetStageName,
  missingFields,
  accountId,
  onComplete,
  outcomeType,
}: RequiredFieldsModalProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // Reset values when modal opens
  useEffect(() => {
    if (open) {
      setValues({});
    }
  }, [open]);

  const allFieldsFilled = missingFields.every(field => {
    const value = values[field.id];
    if (field.field_type === "boolean") return value !== undefined;
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== "";
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save all values
      for (const field of missingFields) {
        const value = values[field.id];
        if (value === undefined || value === null || value === "") continue;

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
            valueData.value_boolean = value;
            break;
          case "number":
          case "currency":
            valueData.value_number = value;
            break;
          case "date":
            valueData.value_date = value;
            break;
          case "select":
          case "text":
          case "instagram":
            valueData.value_text = value;
            break;
          case "multi_select":
          case "user":
          case "location":
          case "multi_instagram":
            valueData.value_json = value;
            break;
        }

        const { error } = await supabase
          .from("deal_field_values")
          .upsert(valueData, { onConflict: "deal_id,field_id" });

        if (error) throw error;
      }

      toast.success("Campos preenchidos!");
      onComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving required fields:", error);
      toast.error("Erro ao salvar campos");
    } finally {
      setSaving(false);
    }
  };

  const handleValueChange = (fieldId: string, newValue: any) => {
    setValues(prev => ({ ...prev, [fieldId]: newValue }));
  };

  // Generate contextual messaging based on outcome type
  const getDescription = () => {
    if (outcomeType === "won") {
      return `Para marcar "${dealTitle}" como Ganha, preencha os campos abaixo:`;
    }
    if (outcomeType === "lost") {
      return `Para marcar "${dealTitle}" como Perdida, preencha os campos abaixo:`;
    }
    return `Para mover "${dealTitle}" para a etapa "${targetStageName}", preencha os campos abaixo:`;
  };

  const getButtonLabel = () => {
    if (outcomeType === "won") {
      return "Preencher e Ganhar";
    }
    if (outcomeType === "lost") {
      return "Preencher e Perder";
    }
    return "Preencher e Mover";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Campos Obrigatórios</DialogTitle>
          <DialogDescription>
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {missingFields.map(field => (
            <div key={field.id} className="space-y-2">
              <Label className="text-sm font-medium">
                {field.name} <span className="text-destructive">*</span>
              </Label>
              <DealFieldValueEditor
                field={field}
                dealId={dealId}
                accountId={accountId}
                currentValue={values[field.id]}
                onValueChange={handleValueChange}
              />
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!allFieldsFilled || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {getButtonLabel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
