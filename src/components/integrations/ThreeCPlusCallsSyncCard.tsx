import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, RefreshCw } from "lucide-react";

interface SyncState {
  last_synced_at: string | null;
  last_run_at: string | null;
  status: string;
  last_error: string | null;
  calls_synced: number;
}

export function ThreeCPlusCallsSyncCard() {
  const { currentUser } = useCurrentUser();
  const [state, setState] = useState<SyncState | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("threecplus_sync_state")
      .select("last_synced_at, last_run_at, status, last_error, calls_synced")
      .eq("account_id", currentUser.account_id)
      .maybeSingle();
    setState((data as SyncState) || null);
    setLoading(false);
  }, [currentUser?.account_id]);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-sync-calls", {
        body: { days: 90, force: true },
      });
      if (error) throw error;
      if (data?.error) toast.error(data.error);
      else toast.success(`${data?.synced ?? 0} ligações sincronizadas.`);
    } catch (err: any) {
      toast.error("Falha ao sincronizar", { description: err?.message });
    } finally {
      setSyncing(false);
      load();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Sincronização de ligações</CardTitle>
              <CardDescription>Importa o histórico de ligações da 3C para os relatórios do ROY.</CardDescription>
            </div>
          </div>
          <Button size="sm" onClick={sync} disabled={syncing}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sincronizar agora
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Última sincronização</p>
              <p className="text-sm font-medium">
                {state?.last_synced_at
                  ? format(new Date(state.last_synced_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : "Nunca"}
              </p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Ligações importadas</p>
              <p className="text-sm font-medium">{state?.calls_synced ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Erros</p>
              <p className={`text-sm font-medium ${state?.last_error ? "text-destructive" : ""}`}>
                {state?.last_error || "Nenhum"}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
