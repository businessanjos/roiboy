import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { format, addMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  Save,
  CreditCard,
  FileText,
  Banknote,
  QrCode,
  CheckCircle,
  Receipt,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PayerSelector } from "@/components/financial/payers/PayerSelector";
import { UserCircle2, AlertTriangle } from "lucide-react";

interface InstallmentDetailItem {
  amount?: number | string | null;
  value?: number | string | null;
  due_date?: string | null;
  method?: string | null;
  method_label?: string | null;
}

interface ContractNegotiationTabProps {
  contractId: string;
  contractValue: number;
  clientId: string;
  accountId: string;
  negotiationType: string | null;
  negotiationDescription: string | null;
  paymentMethod: string | null;
  installmentsCount: number | null;
  firstDueDate: string | null;
  installmentsDetail?: InstallmentDetailItem[] | any;
  receivablesGenerated: boolean;
  payerId?: string | null;
  onUpdate: () => void;
}

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX", icon: QrCode },
  { value: "boleto", label: "Boleto", icon: Banknote },
  { value: "cartao", label: "Cartão", icon: CreditCard },
  { value: "cheque", label: "Cheque", icon: FileText },
];

const INSTALLMENT_OPTIONS = [
  { value: 1, label: "À Vista (1x)" },
  { value: 2, label: "2x" },
  { value: 3, label: "3x" },
  { value: 4, label: "4x" },
  { value: 5, label: "5x" },
  { value: 6, label: "6x" },
  { value: 10, label: "10x" },
  { value: 12, label: "12x" },
];

