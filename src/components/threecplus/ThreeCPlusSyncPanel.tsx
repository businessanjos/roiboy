import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, RefreshCw, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AgentRow {
  id: string;
  external_agent_id: string;
  external_name: string | null;
  external_email: string | null;
  user_id: string | null;
  token_status: string;
  last_synced_at: string | null;
}

interface SyncState {
  last_synced_at: string | null;
  last_run_at: string | null;
  status: string;
  is_paused: boolean;
  last_error: string | null;
  calls_synced: number;
}

interface Props {
  onSynced?: () => void;
}

export function ThreeCPlusSyncPanel({ onSynced }: Props) {
  const { currentUser } = useCurrentUser();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [state, setState] = useState<SyncState | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [userInput, setUserInput] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);
    const [agentsRes, stateRes, usersRes] = await Promise.all([
      supabase
        .from("threecplus_agents")
        .select("id, external_agent_id, external_name, external_email, user_id, token_status, last_synced_at")
        .eq("account_id", currentUser.account_id)
        .order("external_name"),
      supabase
        .from("threecplus_sync_state")
        .select("last_synced_at, last_run_at, status, is_paused, last_error, calls_synced")
        .eq("account_id", currentUser.account_id)
        .maybeSingle(),
      supabase
        .from("users")
        .select("id, name")
        .eq("account_id", currentUser.account_id)
        .order("name"),
    ]);
    setAgents((agentsRes.data as AgentRow[]) || []);
    setState((stateRes.data as SyncState) || null);
    setUsers((usersRes.data as { id: string; name: string }[]) || []);
    setLoading(false);
  }, [currentUser?.account_id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async (days?: number) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-sync-calls", {
        body: { days, force: true },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`${data?.synced ?? 0} ligações sincronizadas`);
        onSynced?.();
      }
    } catch (err: any) {
      toast.error(err?.message || "Falha ao sincronizar");
    } finally {
      setSyncing(false);
      load();
    }
  };

  const handleSaveAgent = async () => {
    if (!tokenInput.trim()) {
      toast.error("Informe o token da API do agente");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-register-agent", {
        body: {
          api_token: tokenInput.trim(),
          user_id: userInput === "none" ? null : userInput,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || "Não foi possível validar o token");
        return;
      }
      toast.success(`Agente ${data.agent?.external_name || ""} cadastrado`);
      setTokenInput("");
      setUserInput("none");
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao cadastrar agente");
    } finally {
      setSaving(false);
    }
  };

  const handleLinkUser = async (agentId: string, userId: string) => {
    const value = userId === "none" ? null : userId;
    const { error } = await supabase
      .from("threecplus_agents")
      .update({ user_id: value })
      .eq("id", agentId);
    if (error) {
      toast.error("Não foi possível vincular o usuário");
      return;
    }
    setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, user_id: value } : a)));
  };

  const handleDelete = async (agentId: string) => {
    const { error } = await supabase.functions.invoke("threecplus-register-agent", {
      body: { action: "delete", agent_id: agentId },
    });
    if (error) {
      toast.error("Não foi possível remover o agente");
      return;
    }
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Sincronização 3C Plus
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {state?.last_synced_at
              ? `Última sincronização: ${format(new Date(state.last_synced_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`
              : "Nenhuma sincronização executada ainda"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSync(90)} disabled={syncing}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Sincronizar</span>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Agente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar agente da 3C Plus</DialogTitle>
                <DialogDescription>
                  Cole o token de API da 3C Plus do agente (perfil do usuário na 3C Plus &gt; Token de API).
                  O token fica protegido e é usado apenas para importar o histórico de ligações dessa pessoa.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tc-token">Token da API</Label>
                  <Input
                    id="tc-token"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="ex.: ij1wUgu9thSZ..."
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Vincular a um usuário do ROY</Label>
                  <Select value={userInput} onValueChange={setUserInput}>
                    <SelectTrigger>
                      <SelectValue placeholder="Detectar automaticamente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Detectar automaticamente</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveAgent} disabled={saving}>
                  {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  Validar e salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {state?.last_error && (
          <p className="text-xs text-destructive">{state.last_error}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : agents.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum agente cadastrado. Adicione o token de API de cada pessoa (Cleberson, Darlan, Rafaela...)
            para importar as ligações feitas direto no painel da 3C Plus.
          </p>
        ) : (
          <div className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex flex-wrap items-center gap-2 justify-between rounded-lg border border-border/60 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {agent.external_name || `Agente ${agent.external_agent_id}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      ID 3C {agent.external_agent_id}
                      {agent.last_synced_at
                        ? ` · sincronizado ${format(new Date(agent.last_synced_at), "dd/MM HH:mm", { locale: ptBR })}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={agent.token_status === "ok" ? "default" : "destructive"}
                    className="text-[10px]"
                  >
                    {agent.token_status === "ok" ? "Token válido" : "Token inválido"}
                  </Badge>
                  <Select
                    value={agent.user_id ?? "none"}
                    onValueChange={(v) => handleLinkUser(agent.id, v)}
                  >
                    <SelectTrigger className="h-8 w-[180px] text-xs">
                      <SelectValue placeholder="Vincular usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem vínculo</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDelete(agent.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
