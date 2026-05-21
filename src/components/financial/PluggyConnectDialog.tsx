import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link as LinkIcon, AlertCircle, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingItem {
  id: string;
  status: string;
  executionStatus: string;
  createdAt: string;
  updatedAt: string;
  institution: string;
  institutionImage: string | null;
}

declare global {
  interface Window {
    PluggyConnect?: new (options: Record<string, unknown>) => {
      init: () => void;
      destroy?: () => void;
    };
  }
}

const PLUGGY_CDN = "https://cdn.pluggy.ai/web-connect/v2.13.1/pluggy-connect.js";

interface PluggyAccount {
  account_id: string;
  account_name: string;
  account_number: string;
  account_type: string;
  balance: number | null;
  currency: string;
  institution: string;
  item_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bankAccountId: string;
  bankAccountName: string;
}

function loadPluggyScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PluggyConnect) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PLUGGY_CDN}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar Pluggy Connect")));
      return;
    }
    const s = document.createElement("script");
    s.src = PLUGGY_CDN;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar Pluggy Connect"));
    document.head.appendChild(s);
  });
}

export function PluggyConnectDialog({ open, onOpenChange, bankAccountId, bankAccountName }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<PluggyAccount[] | null>(null);
  const [selected, setSelected] = useState<PluggyAccount | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<PendingItem[] | null>(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!open) {
      setAccounts(null);
      setSelected(null);
      setItemId(null);
      setError(null);
      setPendingItems(null);
      setRecovering(false);
      setLoading(false);
    }
  }, [open]);

  const startConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await loadPluggyScript();
      const { data, error: fnErr } = await supabase.functions.invoke<{
        success: boolean;
        accessToken?: string;
        error?: string;
      }>("pluggy-create-connect-token", { body: { clientUserId: bankAccountId } });
      if (fnErr) throw fnErr;
      if (!data?.success || !data.accessToken) throw new Error(data?.error || "Sem token");

      if (!window.PluggyConnect) throw new Error("Widget Pluggy não carregou");

      const widget = new window.PluggyConnect({
        connectToken: data.accessToken,
        includeSandbox: true,
        onSuccess: async (payload: any) => {
          const newItemId = payload?.item?.id;
          if (!newItemId) {
            setError("Item Pluggy não retornado");
            return;
          }
          setItemId(newItemId);
          setLoading(true);
          setTimeout(() => fetchAccounts(newItemId), 2500);
        },
        onError: (e: any) => {
          setError(typeof e === "string" ? e : (e?.message ?? "Erro ao conectar banco"));
          setLoading(false);
        },
        onClose: () => {
          setLoading(false);
        },
      });
      widget.init();
      // Widget Pluggy abre sua própria UI em overlay — liberar loading do nosso dialog
      // para não travar caso onClose não dispare (popup bloqueado, erro silencioso, etc).
      setLoading(false);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const loadPendingItems = async () => {
    setRecovering(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke<{
        success: boolean;
        items?: PendingItem[];
        error?: string;
      }>("pluggy-list-items", { body: { clientUserId: bankAccountId } });
      if (fnErr) throw fnErr;
      if (!data?.success) throw new Error(data?.error || "Erro ao buscar conexões");
      setPendingItems(data.items ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRecovering(false);
    }
  };

  const useExistingItem = (id: string) => {
    setItemId(id);
    fetchAccounts(id);
  };

  const fetchAccounts = async (id: string) => {
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke<{
        success: boolean;
        accounts?: PluggyAccount[];
        error?: string;
      }>("pluggy-list-item-accounts", { body: { itemId: id } });
      if (fnErr) throw fnErr;
      if (!data?.success) throw new Error(data?.error || "Erro ao listar contas");
      setAccounts(data.accounts ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const linkMutation = useMutation({
    mutationFn: async (acc: PluggyAccount) => {
      const { error: updErr } = await supabase
        .from("bank_accounts")
        .update({
          openfinance_provider: "pluggy",
          openfinance_connection_id: acc.item_id,
          openfinance_account_id: acc.account_id,
          openfinance_institution: acc.institution,
        })
        .eq("id", bankAccountId);
      if (updErr) throw updErr;
      // Já dispara sync inicial de saldo
      await supabase.functions.invoke("pluggy-sync-balances", {
        body: { bank_account_id: bankAccountId },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-accounts-all"] });
      toast({ title: "Banco conectado via Pluggy" });
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "Erro ao vincular", description: e.message, variant: "destructive" });
    },
  });

  const hasUnlinkedAccounts = !!accounts && accounts.length > 0;

  const handleOpenChange = (v: boolean) => {
    if (!v && hasUnlinkedAccounts && !linkMutation.isPending) {
      const ok = window.confirm(
        "Atenção: você ainda não vinculou nenhuma conta!\n\n" +
          "A autorização no banco já aconteceu, mas SEM o passo final de \"Vincular conta\" " +
          "o ROY não vai conseguir puxar saldo nem extrato.\n\n" +
          "Tem certeza que quer fechar mesmo assim?"
      );
      if (!ok) return;
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conectar via Pluggy — {bankAccountName}</DialogTitle>
          <DialogDescription>
            Fluxo em <strong>3 passos</strong>: (1) autorizar no banco, (2) selecionar a conta,
            (3) clicar em <strong>"Vincular conta"</strong>. Sem o passo 3 a conexão não é salva no ROY.
          </DialogDescription>
        </DialogHeader>

        {!accounts && !loading && !error && (
          <div className="py-8 flex flex-col items-center gap-3">
            <Button onClick={startConnect} size="lg">
              <LinkIcon className="h-4 w-4 mr-2" />
              Conectar banco
            </Button>
            <p className="text-xs text-muted-foreground max-w-md text-center">
              Você será redirecionado para o widget da Pluggy. Conclua a autorização e
              <strong> NÃO feche</strong> esta janela antes de clicar em "Vincular conta" no passo final.
            </p>
          </div>
        )}


        {loading && (
          <div className="py-12 flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            {itemId ? "Carregando contas do banco..." : "Abrindo Pluggy..."}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div className="text-sm flex-1">
              <p className="font-medium text-destructive">Erro</p>
              <p className="text-muted-foreground mt-1">{error}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={startConnect}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {accounts && accounts.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma conta retornada pelo banco.
          </p>
        )}

        {hasUnlinkedAccounts && (
          <>
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 flex gap-2 items-start">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  Passo final obrigatório
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Selecione a conta abaixo e clique em <strong>"Vincular conta"</strong>.
                  Fechar agora descarta a conexão.
                </p>
              </div>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {accounts!.map((a) => {
                const isSel = selected?.account_id === a.account_id;
                return (
                  <button
                    key={a.account_id}
                    type="button"
                    onClick={() => setSelected(a)}
                    className={`w-full text-left rounded-md border p-3 transition ${
                      isSel ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{a.account_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.institution} • {a.account_number || a.account_id}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{a.account_type}</Badge>
                        {a.balance != null && (
                          <div className="text-xs text-muted-foreground mt-1">
                            R$ {a.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={linkMutation.isPending}
          >
            Cancelar
          </Button>
          {hasUnlinkedAccounts && (
            <Button
              disabled={!selected || linkMutation.isPending}
              onClick={() => selected && linkMutation.mutate(selected)}
              className={selected ? "animate-pulse" : ""}
            >
              {linkMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LinkIcon className="h-4 w-4 mr-2" />
              )}
              Vincular conta {selected ? "✓" : "(selecione uma conta)"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
