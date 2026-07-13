import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMonths, parseISO } from "date-fns";
import { AlertTriangle, RefreshCw, Ban, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatBRLPrecise } from "@/lib/financial-format";

const METHODS = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão de crédito" },
  { value: "cartao_recorrencia", label: "Cartão recorrência" },
  { value: "cheque", label: "Cheque" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
];

const CANCEL_REASONS = [
  "Inadimplência",
  "Cliente desistiu / cancelou",
  "Problemas financeiros do cliente",
  "Sem contato / cliente sumiu",
  "Outro",
];

type NewItem = { due_date: string; amount: string; payment_method: string };

interface Target {
  contract_id: string;
  client_id: string;
  client_name: string;
  product_name: string | null;
  total_value: number;
  total_received: number;
}

export function CancelDelinquentDialog({
  target,
  open,
  onOpenChange,
  onDone,
}: {
  target: Target | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone?: () => void;
}) {
  const [mode, setMode] = useState<"cancel" | "renegotiate">("cancel");
  const [reason, setReason] = useState<string>("Inadimplência");
  const [reasonOther, setReasonOther] = useState("");
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);

  // renegotiation fields
  const [method, setMethod] = useState("pix");
  const [downPayment, setDownPayment] = useState("0");
  const [downPaymentDate, setDownPaymentDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [count, setCount] = useState(3);
  const [firstDueDate, setFirstDueDate] = useState<string>(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
  const [items, setItems] = useState<NewItem[]>([]);

  const { data: pending, isLoading } = useQuery({
    enabled: open && !!target?.contract_id,
    queryKey: ["cancel-delinquent-entries", target?.contract_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("id, description, amount, due_date, status, account_id, company_id, cost_center_id, category_id, bank_account_id, currency, notes")
        .eq("contract_id", target!.contract_id)
        .eq("entry_type", "receivable")
        .in("status", ["pending", "overdue", "partially_paid"])
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const entriesTotal = useMemo(
    () => (pending || []).reduce((s, e: any) => s + (Number(e.amount) || 0), 0),
    [pending]
  );
  const hasEntries = (pending || []).length > 0;
  // Fallback: if no receivables were generated yet, use contract value minus what was received.
  const totalOwed = hasEntries
    ? entriesTotal
    : Math.max(0, (target?.total_value ?? 0) - (target?.total_received ?? 0));
  const overdueCount = useMemo(
    () => (pending || []).filter((e: any) => e.status === "overdue").length,
    [pending]
  );

  const regenerate = (n: number, first: string, m: string, base: number, down: number) => {
    const remaining = Math.max(0, base - down);
    const each = n > 0 ? +(remaining / n).toFixed(2) : 0;
    const last = n > 0 ? +(remaining - each * (n - 1)).toFixed(2) : 0;
    const arr: NewItem[] = [];
    const firstDate = first ? parseISO(first) : new Date();
    for (let i = 0; i < n; i++) {
      arr.push({
        due_date: format(addMonths(firstDate, i), "yyyy-MM-dd"),
        amount: String(i === n - 1 ? last : each),
        payment_method: m,
      });
    }
    setItems(arr);
    setCount(n);
  };

  useEffect(() => {
    if (!open) return;
    setMode("cancel");
    setReason("Inadimplência");
    setReasonOther("");
    setJustification("");
    setMethod("pix");
    setDownPayment("0");
    setDownPaymentDate(format(new Date(), "yyyy-MM-dd"));
    setCount(3);
    setFirstDueDate(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
    setItems([]);
  }, [open, target?.contract_id]);

  useEffect(() => {
    if (mode === "renegotiate" && totalOwed > 0 && items.length === 0) {
      regenerate(3, firstDueDate, method, totalOwed, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, totalOwed]);

  const totalItems = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const totalRenegotiated = totalItems + (Number(downPayment) || 0);

  const finalReason = reason === "Outro" ? `Outro: ${reasonOther.trim()}` : reason;

  const handleConfirm = async () => {
    if (!target) return;
    if (!justification.trim() || justification.trim().length < 5) {
      toast.error("Justificativa é obrigatória (mínimo 5 caracteres)");
      return;
    }
    if (reason === "Outro" && !reasonOther.trim()) {
      toast.error("Descreva o motivo");
      return;
    }

    setSaving(true);
    try {
      const stamp = format(new Date(), "dd/MM/yyyy HH:mm");
      const pendingIds = (pending || []).map((e: any) => e.id);

      if (mode === "renegotiate") {
        if (items.length === 0 && (Number(downPayment) || 0) <= 0) {
          throw new Error("Adicione ao menos uma parcela ou entrada");
        }
        // 1) cancel existing pending receivables
        if (pendingIds.length) {
          const note = `\n[Renegociado em ${stamp}] Motivo: ${finalReason}. ${justification.trim()}`;
          for (const e of pending as any[]) {
            await supabase
              .from("financial_entries")
              .update({
                status: "cancelled",
                notes: (e.notes ?? "") + note,
              })
              .eq("id", e.id);
          }
        }
        // 2) create new receivables using template from the first pending entry
        const template: any = (pending || [])[0];
        if (!template) throw new Error("Não há parcelas a renegociar");
        const baseNew: Record<string, any> = {
          account_id: template.account_id,
          company_id: template.company_id,
          cost_center_id: template.cost_center_id,
          category_id: template.category_id,
          bank_account_id: template.bank_account_id,
          client_id: target.client_id,
          contract_id: target.contract_id,
          currency: template.currency ?? "BRL",
          entry_type: "receivable",
          status: "pending",
          source: "renegotiation",
        };
        const totalParts = items.length + ((Number(downPayment) || 0) > 0 ? 1 : 0);
        const header = `Renegociação do contrato ${target.contract_id}. Motivo: ${finalReason}. ${justification.trim()}`;
        const rows: any[] = [];
        if ((Number(downPayment) || 0) > 0) {
          rows.push({
            ...baseNew,
            description: `${target.product_name ?? "Contrato"} — Entrada renegociação (1/${totalParts})`,
            amount: Number(downPayment),
            due_date: downPaymentDate,
            notes: `${header}\nForma: ${method}`,
          });
        }
        items.forEach((it, i) => {
          const idx = i + 1 + ((Number(downPayment) || 0) > 0 ? 1 : 0);
          rows.push({
            ...baseNew,
            description: `${target.product_name ?? "Contrato"} — Parcela renegociada (${idx}/${totalParts})`,
            amount: Number(it.amount) || 0,
            due_date: it.due_date,
            notes: `${header}\nForma: ${it.payment_method}`,
          });
        });
        if (rows.length) {
          const { error } = await supabase.from("financial_entries").insert(rows);
          if (error) throw error;
        }
        toast.success(`Renegociação registrada em ${rows.length} lançamento(s). Contrato mantido ativo.`);
      } else {
        // CANCEL mode: mark contract cancelled + write-off pending receivables
        const { error: cErr } = await supabase
          .from("client_contracts")
          .update({
            status: "cancelled",
            cancellation_reason: finalReason,
            cancellation_justification: justification.trim(),
            cancelled_at: new Date().toISOString(),
          })
          .eq("id", target.contract_id);
        if (cErr) throw cErr;

        if (pendingIds.length) {
          const note = `\n[Contrato cancelado em ${stamp}] Motivo: ${finalReason}. ${justification.trim()}`;
          for (const e of pending as any[]) {
            await supabase
              .from("financial_entries")
              .update({
                status: "cancelled",
                notes: (e.notes ?? "") + note,
              })
              .eq("id", e.id);
          }
        }
        toast.success(`Contrato cancelado. ${pendingIds.length} parcela(s) em aberto quitadas por baixa.`);
      }

      onDone?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  if (!target) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Cancelar por inadimplência
          </DialogTitle>
          <DialogDescription>
            {target.client_name}
            {target.product_name && ` · ${target.product_name}`}
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Valor total do contrato</span>
            <span className="font-medium tabular-nums">{formatBRLPrecise(target.total_value)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Já recebido</span>
            <span className="font-medium tabular-nums text-emerald-700">
              {formatBRLPrecise(target.total_received)}
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              Total devido em aberto
              {overdueCount > 0 && (
                <Badge variant="destructive" className="h-5">{overdueCount} vencida(s)</Badge>
              )}
            </span>
            <span className="text-lg font-bold tabular-nums text-red-600">
              {isLoading ? "..." : formatBRLPrecise(totalOwed)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {hasEntries
              ? `${(pending || []).length} parcela(s) pendente(s)/vencida(s)`
              : "Nenhuma parcela lançada no financeiro — usando valor do contrato menos o recebido."}
          </div>
        </div>

        {/* Mode switch */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("cancel")}
            className={`rounded-lg border p-3 text-left transition-colors ${
              mode === "cancel" ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-sm">
              <Ban className="h-4 w-4 text-red-600" /> Cancelar contrato
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Marca o contrato como Cancelado e dá baixa (write-off) nas parcelas em aberto.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode("renegotiate")}
            className={`rounded-lg border p-3 text-left transition-colors ${
              mode === "renegotiate" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-sm">
              <RefreshCw className="h-4 w-4 text-primary" /> Renegociar
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Substitui as parcelas em aberto por um novo plano. Contrato segue ativo.
            </p>
          </button>
        </div>

        {/* Reason + justification (always required) */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Motivo *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANCEL_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {reason === "Outro" && (
              <div>
                <Label>Descreva o motivo *</Label>
                <Input value={reasonOther} onChange={(e) => setReasonOther(e.target.value)} />
              </div>
            )}
          </div>
          <div>
            <Label>Justificativa *</Label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Ex.: 3 tentativas de contato sem retorno, última cobrança em ..."
              rows={2}
            />
          </div>
        </div>

        {/* Renegotiation plan */}
        {mode === "renegotiate" && (
          <div className="space-y-3 border-t pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Forma de pagamento</Label>
                <Select
                  value={method}
                  onValueChange={(m) => {
                    setMethod(m);
                    setItems((prev) => prev.map((it) => ({ ...it, payment_method: m })));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nº de parcelas</Label>
                <Select
                  value={String(count)}
                  onValueChange={(v) =>
                    regenerate(Number(v), firstDueDate, method, totalOwed, Number(downPayment) || 0)
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Entrada (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={downPayment}
                  onChange={(e) => {
                    setDownPayment(e.target.value);
                    regenerate(count, firstDueDate, method, totalOwed, Number(e.target.value) || 0);
                  }}
                />
              </div>
              <div>
                <Label>Data da entrada</Label>
                <Input
                  type="date"
                  value={downPaymentDate}
                  onChange={(e) => setDownPaymentDate(e.target.value)}
                  disabled={(Number(downPayment) || 0) <= 0}
                />
              </div>
              <div>
                <Label>1ª parcela em</Label>
                <Input
                  type="date"
                  value={firstDueDate}
                  onChange={(e) => {
                    setFirstDueDate(e.target.value);
                    regenerate(count, e.target.value, method, totalOwed, Number(downPayment) || 0);
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Label className="mr-auto">Parcelas ({items.length})</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const lastDate = items.length
                    ? parseISO(items[items.length - 1].due_date)
                    : new Date();
                  setItems((prev) => [
                    ...prev,
                    { due_date: format(addMonths(lastDate, 1), "yyyy-MM-dd"), amount: "0", payment_method: method },
                  ]);
                  setCount(items.length + 1);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                  <Input
                    type="date"
                    value={it.due_date}
                    onChange={(e) =>
                      setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, due_date: e.target.value } : x)))
                    }
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={it.amount}
                    onChange={(e) =>
                      setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, amount: e.target.value } : x)))
                    }
                  />
                  <Select
                    value={it.payment_method}
                    onValueChange={(v) =>
                      setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, payment_method: v } : x)))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setItems((prev) => prev.filter((_, idx) => idx !== i));
                      setCount(items.length - 1);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">Total renegociado (entrada + parcelas)</span>
              <span className="font-semibold tabular-nums">{formatBRLPrecise(totalRenegotiated)}</span>
            </div>
            {Math.abs(totalRenegotiated - totalOwed) > 0.01 && (
              <p className="text-xs text-amber-600">
                Atenção: total difere do valor devido em aberto ({formatBRLPrecise(totalOwed)}).
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Voltar
          </Button>
          <Button
            variant={mode === "cancel" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving
              ? "Processando…"
              : mode === "cancel"
                ? "Cancelar contrato"
                : "Confirmar renegociação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CancelDelinquentDialog;
