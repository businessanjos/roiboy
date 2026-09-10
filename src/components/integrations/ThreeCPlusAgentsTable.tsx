import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Headphones, Loader2, Plus, RefreshCw, Save, Trash2, Zap } from "lucide-react";

interface AccountUser {
  id: string;
  name: string | null;
  email: string | null;
}

interface Row extends AccountUser {
  extension: string;
  password: string;
  hasPassword: boolean;
  agentId: string;
  agentName: string | null;
  runtimeStatus?: "offline" | "idle" | "on_call" | "break";
}

export function ThreeCPlusAgentsTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [agentTokenConfigured, setAgentTokenConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});
  const [addUserId, setAddUserId] = useState("");
  const [legacyToken, setLegacyToken] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("threecplus-register-agent", {
        body: { action: "list_links" },
      });

      const accountUsers: AccountUser[] = (data?.users || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
      }));
      setUsers(accountUsers);
      setMeId(data?.me_user_id || null);
      setIsAdmin(Boolean(data?.is_admin));
      setAgentTokenConfigured(Boolean(data?.agent_token_configured));

      const linkByUser = new Map<string, any>();
      for (const l of data?.links || []) linkByUser.set(l.user_id, l);
      const agentByUser = new Map<string, any>();
      for (const a of data?.agents || []) if (a.user_id) agentByUser.set(a.user_id, a);

      const built: Row[] = accountUsers
        .filter((u) => linkByUser.get(u.id)?.extension || linkByUser.get(u.id)?.agent_id || agentByUser.get(u.id))
        .filter((u) => data?.is_admin || u.id === data?.me_user_id)
        .map((u) => {
          const link = linkByUser.get(u.id);
          const agent = agentByUser.get(u.id);
          return {
            ...u,
            extension: link?.extension || "",
            password: "",
            hasPassword: Boolean(link?.has_password),
            agentId: link?.agent_id || (agent ? String(agent.external_agent_id) : ""),
            agentName: agent?.external_name || null,
          };
        });

      setRows(built);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let active = true;
    const refreshStatuses = async () => {
      const { data } = await supabase.functions.invoke("threecplus-register-agent", {
        body: { action: "agent_statuses" },
      });
      if (!active || !data?.success) return;
      setRows((previous) => previous.map((row) => ({
        ...row,
        runtimeStatus: data.statuses?.[row.id] || "offline",
      })));
    };
    void refreshStatuses();
    const timer = window.setInterval(() => { void refreshStatuses(); }, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const availableUsers = useMemo(
    () => users.filter((u) => !rows.some((r) => r.id === u.id)),
    [users, rows],
  );

  const update = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addPerson = () => {
    const user = users.find((u) => u.id === addUserId);
    if (!user) return;
    setRows((prev) => [
      ...prev,
      { ...user, extension: "", password: "", hasPassword: false, agentId: "", agentName: null },
    ]);
    setAddUserId("");
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-register-agent", {
        body: { action: "sync_agents" },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error("Não foi possível sincronizar", { description: data?.error });
        return;
      }
      toast.success(`${data.linked} pessoa(s) vinculada(s) de ${data.agents_found} agente(s) na 3C.`);
      await load();
    } catch (err: any) {
      toast.error("Erro ao sincronizar", { description: err?.message });
    } finally {
      setSyncing(false);
    }
  };

  const save = async (row: Row) => {
    if (!row.extension.trim()) {
      toast.error("Informe o ramal.");
      return;
    }
    setBusyId(row.id);
    try {
      const isSelf = row.id === meId;
      const { data, error } = await supabase.functions.invoke("threecplus-register-agent", {
        body: {
          action: isSelf ? "save_extension" : "admin_save_extension",
          user_id: row.id,
          extension: row.extension.trim(),
          extension_password: row.password.trim() || null,
          agent_id: row.agentId.trim() || null,
          api_token: isSelf && !agentTokenConfigured && legacyToken.trim() ? legacyToken.trim() : null,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error("Não foi possível salvar", { description: data?.error });
        return;
      }
      update(row.id, {
        agentId: String(data.agent_id),
        password: "",
        hasPassword: row.hasPassword || Boolean(row.password.trim()),
      });
      toast.success(`${row.name || "Pessoa"} vinculada ao agente ${data.agent_id}.`);
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err?.message });
    } finally {
      setBusyId(null);
    }
  };

  const test = async (row: Row) => {
    setBusyId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-register-agent", {
        body: { action: "test_agent", user_id: row.id },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error("Teste falhou", { description: data?.error });
        return;
      }
      toast.success(`Conexão ok — agente ${data.agent_id}${data.name ? ` (${data.name})` : ""}.`);
    } catch (err: any) {
      toast.error("Erro no teste", { description: err?.message });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (row: Row) => {
    setBusyId(row.id);
    try {
      const { error } = await supabase.functions.invoke("threecplus-register-agent", {
        body: { action: "remove_link", user_id: row.id },
      });
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success("Vínculo removido.");
    } catch (err: any) {
      toast.error("Erro ao remover", { description: err?.message });
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (row: Row) => {
    if (!row.agentId) return <Badge variant="secondary">Não vinculado</Badge>;
    if (!row.hasPassword && !row.password.trim()) return <Badge variant="outline">Falta senha</Badge>;
    const labels = { offline: "Offline", idle: "Ocioso", on_call: "Em chamada", break: "Intervalo" };
    const variants = { offline: "secondary", idle: "default", on_call: "destructive", break: "outline" } as const;
    const state = row.runtimeStatus || "offline";
    return <Badge variant={variants[state]}>{labels[state]}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Headphones className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Agentes</CardTitle>
              <CardDescription>Pessoas do ROY que discam pela 3C Plus, com ramal, senha e agente.</CardDescription>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={sync} disabled={syncing || loading}>
                {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sincronizar com a 3C
              </Button>
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger className="h-9 w-[200px]">
                  <SelectValue placeholder="+ Adicionar pessoa" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={addPerson} disabled={!addUserId}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma pessoa vinculada à 3C ainda. Use "Sincronizar com a 3C" ou adicione manualmente.
          </p>
        ) : (
          <div className="max-h-[460px] overflow-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead className="w-[110px]">Ramal</TableHead>
                  <TableHead className="w-[150px]">Senha</TableHead>
                  <TableHead className="w-[170px]">Agente 3C</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[190px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className={row.id === meId ? "bg-primary/5" : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        {row.name || row.email}
                        {row.id === meId && (
                          <Badge variant="outline" className="text-[10px]">
                            você
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.extension}
                        placeholder="1001"
                        onChange={(e) => update(row.id, { extension: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <Input
                          type={showPwd[row.id] ? "text" : "password"}
                          value={row.password}
                          placeholder={row.hasPassword ? "••••• salva" : "•••••"}
                          className="pr-9"
                          onChange={(e) => update(row.id, { password: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd((p) => ({ ...p, [row.id]: !p[row.id] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPwd[row.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.agentId}
                        placeholder="não encontrado"
                        onChange={(e) => update(row.id, { agentId: e.target.value.replace(/\D/g, "") })}
                      />
                      {row.agentName && (
                        <div className="mt-1 truncate text-[11px] text-muted-foreground">{row.agentName}</div>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(row)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="sm" onClick={() => save(row)} disabled={busyId === row.id}>
                          {busyId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => test(row)}
                          disabled={busyId === row.id || !row.agentId}
                        >
                          <Zap className="mr-1 h-4 w-4" /> Testar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove(row)}
                          disabled={busyId === row.id}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!agentTokenConfigured && (
          <Collapsible>
            <CollapsibleTrigger className="text-xs text-muted-foreground underline underline-offset-4">
              Avançado (legado)
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Sem token de serviço de Agente na conta, informe seu token individual da 3C antes de salvar sua
                linha. Tokens individuais deixam de funcionar em 01/10/2026.
              </p>
              <Input
                type="password"
                className="font-mono text-sm"
                placeholder="Token individual do agente"
                value={legacyToken}
                onChange={(e) => setLegacyToken(e.target.value)}
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
