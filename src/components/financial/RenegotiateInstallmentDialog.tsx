import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";
import { Plus, Trash2, RefreshCw } from "lucide-react";
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

type NewInstallment = { due_date: string; amount: string; payment_method: string };

const METHODS = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "cheque", label: "Cheque" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
];

export function RenegotiateInstallmentDialog({
  installmentId,
  open,
  onOpenChange,
  onRenegotiated,
}: {
  installmentId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRenegotiated?: () => void;
}) {
  const [original, setOriginal] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [count, setCount] = useState(2);
  const [items, setItems] = useState<NewInstallment[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !installmentId) return;
    (async () => {
      const { data } = await supabase
        .from("installments")
        .select("id, number, due_date, amount, payment_method, status")
        .eq("id", installmentId)
        .maybeSingle();
      setOriginal(data);
      if (data) {
        const base = Number(data.amount) || 0;
        const split = +(base / 2).toFixed(2);
        setItems([
          { due_date: format(addMonths(new Date(), 1), "yyyy-MM-dd"), amount: String(split), payment_method: data.payment_method ?? "pix" },
          { due_date: format(addMonths(new Date(), 2), "yyyy-MM-dd"), amount: String(base - split), payment_method: data.payment_method ?? "pix" },
        ]);
        setCount(2);
      }
      setReason("");
    })();
  }, [open, installmentId]);

  const regenerate = (n: number) => {
    if (!original) return;
    const base = Number(original.amount) || 0;
    const each = +(base / n).toFixed(2);
    const last = +(base - each * (n - 1)).toFixed(2);
    const arr: NewInstallment[] = [];
    for (let i = 0; i < n; i++) {
      arr.push({
        due_date: format(addMonths(new Date(), i + 1), "yyyy-MM-dd"),
        amount: String(i === n - 1 ? last : each),
        payment_method: original.payment_method ?? "pix",
      });
    }
    setItems(arr);
    setCount(n);
  };

  const updateItem = (i: number, patch: Partial<NewInstallment>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  const addItem = () => {
    const lastDate = items.length ? new Date(items[items.length - 1].due_date) : new Date();
    setItems((prev) => [
      ...prev,
      { due_date: format(addMonths(lastDate, 1), "yyyy-MM-dd"), amount: "0", payment_method: original?.payment_method ?? "pix" },
    ]);
    setCount(items.length + 1);
  };

  const removeItem = (i: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
    setCount(items.length - 1);
  };

  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  const handleSubmit = async () => {
    if (!installmentId) return;
    if (!reason.trim()) {
      toast.error("Informe o motivo da renegociação");
      return;
    }
    if (items.length === 0) {
      toast.error("Adicione ao menos uma nova parcela");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("renegotiate_installment", {
      p_installment_id: installmentId,
      p_reason: reason.trim(),
      p_new_installments: items.map((it) => ({
        due_date: it.due_date,
        amount: Number(it.amount),
        payment_method: it.payment_method,
      })),
    });
    setSaving(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success(`Parcela renegociada em ${items.length} novas parcelas`);
    onRenegotiated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Renegociar parcela
          </DialogTitle>
          <DialogDescription>
            A parcela original será marcada como <strong>Renegociada</strong> (não é apagada). Um novo
            borderô será criado com as parcelas abaixo.
          </DialogDescription>
        </DialogHeader>

        {original && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Parcela #{original.number}</span>
              <span className="font-medium">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                  Number(original.amount) || 0
                )}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Vencimento original: {format(new Date(original.due_date), "dd/MM/yyyy")} ·{" "}
              {original.payment_method ?? "—"}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label>Motivo da renegociação *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: Cliente solicitou parcelamento adicional após perda de receita…"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Label className="mr-auto">Novo plano ({items.length} parcelas)</Label>
            <Select value={String(count)} onValueChange={(v) => regenerate(Number(v))}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 6, 8, 10, 12].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}x
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                <Input
                  type="date"
                  value={it.due_date}
                  onChange={(e) => updateItem(i, { due_date: e.target.value })}
                />
                <Input
                  type="number"
                  step="0.01"
                  value={it.amount}
                  onChange={(e) => updateItem(i, { amount: e.target.value })}
                />
                <Select
                  value={it.payment_method}
                  onValueChange={(v) => updateItem(i, { payment_method: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-sm border-t pt-2">
            <span className="text-muted-foreground">Total renegociado</span>
            <span className="font-semibold">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}
            </span>
          </div>
          {original && Math.abs(total - Number(original.amount)) > 0.01 && (
            <p className="text-xs text-amber-600">
              Atenção: total difere da parcela original (
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                Number(original.amount)
              )}
              ).
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Renegociando…" : "Confirmar renegociação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RenegotiateInstallmentDialog;
