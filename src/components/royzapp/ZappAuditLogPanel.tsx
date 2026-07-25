import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, History, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ZappAuditLogPanelProps {
  sectorId?: string | null;
  limit?: number;
}

interface AuditRow {
  id: string;
  action: string;
  sector_id: string | null;
  created_at: string;
  reason: string | null;
  from_agent_id: string | null;
  to_agent_id: string | null;
  from_department_id: string | null;
  to_department_id: string | null;
  actor_user_id: string | null;
  zapp_conversation_id: string | null;
}

const ACTION_LABEL: Record<string, { label: string; className: string }> = {
  assign: { label: "Atribuição", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  reassign: { label: "Reatribuição", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  transfer: { label: "Transferência", className: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
};

export function ZappAuditLogPanel({ sectorId, limit = 100 }: ZappAuditLogPanelProps) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [depts, setDepts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("zapp_audit_logs")
        .select(
          "id, action, sector_id, created_at, reason, from_agent_id, to_agent_id, from_department_id, to_department_id, actor_user_id, zapp_conversation_id",
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (sectorId) query = query.eq("sector_id", sectorId);

      const { data, error } = await query;
      if (error) throw error;
      const logs = (data || []) as AuditRow[];
      setRows(logs);

      const agentIds = Array.from(
        new Set(logs.flatMap((r) => [r.from_agent_id, r.to_agent_id]).filter(Boolean) as string[]),
      );
      const deptIds = Array.from(
        new Set(
          logs.flatMap((r) => [r.from_department_id, r.to_department_id]).filter(Boolean) as string[],
        ),
      );
      const userIds = Array.from(new Set(logs.map((r) => r.actor_user_id).filter(Boolean) as string[]));

      const nameMap: Record<string, string> = {};

      if (agentIds.length) {
        const { data: agents } = await supabase
          .from("zapp_agents")
          .select("id, user_id")
          .in("id", agentIds);
        const agentUserIds = Array.from(
          new Set((agents || []).map((a) => a.user_id).filter(Boolean) as string[]),
        );
        const allUserIds = Array.from(new Set([...userIds, ...agentUserIds]));
        const { data: users } = allUserIds.length
          ? await supabase.from("users").select("id, name, email").in("id", allUserIds)
          : { data: [] as any[] };
        const userName: Record<string, string> = {};
        (users || []).forEach((u: any) => {
          userName[u.id] = u.name || u.email || "Usuário";
        });
        (agents || []).forEach((a: any) => {
          nameMap[a.id] = userName[a.user_id] || "Atendente";
        });
        userIds.forEach((id) => {
          nameMap[id] = userName[id] || "Usuário";
        });
      } else if (userIds.length) {
        const { data: users } = await supabase
          .from("users")
          .select("id, name, email")
          .in("id", userIds);
        (users || []).forEach((u: any) => {
          nameMap[u.id] = u.name || u.email || "Usuário";
        });
      }

      setNames(nameMap);

      if (deptIds.length) {
        const { data: departments } = await supabase
          .from("zapp_departments")
          .select("id, name")
          .in("id", deptIds);
        const deptMap: Record<string, string> = {};
        (departments || []).forEach((d: any) => {
          deptMap[d.id] = d.name;
        });
        setDepts(deptMap);
      } else {
        setDepts({});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectorId, limit]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-zapp-accent" />
            Log de auditoria
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Transferências e reatribuições de conversas: quem fez, quando, de qual setor e para qual
            responsável.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
          <History className="h-5 w-5" />
          Nenhuma ação registrada ainda.
        </div>
      ) : (
        <ScrollArea className="h-[520px] pr-3">
          <div className="space-y-2">
            {rows.map((row) => {
              const meta = ACTION_LABEL[row.action] || {
                label: row.action,
                className: "bg-muted text-muted-foreground border-border",
              };
              const fromAgent = row.from_agent_id ? names[row.from_agent_id] : null;
              const toAgent = row.to_agent_id ? names[row.to_agent_id] : null;
              const fromDept = row.from_department_id ? depts[row.from_department_id] : null;
              const toDept = row.to_department_id ? depts[row.to_department_id] : null;

              return (
                <div key={row.id} className="rounded-lg border border-border bg-card/60 p-3 text-xs space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={meta.className}>
                      {meta.label}
                    </Badge>
                    {row.sector_id && (
                      <Badge variant="outline" className="capitalize">
                        {row.sector_id}
                      </Badge>
                    )}
                    <span className="text-muted-foreground ml-auto">
                      {format(new Date(row.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted-foreground">Responsável:</span>
                    <span className="font-medium">{fromAgent || "Fila / sem responsável"}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium text-zapp-accent">{toAgent || "Fila / sem responsável"}</span>
                  </div>

                  {(fromDept || toDept) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-muted-foreground">Fila:</span>
                      <span>{fromDept || "—"}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span>{toDept || "—"}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                    <span>Executado por:</span>
                    <span className="font-medium text-foreground">
                      {(row.actor_user_id && names[row.actor_user_id]) || "Sistema / automação"}
                    </span>
                    {row.zapp_conversation_id && (
                      <span className="ml-auto font-mono uppercase">
                        #{row.zapp_conversation_id.slice(0, 6)}
                      </span>
                    )}
                  </div>

                  {row.reason && <p className="text-muted-foreground italic">Motivo: {row.reason}</p>}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
