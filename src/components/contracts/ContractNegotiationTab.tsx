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
        updateData.installments_count = installments;
        updateData.first_due_date = firstDueDate;
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

    // Mark immediately BEFORE any async operation
    generatedRef.current = true;
    setGenerating(true);

    try {
      // 1) Persist the negotiation on the contract. Only overwrite installments_detail
      //    if the sales team didn't already provide a breakdown (respect the sales input).
      const updatePayload: Record<string, any> = {
        payment_method: paymentMethod,
        installments_count: installments,
        first_due_date: firstDueDate,
        negotiation_type: negotiationType,
      };
      if (!hasSalesBreakdown) {
        // Build a simple uniform breakdown so the DB generator has explicit due dates.
        const base = new Date(firstDueDate);
        const per = Math.round((contractValue / installments) * 100) / 100;
        updatePayload.installments_detail = Array.from({ length: installments }).map((_, i) => ({
          amount: per,
          due_date: format(addMonths(base, i), "yyyy-MM-dd"),
          method: paymentMethod,
        }));
      }

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
                  <span className="text-muted-foreground">Valor total:</span>
                  <span className="font-medium">{formatCurrency(contractValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parcelas:</span>
                  <span className="font-medium">{installments}x</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Valor por parcela:</span>
                  <span className="font-semibold text-primary">
                    {formatCurrency(installmentValue)}
                  </span>
                </div>
                {firstDueDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">1º vencimento:</span>
                    <span className="font-medium">
                      {format(new Date(firstDueDate), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detalhamento vindo do comercial (PaymentBreakdownComposer) */}
          {hasSalesBreakdown && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    Detalhamento do comercial
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {salesBreakdown.length} parcela(s) já preenchidas na negociação
                  </span>
                </div>
                <div className="rounded-md border bg-background divide-y">
                  {salesBreakdown.map((d, i) => {
                    const amount = Number(d.amount ?? d.value ?? 0);
                    return (
                      <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-6 tabular-nums">#{i + 1}</span>
                          {d.method_label || d.method ? (
                            <Badge variant="outline" className="text-[10px] py-0 h-4">
                              {d.method_label || d.method}
                            </Badge>
                          ) : null}
                          <span className="text-muted-foreground text-xs">
                            {d.due_date
                              ? format(new Date(d.due_date), "dd/MM/yyyy", { locale: ptBR })
                              : "sem data"}
                          </span>
                        </div>
                        <span className="font-medium tabular-nums">{formatCurrency(amount)}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ao gerar, o financeiro respeita este detalhamento (valores e datas por parcela).
                </p>
              </CardContent>
            </Card>
          )}

          {/* Generate Receivables Button */}
          {receivablesGenerated ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Parcelas já geradas no financeiro</span>
            </div>
          ) : (
            <Button
              onClick={handleGenerateReceivables}
              disabled={generating || !paymentMethod}
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
                  Gerar {installments} Parcela(s) no Financeiro
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
