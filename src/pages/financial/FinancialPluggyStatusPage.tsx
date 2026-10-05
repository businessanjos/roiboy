import { useMemo, useState } from "react";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { usePaginationState } from "@/hooks/usePagedList";
import { ListPagination } from "@/components/ui/list-pagination";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  Wallet,
  Activity,
  Info,
  Copy,
  Check,
  ArrowDownToLine,
  Plus,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

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
  if (!iso) return "Nunca sincronizado";
  try {
    return `Há ${formatDistanceToNow(new Date(iso), { locale: ptBR })}`;
  } catch {
    return "—";
  }
};

const formatFull = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd 'de' MMM 'às' HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
};

const friendlySyncType = (type: string) =>
  type === "balances" ? "Saldo" : type === "transactions" ? "Movimentações" : type;

const friendlyError = (msg: string | null): string => {
  if (!msg) return "";
  const m = msg.toLowerCase();
  if (m.includes("token") || m.includes("auth") || m.includes("unauthor"))
    return "Conexão expirou. Reconecte o banco para continuar.";
  if (m.includes("timeout") || m.includes("timed out"))
    return "O banco demorou para responder. Tente novamente em instantes.";
  if (m.includes("rate") || m.includes("429"))
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos.";
  if (m.includes("network") || m.includes("fetch"))
    return "Falha de comunicação com o banco. Verifique sua internet.";
  return msg.length > 140 ? msg.slice(0, 137) + "…" : msg;
};

const HealthPill = ({
  state,
}: {
  state: "ok" | "warn" | "error" | "idle";
}) => {
  const map = {
    ok: {
      label: "Funcionando",
      icon: CheckCircle2,
      cls: "bg-success/15 text-success-strong dark:text-success border-success/30",
    },
    warn: {
      label: "Atenção",
      icon: Clock,
      cls: "bg-warning/15 text-warning-strong dark:text-warning border-warning/30",
    },
    error: {
      label: "Com problema",
      icon: AlertCircle,
      cls: "bg-destructive/15 text-destructive border-destructive/30",
    },
    idle: {
      label: "Aguardando",
      icon: Clock,
      cls: "bg-muted text-muted-foreground border-border",
    },
  } as const;
  const cfg = map[state];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`${cfg.cls} font-medium`}>
      <Icon className="h-3 w-3 mr-1" /> {cfg.label}
    </Badge>
  );
};

const CopyButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      aria-label="Copiar identificador"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
};

