import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, RefreshCw, Search, ArrowUpRight, ArrowDownRight, Link2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PluggyConnectDialog } from "@/components/financial/PluggyConnectDialog";

interface Entry {
  id: string;
  description: string;
  amount: number;
  entry_type: "receivable" | "payable";
  payment_date: string | null;
  due_date: string;
  status: string;
  source: string;
  openfinance_transaction_id: string | null;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function FinancialBankAccountStatementPage() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: bankAccount } = useQuery({
    enabled: !!id && !!accountId,
    queryKey: ["bank-account", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: entries = [], isLoading } = useQuery<Entry[]>({
    enabled: !!id,
    queryKey: ["bank-account-statement", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("id, description, amount, entry_type, payment_date, due_date, status, source, openfinance_transaction_id")
        .eq("bank_account_id", id!)
        .order("payment_date", { ascending: false, nullsFirst: false })
        .order("due_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const [b, t] = await Promise.all([
        supabase.functions.invoke("pluggy-sync-balances", { body: { bank_account_id: id } }),
        supabase.functions.invoke("pluggy-sync-transactions", { body: { bank_account_id: id } }),
      ]);
      if (b.error) throw b.error;
      if (t.error) throw t.error;
      return t.data;
    },
    onSuccess: (data: any) => {
      const imported = data?.results?.[0]?.imported ?? 0;
      toast({ title: "Sincronização concluída", description: `${imported} novas movimentações importadas.` });
      qc.invalidateQueries({ queryKey: ["bank-account-statement", id] });
      qc.invalidateQueries({ queryKey: ["bank-account", id] });
      qc.invalidateQueries({ queryKey: ["bank-accounts-all"] });
    },
    onError: (e: any) => {
      toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    if (!search) return entries;
    const s = search.toLowerCase();
    return entries.filter((e) => e.description.toLowerCase().includes(s));
  }, [entries, search]);

  const totals = useMemo(() => {
    let credit = 0, debit = 0;
    for (const e of entries) {
      if (e.entry_type === "receivable") credit += Number(e.amount);
      else debit += Number(e.amount);
    }
    return { credit, debit, net: credit - debit };
  }, [entries]);

  const isLinked = !!bankAccount?.openfinance_account_id;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/financial/bank-accounts"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {bankAccount?.name ?? "Extrato"}
              {isLinked && <Badge variant="secondary">Open Finance</Badge>}
            </h1>
            <p className="text-muted-foreground text-sm">
              {bankAccount?.bank_name}
              {bankAccount?.last_transactions_sync_at && (
                <> • última sincronização {format(parseISO(bankAccount.last_transactions_sync_at), "dd/MM HH:mm", { locale: ptBR })}</>
              )}
            </p>
          </div>
        </div>
        {isLinked && (
          <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            Sincronizar agora
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo Atual</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(bankAccount?.current_balance ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
              {fmt(Number(bankAccount?.current_balance ?? 0))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Entradas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{fmt(totals.credit)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saídas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{fmt(totals.debit)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Movimentações</CardTitle>
            <div className="relative w-64">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar descrição" className="pl-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              {isLinked ? "Nenhuma movimentação. Clique em Sincronizar agora." : "Conta não vinculada ao Open Finance."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => {
                  const date = e.payment_date ?? e.due_date;
                  const isCredit = e.entry_type === "receivable";
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(parseISO(date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isCredit ? <ArrowDownRight className="h-4 w-4 text-green-600" /> : <ArrowUpRight className="h-4 w-4 text-red-600" />}
                          <span className="truncate max-w-md">{e.description}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {e.source === "openfinance" ? "Open Finance" : e.source}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${isCredit ? "text-green-600" : "text-red-600"}`}>
                        {isCredit ? "+" : "−"} {fmt(Number(e.amount))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
