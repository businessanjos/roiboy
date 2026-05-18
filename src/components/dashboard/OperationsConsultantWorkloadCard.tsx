import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare, Clock, MessagesSquare, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ConsultantRow {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  activeClients: number;
  conversations: number;
  messagesSent: number;
  avgServiceMin: number;
  msgsPerDay: number;
  convsPerDay: number;
}

const RANGES: Record<string, number> = {
  "7": 7,
  "15": 15,
  "30": 30,
  "60": 60,
  "90": 90,
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("");
}

export function OperationsConsultantWorkloadCard() {
  const [rangeDays, setRangeDays] = useState<string>("7");
  const [rows, setRows] = useState<ConsultantRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const days = RANGES[rangeDays] ?? 7;
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const load = async () => {
      setLoading(true);
      try {
        // Operations consultants: team_role.name = 'Consultor'
        const { data: consultants, error: usersErr } = await supabase
          .from("users")
          .select("id, name, email, avatar_url, is_active, team_roles!users_team_role_id_fkey(name)")
          .eq("is_active", true);

        if (usersErr) throw usersErr;

        const opsUsers = (consultants || []).filter((u: any) => {
          const tr = u.team_roles?.name?.toLowerCase() || "";
          return tr.includes("consultor");
        });

        if (opsUsers.length === 0) {
          if (!cancelled) setRows([]);
          return;
        }

        const userIds = opsUsers.map((u: any) => u.id);

        // Active clients per consultant
        const { data: clientsData } = await supabase
          .from("clients")
          .select("responsible_user_id, status")
          .in("responsible_user_id", userIds)
          .eq("status", "active");

        const clientsByUser = new Map<string, number>();
        (clientsData || []).forEach((c: any) => {
          clientsByUser.set(
            c.responsible_user_id,
            (clientsByUser.get(c.responsible_user_id) || 0) + 1
          );
        });

        // Messages sent (outbound) per consultant in range
        const { data: messages } = await supabase
          .from("zapp_messages")
          .select("sender_user_id, zapp_conversation_id, direction, sent_at")
          .in("sender_user_id", userIds)
          .eq("direction", "outbound")
          .gte("sent_at", sinceIso)
          .limit(50000);

        const msgsByUser = new Map<string, number>();
        const convsByUser = new Map<string, Set<string>>();
        (messages || []).forEach((m: any) => {
          if (!m.sender_user_id) return;
          msgsByUser.set(m.sender_user_id, (msgsByUser.get(m.sender_user_id) || 0) + 1);
          if (m.zapp_conversation_id) {
            if (!convsByUser.has(m.sender_user_id)) {
              convsByUser.set(m.sender_user_id, new Set());
            }
            convsByUser.get(m.sender_user_id)!.add(m.zapp_conversation_id);
          }
        });

        // Avg service duration from closed assignments in range
        const { data: assignments } = await supabase
          .from("zapp_conversation_assignments")
          .select("agent_id, service_duration_minutes, closed_at")
          .in("agent_id", userIds)
          .not("service_duration_minutes", "is", null)
          .gte("closed_at", sinceIso)
          .limit(10000);

        const durByUser = new Map<string, { sum: number; n: number }>();
        (assignments || []).forEach((a: any) => {
          if (!a.agent_id || a.service_duration_minutes == null) return;
          const prev = durByUser.get(a.agent_id) || { sum: 0, n: 0 };
          prev.sum += Number(a.service_duration_minutes) || 0;
          prev.n += 1;
          durByUser.set(a.agent_id, prev);
        });

        const built: ConsultantRow[] = opsUsers.map((u: any) => {
          const dur = durByUser.get(u.id);
          const convs = convsByUser.get(u.id)?.size || 0;
          const msgs = msgsByUser.get(u.id) || 0;
          return {
            id: u.id,
            name: u.name || u.email || "—",
            email: u.email || "",
            avatar_url: u.avatar_url,
            activeClients: clientsByUser.get(u.id) || 0,
            conversations: convs,
            messagesSent: msgs,
            avgServiceMin: dur && dur.n > 0 ? Math.round(dur.sum / dur.n) : 0,
            msgsPerDay: Math.round((msgs / days) * 10) / 10,
            convsPerDay: Math.round((convs / days) * 10) / 10,
          };
        });

        built.sort((a, b) => b.activeClients - a.activeClients);

        if (!cancelled) setRows(built);
      } catch (e) {
        console.error("[OpsConsultantWorkload] load error", e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [rangeDays]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        clients: acc.clients + r.activeClients,
        convs: acc.convs + r.conversations,
        msgs: acc.msgs + r.messagesSent,
      }),
      { clients: 0, convs: 0, msgs: 0 }
    );
  }, [rows]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Demanda dos Consultores de Operações
          </CardTitle>
          <CardDescription>
            Carteira ativa, conversas atendidas, mensagens trocadas e tempo médio de atendimento
            por consultor. Use para confrontar reclamações de sobrecarga.
          </CardDescription>
        </div>
        <Select value={rangeDays} onValueChange={setRangeDays}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="15">Últimos 15 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando métricas...
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum consultor de Operações encontrado.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Carteira total</div>
                <div className="text-2xl font-bold">{totals.clients}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Conversas no período</div>
                <div className="text-2xl font-bold">{totals.convs}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Mensagens enviadas</div>
                <div className="text-2xl font-bold">{totals.msgs}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">Consultora</th>
                    <th className="py-2 px-2 font-medium text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Users className="h-3.5 w-3.5" /> Carteira
                      </div>
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      <div className="flex items-center justify-end gap-1">
                        <MessagesSquare className="h-3.5 w-3.5" /> Conversas
                      </div>
                    </th>
                    <th className="py-2 px-2 font-medium text-right hidden md:table-cell">
                      Conv./dia
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      <div className="flex items-center justify-end gap-1">
                        <MessageSquare className="h-3.5 w-3.5" /> Mensagens
                      </div>
                    </th>
                    <th className="py-2 px-2 font-medium text-right hidden md:table-cell">
                      Msgs/dia
                    </th>
                    <th className="py-2 pl-2 font-medium text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="h-3.5 w-3.5" /> Tempo médio
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const heavy = r.activeClients >= 40;
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={r.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {initials(r.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium leading-tight">{r.name}</div>
                              <div className="text-xs text-muted-foreground leading-tight">
                                {r.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Badge variant={heavy ? "destructive" : "secondary"}>
                            {r.activeClients}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-right">{r.conversations}</td>
                        <td className="py-2 px-2 text-right hidden md:table-cell">
                          {r.convsPerDay}
                        </td>
                        <td className="py-2 px-2 text-right">{r.messagesSent}</td>
                        <td className="py-2 px-2 text-right hidden md:table-cell">
                          {r.msgsPerDay}
                        </td>
                        <td className="py-2 pl-2 text-right">
                          {r.avgServiceMin > 0 ? `${r.avgServiceMin} min` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Tempo médio considera conversas encerradas no período. Carteira =
              clientes ativos atribuídos.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
