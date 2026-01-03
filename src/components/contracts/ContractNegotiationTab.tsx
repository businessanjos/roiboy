import { useState, useEffect } from "react";
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
import { format, addMonths } from "date-fns";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  receivablesGenerated: initialReceivablesGenerated,
  onUpdate,
}: ContractNegotiationTabProps) {
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [negotiationType, setNegotiationType] = useState(initialType || "standard");
  const [description, setDescription] = useState(initialDescription || "");
  const [paymentMethod, setPaymentMethod] = useState(initialMethod || "");
  const [installments, setInstallments] = useState(initialInstallments || 1);
  const [firstDueDate, setFirstDueDate] = useState(
    initialDueDate || format(new Date(), "yyyy-MM-dd")
  );
  const [receivablesGenerated, setReceivablesGenerated] = useState(initialReceivablesGenerated);

  useEffect(() => {
    setNegotiationType(initialType || "standard");
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
    if (!paymentMethod) {
      toast.error("Selecione uma forma de pagamento");
      return;
    }

    setGenerating(true);
    try {
      const entries = [];
      const baseDate = new Date(firstDueDate);

      for (let i = 0; i < installments; i++) {
        const dueDate = addMonths(baseDate, i);
        entries.push({
          account_id: accountId,
          client_id: clientId,
          contract_id: contractId,
          entry_type: "receivable",
          description: `Parcela ${i + 1}/${installments} - Contrato`,
          amount: Math.round(installmentValue * 100) / 100,
          due_date: format(dueDate, "yyyy-MM-dd"),
          status: "pending",
          is_recurring: false,
          is_conciliated: false,
          currency: "BRL",
        });
      }

      const { error: entriesError } = await supabase
        .from("financial_entries")
        .insert(entries);

      if (entriesError) throw entriesError;

      // Mark receivables as generated
      const { error: updateError } = await supabase
        .from("client_contracts")
        .update({
          receivables_generated: true,
          receivables_generated_at: new Date().toISOString(),
          payment_method: paymentMethod,
          installments_count: installments,
          first_due_date: firstDueDate,
        })
        .eq("id", contractId);

      if (updateError) throw updateError;

      setReceivablesGenerated(true);
      toast.success(`${installments} parcela(s) gerada(s) no contas a receber`);
      onUpdate();
    } catch (error) {
      console.error("Error generating receivables:", error);
      toast.error("Erro ao gerar parcelas");
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
