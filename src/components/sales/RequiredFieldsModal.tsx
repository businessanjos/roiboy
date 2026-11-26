import { useState, useEffect, useRef, type ReactNode } from "react";
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
import { Loader2, Check, RefreshCw, ShieldCheck, Repeat, Receipt, CalendarDays, CalendarRange, ArrowUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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
import {
  allowedSubscriptionPayments,
  isSubscriptionAnswerComplete,
  prefillSubscriptionPayment,
  SUBSCRIPTION_CYCLE_LABEL,
  type SubscriptionCycle,
} from "@/lib/sales/subscriptionWin";
import { fetchDealItemVenda, fetchSubscriptionWinState, type SubscriptionWinState } from "@/lib/sales/subscriptionWinState";
import { DEAL_DOCUMENT_FIELD_IDS, ITEM_VENDA_FIELD_ID, payWinGate, requiresPaidWin } from "@/lib/sales/payWinGate";
import { useRykaPaySubscriptions } from "@/hooks/useRykaPaySubscriptions";
import { paidPayCharge } from "@/lib/sales/subscriptionPayCharge";
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
  const [storedItem, setStoredItem] = useState<string | null>(null);
  // Dados (documento + item) com que o vendedor clicou em verificar; mudou algo, verifica de novo.
  const [payVerifiedKey, setPayVerifiedKey] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const docPrefilledRef = useRef(false);
  // A trava de pagamento só existe no ganho.
  const isWinFlow = outcomeType === "won" || (subscriptionRequired && outcomeType !== "lost");

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
      setStoredItem(null);
      setPayVerifiedKey(null);
      docPrefilledRef.current = false;

      if (isWinFlow && dealId) {
        fetchDealItemVenda(dealId)
          .then(setStoredItem)
          .catch((err) => console.error("Erro ao carregar o item da venda:", err));
      }

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
  }, [open, dealId, showBriefing, showBilling, draftKey, subscriptionRequired, isWinFlow]);

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
  // Programa Clínica Ryka: o ganho só é liberado com pagamento confirmado no RykaPay,
  // consultado quando o vendedor clica em verificar. Outros produtos não passam por isso.
  const itemField = missingFields.find((f) => f.id === ITEM_VENDA_FIELD_ID);
  const itemValue = ((itemField ? values[itemField.id] : null) as string | null) || storedItem;
  const payGate = isWinFlow && requiresPaidWin(itemValue);
  const docFields = payGate
    ? missingFields.filter(
        (f) => DEAL_DOCUMENT_FIELD_IDS.includes(f.id) || (f.field_type === "text" && /\b(cpf|cnpj)\b/i.test(f.name)),
      )
    : [];
  const payKey = JSON.stringify([itemValue, ...docFields.map((f) => values[f.id] ?? "")]);
  const payRequested = payGate && payVerifiedKey === payKey;
  // Assinatura já paga no RykaPay: valor e data aparecem só para leitura.
  const payQuery = useRykaPaySubscriptions(
    { dealId },
    open && (payGate ? payRequested : subscriptionActive && !!subscriptionCycle),
  );
  const payData = payGate && !payRequested ? undefined : payQuery.data;
  const payCharge = subscriptionActive ? paidPayCharge(payData, subscriptionCycle) : null;
  const gate = payWinGate({
    requested: payRequested,
    checking: verifying || payQuery.isLoading,
    failed: payQuery.isError,
    result: payData,
    isSubscription,
    cycle: subscriptionCycle,
  });
  const gateBusy = verifying || gate.status === "checking";
  const payChecking = payGate ? gateBusy : subscriptionActive && !!subscriptionCycle && payQuery.isLoading;

  // CPF/CNPJ já cadastrado no cliente ou no lead entra preenchido (o vendedor ainda pode trocar).
  const docFieldId = docFields[0]?.id;
  useEffect(() => {
    if (!open || !docFieldId || docPrefilledRef.current) return;
    docPrefilledRef.current = true;
    (async () => {
      const { data: deal } = await supabase.from("deals").select("client_id, lead_id").eq("id", dealId).maybeSingle();
      let doc: string | null = null;
      if (deal?.client_id) {
        const { data } = await supabase.from("clients").select("cpf, cnpj").eq("id", deal.client_id).maybeSingle();
        doc = data?.cpf || data?.cnpj || null;
      }
      if (!doc && deal?.lead_id) {
        const { data } = await supabase.from("leads").select("cpf, cnpj").eq("id", deal.lead_id).maybeSingle();
        doc = data?.cpf || data?.cnpj || null;
      }
      if (doc) setValues((prev) => (prev[docFieldId] ? prev : { ...prev, [docFieldId]: doc }));
    })().catch((err) => console.error("Erro ao buscar CPF/CNPJ do cadastro:", err));
  }, [open, docFieldId, dealId]);
  const payMethod = payCharge && requiredMethods.length === 1 ? requiredMethods[0] : null;
  const payLocked = !!payMethod;
  const payAmount = payCharge?.amount ?? null;
  const payDate = payCharge?.firstPaidDate ?? null;
  const payMethodKey = payMethod?.key ?? null;
  const payMethodLabel = payMethod?.label ?? null;
  useEffect(() => {
    if (!payMethodKey || payAmount === null || !payDate) return;
    setBreakdown((prev) => {
      const current = prev.find((b) => b.method === payMethodKey);
      if (prev.length === 1 && current && current.amount === payAmount && current.installments === 1 && current.first_due_date === payDate) return prev;
      return [{
        method: payMethodKey,
        method_label: payMethodLabel ?? payMethodKey,
        amount: payAmount,
        installments: 1,
        first_due_date: payDate,
        is_cash_collect: current?.is_cash_collect ?? false,
      }];
    });
  }, [payMethodKey, payMethodLabel, payAmount, payDate, breakdown]);
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

  // Em assinatura o vendedor não digita valor/data: ou vem do RykaPay, ou fica em branco.
  const sellerFillsBreakdown = needsBreakdown && !subscriptionActive;
  const payBreakdownReady = subscriptionActive && payLocked && isBreakdownComplete(breakdown);
  const breakdownOk = !sellerFillsBreakdown || isBreakdownComplete(breakdown);
  // Briefing operacional é OBRIGATÓRIO em todo ganho (inclui carteira/renovação)
  const briefingOk = !showBriefing || briefingComplete;
  const billingOk = !showBilling || isBillingMentoreeComplete(billingValues);
  // Valor recebido (cash collect) é obrigatório no ganho — pode ser 0, mas precisa ser informado.
  const parsedReceived = Number(String(receivedValue).replace(/\./g, "").replace(",", "."));
  const receivedOk = !showBilling || (receivedValue.trim() !== "" && Number.isFinite(parsedReceived) && parsedReceived >= 0);
  const payGateOk = !payGate || gate.status === "paid";
  const canSave = subscriptionOk && allFieldsFilled && breakdownOk && briefingOk && billingOk && receivedOk && !payChecking && payGateOk;

  const upsertFieldValue = async (field: CustomField) => {
    const value = values[field.id];
    if (value === undefined || value === null || value === "") return;

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
  };

  // O RykaPay é consultado pelo que está salvo no negócio: grava o documento antes de consultar.
  const handleVerifyPay = async () => {
    setVerifying(true);
    try {
      for (const field of itemField ? [...docFields, itemField] : docFields) await upsertFieldValue(field);
      setPayVerifiedKey(payKey);
      await payQuery.refetch();
    } catch (error) {
      console.error("Erro ao verificar pagamento:", error);
      toast.error("Não foi possível verificar o pagamento. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  };

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

        await upsertFieldValue(field);
      }

      // Save the payment breakdown into "Detalhamento de Pagamento" if applicable.
      // Em assinatura, trocar para uma forma sem detalhamento (Pix) limpa o detalhamento da forma anterior.
      // Sem pagamento no RykaPay, nada digitado à mão é gravado: o detalhamento antigo é limpo.
      const clearStaleBreakdown = subscriptionActive
        ? !!paymentMethodField && !paymentKeptFromDeal && !payBreakdownReady
        : !!subscriptionPaymentField && !paymentKeptFromDeal && !needsBreakdown;
      if (sellerFillsBreakdown || payBreakdownReady || clearStaleBreakdown) {
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
    (f) =>
      f.name !== PAYMENT_BREAKDOWN_FIELD_NAME &&
      !(subscriptionActive && f.id === paymentMethodField?.id) &&
      !docFields.some((d) => d.id === f.id),
  );

  const renderField = (field: CustomField, hideLabel = false) => {
    const bonusField = isBonusField(field.name);
    return (
      <div key={field.id} className="space-y-2">
        {!hideLabel && (
          <Label className="text-sm font-medium">
            {field.name} <span className="text-destructive">*</span>
          </Label>
        )}
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
        {field.id === paymentMethodField?.id && payChecking && !payGate && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Consultando o RykaPay…
          </p>
        )}
        {field.id === paymentMethodField?.id && subscriptionActive && !payGate && !payChecking && !payCharge && !!paymentMethodValue && (
          <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Valor e data da cobrança vêm do RykaPay. Ainda não há pagamento registrado lá — quando houver,
            aparece na aba Assinaturas do negócio.
          </div>
        )}
        {field.id === paymentMethodField?.id && subscriptionActive && !payGate && !payChecking && payCharge && (
          <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Já pago no RykaPay:{" "}
            <span className="font-medium text-foreground">
              {payCharge.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
            {" · 1º pagamento em "}
            <span className="font-medium text-foreground">
              {payCharge.firstPaidDate.split("-").reverse().join("/")}
            </span>
          </div>
        )}
        {field.id === paymentMethodField?.id && sellerFillsBreakdown && (
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


  const stepHeader = (step: number, title: string, done: boolean) => (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
          done ? "bg-primary text-primary-foreground" : "border border-border bg-background text-muted-foreground",
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : step}
      </span>
      <Label className="text-sm font-semibold leading-tight">
        {title} <span className="text-destructive">*</span>
      </Label>
    </div>
  );

  const choiceCards = <T extends string>(
    label: string,
    selected: T | null,
    onSelect: (value: T) => void,
    options: { value: T; title: string; hint: string; icon: LucideIcon }[],
    disabled = false,
  ) => (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map(({ value, title, hint, icon: Icon }) => {
        const active = selected === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onSelect(value)}
            className={cn(
              "relative flex min-h-[76px] flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:cursor-not-allowed disabled:opacity-60",
              active
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-border bg-background hover:border-primary/50 hover:bg-muted/50",
            )}
          >
            <span className="flex w-full items-center gap-2">
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              <span className="text-sm font-semibold">{title}</span>
              <span
                className={cn(
                  "ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                )}
              >
                {active && <Check className="h-3 w-3" />}
              </span>
            </span>
            <span className="text-xs leading-snug text-muted-foreground">{hint}</span>
          </button>
        );
      })}
    </div>
  );

  // O restante do ganho só abre depois da pergunta de assinatura (e do ciclo, quando for assinatura).
  const subscriptionAnswered =
    !subscriptionRequired || isSubscription === false || (isSubscription === true && subscriptionCycle !== null);

  const subscriptionSection = subscriptionRequired ? (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="space-y-2.5">
        {stepHeader(1, "É uma assinatura?", isSubscription !== null)}
        {choiceCards<"yes" | "no">(
          "É uma assinatura?",
          isSubscription === null ? null : isSubscription ? "yes" : "no",
          (next) => {
            const yes = next === "yes";
            setIsSubscription(yes);
            if (!yes) setSubscriptionCycle(null);
          },
          [
            { value: "yes", title: "Sim", hint: "Cobrança que se repete", icon: Repeat },
            { value: "no", title: "Não", hint: "Venda única", icon: Receipt },
          ],
          subscriptionState === null,
        )}
      </div>

      {isSubscription === true && (
        <div className="space-y-2.5 border-t border-border pt-4">
          {stepHeader(2, "Mensal ou anual?", subscriptionCycle !== null)}
          {choiceCards<SubscriptionCycle>(
            "É uma assinatura mensal ou anual?",
            subscriptionCycle,
            (next) => applyCycle(next),
            [
              { value: "monthly", title: "Mensal", hint: "Cartão recorrência", icon: CalendarDays },
              { value: "annual", title: "Anual", hint: "Pix ou Cartão de crédito", icon: CalendarRange },
            ],
          )}
        </div>
      )}

      {subscriptionActive && subscriptionCycle && paymentMethodField && (
        <div className="space-y-2.5 border-t border-border pt-4">
          {stepHeader(3, "Forma de pagamento", !!paymentMethodValue)}
          {renderField(paymentMethodField, true)}
        </div>
      )}

      {!subscriptionAnswered && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowUp className="h-3.5 w-3.5 shrink-0" />
          {isSubscription === true
            ? "Escolha mensal ou anual para liberar o restante do ganho."
            : "Responda primeiro para liberar o restante do ganho."}
        </p>
      )}
    </div>
  ) : null;

  const gateNote = (tone: "success" | "warning" | "destructive", text: ReactNode) => (
    <p
      className={cn(
        "rounded-lg border p-3 text-xs leading-relaxed text-foreground",
        tone === "success" && "border-success/40 bg-success/10",
        tone === "warning" && "border-warning/40 bg-warning/10",
        tone === "destructive" && "border-destructive/40 bg-destructive/10",
      )}
    >
      {text}
    </p>
  );

  const payGateSection = payGate && subscriptionAnswered ? (
    <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          Pagamento no RykaPay <span className="text-destructive">*</span>
        </p>
        <p className="text-xs text-muted-foreground">
          O ganho do Programa Clínica Ryka só é liberado com o pagamento confirmado no RykaPay.
        </p>
      </div>
      {docFields.map((field) => renderField(field))}
      <Button type="button" variant="outline" className="min-h-11 w-full" onClick={handleVerifyPay} disabled={gateBusy}>
        {gateBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
        {gateBusy ? "Consultando o RykaPay…" : gate.status === "idle" ? "Verificar pagamento no RykaPay" : "Verificar de novo"}
      </Button>
      <div role="status" aria-live="polite">
        {!gateBusy && gate.status === "idle" && payVerifiedKey !== null &&
          gateNote("warning", "Os dados mudaram depois da última consulta. Verifique o pagamento de novo.")}
        {!gateBusy && gate.status === "paid" &&
          gateNote(
            "success",
            <>
              <span className="font-semibold">Pagamento confirmado no RykaPay.</span>{" "}
              {gate.charge.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              {" · 1º pagamento em "}
              {gate.charge.firstPaidDate.split("-").reverse().join("/")}
              {" · Plano "}
              {SUBSCRIPTION_CYCLE_LABEL[gate.cycle]}. Pode seguir com o ganho.
            </>,
          )}
        {!gateBusy && gate.status === "unpaid" &&
          gateNote(
            "warning",
            <>
              <span className="font-semibold">Nenhum pagamento confirmado no RykaPay.</span> O ganho fica bloqueado até a
              cliente concluir o pagamento. Depois que ela pagar, clique em "Verificar de novo".
            </>,
          )}
        {!gateBusy && gate.status === "other_cycle" &&
          gateNote(
            "warning",
            <>
              O RykaPay tem pagamento do plano <span className="font-semibold">{SUBSCRIPTION_CYCLE_LABEL[gate.cycle]}</span>,
              diferente do que foi marcado acima. Ajuste a resposta para liberar o ganho.
            </>,
          )}
        {!gateBusy && gate.status === "needs_document" &&
          gateNote("warning", "Informe o CPF ou CNPJ de quem pagou para consultar o pagamento.")}
        {!gateBusy && gate.status === "needs_product" &&
          gateNote("warning", "Não foi possível identificar o Item da Venda deste negócio. Confira o item e verifique de novo.")}
        {!gateBusy && gate.status === "error" &&
          gateNote("destructive", "Não foi possível consultar o RykaPay agora. Tente verificar de novo em instantes.")}
      </div>
    </div>
  ) : null;

  // Depois da verificação é que o restante do ganho aparece. Sem campo de documento nesta
  // janela, o restante abre para o vendedor informar o CPF/CNPJ nos dados de faturamento.
  const restOpen =
    subscriptionAnswered && (payGateOk || (gate.status === "needs_document" && docFields.length === 0));

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
                <TabsTrigger value="briefing" disabled={!payGateOk}>
                  Briefing para Operação {briefingComplete ? "✓" : "*"}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="fields" className="space-y-6 mt-4">
                {subscriptionSection}
                {payGateSection}
                {restOpen && displayedFields.length > 0 && (
                  <div className="space-y-4">
                    {displayedFields.map((field) => renderField(field))}
                  </div>
                )}

                {restOpen && receivedValueSection}

                {restOpen && showBilling && draftHydrated && (
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
              {payGateSection}
              {restOpen && displayedFields.length > 0 && (
                <div className="space-y-4">
                  {displayedFields.map((field) => renderField(field))}
                </div>
              )}
              {restOpen && receivedValueSection}

              {restOpen && showBilling && draftHydrated && (
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
