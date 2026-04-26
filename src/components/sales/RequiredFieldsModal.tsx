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
import {
  PaymentBreakdownComposer,
  PaymentBreakdownItem,
  getMethodsForPaymentOption,
  isBreakdownComplete,
} from "@/components/sales/PaymentBreakdownComposer";
import { OperationBriefingForm, isBriefingComplete, OperationBriefingData } from "@/components/operations/OperationBriefingForm";
import { Separator } from "@/components/ui/separator";
import { BonusSelector } from "@/components/sales/BonusSelector";

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
  /** Optional client id, used to pre-load/save the operation briefing */
  clientId?: string | null;
}

const PAYMENT_METHOD_FIELD_NAME = "Forma da Pagamento";
const PAYMENT_BREAKDOWN_FIELD_NAME = "Detalhamento de Pagamento";
const BONUS_FIELD_NAMES = ["Ganhou Bônus?", "Bônus"];

const isBonusField = (name: string) => BONUS_FIELD_NAMES.includes(name);

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
  clientId,
}: RequiredFieldsModalProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [breakdown, setBreakdown] = useState<PaymentBreakdownItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [briefingComplete, setBriefingComplete] = useState(false);

  const showBriefing = outcomeType === "won";

  // Reset values when modal opens; pre-check briefing status
  useEffect(() => {
    if (open) {
      setValues({});
      setBreakdown([]);
      setBriefingComplete(false);

      if (showBriefing && dealId) {
        supabase
          .from("deal_operation_briefings")
          .select("is_complete")
          .eq("deal_id", dealId)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.is_complete) setBriefingComplete(true);
          });
      }
    }
  }, [open, dealId, showBriefing]);

  const paymentMethodField = missingFields.find((f) => f.name === PAYMENT_METHOD_FIELD_NAME);
  const paymentMethodValue = paymentMethodField ? values[paymentMethodField.id] : undefined;
  const requiredMethods = paymentMethodValue
    ? getMethodsForPaymentOption(paymentMethodValue as string)
    : [];
  const needsBreakdown = requiredMethods.length > 0;

  const paymentMethodLabel = (() => {
    if (!paymentMethodField || !paymentMethodValue) return "";
    const opt = paymentMethodField.options.find((o) => o.value === paymentMethodValue);
    return opt?.label ?? "";
  })();

  const allFieldsFilled = missingFields.every((field) => {
    // Skip the auto-filled breakdown field — it's handled separately below.
    if (field.name === PAYMENT_BREAKDOWN_FIELD_NAME) return true;
    const value = values[field.id];
    if (field.field_type === "boolean") return value !== undefined;
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== "";
  });

  const breakdownOk = !needsBreakdown || isBreakdownComplete(breakdown);
  const briefingOk = !showBriefing || briefingComplete;
  const canSave = allFieldsFilled && breakdownOk && briefingOk;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save standard required fields
      for (const field of missingFields) {
        // Skip the breakdown field — handled separately so we always write the latest composer state.
        if (field.name === PAYMENT_BREAKDOWN_FIELD_NAME) continue;

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

        // Bonus fields are always stored as JSON arrays of selected labels
        if (isBonusField(field.name)) {
          valueData.value_json = Array.isArray(value) ? value : [];
          valueData.value_text = null;
        }

        const { error } = await supabase
          .from("deal_field_values")
          .upsert(valueData, { onConflict: "deal_id,field_id" });

        if (error) throw error;
      }

      // Save the payment breakdown into "Detalhamento de Pagamento" if applicable
      if (needsBreakdown) {
        const breakdownField = missingFields.find((f) => f.name === PAYMENT_BREAKDOWN_FIELD_NAME);
        // Fall back to fetching it if it's not part of missingFields (e.g. already filled but still required)
        let breakdownFieldId = breakdownField?.id;
        if (!breakdownFieldId) {
          const { data: bf } = await supabase
            .from("custom_fields")
            .select("id")
            .eq("account_id", accountId)
            .eq("name", PAYMENT_BREAKDOWN_FIELD_NAME)
            .maybeSingle();
          breakdownFieldId = bf?.id;
        }

        if (breakdownFieldId) {
          const summary = breakdown
            .map(
              (b) =>
                `${b.method_label}: R$ ${(b.amount ?? 0).toFixed(2)} em ${b.installments}x (1ª: ${b.first_due_date})`
            )
            .join(" | ");

          const { error: bErr } = await supabase.from("deal_field_values").upsert(
            {
              account_id: accountId,
              deal_id: dealId,
              field_id: breakdownFieldId,
              value_text: summary,
              value_json: breakdown as any,
              value_number: null,
              value_boolean: null,
              value_date: null,
            },
            { onConflict: "deal_id,field_id" }
          );
          if (bErr) throw bErr;
        }
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
    setValues((prev) => ({ ...prev, [fieldId]: newValue }));
    // If the user changes the payment method, reset the breakdown
    if (paymentMethodField && fieldId === paymentMethodField.id) {
      setBreakdown([]);
    }
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
    if (outcomeType === "won") return "Preencher e Ganhar";
    if (outcomeType === "lost") return "Preencher e Perder";
    return "Preencher e Mover";
  };

  // Filter out the auto-managed breakdown field from the displayed list
  const displayedFields = missingFields.filter((f) => f.name !== PAYMENT_BREAKDOWN_FIELD_NAME);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${showBriefing ? "max-w-3xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>Campos Obrigatórios</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {showBriefing && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Briefing para Operação</h3>
                <p className="text-xs text-muted-foreground">
                  Preencha o briefing estruturado abaixo. Salve para liberar o botão "Preencher e Ganhar".
                </p>
              </div>
              <OperationBriefingForm
                dealId={dealId}
                clientId={clientId ?? null}
                onSaved={(data: OperationBriefingData) => setBriefingComplete(isBriefingComplete(data))}
              />
              {displayedFields.length > 0 && <Separator />}
            </div>
          )}

          {displayedFields.map((field) => {
            const bonusField = isBonusField(field.name);
            return (
              <div key={field.id} className="space-y-2">
                <Label className="text-sm font-medium">
                  {field.name} <span className="text-destructive">*</span>
                </Label>
                {bonusField ? (
                  <BonusSelector
                    dealId={dealId}
                    value={Array.isArray(values[field.id]) ? (values[field.id] as string[]) : []}
                    onChange={(newValue) => handleValueChange(field.id, newValue)}
                  />
                ) : (
                  <InlineFieldInput
                    field={field}
                    value={values[field.id]}
                    onChange={(newValue) => handleValueChange(field.id, newValue)}
                  />
                )}
                {field.id === paymentMethodField?.id && needsBreakdown && (
                  <PaymentBreakdownComposer
                    paymentMethodValue={paymentMethodValue as string}
                    paymentMethodLabel={paymentMethodLabel}
                    value={breakdown}
                    onChange={setBreakdown}
                  />
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {getButtonLabel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