export default function FinancialPluggyStatusPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);
  const [historyAccountId, setHistoryAccountId] = useState<string | null>(null);

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

  // Resumo rotulado: até 10 logs mais recentes POR CONTA (uma query por conta, em
  // paralelo), evitando que um `.limit()` global esconda contas com muita atividade.
  // A UI só exibe os 8 mais recentes (rótulo "Últimas atualizações").
  const { data: logsByAccountData, isLoading: loadingLogs } = useQuery({
    queryKey: ["pluggy-status-logs-per-account", accountIds],
    enabled: accountIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        accountIds.map(async (id) => {
          const { data, error } = await supabase
            .from("openfinance_sync_logs")
            .select(
              "id,bank_account_id,sync_type,status,transactions_imported,error_message,started_at,finished_at,provider"
            )
            .eq("bank_account_id", id)
            .order("started_at", { ascending: false })
            .limit(10);
          if (error) throw error;
          return [id, (data ?? []) as SyncLogRow[]] as const;
        })
      );
      return results;
    },
  });

  const logsByAccount = useMemo(() => {
    return new Map<string, SyncLogRow[]>(logsByAccountData ?? []);
  }, [logsByAccountData]);

  const logs = useMemo(
    () => Array.from(logsByAccount.values()).flat(),
    [logsByAccount]
  );

  // Totais das últimas 24h: consulta dedicada sem limite (janela de tempo curta,
  // não sofre o truncamento silencioso do preview por conta acima).
  const { data: imported24Count = 0 } = useQuery({
    queryKey: ["pluggy-status-imported-24h", accountIds],
    enabled: accountIds.length > 0,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      // Usa fetchAllRows (paginação por .range com ordenação estável) em vez de
      // uma única query sem limite explícito: evita o truncamento silencioso de
      // 1000 linhas imposto pelo PostgREST e propaga erro em vez de somar
      // dados parciais como se fossem o total.
      const { data, error } = await fetchAllRows<{ transactions_imported: number }>(
        (from, to) =>
          supabase
            .from("openfinance_sync_logs")
            .select("transactions_imported")
            .in("bank_account_id", accountIds)
            .gte("started_at", since)
            .order("id", { ascending: true })
            .range(from, to)
      );
      if (error) throw error;
      return data.reduce((s, l) => s + (l.transactions_imported || 0), 0);
    },
  });

  const getAccountHealth = (
    a: BankAccountRow,
    accLogs: SyncLogRow[]
  ): "ok" | "warn" | "error" | "idle" => {
    const last = accLogs[0];
    if (!last) return "idle";
    if (last.status === "error") return "error";
    const lastSync = a.last_transactions_sync_at || a.last_balance_sync_at;
    if (!lastSync) return "warn";
    const hours = (Date.now() - new Date(lastSync).getTime()) / 36e5;
    if (hours > 36) return "warn";
    return "ok";
  };

  const totals = useMemo(() => {
    const withProblem = (accounts ?? []).filter((a) => {
      const lgs = logsByAccount.get(a.id) ?? [];
      return getAccountHealth(a, lgs) === "error";
    }).length;
    return {
      connections: accounts?.length ?? 0,
      withProblem,
      imported24: imported24Count,
    };
  }, [accounts, logsByAccount, imported24Count]);

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
      queryClient.invalidateQueries({ queryKey: ["pluggy-status-accounts"] });
      // Chaves reais usadas pelas queries desta página (o prefixo basta: o
      // React Query invalida por correspondência parcial por padrão).
      queryClient.invalidateQueries({ queryKey: ["pluggy-status-logs-per-account"] });
      queryClient.invalidateQueries({ queryKey: ["pluggy-status-imported-24h"] });
      queryClient.invalidateQueries({ queryKey: ["pluggy-status-history"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Não foi possível atualizar agora",
        description: friendlyError(err.message),
        variant: "destructive",
      });
    },
  });

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await syncMutation.mutateAsync({ bankAccountId: id, type: "balances" });
      await syncMutation.mutateAsync({ bankAccountId: id, type: "transactions" });
      toast({
        title: "Dados atualizados",
        description: "Saldo e movimentações foram trazidos do seu banco.",
      });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Meus bancos conectados
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Aqui você vê se cada banco está trazendo os dados corretamente. Sem
              jargão técnico.
            </p>
          </div>
          <Button onClick={() => navigate("/financial/bank-accounts")}>
            <Plus className="h-4 w-4 mr-2" />
            Conectar um banco
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Bancos conectados</div>
                  <div className="text-2xl font-semibold">{totals.connections}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    totals.withProblem > 0
                      ? "bg-destructive/10"
                      : "bg-success/10"
                  }`}
                >
                  {totals.withProblem > 0 ? (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Precisam de atenção
                  </div>
                  <div className="text-2xl font-semibold">{totals.withProblem}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center">
                  <ArrowDownToLine className="h-5 w-5 text-info" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Movimentações trazidas (24h)
                  </div>
                  <div className="text-2xl font-semibold">{totals.imported24}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Help banner */}
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="text-muted-foreground">
            Sempre que um banco aparecer com{" "}
            <span className="text-destructive font-medium">Com problema</span>,
            clique em <span className="font-medium">Atualizar agora</span>. Se o
            erro continuar, é provável que a conexão tenha expirado — basta
            reconectar o banco.
          </div>
        </div>

        {/* Accounts list */}
        {loadingAccounts ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !accounts || accounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-muted mx-auto flex items-center justify-center">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <div className="font-medium">
                  Você ainda não conectou nenhum banco
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Conecte uma conta para acompanhar saldo e movimentações automaticamente.
                </div>
              </div>
              <Button onClick={() => navigate("/financial/bank-accounts")}>
                <Plus className="h-4 w-4 mr-2" /> Conectar um banco
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-3">
            {accounts.map((a) => {
              const accLogs = logsByAccount.get(a.id) ?? [];
              const lastLog = accLogs[0];
              const health = getAccountHealth(a, accLogs);
              const lastSync =
                a.last_transactions_sync_at || a.last_balance_sync_at;
              return (
                <AccordionItem
                  key={a.id}
                  value={a.id}
                  className="border rounded-lg bg-card overflow-hidden data-[state=open]:shadow-sm"
                >
                  <AccordionTrigger className="hover:no-underline px-4 py-3">
                    <div className="flex flex-1 items-center gap-3 pr-2">
                      {a.logo_url ? (
                        <img
                          src={a.logo_url}
                          alt=""
                          className="h-10 w-10 rounded-lg object-contain bg-muted p-1"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="text-left flex-1 min-w-0">
                        <div className="font-medium truncate">{a.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {a.openfinance_institution || a.bank_name} ·{" "}
                          {formatRelative(lastSync)}
                        </div>
                      </div>
                      <HealthPill state={health} />
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-5 pt-2">
                      {/* Quick stats */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-lg border p-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Wallet className="h-3.5 w-3.5" /> Saldo atual
                          </div>
                          <div className="text-lg font-semibold mt-1">
                            {a.current_balance.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1">
                            Atualizado em {formatFull(a.last_balance_sync_at)}
                          </div>
                        </div>
                        <div className="rounded-lg border p-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Activity className="h-3.5 w-3.5" /> Movimentações
                          </div>
                          <div className="text-lg font-semibold mt-1">
                            {accLogs
                              .filter((l) => l.sync_type === "transactions")
                              .reduce(
                                (s, l) => s + (l.transactions_imported || 0),
                                0
                              )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1">
                            Trazidas nos últimos dias
                          </div>
                        </div>
                        <div className="rounded-lg border p-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" /> Última atualização
                          </div>
                          <div className="text-lg font-semibold mt-1">
                            {formatRelative(lastSync).replace("Há ", "")}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1">
                            {formatFull(lastSync)}
                          </div>
                        </div>
                      </div>

                      {/* Error helper */}
                      {health === "error" && lastLog?.error_message && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                            <div>
                              <div className="font-medium text-destructive">
                                Algo deu errado na última atualização
                              </div>
                              <div className="text-muted-foreground mt-1">
                                {friendlyError(lastLog.error_message)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => handleSync(a.id)}
                          disabled={syncingId === a.id}
                        >
                          {syncingId === a.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Atualizando…
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Atualizar agora
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            navigate(`/financial/bank-accounts/${a.id}/extrato`)
                          }
                        >
                          Ver extrato
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setHistoryAccountId(a.id)}
                        >
                          Ver histórico
                        </Button>
                      </div>

                      {/* History timeline */}
                      <div>
                        <div className="text-sm font-medium mb-2">
                          Últimas atualizações
                        </div>
                        {loadingLogs ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : accLogs.length === 0 ? (
                          <div className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
                            Ainda não houve nenhuma atualização.
                          </div>
                        ) : (
                          <ol className="relative border-l border-border ml-2 space-y-3">
                            {accLogs.slice(0, 8).map((l) => {
                              const ok = l.status === "success";
                              const err = l.status === "error";
                              return (
                                <li key={l.id} className="ml-4">
                                  <span
                                    className={`absolute -left-1.5 h-3 w-3 rounded-full border-2 border-background ${
                                      ok
                                        ? "bg-success"
                                        : err
                                        ? "bg-destructive"
                                        : "bg-muted-foreground"
                                    }`}
                                  />
                                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                    <span className="text-sm font-medium">
                                      {friendlySyncType(l.sync_type)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatFull(l.started_at)}
                                    </span>
                                    {ok && l.transactions_imported > 0 && (
                                      <Badge
                                        variant="outline"
                                        className="bg-success/10 text-success-strong dark:text-success border-success/30"
                                      >
                                        {l.transactions_imported} novas
                                      </Badge>
                                    )}
                                    {err && (
                                      <Badge variant="destructive">Falhou</Badge>
                                    )}
                                  </div>
                                  {err && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {friendlyError(l.error_message)}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </div>

                      {/* Technical details (collapsible) */}
                      <div className="pt-2 border-t">
                        <button
                          type="button"
                          onClick={() => setShowTechnical((v) => !v)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showTechnical ? "Ocultar" : "Mostrar"} detalhes técnicos
                        </button>
                        {showTechnical && (
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="rounded border p-2">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                  ID da conexão
                                </span>
                                {a.openfinance_connection_id && (
                                  <CopyButton
                                    value={a.openfinance_connection_id}
                                  />
                                )}
                              </div>
                              <div className="font-mono break-all">
                                {a.openfinance_connection_id || "—"}
                              </div>
                            </div>
                            <div className="rounded border p-2">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                  ID da conta
                                </span>
                                {a.openfinance_account_id && (
                                  <CopyButton value={a.openfinance_account_id} />
                                )}
                              </div>
                              <div className="font-mono break-all">
                                {a.openfinance_account_id || "—"}
                              </div>
                            </div>
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
      </div>
      <SyncHistoryDialog
        accountId={historyAccountId}
        accountName={(accounts ?? []).find((a) => a.id === historyAccountId)?.name ?? ""}
        open={historyAccountId !== null}
        onOpenChange={(open) => !open && setHistoryAccountId(null)}
      />
    </TooltipProvider>
  );
}

const HISTORY_PAGE_SIZE = 20 as const;

/**
 * Histórico completo (paginado no servidor) de sincronizações de uma conta.
 * O resumo exibido no accordion mostra só os 8 logs mais recentes; aqui o
 * usuário navega por todo o histórico via count: 'exact' + range().
 */
function SyncHistoryDialog({
  accountId,
  accountName,
  open,
  onOpenChange,
}: {
  accountId: string | null;
  accountName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Total real (atualizado a cada resposta) para que a paginação não "pisque"
  // de volta à página 1 enquanto a contagem ainda não chegou.
  const [total, setTotal] = useState(0);
  const pg = usePaginationState(total, {
    resetKey: accountId,
    defaultPageSize: HISTORY_PAGE_SIZE,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["pluggy-status-history", accountId, pg.currentPage, pg.pageSize],
    enabled: open && !!accountId,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("openfinance_sync_logs")
        .select(
          "id,bank_account_id,sync_type,status,transactions_imported,error_message,started_at,finished_at,provider",
          { count: "exact" }
        )
        .eq("bank_account_id", accountId as string)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(pg.from, pg.to);
      if (error) throw error;
      const result = { rows: (data ?? []) as SyncLogRow[], total: count ?? 0 };
      setTotal(result.total);
      return result;
    },
  });

  const rows = data?.rows ?? [];
  const pgWithTotal = pg;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de sincronizações · {accountName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Nenhum registro encontrado.
            </div>
          ) : (
            <ol className="relative border-l border-border ml-2 space-y-3">
              {rows.map((l) => {
                const ok = l.status === "success";
                const err = l.status === "error";
                return (
                  <li key={l.id} className="ml-4">
                    <span
                      className={`absolute -left-1.5 h-3 w-3 rounded-full border-2 border-background ${
                        ok ? "bg-success" : err ? "bg-destructive" : "bg-muted-foreground"
                      }`}
                    />
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-sm font-medium">{friendlySyncType(l.sync_type)}</span>
                      <span className="text-xs text-muted-foreground">{formatFull(l.started_at)}</span>
                      {ok && l.transactions_imported > 0 && (
                        <Badge
                          variant="outline"
                          className="bg-success/10 text-success-strong dark:text-success border-success/30"
                        >
                          {l.transactions_imported} novas
                        </Badge>
                      )}
                      {err && <Badge variant="destructive">Falhou</Badge>}
                    </div>
                    {err && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {friendlyError(l.error_message)}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <ListPagination
          currentPage={pgWithTotal.currentPage}
          totalPages={pgWithTotal.totalPages}
          totalItems={pgWithTotal.totalItems}
          pageSize={pgWithTotal.pageSize}
          onPageChange={pg.handlePageChange}
          onPageSizeChange={pg.handlePageSizeChange}
          itemLabel="registros"
        />
      </DialogContent>
    </Dialog>
  );
}
