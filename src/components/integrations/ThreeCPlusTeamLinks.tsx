import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Save, Users } from "lucide-react";

interface Row {
  id: string;
  name: string | null;
  email: string | null;
  extension: string;
  password: string;
  agentId: string;
  linked: boolean;
}

export function ThreeCPlusTeamLinks() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: users }, { data: linkData }] = await Promise.all([
        supabase.from("users").select("id, name, email, is_active").order("name"),
        supabase.functions.invoke("threecplus-register-agent", { body: { action: "list_links" } }),
      ]);

      const links = new Map<string, any>();
      for (const l of linkData?.links || []) links.set(l.user_id, l);
      for (const a of linkData?.agents || []) {
        if (a.user_id && !links.get(a.user_id)?.agent_id) {
          links.set(a.user_id, { ...(links.get(a.user_id) || {}), agent_id: String(a.external_agent_id) });
        }
      }

      setRows(
        (users || [])
          .filter((u: any) => u.is_active !== false)
          .map((u: any) => {
            const link = links.get(u.id);
            return {
              id: u.id,
              name: u.name,
              email: u.email,
              extension: link?.extension || "",
              password: "",
              agentId: link?.agent_id || "",
              linked: Boolean(link?.agent_id),
            };
          }),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async (row: Row) => {
    if (!row.extension.trim()) {
      toast.error("Informe o ramal.");
      return;
    }
    setSavingId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-register-agent", {
        body: {
          action: "admin_save_extension",
          user_id: row.id,
          extension: row.extension.trim(),
          extension_password: row.password.trim() || null,
          agent_id: row.agentId.trim() || null,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error("Não foi possível vincular", { description: data?.error });
        return;
      }
      update(row.id, { agentId: String(data.agent_id), linked: true, password: "" });
      toast.success(`${row.name || "Usuário"} vinculado ao agente ${data.agent_id}.`);
    } catch (err: any) {
      toast.error("Erro ao vincular agente", { description: err?.message });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Agentes 3C da equipe</CardTitle>
              <CardDescription>
                Preencha ramal, senha e, se precisar, o ID do agente de qualquer pessoa — sem entrar na conta dela.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={syncAgents} disabled={syncing || loading}>
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sincronizar agentes da 3C
            </Button>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              Atualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-[420px] overflow-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead className="w-[110px]">Ramal</TableHead>
                  <TableHead className="w-[140px]">Senha</TableHead>
                  <TableHead className="w-[140px]">Agente 3C</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.name || row.email}</div>
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
                      <Input
                        type="password"
                        value={row.password}
                        placeholder="•••••"
                        onChange={(e) => update(row.id, { password: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.agentId}
                        placeholder="auto"
                        onChange={(e) => update(row.id, { agentId: e.target.value.replace(/\D/g, "") })}
                      />
                      {row.linked && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          Vinculado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => save(row)} disabled={savingId === row.id}>
                        {savingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="mr-1.5 h-4 w-4" /> Salvar
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
