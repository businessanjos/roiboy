import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePaginationState } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, History } from "lucide-react";
import { PERMISSION_CATALOG, LEVEL_LABELS } from "@/lib/access/permissionCatalog";

const PIPE: Record<string, string> = { own: "Só os dele", all: "Todos do funil", none: "Sem acesso" };

function itemLabel(key: string) {
  const [m, s] = key.split("/");
  const mod = PERMISSION_CATALOG.find((x) => x.module === m);
  return mod?.items.find((i) => i.sub === s)?.label ?? key;
}
function levelLabel(v: string) {
  if (!v || v === "Padrão") return "Padrão";
  const [lvl, scope] = v.split("/");
  const l = (LEVEL_LABELS as Record<string, string>)[lvl] ?? lvl;
  return lvl === "none" ? l : `${l}${scope === "all" ? " · equipe" : ""}`;
}

function describe(r: any): string {
  const d = r.details ?? {};
  switch (r.action) {
    case "user.access_replicated": return `Recebeu os acessos de ${d.origem ?? "outra pessoa"}`;
    case "user.permission_changed": return `${itemLabel(d.item)}: ${levelLabel(d.antes)} → ${levelLabel(d.depois)}`;
    case "user.pipeline_access_changed": return `Funil ${d.funil ?? ""}: ${PIPE[d.antes] ?? d.antes} → ${PIPE[d.depois] ?? d.depois}`;
    case "user.deal_visibility_changed": return "Visibilidade de negócios alterada";
    case "user.access_profile_changed": return "Perfil de acesso alterado";
    default: return r.action;
  }
}

export function UserAccessHistory({ userId, accountId }: { userId: string; accountId: string }) {
  const [open, setOpen] = useState(false);

  const { data: count = 0 } = useQuery({
    queryKey: ["user-access-history-count", accountId, userId],
    enabled: open,
    queryFn: async () => {
      const { count } = await supabase.from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId).eq("entity_type", "user").eq("entity_id", userId)
        .in("action", ["user.access_replicated", "user.permission_changed", "user.pipeline_access_changed", "user.deal_visibility_changed", "user.access_profile_changed"]);
      return count ?? 0;
    },
  });

  const pg = usePaginationState(count, { resetKey: [accountId, userId], defaultPageSize: 20 });

  const { data = [], isLoading } = useQuery({
    queryKey: ["user-access-history", accountId, userId, pg.from, pg.to],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs")
        .select("id, action, details, user_name, created_at")
        .eq("account_id", accountId).eq("entity_type", "user").eq("entity_id", userId)
        .in("action", ["user.access_replicated", "user.permission_changed", "user.pipeline_access_changed", "user.deal_visibility_changed", "user.access_profile_changed"])
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(pg.from, pg.to);
      return data ?? [];
    },
  });

  return (
    <div className="rounded-md border">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        <span className="flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Histórico de alterações de acesso</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto border-t divide-y">
          {isLoading && <p className="p-3 text-xs text-muted-foreground">Carregando…</p>}
          {!isLoading && data.length === 0 && <p className="p-3 text-xs text-muted-foreground">Nenhuma alteração registrada ainda.</p>}
          {data.map((r: any) => (
            <div key={r.id} className="px-3 py-2">
              <p className="text-sm">{describe(r)}</p>
              <p className="text-xs text-muted-foreground">
                {r.user_name ?? "Sistema"} · {format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          ))}
          {count > pg.pageSize && <PagerFor state={pg} itemLabel="alterações" hidePageSize />}
        </div>
      )}
    </div>
  );
}
