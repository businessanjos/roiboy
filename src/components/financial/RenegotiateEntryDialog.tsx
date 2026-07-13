import { useEffect, useMemo, useState } from "react";
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

type NewItem = { due_date: string; amount: string; payment_method: string };

const METHODS = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão de crédito" },
  { value: "cartao_recorrencia", label: "Cartão recorrência" },
  { value: "cheque", label: "Cheque" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
];

type OriginalEntry = {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  entry_type: "payable" | "receivable";
  category_id: string | null;
  bank_account_id: string | null;
  client_id: string | null;
  contract_id: string | null;
  currency: string;
  notes: string | null;
  status: string;
};

async function fetchFullEntry(id: string) {
  const { data } = await supabase
    .from("financial_entries")
    .select(
      "id, account_id, company_id, cost_center_id, supplier_id, seller_id, project_id, deal_id, entry_type, category_id, bank_account_id, client_id, contract_id, currency, notes, description"
    )
    .eq("id", id)
    .maybeSingle();
  return data as any;
}

export function RenegotiateEntryDialog({
  entry,
  open,
  onOpenChange,
  onRenegotiated,
}: {
  entry: OriginalEntry | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRenegotiated?: () => void;
}) {
  const [reason, setReason] = useState("");
  const [downPayment, setDownPayment] = useState("0");
  const [downPaymentDate, setDownPaymentDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [method, setMethod] = useState("pix");
  const [count, setCount] = useState(2);
  const [firstDueDate, setFirstDueDate] = useState<string>(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
  const [items, setItems] = useState<NewItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !entry) return;
    setReason("");
    setDownPayment("0");
    setDownPaymentDate(format(new Date(), "yyyy-MM-dd"));
    setMethod("pix");
    setCount(2);
    setFirstDueDate(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
    regenerate(2, format(addMonths(new Date(), 1), "yyyy-MM-dd"), "pix", Number(entry.amount) || 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id]);

  const regenerate = (n: number, first: string, m: string, base: number, down: number) => {
    const remaining = Math.max(0, base - down);
    const each = +(remaining / n).toFixed(2);
    const last = +(remaining - each * (n - 1)).toFixed(2);
    const arr: NewItem[] = [];
    const firstDate = first ? new Date(first) : new Date();
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

  const handleCountChange = (n: number) => {
    if (!entry) return;
    regenerate(n, firstDueDate, method, Number(entry.amount) || 0, Number(downPayment) || 0);
  };

  const handleFirstDateChange = (d: string) => {
    if (!entry) return;
    setFirstDueDate(d);
    regenerate(count, d, method, Number(entry.amount) || 0, Number(downPayment) || 0);
  };

  const handleMethodChange = (m: string) => {
    setMethod(m);
    setItems((prev) => prev.map((it) => ({ ...it, payment_method: m })));
  };

  const handleDownChange = (v: string) => {
    setDownPayment(v);
    if (!entry) return;
    regenerate(count, firstDueDate, method, Number(entry.amount) || 0, Number(v) || 0);
  };

  const updateItem = (i: number, patch: Partial<NewItem>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  const addItem = () => {
    const lastDate = items.length ? new Date(items[items.length - 1].due_date) : new Date();
    setItems((prev) => [
      ...prev,
      { due_date: format(addMonths(lastDate, 1), "yyyy-MM-dd"), amount: "0", payment_method: method },
    ]);
    setCount(items.length + 1);
  };

  const removeItem = (i: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
    setCount(items.length - 1);
  };

  const totalItems = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const totalRenegotiated = totalItems + (Number(downPayment) || 0);

  const diff = useMemo(
    () => (entry ? Math.abs(totalRenegotiated - Number(entry.amount)) : 0),
    [entry, totalRenegotiated]
  );

  const handleSubmit = async () => {
    if (!entry) return;
    if (!reason.trim()) {
      toast.error("Informe o motivo da renegociação");
      return;
    }
    if (items.length === 0 && (Number(downPayment) || 0) <= 0) {
      toast.error("Adicione ao menos uma parcela ou uma entrada");
      return;
    }

    setSaving(true);
    try {
      const stamp = format(new Date(), "dd/MM/yyyy HH:mm");
      const historyNote = `\n\n[Renegociado em ${stamp}] Motivo: ${reason.trim()}`;

      // 1) Cancel original entry
      const { error: cancelErr } = await supabase
        .from("financial_entries")
        .update({
          status: "cancelled",
          notes: (entry.notes ?? "") + historyNote,
        })
        .eq("id", entry.id);
      if (cancelErr) throw cancelErr;

      // 2) Build new entries
      const baseNew = {
        entry_type: entry.entry_type,
        category_id: entry.category_id,
        bank_account_id: entry.bank_account_id,
        client_id: entry.client_id,
        contract_id: entry.contract_id,
        currency: entry.currency ?? "BRL",
        status: "pending" as const,
        source: "renegotiation",
        notes: `Renegociação de "${entry.description}" (${entry.id}). Motivo: ${reason.trim()}`,
      };

      const rows: any[] = [];
      const totalParts = items.length + ((Number(downPayment) || 0) > 0 ? 1 : 0);

      if ((Number(downPayment) || 0) > 0) {
        rows.push({
          ...baseNew,
          description: `${entry.description} — Entrada (renegociação) (1/${totalParts})`,
          amount: Number(downPayment),
          due_date: downPaymentDate,
          payment_method: method,
        });
      }

      items.forEach((it, i) => {
        const idx = i + 1 + ((Number(downPayment) || 0) > 0 ? 1 : 0);
        rows.push({
          ...baseNew,
          description: `${entry.description} — Parcela renegociada (${idx}/${totalParts})`,
          amount: Number(it.amount) || 0,
          due_date: it.due_date,
          payment_method: it.payment_method,
        });
      });

      if (rows.length) {
        const { error: insErr } = await supabase.from("financial_entries").insert(rows);
        if (insErr) throw insErr;
      }

      toast.success(`Renegociação registrada em ${rows.length} lançamento(s)`);
      onRenegotiated?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao renegociar: " + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Renegociar lançamento
          </DialogTitle>
          <DialogDescription>
            O lançamento original será marcado como <strong>Cancelado</strong> (com histórico da renegociação) e novos
            lançamentos serão criados com o plano abaixo.
          </DialogDescription>
        </DialogHeader>

        {entry && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground truncate mr-2">{entry.description}</span>
              <span className="font-medium whitespace-nowrap">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                  Number(entry.amount) || 0
                )}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Vencimento original: {format(new Date(entry.due_date), "dd/MM/yyyy")}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={method} onValueChange={handleMethodChange}>
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
            </div>
            <div>
              <Label>Nº de parcelas</Label>
              <Select value={String(count)} onValueChange={(v) => handleCountChange(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x
                    </SelectItem>
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
                onChange={(e) => handleDownChange(e.target.value)}
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
                onChange={(e) => handleFirstDateChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label className="mr-auto">Parcelas ({items.length})</Label>
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
                  disabled={items.length === 0}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-sm border-t pt-2">
            <span className="text-muted-foreground">Total renegociado (entrada + parcelas)</span>
            <span className="font-semibold">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalRenegotiated)}
            </span>
          </div>
          {entry && diff > 0.01 && (
            <p className="text-xs text-amber-600">
              Atenção: total difere do lançamento original (
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                Number(entry.amount)
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

export default RenegotiateEntryDialog;
