import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Link as LinkIcon,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BankAccountRow {
  id: string;
  name: string;
  bank_name: string;
  logo_url: string | null;
  openfinance_provider: string | null;
  openfinance_connection_id: string | null;
  openfinance_account_id: string | null;
  openfinance_institution: string | null;
  last_balance_sync_at: string | null;
  last_transactions_sync_at: string | null;
  current_balance: number;
  is_active: boolean;
}

interface SyncLogRow {
  id: string;
  bank_account_id: string | null;
  sync_type: string;
  status: string;
  transactions_imported: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  provider: string | null;
}

const formatRelative = (iso: string | null) => {
  if (!iso) return "Nunca";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return "—";
  }
};

const formatFull = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
  } catch {
    return "—";
  }
};

const StatusBadge = ({ status }: { status: string }) => {
  if (status === "success")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Sucesso
      </Badge>
    );
  if (status === "error")
    return (
      <Badge variant="destructive">
        <AlertCircle className="h-3 w-3 mr-1" /> Erro
      </Badge>
    );
  return (
    <Badge variant="secondary">
      <Clock className="h-3 w-3 mr-1" /> {status}
    </Badge>
  );
};

export default function FinancialPluggyStatusPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ["pluggy-status-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select(
          "id,name,bank_name,logo_url,openfinance_provider,openfinance_connection_id,openfinance_account_id,openfinance_institution,last_balance_sync_at,last_transactions_sync_at,current_balance,is_active"
        )
        .eq("openfinance_provider", "pluggy")
        .order("name");
      if (error) throw error;
      return (data ?? []) as BankAccountRow[];
    },
  });

  const accountIds = useMemo(() => (accounts ?? []).map((a) => a.id), [accounts]);

  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ["pluggy-status-logs", accountIds],
    enabled: accountIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("openfinance_sync_logs")
        .select(
          "id,bank_account_id,sync_type,status,transactions_imported,error_message,started_at,finished_at,provider"
        )
        .in("bank_account_id", accountIds)
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as SyncLogRow[];
    },
  });

  const logsByAccount = useMemo(() => {
    const map = new Map<string, SyncLogRow[]>();
    (logs ?? []).forEach((l) => {
      if (!l.bank_account_id) return;
      const arr = map.get(l.bank_account_id) ?? [];
      arr.push(l);
      map.set(l.bank_account_id, arr);
    });
    return map;
  }, [logs]);

  const totals = useMemo(() => {
    const all = logs ?? [];
    const last24h = all.filter(
      (l) => new Date(l.started_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
    );
    return {
      connections: accounts?.length ?? 0,
      success24: last24h.filter((l) => l.status === "success").length,
      errors24: last24h.filter((l) => l.status === "error").length,
      imported24: last24h.reduce((s, l) => s + (l.transactions_imported || 0), 0),
    };
  }, [logs, accounts]);

  const syncMutation = useMutation({
    mutationFn: async ({
      bankAccountId,
      type,
    }: {
      bankAccountId: string;
      type: "balances" | "transactions";
    }) => {
      const fn =
        type === "balances" ? "pluggy-sync-balances" : "pluggy-sync-transactions";
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { bank_account_id: bankAccountId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Sincronização concluída" });
      queryClient.invalidateQueries({ queryKey: ["pluggy-status-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["pluggy-status-logs"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro ao sincronizar",
        description: err.message,
        variant: "destructive",
      });
    },
    onSettled: () => setSyncingId(null),
  });

  const handleSync = async (id: string) => {
    setSyncingId(id);
    await syncMutation.mutateAsync({ bankAccountId: id, type: "balances" });
    await syncMutation.mutateAsync({ bankAccountId: id, type: "transactions" });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Status Pluggy</h1>
        <p className="text-sm text-muted-foreground">
          Monitoramento das conexões Open Finance via Pluggy.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium">
              Conexões
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totals.connections}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium">
              Sucessos (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-600">
              {totals.success24}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium">
              Erros (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-destructive">
              {totals.errors24}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium">
              Registros importados (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totals.imported24}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conexões ativas</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAccounts ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !accounts || accounts.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma conta conectada via Pluggy. Vá em Contas Bancárias para
              conectar.
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {accounts.map((a) => {
                const accLogs = logsByAccount.get(a.id) ?? [];
                const lastLog = accLogs[0];
                return (
                  <AccordionItem key={a.id} value={a.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-1 items-center gap-3 pr-4">
                        {a.logo_url ? (
                          <img
                            src={a.logo_url}
                            alt=""
                            className="h-8 w-8 rounded object-contain bg-muted"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                            <LinkIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="text-left flex-1 min-w-0">
                          <div className="font-medium truncate">{a.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {a.openfinance_institution || a.bank_name}
                          </div>
                        </div>
                        <div className="hidden md:flex flex-col items-end text-xs">
                          <span className="text-muted-foreground">
                            Última sync
                          </span>
                          <span>
                            {formatRelative(
                              a.last_transactions_sync_at ||
                                a.last_balance_sync_at
                            )}
                          </span>
                        </div>
                        {lastLog && <StatusBadge status={lastLog.status} />}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Item ID
                            </div>
                            <div className="font-mono text-xs break-all">
                              {a.openfinance_connection_id || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Account ID
                            </div>
                            <div className="font-mono text-xs break-all">
                              {a.openfinance_account_id || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Saldo atual
                            </div>
                            <div>
                              {a.current_balance.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Última sync de saldo
                            </div>
                            <div>{formatFull(a.last_balance_sync_at)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Última sync de transações
                            </div>
                            <div>{formatFull(a.last_transactions_sync_at)}</div>
                          </div>
                          <div className="flex items-end">
                            <Button
                              size="sm"
                              onClick={() => handleSync(a.id)}
                              disabled={syncingId === a.id}
                            >
                              {syncingId === a.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                              )}
                              Sincronizar agora
                            </Button>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            Histórico recente
                          </div>
                          {loadingLogs ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : accLogs.length === 0 ? (
                            <div className="text-xs text-muted-foreground">
                              Nenhuma execução registrada.
                            </div>
                          ) : (
                            <div className="border rounded-md overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Início</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">
                                      Registros
                                    </TableHead>
                                    <TableHead>Duração</TableHead>
                                    <TableHead>Erro</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {accLogs.slice(0, 15).map((l) => {
                                    const duration =
                                      l.finished_at && l.started_at
                                        ? `${Math.round(
                                            (new Date(l.finished_at).getTime() -
                                              new Date(l.started_at).getTime()) /
                                              1000
                                          )}s`
                                        : "—";
                                    return (
                                      <TableRow key={l.id}>
                                        <TableCell className="text-xs whitespace-nowrap">
                                          {formatFull(l.started_at)}
                                        </TableCell>
                                        <TableCell className="text-xs capitalize">
                                          {l.sync_type}
                                        </TableCell>
                                        <TableCell>
                                          <StatusBadge status={l.status} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {l.transactions_imported}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                          {duration}
                                        </TableCell>
                                        <TableCell className="text-xs text-destructive max-w-[280px] truncate">
                                          {l.error_message || "—"}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
