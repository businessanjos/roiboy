import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { BonusSelector } from "@/components/sales/BonusSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillingMentoreeSection, BillingMentoreeValues, isBillingMentoreeComplete } from "@/components/sales/BillingMentoreeSection";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  allowedSubscriptionPayments,
  isSubscriptionAnswerComplete,
  prefillSubscriptionPayment,
  type SubscriptionCycle,
} from "@/lib/sales/subscriptionWin";
import { fetchSubscriptionWinState, type SubscriptionWinState } from "@/lib/sales/subscriptionWinState";
import { clearLocalAutosaveDraft, readLocalAutosaveDraft, writeLocalAutosaveDraft } from "@/hooks/useLocalAutosaveDraft";

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
  /** Renovação: dispensa o briefing para operação */
  skipBriefing?: boolean;
  /** A empresa do negócio exige responder "É uma assinatura?" antes do ganho */
  subscriptionRequired?: boolean;
}

const PAYMENT_METHOD_FIELD_NAME = "Forma da Pagamento";
const PAYMENT_BREAKDOWN_FIELD_NAME = "Detalhamento de Pagamento";
const BONUS_FIELD_NAMES = ["Ganhou Bônus?", "Bônus"];

const isBonusField = (name: string) => BONUS_FIELD_NAMES.includes(name);

const EMPTY_BILLING_VALUES: BillingMentoreeValues = {
  tipo_pessoa: "",
  doc: "",
  razao_social: "",
  email_nf: "",
  ment_nome: "",
  ment_telefone: "",
  ment_email: "",
};

