import { forwardRef, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { History, CheckCircle2, Clock, RotateCcw, Search, DollarSign, Filter } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

type SpinRow = {
  id: string;
  spiff_id: string;
  user_id: string;
  prize_amount: number;
  prize_label: string | null;
  spun_at: string;
  payment_status: "pending" | "paid";
  paid_at: string | null;
  paid_by: string | null;
  payment_notes: string | null;
};

export const SpiffSpinsHistory = forwardRef<HTMLDivElement>((_props, ref) => {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [spiffFilter, setSpiffFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [payDialog, setPayDialog] = useState<SpinRow | null>(null);
  const [payNotes, setPayNotes] = useState("");

  // Verifica permissão (espelha a função SQL can_manage_spiff_payments)
  const canManagePayments = useMemo(() => {
    const role = (currentUser as any)?.role;
    if (["admin", "head", "gestor", "leader", "mentor"].includes(role)) return true;
    return false;
  }, [currentUser]);

  const spinsQ = useQuery({
    queryKey: ["spiff-spins-history", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spiff_spins")
        .select("id, spiff_id, user_id, prize_amount, prize_label, spun_at, payment_status, paid_at, paid_by, payment_notes")
        .eq("account_id", accountId!)
        .order("spun_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as SpinRow[];
    },
  });

  const spiffsQ = useQuery({
    queryKey: ["spiffs-list-history", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_spiffs")
        .select("id, name")
        .eq("account_id", accountId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const usersQ = useQuery({
    queryKey: ["spiffs-users-history", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("account_id", accountId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const userById = useMemo(() => {
    const m = new Map<string, { name: string; email: string }>();
    (usersQ.data ?? []).forEach((u: any) => m.set(u.id, { name: u.name || u.email || "—", email: u.email || "" }));
    return m;
  }, [usersQ.data]);

  const spiffById = useMemo(() => {
    const m = new Map<string, string>();
    (spiffsQ.data ?? []).forEach((s: any) => m.set(s.id, s.name || "—"));
    return m;
  }, [spiffsQ.data]);

  const filtered = useMemo(() => {
    let rows = spinsQ.data ?? [];
    if (statusFilter !== "all") rows = rows.filter((r) => r.payment_status === statusFilter);
    if (userFilter !== "all") rows = rows.filter((r) => r.user_id === userFilter);
    if (spiffFilter !== "all") rows = rows.filter((r) => r.spiff_id === spiffFilter);
    if (from) {
      const f = new Date(from).getTime();
      rows = rows.filter((r) => new Date(r.spun_at).getTime() >= f);
    }
    if (to) {
      const t = new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1;
      rows = rows.filter((r) => new Date(r.spun_at).getTime() <= t);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => {
        const name = userById.get(r.user_id)?.name?.toLowerCase() || "";
        const sp = spiffById.get(r.spiff_id)?.toLowerCase() || "";
        const lbl = (r.prize_label || "").toLowerCase();
        return name.includes(q) || sp.includes(q) || lbl.includes(q);
      });
    }
    return rows;
  }, [spinsQ.data, statusFilter, userFilter, spiffFilter, from, to, search, userById, spiffById]);

  const totals = useMemo(() => {
    const totalAmount = filtered.reduce((acc, r) => acc + Number(r.prize_amount || 0), 0);
    const paidAmount = filtered
      .filter((r) => r.payment_status === "paid")
      .reduce((acc, r) => acc + Number(r.prize_amount || 0), 0);
    const pendingAmount = totalAmount - paidAmount;
    return {
      total: filtered.length,
      paidCount: filtered.filter((r) => r.payment_status === "paid").length,
      pendingCount: filtered.filter((r) => r.payment_status === "pending").length,
      totalAmount,
      paidAmount,
      pendingAmount,
    };
  }, [filtered]);

  const updateMut = useMutation({
    mutationFn: async (input: { spin: SpinRow; markAsPaid: boolean; notes?: string }) => {
      const { spin, markAsPaid, notes } = input;
      const payload: any = markAsPaid
        ? {
            payment_status: "paid",
            paid_at: new Date().toISOString(),
            paid_by: currentUser?.id ?? null,
            payment_notes: notes ?? null,
          }
        : {
            payment_status: "pending",
            paid_at: null,
            paid_by: null,
            payment_notes: null,
          };
      const { error } = await supabase.from("spiff_spins").update(payload).eq("id", spin.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["spiff-spins-history"] });
      toast.success(vars.markAsPaid ? "Giro marcado como pago" : "Pagamento desfeito");
      setPayDialog(null);
      setPayNotes("");
    },
    onError: (e: any) => {
      toast.error(e?.message?.includes("policy")
        ? "Você não tem permissão para alterar pagamentos."
        : `Erro: ${e?.message ?? "tente novamente"}`);
    },
  });

  const isLoading = spinsQ.isLoading || spiffsQ.isLoading || usersQ.isLoading;

  return (
    <div ref={ref} className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Giros</div>
            <div className="text-2xl font-semibold mt-1">{totals.total}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {totals.pendingCount} pendente{totals.pendingCount === 1 ? "" : "s"} · {totals.paidCount} pago{totals.paidCount === 1 ? "" : "s"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Sorteado</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{formatBRL(totals.totalAmount)}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-900/40">
          <CardContent className="p-4">
            <div className="text-xs text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> A Pagar
            </div>
            <div className="text-2xl font-semibold mt-1 tabular-nums text-amber-700 dark:text-amber-400">
              {formatBRL(totals.pendingAmount)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-900/40">
          <CardContent className="p-4">
            <div className="text-xs text-emerald-700 dark:text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Pago
            </div>
            <div className="text-2xl font-semibold mt-1 tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatBRL(totals.paidAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">A Pagar</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vendedor</Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {(usersQ.data ?? []).map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Campanha</Label>
              <Select value={spiffFilter} onValueChange={setSpiffFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(spiffsQ.data ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-7"
                  placeholder="Nome, prêmio…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico de Giros
          </CardTitle>
          <CardDescription>
            {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
            {!canManagePayments && " · você não tem permissão para alterar pagamentos"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum giro encontrado com os filtros atuais.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Prêmio</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const paidByName = r.paid_by ? userById.get(r.paid_by)?.name : null;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(r.spun_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">{userById.get(r.user_id)?.name || "—"}</TableCell>
                      <TableCell className="text-sm">{spiffById.get(r.spiff_id) || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {r.prize_label || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {Number(r.prize_amount) > 0
                          ? formatBRL(Number(r.prize_amount))
                          : <span className="text-muted-foreground">R$ 0</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.payment_status === "paid" ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Pago
                          </Badge>
                        ) : Number(r.prize_amount) > 0 ? (
                          <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700 dark:text-amber-400">
                            <Clock className="h-3 w-3" /> A pagar
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">—</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {r.paid_at ? (
                          <div>
                            <div>{format(new Date(r.paid_at), "dd/MM/yy", { locale: ptBR })}</div>
                            {paidByName && <div className="text-[10px] opacity-70">por {paidByName}</div>}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(r.prize_amount) <= 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : r.payment_status === "pending" ? (
                          <Button
                            size="sm"
                            disabled={!canManagePayments}
                            onClick={() => { setPayDialog(r); setPayNotes(""); }}
                            className="h-7 gap-1.5 text-xs"
                          >
                            <DollarSign className="h-3 w-3" />
                            Marcar pago
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!canManagePayments || updateMut.isPending}
                            onClick={() => updateMut.mutate({ spin: r, markAsPaid: false })}
                            className="h-7 gap-1.5 text-xs"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Desfazer
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Pagar */}
      <Dialog open={!!payDialog} onOpenChange={(o) => { if (!o) { setPayDialog(null); setPayNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pagamento</DialogTitle>
            <DialogDescription>
              {payDialog && (
                <>
                  Marcar como pago o prêmio de{" "}
                  <strong>{formatBRL(Number(payDialog.prize_amount))}</strong> para{" "}
                  <strong>{userById.get(payDialog.user_id)?.name}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Observações (opcional)</Label>
            <Textarea
              placeholder="Ex: pago via PIX em 20/04…"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPayDialog(null); setPayNotes(""); }}>
              Cancelar
            </Button>
            <Button
              disabled={updateMut.isPending}
              onClick={() => payDialog && updateMut.mutate({ spin: payDialog, markAsPaid: true, notes: payNotes || undefined })}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
SpiffSpinsHistory.displayName = "SpiffSpinsHistory";