export function ContractNegotiationTab({
  contractId,
  contractValue,
  clientId,
  accountId,
  negotiationType: initialType,
  negotiationDescription: initialDescription,
  paymentMethod: initialMethod,
  installmentsCount: initialInstallments,
  firstDueDate: initialDueDate,
  installmentsDetail: initialDetail,
  receivablesGenerated: initialReceivablesGenerated,
  payerId: initialPayerId,
  onUpdate,
}: ContractNegotiationTabProps) {
  const salesBreakdown: InstallmentDetailItem[] = Array.isArray(initialDetail)
    ? (initialDetail as InstallmentDetailItem[]).filter((d) => d && (d.amount != null || d.value != null))
    : [];
  const hasSalesBreakdown = salesBreakdown.length > 0;
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  // Detectar tipo automaticamente: se tem descrição mas não tem tipo, é custom
  const [negotiationType, setNegotiationType] = useState(() => {
    if (initialType) return initialType;
    if (initialDescription) return "custom";
    return "standard";
  });
  const [description, setDescription] = useState(initialDescription || "");
  const [paymentMethod, setPaymentMethod] = useState(initialMethod || (hasSalesBreakdown ? salesBreakdown[0]?.method || "" : ""));
  const [installments, setInstallments] = useState(
    initialInstallments || (hasSalesBreakdown ? salesBreakdown.length : 1)
  );
  const [firstDueDate, setFirstDueDate] = useState(
    initialDueDate || (hasSalesBreakdown ? salesBreakdown[0]?.due_date : null) || format(new Date(), "yyyy-MM-dd")
  );
  const [receivablesGenerated, setReceivablesGenerated] = useState(initialReceivablesGenerated);
  const [payerId, setPayerId] = useState<string | null>(initialPayerId ?? null);
  const [savingPayer, setSavingPayer] = useState(false);

  useEffect(() => { setPayerId(initialPayerId ?? null); }, [initialPayerId]);

  const handlePayerChange = async (newPayerId: string | null) => {
    setPayerId(newPayerId);
    setSavingPayer(true);
    try {
      const { error } = await supabase
        .from("client_contracts")
        .update({ payer_id: newPayerId })
        .eq("id", contractId);
      if (error) throw error;
      toast.success("Pagador atualizado no contrato");
      onUpdate();
    } catch (e: any) {
      console.error("Error updating payer:", e);
      toast.error(e?.message || "Erro ao salvar pagador");
    } finally {
      setSavingPayer(false);
    }
  };



  // Editable installments detail (source of truth for what's saved / generated)
  type EditableInstallment = { amount: number; due_date: string; method: string };
  const buildDetail = (
    count: number,
    startDate: string,
    method: string,
    total: number
  ): EditableInstallment[] => {
    const safeCount = Math.max(1, Math.floor(count || 1));
    const base = Math.floor((total / safeCount) * 100) / 100;
    const remainder = Math.round((total - base * safeCount) * 100) / 100;
    const startD = startDate ? parseISO(startDate) : new Date();
    return Array.from({ length: safeCount }).map((_, i) => ({
      amount: i === 0 ? Math.round((base + remainder) * 100) / 100 : base,
      due_date: format(addMonths(startD, i), "yyyy-MM-dd"),
      method: method || "pix",
    }));
  };

  const initialEditable: EditableInstallment[] = hasSalesBreakdown
    ? salesBreakdown.map((d, i) => ({
        amount: Number(d.amount ?? d.value ?? 0),
        due_date:
          d.due_date ||
          format(addMonths(parseISO(initialDueDate || format(new Date(), "yyyy-MM-dd")), i), "yyyy-MM-dd"),
        method: d.method || initialMethod || "pix",
      }))
    : buildDetail(
        initialInstallments || 1,
        initialDueDate || format(new Date(), "yyyy-MM-dd"),
        initialMethod || "pix",
        contractValue
      );

  const [detail, setDetail] = useState<EditableInstallment[]>(initialEditable);
  const [detailDirty, setDetailDirty] = useState<boolean>(hasSalesBreakdown);

  // Ref to prevent duplicate generation during re-renders
  const generatedRef = useRef(initialReceivablesGenerated);

  // Sync ref with prop when component receives new data
  useEffect(() => {
    generatedRef.current = initialReceivablesGenerated;
  }, [initialReceivablesGenerated]);

  useEffect(() => {
    // Detectar tipo automaticamente baseado nos dados existentes
    let effectiveType = initialType;
    if (!effectiveType && initialDescription) {
      effectiveType = "custom";
    }
    setNegotiationType(effectiveType || "standard");
    setDescription(initialDescription || "");
    setPaymentMethod(initialMethod || "");
    setInstallments(initialInstallments || 1);
    setFirstDueDate(initialDueDate || format(new Date(), "yyyy-MM-dd"));
    setReceivablesGenerated(initialReceivablesGenerated);
  }, [initialType, initialDescription, initialMethod, initialInstallments, initialDueDate, initialReceivablesGenerated]);

  // Auto-recalculate detail when inputs change, unless the user has manually edited
  useEffect(() => {
    if (detailDirty) return;
    setDetail(buildDetail(installments, firstDueDate, paymentMethod, contractValue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installments, firstDueDate, paymentMethod, contractValue]);

  const detailTotal = useMemo(
    () => Math.round(detail.reduce((s, d) => s + (Number(d.amount) || 0), 0) * 100) / 100,
    [detail]
  );
  const detailBalanced = Math.abs(detailTotal - contractValue) < 0.01;

  const updateInstallmentAt = (idx: number, patch: Partial<EditableInstallment>) => {
    setDetailDirty(true);
    setDetail((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const addInstallment = () => {
    setDetailDirty(true);
    setDetail((prev) => {
      const last = prev[prev.length - 1];
      const nextDate = last
        ? format(addMonths(parseISO(last.due_date), 1), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd");
      return [
        ...prev,
        { amount: 0, due_date: nextDate, method: paymentMethod || "pix" },
      ];
    });
    setInstallments((n) => n + 1);
  };

  const removeInstallmentAt = (idx: number) => {
    if (detail.length <= 1) return;
    setDetailDirty(true);
    setDetail((prev) => prev.filter((_, i) => i !== idx));
    setInstallments((n) => Math.max(1, n - 1));
  };

  const distributeEqually = () => {
    setDetailDirty(false);
    setDetail(buildDetail(installments, firstDueDate, paymentMethod || "pix", contractValue));
  };

  const distributeRemainder = () => {
    setDetailDirty(true);
    setDetail((prev) => {
      if (prev.length === 0) return prev;
      const lockedSum = prev.slice(1).reduce((s, d) => s + (Number(d.amount) || 0), 0);
      const firstAmount = Math.round((contractValue - lockedSum) * 100) / 100;
      return prev.map((d, i) => (i === 0 ? { ...d, amount: firstAmount } : d));
    });
  };

  const installmentValue = contractValue / installments;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: Record<string, any> = {
        negotiation_type: negotiationType,
        updated_at: new Date().toISOString(),
      };

      if (negotiationType === "custom") {
        updateData.negotiation_description = description;
        updateData.payment_method = null;
        updateData.installments_count = null;
        updateData.first_due_date = null;
      } else {
        updateData.negotiation_description = null;
        updateData.payment_method = paymentMethod;
        updateData.installments_count = detail.length || installments;
        updateData.first_due_date = detail[0]?.due_date || firstDueDate;
        updateData.installments_detail = detail.map((d, i) => ({
          number: i + 1,
          amount: Number(d.amount) || 0,
          due_date: d.due_date,
          method: d.method,
        }));
      }

      const { error } = await supabase
        .from("client_contracts")
        .update(updateData)
        .eq("id", contractId);

      if (error) throw error;
      toast.success("Negociação salva com sucesso");
      onUpdate();
    } catch (error) {
      console.error("Error saving negotiation:", error);
      toast.error("Erro ao salvar negociação");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateReceivables = async () => {
    // Triple-check to prevent duplicate generation
    if (generating || receivablesGenerated || generatedRef.current) {
      console.warn("Generation blocked: already in progress or completed");
      return;
    }

    if (!paymentMethod) {
      toast.error("Selecione uma forma de pagamento");
      return;
    }

    if (!payerId) {
      toast.error("Revise o pagador (CPF/CNPJ) antes de gerar as parcelas.");
      return;
    }


    // Mark immediately BEFORE any async operation
    generatedRef.current = true;
    setGenerating(true);

    try {
      // 1) Persist the negotiation on the contract using the editable installments detail.
      if (!detailBalanced) {
        toast.error(
          `O detalhamento (${formatCurrency(detailTotal)}) precisa somar exatamente o valor do contrato (${formatCurrency(contractValue)}).`
        );
        generatedRef.current = false;
        setGenerating(false);
        return;
      }
      const updatePayload: Record<string, any> = {
        payment_method: paymentMethod,
        installments_count: detail.length || installments,
        first_due_date: detail[0]?.due_date || firstDueDate,
        negotiation_type: negotiationType,
        installments_detail: detail.map((d, i) => ({
          number: i + 1,
          amount: Number(d.amount) || 0,
          due_date: d.due_date,
          method: d.method,
        })),
      };

      const { error: prepError } = await supabase
        .from("client_contracts")
        .update(updatePayload)
        .eq("id", contractId);

      if (prepError) {
        generatedRef.current = false;
        throw prepError;
      }

      // 2) Flip the flag — the DB trigger `contract_generate_receivables` will
      //    create the entries in financial_entries + installments/invoices,
      //    honoring installments_detail (including the sales-team breakdown) and
      //    assigning a fallback income category so RLS/validation triggers pass.
      const { error: flagError } = await supabase
        .from("client_contracts")
        .update({
          receivables_generated: true,
          receivables_generated_at: new Date().toISOString(),
        })
        .eq("id", contractId);

      if (flagError) {
        generatedRef.current = false;
        throw flagError;
      }

      setReceivablesGenerated(true);
      toast.success(`${installments} parcela(s) gerada(s) no contas a receber`);
      onUpdate();
    } catch (error: any) {
      console.error("Error generating receivables:", error);
      const msg =
        error?.message ||
        error?.error_description ||
        "Erro ao gerar parcelas";
      toast.error(msg);
      generatedRef.current = false;
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateReceivables = async () => {
    if (generating) return;
    if (!detailBalanced) {
      toast.error(
        `O detalhamento (${formatCurrency(detailTotal)}) precisa somar exatamente o valor do contrato (${formatCurrency(contractValue)}).`
      );
      return;
    }
    if (!window.confirm(
      "Isso vai apagar as parcelas em aberto deste contrato no financeiro e recriar conforme o detalhamento atual. Parcelas já pagas serão preservadas (a operação será bloqueada se houver alguma). Deseja continuar?"
    )) {
      return;
    }
    setGenerating(true);
    try {
      // 1) Persist the current editable detail on the contract before regenerating
      const { error: upErr } = await supabase
        .from("client_contracts")
        .update({
          payment_method: paymentMethod,
          installments_count: detail.length,
          first_due_date: detail[0]?.due_date || firstDueDate,
          installments_detail: detail.map((d, i) => ({
            number: i + 1,
            amount: Number(d.amount) || 0,
            due_date: d.due_date,
            method: d.method,
          })),
        })
        .eq("id", contractId);
      if (upErr) throw upErr;

      // 2) Call the DB function that clears open entries and re-triggers the generator
      const { data, error } = await supabase.rpc("regenerate_contract_receivables", {
        _contract_id: contractId,
      });
      if (error) throw error;

      toast.success(`${data ?? detail.length} parcela(s) recriada(s) no financeiro`);
      onUpdate();
    } catch (error: any) {
      console.error("Error regenerating receivables:", error);
      toast.error(error?.message || "Erro ao refazer parcelas");
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Negotiation Type */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Tipo de Negociação</Label>
        <RadioGroup
          value={negotiationType}
          onValueChange={setNegotiationType}
          className="grid grid-cols-2 gap-3"
        >
          <div>
            <RadioGroupItem value="standard" id="standard" className="peer sr-only" />
            <Label
              htmlFor="standard"
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors",
                negotiationType === "standard" && "border-primary bg-primary/5"
              )}
            >
              <Receipt className="mb-2 h-6 w-6" />
              <span className="font-medium">Padrão</span>
              <span className="text-xs text-muted-foreground text-center mt-1">
                Parcelas automáticas
              </span>
            </Label>
          </div>
          <div>
            <RadioGroupItem value="custom" id="custom" className="peer sr-only" />
            <Label
              htmlFor="custom"
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors",
                negotiationType === "custom" && "border-primary bg-primary/5"
              )}
            >
              <FileText className="mb-2 h-6 w-6" />
              <span className="font-medium">Personalizada</span>
              <span className="text-xs text-muted-foreground text-center mt-1">
                Descrição livre
              </span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Custom Negotiation */}
      {negotiationType === "custom" && (
        <div className="space-y-3">
          <Label>Descrição da Negociação</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva os termos da negociação personalizada..."
            rows={4}
          />
        </div>
      )}

      {/* Mostrar descrição existente mesmo em modo standard */}
      {negotiationType === "standard" && description && (
        <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
          <Label className="text-sm font-medium">Observações da Negociação</Label>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{description}</p>
        </div>
      )}

      {/* Standard Negotiation */}
      {negotiationType === "standard" && (
        <div className="space-y-4">
          {/* Payment Method */}
          <div className="space-y-3">
            <Label>Forma de Pagamento</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                return (
                  <Button
                    key={method.value}
                    type="button"
                    variant={paymentMethod === method.value ? "default" : "outline"}
                    className="h-auto py-3 justify-start gap-2"
                    onClick={() => setPaymentMethod(method.value)}
                  >
                    <Icon className="h-4 w-4" />
                    {method.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Installments */}
          <div className="space-y-3">
            <Label>Número de Parcelas</Label>
            <Select
              value={String(installments)}
              onValueChange={(v) => setInstallments(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTALLMENT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* First Due Date */}
          <div className="space-y-3">
            <Label>Data do 1º Vencimento</Label>
            <Input
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
            />
          </div>

          {/* Summary Card */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor total do contrato:</span>
                  <span className="font-medium">{formatCurrency(contractValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parcelas:</span>
                  <span className="font-medium">{detail.length}x</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Soma do detalhamento:</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      detailBalanced ? "text-primary" : "text-destructive"
                    )}
                  >
                    {formatCurrency(detailTotal)}
                    {!detailBalanced && (
                      <span className="ml-2 text-xs font-normal">
                        (diferença {formatCurrency(detailTotal - contractValue)})
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Editable Installments Detail */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-base font-medium">Detalhamento das Parcelas</Label>
                {hasSalesBreakdown && (
                  <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                    Vindo do comercial
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={distributeRemainder}
                  className="h-8 text-xs"
                  title="Ajusta a 1ª parcela para fechar com o total do contrato"
                >
                  Ajustar diferença
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={distributeEqually}
                  className="h-8 text-xs"
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  Recalcular
                </Button>
              </div>
            </div>

            <div className="rounded-md border bg-background divide-y">
              <div className="grid grid-cols-[32px_1fr_140px_140px_32px] gap-2 px-3 py-2 text-[11px] text-muted-foreground uppercase tracking-wide bg-muted/40">
                <div>#</div>
                <div>Valor</div>
                <div>Vencimento</div>
                <div>Forma</div>
                <div></div>
              </div>
              {detail.map((d, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[32px_1fr_140px_140px_32px] gap-2 px-3 py-2 items-center"
                >
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {idx + 1}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={d.amount}
                    onChange={(e) =>
                      updateInstallmentAt(idx, {
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-8 text-sm"
                  />
                  <Input
                    type="date"
                    value={d.due_date}
                    onChange={(e) =>
                      updateInstallmentAt(idx, { due_date: e.target.value })
                    }
                    className="h-8 text-sm"
                  />
                  <Select
                    value={d.method || "pix"}
                    onValueChange={(v) => updateInstallmentAt(idx, { method: v })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeInstallmentAt(idx)}
                    disabled={detail.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addInstallment}
              className="w-full"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Adicionar parcela
            </Button>

            <p className="text-xs text-muted-foreground">
              Alterando o nº de parcelas, a data do 1º vencimento ou a forma padrão acima, o detalhamento é recalculado automaticamente. Ao editar diretamente uma parcela, os valores passam a ser manuais — use "Recalcular" para redistribuir igualmente.
            </p>
          </div>


          {/* Payer (CPF/CNPJ) — obrigatório revisar antes de gerar */}
          <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <UserCircle2 className="h-4 w-4 text-primary" />
              <Label className="text-base font-medium">Pagador (CPF/CNPJ)</Label>
              {receivablesGenerated && (
                <Badge variant="outline" className="text-[10px]">Travado após geração</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              O pagador definido aqui vai para a invoice, parcelas e futura NF-e. Se estiver vazio, use "Usar dados do cliente" ou cadastre um novo.
            </p>
            <PayerSelector
              value={payerId}
              onChange={handlePayerChange}
              clientId={clientId}
              disabled={savingPayer || receivablesGenerated}
            />
            {!payerId && !receivablesGenerated && (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                Selecione ou crie o pagador antes de gerar as parcelas.
              </div>
            )}
          </div>

          {/* Generate / Regenerate Receivables Button */}
          {receivablesGenerated ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Parcelas já geradas no financeiro</span>
              </div>
              <Button
                onClick={handleRegenerateReceivables}
                disabled={generating || !detailBalanced}
                variant="outline"
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Refazendo parcelas...
                  </>
                ) : (
                  <>
                    <Receipt className="h-4 w-4 mr-2" />
                    Refazer {detail.length} parcela(s) no Financeiro
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Refazer apaga apenas parcelas em aberto e recria conforme o detalhamento acima. Parcelas já pagas bloqueiam a operação.
              </p>
            </div>
          ) : (
            <Button
              onClick={handleGenerateReceivables}
              disabled={generating || !paymentMethod || !detailBalanced}
              className="w-full"
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando parcelas...
                </>
              ) : (
                <>
                  <Receipt className="h-4 w-4 mr-2" />
                  Gerar {detail.length} Parcela(s) no Financeiro
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Negociação
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