type RequiredFieldsDraft = {
  values: Record<string, any>;
  breakdown: PaymentBreakdownItem[];
  billingValues: BillingMentoreeValues;
};

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
  skipBriefing = false,
  subscriptionRequired = false,
}: RequiredFieldsModalProps) {
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionWinState | null>(null);
  const [isSubscription, setIsSubscription] = useState<boolean | null>(null);
  const [subscriptionCycle, setSubscriptionCycle] = useState<SubscriptionCycle | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [breakdown, setBreakdown] = useState<PaymentBreakdownItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [briefingComplete, setBriefingComplete] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [billingValues, setBillingValues] = useState<BillingMentoreeValues>(EMPTY_BILLING_VALUES);
  const [receivedValue, setReceivedValue] = useState<string>("");
  const [dealContact, setDealContact] = useState<{ name?: string | null; phone?: string | null; email?: string | null } | undefined>(undefined);
  const skipAutosaveRef = useRef(false);

  const showBriefing = outcomeType === "won" && !skipBriefing;
  // Dados de faturamento / emissão de NF só fazem sentido quando a venda é dada como ganha.
  // NÃO pedir em movimentos intermediários de etapa.
  const showBilling = outcomeType === "won";
  const draftKey = open
    ? `roy:sales:required-fields-draft:${accountId}:${dealId}:${outcomeType ?? targetStageName}`
    : null;

  // Reset values when modal opens; pre-check briefing status; load deal contact for mentorado defaults
  useEffect(() => {
    if (open) {
      const draft = readLocalAutosaveDraft<RequiredFieldsDraft>(draftKey);
      skipAutosaveRef.current = true;
      setDraftHydrated(false);
      setValues(draft?.values ?? {});
      setBreakdown(draft?.breakdown ?? []);
      setBillingValues(draft?.billingValues ?? EMPTY_BILLING_VALUES);
      setBriefingComplete(false);
      setDealContact(undefined);
      setReceivedValue("");
      setSubscriptionState(null);
      setIsSubscription(null);
      setSubscriptionCycle(null);

      if (subscriptionRequired && dealId) {
        fetchSubscriptionWinState(dealId)
          .then((state) => {
            setSubscriptionState(state);
            setIsSubscription(state.isSubscription);
            const cycle = state.isSubscription ? state.cycle : null;
            setSubscriptionCycle(cycle);
            if (cycle && state.paymentField) {
              const prefill = prefillSubscriptionPayment(cycle, state.paymentValue);
              if (prefill) setValues((prev) => ({ ...prev, [state.paymentField!.id]: prev[state.paymentField!.id] ?? prefill }));
            }
          })
          .catch((err) => {
            console.error("Erro ao carregar dados de assinatura:", err);
            toast.error("Não foi possível carregar os dados de assinatura. Feche e tente novamente.");
          });
      }

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

      if (showBilling && dealId) {
        supabase
          .from("deals")
          .select("contact_name, contact_phone, contact_email, received_value")
          .eq("id", dealId)
          .maybeSingle()
          .then(({ data }) => {
            if (data && (data as any).received_value !== null && (data as any).received_value !== undefined) {
              setReceivedValue(String((data as any).received_value).replace(".", ","));
            }
            if (data) {
              setDealContact({
                name: data.contact_name,
                phone: data.contact_phone,
                email: data.contact_email,
              });
            }
          });
      }

      window.setTimeout(() => {
        skipAutosaveRef.current = false;
        setDraftHydrated(true);
      }, 0);
    }
  }, [open, dealId, showBriefing, showBilling, draftKey, subscriptionRequired]);

  useEffect(() => {
    if (!open || !draftKey || skipAutosaveRef.current) return;
    writeLocalAutosaveDraft<RequiredFieldsDraft>(draftKey, {
      values,
      breakdown,
      billingValues,
    });
  }, [open, draftKey, values, breakdown, billingValues]);

  const missingPaymentField = missingFields.find((f) => f.name === PAYMENT_METHOD_FIELD_NAME);
  const subscriptionActive = subscriptionRequired && isSubscription === true;
  // Em assinatura, a forma de pagamento é sempre conferida — mesmo quando já estava preenchida.
  const subscriptionPaymentField: CustomField | undefined =
    subscriptionActive && !missingPaymentField && subscriptionState?.paymentField
      ? ({
          ...subscriptionState.paymentField,
          is_required: true,
          display_order: 0,
          is_active: true,
          show_in_clients: false,
          folder_id: null,
        } as unknown as CustomField)
      : undefined;
  const paymentMethodField = missingPaymentField ?? subscriptionPaymentField;
  const paymentMethodValue = paymentMethodField ? values[paymentMethodField.id] : undefined;
  const storedPaymentValue = subscriptionState?.paymentValue ?? null;
  // Forma já salva e mantida: o detalhamento existente continua valendo, sem preencher de novo.
  const paymentKeptFromDeal = !!subscriptionPaymentField && !!paymentMethodValue && paymentMethodValue === storedPaymentValue;
  const requiredMethods = paymentMethodValue && !paymentKeptFromDeal
    ? getMethodsForPaymentOption(paymentMethodValue as string)
    : [];
  const needsBreakdown = requiredMethods.length > 0;
  const allowedPaymentValues = subscriptionActive && subscriptionCycle ? allowedSubscriptionPayments(subscriptionCycle) : null;
  const subscriptionOk =
    !subscriptionRequired ||
    (subscriptionState !== null &&
      isSubscriptionAnswerComplete({
        isSubscription,
        cycle: subscriptionCycle,
        // Sem o campo de forma de pagamento na conta, basta responder o ciclo.
        paymentValue: paymentMethodField
          ? (paymentMethodValue as string | undefined)
          : subscriptionCycle
            ? allowedSubscriptionPayments(subscriptionCycle)[0]
            : null,
      }));

  const applyCycle = (cycle: SubscriptionCycle | null) => {
    setSubscriptionCycle(cycle);
    const field = missingPaymentField ?? subscriptionState?.paymentField;
    if (!cycle || !field) return;
    const current = values[field.id] as string | undefined;
    if (current && allowedSubscriptionPayments(cycle).includes(current)) return;
    const prefill = prefillSubscriptionPayment(cycle, storedPaymentValue);
    setValues((prev) => ({ ...prev, [field.id]: prefill ?? undefined }));
    setBreakdown([]);
  };

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
  // Briefing operacional é OBRIGATÓRIO em todo ganho (inclui carteira/renovação)
  const briefingOk = !showBriefing || briefingComplete;
  const billingOk = !showBilling || isBillingMentoreeComplete(billingValues);
  // Valor recebido (cash collect) é obrigatório no ganho — pode ser 0, mas precisa ser informado.
  const parsedReceived = Number(String(receivedValue).replace(/\./g, "").replace(",", "."));
  const receivedOk = !showBilling || (receivedValue.trim() !== "" && Number.isFinite(parsedReceived) && parsedReceived >= 0);
  const canSave = subscriptionOk && allFieldsFilled && breakdownOk && briefingOk && billingOk && receivedOk;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save standard required fields
      const fieldsToSave = subscriptionPaymentField && !paymentKeptFromDeal
        ? [...missingFields, subscriptionPaymentField]
        : missingFields;
      for (const field of fieldsToSave) {
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

      // Save the payment breakdown into "Detalhamento de Pagamento" if applicable.
      // Em assinatura, trocar para uma forma sem detalhamento (Pix) limpa o detalhamento da forma anterior.
      const clearStaleBreakdown = !!subscriptionPaymentField && !paymentKeptFromDeal && !needsBreakdown;
      if (needsBreakdown || clearStaleBreakdown) {
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
          const summary = clearStaleBreakdown ? null : breakdown
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
              value_json: clearStaleBreakdown ? null : (breakdown as any),
              value_number: null,
              value_boolean: null,
              value_date: null,
            },
            { onConflict: "deal_id,field_id" }
          );
          if (bErr) throw bErr;
        }
      }

      // Upsert Pagador (payer) + vínculo client_payers
      if (showBilling && isBillingMentoreeComplete(billingValues)) {
        try {
          const { data: dealRow } = await supabase
            .from("deals")
            .select("client_id")
            .eq("id", dealId)
            .maybeSingle();
          const cid = (dealRow as any)?.client_id || clientId || null;

          const docClean = billingValues.doc.replace(/\D/g, "");
          if (docClean) {
            // Find existing payer by account + document
            const { data: existingPayer } = await supabase
              .from("payers")
              .select("id")
              .eq("account_id", accountId)
              .eq("document", docClean)
              .maybeSingle();

            const payerPayload: any = {
              account_id: accountId,
              document_type: billingValues.tipo_pessoa,
              document: docClean,
              legal_name: billingValues.razao_social,
              email_billing: billingValues.email_nf || null,
              phone_billing: billingValues.ment_telefone || null,
            };

            let payerId = (existingPayer as any)?.id as string | undefined;
            if (payerId) {
              await supabase.from("payers").update(payerPayload).eq("id", payerId);
            } else {
              const { data: inserted, error: pErr } = await supabase
                .from("payers")
                .insert(payerPayload)
                .select("id")
                .single();
              if (pErr) throw pErr;
              payerId = (inserted as any).id;
            }

            if (cid && payerId) {
              const { data: link } = await supabase
                .from("client_payers")
                .select("id")
                .eq("client_id", cid)
                .eq("payer_id", payerId)
                .maybeSingle();
              if (!link) {
                const isSelf =
                  billingValues.razao_social.trim().toLowerCase() ===
                  (billingValues.ment_nome || "").trim().toLowerCase();
                await supabase.from("client_payers").insert({
                  account_id: accountId,
                  client_id: cid,
                  payer_id: payerId,
                  relationship: billingValues.tipo_pessoa === "cnpj" ? "company" : isSelf ? "self" : "other",
                  is_default: true,
                });
              }
            }
          }
        } catch (payerErr) {
          console.error("Erro ao salvar pagador:", payerErr);
          // não bloqueia o ganho — apenas registra
        }
      }

      if (subscriptionRequired) {
        const { error: subErr } = await supabase
          .from("deals")
          .update({
            is_subscription: isSubscription,
            subscription_cycle: isSubscription ? subscriptionCycle : null,
          })
          .eq("id", dealId);
        if (subErr) throw subErr;
      }

      if (showBilling && receivedOk) {
        const { error: rvErr } = await supabase
          .from("deals")
          .update({ received_value: parsedReceived } as any)
          .eq("id", dealId);
        if (rvErr) throw rvErr;
      }

      clearLocalAutosaveDraft(draftKey);
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
    if (subscriptionRequired) {
      return `Para marcar "${dealTitle}" como Ganha, responda abaixo:`;
    }
    return `Para mover "${dealTitle}" para a etapa "${targetStageName}", preencha os campos abaixo:`;
  };

  const getButtonLabel = () => {
    if (outcomeType === "won") return "Preencher e Ganhar";
    if (outcomeType === "lost") return "Preencher e Perder";
    if (subscriptionRequired) return "Preencher e Ganhar";
    return "Preencher e Mover";
  };

  // Filter out the auto-managed breakdown field from the displayed list
  // Em assinatura, a forma de pagamento sai da lista comum e aparece junto da pergunta, só com as opções permitidas.
  const displayedFields = missingFields.filter(
    (f) => f.name !== PAYMENT_BREAKDOWN_FIELD_NAME && !(subscriptionActive && f.id === paymentMethodField?.id),
  );

  const renderField = (field: CustomField) => {
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
            field={
              allowedPaymentValues && field.id === paymentMethodField?.id
                ? { ...field, options: field.options.filter((o) => allowedPaymentValues.includes(o.value)) }
                : field
            }
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
  };


  const subscriptionSection = subscriptionRequired ? (
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-3">
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          É uma assinatura? <span className="text-destructive">*</span>
        </Label>
        <ToggleGroup
          type="single"
          variant="outline"
          className="justify-start"
          disabled={subscriptionState === null}
          value={isSubscription === null ? "" : isSubscription ? "yes" : "no"}
          onValueChange={(next) => {
            if (!next) return;
            const yes = next === "yes";
            setIsSubscription(yes);
            if (!yes) setSubscriptionCycle(null);
          }}
          aria-label="É uma assinatura?"
        >
          <ToggleGroupItem value="yes" className="h-11 min-w-20 sm:h-9">Sim</ToggleGroupItem>
          <ToggleGroupItem value="no" className="h-11 min-w-20 sm:h-9">Não</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isSubscription === true && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            É uma assinatura mensal ou anual? <span className="text-destructive">*</span>
          </Label>
          <ToggleGroup
            type="single"
            variant="outline"
            className="justify-start"
            value={subscriptionCycle ?? ""}
            onValueChange={(next) => {
              if (next) applyCycle(next as SubscriptionCycle);
            }}
            aria-label="É uma assinatura mensal ou anual?"
          >
            <ToggleGroupItem value="monthly" className="h-11 min-w-20 sm:h-9">Mensal</ToggleGroupItem>
            <ToggleGroupItem value="annual" className="h-11 min-w-20 sm:h-9">Anual</ToggleGroupItem>
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            {subscriptionCycle === "annual"
              ? "Assinatura anual: Pix ou Cartão de crédito."
              : subscriptionCycle === "monthly"
                ? "Assinatura mensal: Cartão recorrência."
                : "A forma de pagamento disponível depende dessa escolha."}
          </p>
        </div>
      )}

      {subscriptionActive && subscriptionCycle && paymentMethodField && renderField(paymentMethodField)}
    </div>
  ) : null;

  const receivedValueSection = showBilling ? (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <Label className="text-sm font-medium">
        Valor recebido (R$) <span className="text-destructive">*</span>
      </Label>
      <Input
        inputMode="decimal"
        placeholder="0,00"
        value={receivedValue}
        onChange={(e) => setReceivedValue(e.target.value.replace(/[^0-9.,]/g, ""))}
      />
      <p className="text-xs text-muted-foreground">
        Quanto entrou de fato no caixa nesta venda. Alimenta o Cash Collect dos SPIFFs. Se ainda não entrou nada, informe 0.
      </p>
    </div>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${showBriefing ? "max-w-3xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>Campos Obrigatórios</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {showBriefing ? (
            <Tabs defaultValue="fields" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="fields">Dados da Negociação</TabsTrigger>
                <TabsTrigger value="briefing">
                  Briefing para Operação {briefingComplete ? "✓" : "*"}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="fields" className="space-y-6 mt-4">
                {subscriptionSection}
                {displayedFields.length > 0 && (
                  <div className="space-y-4">
                    {displayedFields.map((field) => renderField(field))}
                  </div>
                )}

                {receivedValueSection}

                {showBilling && draftHydrated && (
                  <BillingMentoreeSection
                    dealId={dealId}
                    accountId={accountId}
                    contactDefaults={dealContact}
                    values={billingValues}
                    onChange={setBillingValues}
                  />
                )}
              </TabsContent>

              <TabsContent value="briefing" className="space-y-3 mt-4">
                <p className={`text-xs ${briefingComplete ? "text-muted-foreground" : "text-warning"}`}>
                  {briefingComplete
                    ? "Briefing completo — a operação do CS já recebe estas informações."
                    : "Obrigatório — preencha e salve o briefing para concluir o ganho (vale também para carteira/renovação)."}
                </p>
                <OperationBriefingForm
                  dealId={dealId}
                  clientId={clientId ?? null}
                  onSaved={(data: OperationBriefingData) => setBriefingComplete(isBriefingComplete(data))}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-6">
              {subscriptionSection}
              {displayedFields.length > 0 && (
                <div className="space-y-4">
                  {displayedFields.map((field) => renderField(field))}
                </div>
              )}
              {receivedValueSection}

              {showBilling && draftHydrated && (
                <BillingMentoreeSection
                  dealId={dealId}
                  accountId={accountId}
                  contactDefaults={dealContact}
                  values={billingValues}
                  onChange={setBillingValues}
                />
              )}
            </div>
          )}
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
