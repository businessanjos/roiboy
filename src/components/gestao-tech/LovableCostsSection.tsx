import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Zap, Loader2, Link2 } from "lucide-react";

type Kind = "recarga" | "mensalidade";

interface LovableCost {
  id: string;
  account_id: string;
  kind: Kind;
  amount_cents: number;
  currency: string;
  occurred_on: string;
  notes: string | null;
}

interface FinancialLovableEntry {
  id: string;
  amount: number;
  currency: string | null;
  payment_date: string | null;
  due_date: string | null;
  description: string | null;
  status: string | null;
}

const fmtBRL = (cents: number, currency = "BRL") =>
  ((cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
    maximumFractionDigits: 2,
  });

const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");

export function LovableCostsSection() {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const accountId = currentUser?.account_id;
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: manual = [], isLoading } = useQuery({
    queryKey: ["lovable-costs", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lovable_costs")
        .select("*")
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return (data || []) as LovableCost[];
    },
    enabled: !!accountId,
  });

  const { data: financial = [] } = useQuery({
    queryKey: ["lovable-financial-entries", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("id, amount, currency, payment_date, due_date, description, status")
        .eq("entry_type", "expense")
        .ilike("description", "%lovable%")
        .order("payment_date", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as FinancialLovableEntry[];
    },
    enabled: !!accountId,
  });

  const totals = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    let recargas = 0, mensalidades = 0, monthTotal = 0, yearTotal = 0, allTime = 0;

    for (const m of manual) {
      const dt = new Date(m.occurred_on + "T00:00:00");
      if (m.kind === "recarga") recargas += m.amount_cents;
      else mensalidades += m.amount_cents;
      allTime += m.amount_cents;
      if (dt >= monthStart) monthTotal += m.amount_cents;
      if (dt >= yearStart) yearTotal += m.amount_cents;
    }
    for (const f of financial) {
      const cents = Math.round(Number(f.amount || 0) * 100);
      const dtStr = f.payment_date || f.due_date;
      if (!dtStr) continue;
      const dt = new Date(dtStr + "T00:00:00");
      // heuristic: description contains "recarga" or "crédito"
      const d = (f.description || "").toLowerCase();
      if (d.includes("recarga") || d.includes("crédito") || d.includes("credito") || d.includes("top-up")) {
        recargas += cents;
      } else {
        mensalidades += cents;
      }
      allTime += cents;
      if (dt >= monthStart) monthTotal += cents;
      if (dt >= yearStart) yearTotal += cents;
    }
    return { recargas, mensalidades, monthTotal, yearTotal, allTime };
  }, [manual, financial]);

  type Row = {
    key: string;
    kind: string;
    date: string;
    amount_cents: number;
    currency: string;
    description: string;
    source: "manual" | "financial";
    manualId?: string;
    financialId?: string;
  };

  const rows = useMemo<Row[]>(() => {
    const r: Row[] = [];
    for (const m of manual) {
      r.push({
        key: "m:" + m.id,
        kind: m.kind,
        date: m.occurred_on,
        amount_cents: m.amount_cents,
        currency: m.currency,
        description: m.notes || "",
        source: "manual",
        manualId: m.id,
      });
    }
    for (const f of financial) {
      const dt = f.payment_date || f.due_date;
      if (!dt) continue;
      const d = (f.description || "").toLowerCase();
      const kind: Kind =
        d.includes("recarga") || d.includes("crédito") || d.includes("credito") || d.includes("top-up")
          ? "recarga"
          : "mensalidade";
      r.push({
        key: "f:" + f.id,
        kind,
        date: dt,
        amount_cents: Math.round(Number(f.amount || 0) * 100),
        currency: (f.currency || "BRL").toUpperCase(),
        description: f.description || "",
        source: "financial",
        financialId: f.id,
      });
    }
    return r.sort((a, b) => b.date.localeCompare(a.date));
  }, [manual, financial]);

  const deleteManual = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lovable_costs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido");
      qc.invalidateQueries({ queryKey: ["lovable-costs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Custos Lovable — recargas e mensalidades
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registro manual + lançamentos financeiros contendo "Lovable" na descrição.
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Registrar custo
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MiniKpi label="Mensalidades (total)" value={fmtBRL(totals.mensalidades)} />
          <MiniKpi label="Recargas (total)" value={fmtBRL(totals.recargas)} />
          <MiniKpi label="Mês atual" value={fmtBRL(totals.monthTotal)} />
          <MiniKpi label="Ano corrente" value={fmtBRL(totals.yearTotal)} />
          <MiniKpi label="Total geral" value={fmtBRL(totals.allTime)} tone="primary" />
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenhum custo Lovable registrado ainda.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="tabular-nums">{fmtDate(r.date)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        r.kind === "recarga"
                          ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                          : "bg-indigo-500/10 text-indigo-700 border-indigo-500/30"
                      }
                    >
                      {r.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {fmtBRL(r.amount_cents, r.currency)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[360px]">
                    {r.description || "—"}
                  </TableCell>
                  <TableCell>
                    {r.source === "manual" ? (
                      <Badge variant="secondary" className="text-[10px]">manual</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Link2 className="h-3 w-3" /> Financeiro
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.source === "manual" && r.manualId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Remover este registro?")) deleteManual.mutate(r.manualId!);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <LovableCostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accountId={accountId}
        userId={currentUser?.id}
        onSaved={() => qc.invalidateQueries({ queryKey: ["lovable-costs"] })}
      />
    </Card>
  );
}

function MiniKpi({
  label, value, tone,
}: { label: string; value: string; tone?: "primary" }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold mt-1 ${tone === "primary" ? "text-primary" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function LovableCostDialog({
  open, onOpenChange, accountId, userId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountId: string | undefined;
  userId: string | undefined;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<Kind>("mensalidade");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!accountId) return;
    const cents = Math.round(parseFloat(amount.replace(",", ".") || "0") * 100);
    if (!cents || cents <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("lovable_costs").insert({
        account_id: accountId,
        kind,
        amount_cents: cents,
        currency: "BRL",
        occurred_on: date,
        notes: notes || null,
        created_by: userId ?? null,
      });
      if (error) throw error;
      toast.success("Custo registrado");
      onSaved();
      onOpenChange(false);
      setAmount(""); setNotes(""); setKind("mensalidade");
      setDate(new Date().toISOString().slice(0, 10));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar custo Lovable</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensalidade">Mensalidade</SelectItem>
                <SelectItem value="recarga">Recarga de créditos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: plano Business, recarga 500 créditos..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
