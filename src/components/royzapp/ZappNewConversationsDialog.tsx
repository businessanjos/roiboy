import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePagedList } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";
import { Inbox, Send, ExternalLink, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type NewConvFilter = "all" | "client" | "team";

interface Row {
  conversation_id: string;
  client_id: string | null;
  contact_name: string;
  phone_e164: string | null;
  is_group: boolean;
  started_by: "client" | "team";
  started_at: string;
  starter_name: string;
  first_message: string;
  messages_in: number;
  messages_out: number;
  last_at: string | null;
  reply_at: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialFilter: NewConvFilter;
  sectorId: string | null;
  integrationId: string | null;
  includeGroups: boolean;
  agentUserId: string | null;
  from: Date;
  to: Date;
  periodLabel?: string;
  onOpenConversation?: (id: string) => void;
  onlyUnidentified?: boolean;
}

const TZ = "America/Sao_Paulo";
const fmtDT = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDay = (s: string) =>
  new Date(s).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long" });
const dayKey = (s: string) => new Date(s).toLocaleDateString("en-CA", { timeZone: TZ });

function fmtGap(a: string, b: string | null) {
  if (!b) return null;
  const s = (new Date(b).getTime() - new Date(a).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h${String(Math.round((s % 3600) / 60)).padStart(2, "0")}`;
  return `${Math.round(s / 86400)}d`;
}

export function ZappNewConversationsDialog(p: Props) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<NewConvFilter>(p.initialFilter);
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["zapp-new-convs", p.sectorId, p.integrationId, p.includeGroups, p.agentUserId, p.from.toISOString(), p.to.toISOString()],
    enabled: p.open,
    staleTime: 60_000,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await (supabase as any).rpc("zapp_productivity_new_conversations", {
        _sector_id: p.sectorId, _from: p.from.toISOString(), _to: p.to.toISOString(),
        _integration_id: p.integrationId, _include_groups: p.includeGroups, _agent_user_id: p.agentUserId,
      });
      if (error) throw error;
      return (data as Row[]) || [];
    },
  });

  const all = (data || []).filter((r) => !p.onlyUnidentified || (r.started_by === "team" && r.starter_name === "Não identificado (celular)"));
  const counts = { all: all.length, client: all.filter((r) => r.started_by === "client").length, team: all.filter((r) => r.started_by === "team").length };

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    return all.filter((r) => (filter === "all" || r.started_by === filter) &&
      (!t || r.contact_name.toLowerCase().includes(t) || (r.phone_e164 || "").includes(t) || r.starter_name.toLowerCase().includes(t) || r.first_message.toLowerCase().includes(t)));
  }, [all, filter, search]);

  const pg = usePagedList(rows, { resetKey: [filter, search], isLoading });

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: Row[] }[] = [];
    for (const r of pg.items) {
      const k = dayKey(r.started_at);
      let g = out.find((x) => x.key === k);
      if (!g) { g = { key: k, label: fmtDay(r.started_at), items: [] }; out.push(g); }
      g.items.push(r);
    }
    return out;
  }, [pg.items]);

  const chips: { k: NewConvFilter; label: string }[] = [
    { k: "all", label: "Todos" }, { k: "client", label: "Cliente iniciou" }, { k: "team", label: "Equipe iniciou" },
  ];

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-w-3xl bg-zapp-panel border-zapp-border text-zapp-text">
        <DialogHeader>
          <DialogTitle>Primeiros contatos na área</DialogTitle>
          <DialogDescription className="text-zapp-text-muted">
            Primeira troca de mensagens nesta área{p.periodLabel ? ` · ${p.periodLabel}` : ""}. Contatos com histórico anterior não entram, mesmo quando retomados no período.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <Button key={c.k} size="sm" variant={filter === c.k ? "default" : "outline"} className="h-8 rounded-full" onClick={() => setFilter(c.k)}>
              {c.label} <span className="ml-1.5 tabular-nums opacity-70">{counts[c.k]}</span>
            </Button>
          ))}
          <Input placeholder="Buscar contato, atendente ou mensagem..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 flex-1 min-w-[180px] bg-zapp-bg border-zapp-border" />
        </div>

        {error ? (
          <p className="py-6 text-sm text-destructive">Não foi possível carregar: {(error as any)?.message}</p>
        ) : isLoading ? (
          <div className="space-y-2 py-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-zapp-text-muted">Nenhum primeiro contato na área neste filtro. Isso não significa que não houve mensagens ou conversas retomadas.</p>
        ) : (
          <ScrollArea className="h-[55vh] pr-2">
            <div className="space-y-5">
              {groups.map((g) => (
                <section key={g.key}>
                  <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zapp-text-muted">{g.label} · {g.items.length}</h4>
                  <ol className="space-y-2 border-l border-zapp-border pl-4">
                    {g.items.map((r) => {
                      const byClient = r.started_by === "client";
                      const gap = fmtGap(r.started_at, r.reply_at);
                      return (
                        <li key={r.conversation_id} className="relative rounded-lg border border-zapp-border bg-zapp-bg/40 p-3">
                          <span className={cn("absolute -left-[22px] top-4 h-3 w-3 rounded-full border-2 border-zapp-panel", byClient ? "bg-primary" : "bg-success")} />
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 truncate font-medium">
                                {r.is_group && <Users className="h-3.5 w-3.5 shrink-0 text-zapp-text-muted" />}
                                {r.contact_name}
                              </p>
                              <p className="text-[11px] text-zapp-text-muted">
                                {r.phone_e164 || "sem telefone"}{r.client_id ? " · cliente cadastrado" : ""}
                              </p>
                            </div>
                            <Badge variant="outline" className={cn("gap-1 text-[11px]", byClient ? "border-primary/40 text-primary" : "border-success/40 text-success")}>
                              {byClient ? <Inbox className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                              {byClient ? "Cliente iniciou" : "Equipe iniciou"}
                            </Badge>
                          </div>
                          <p className="mt-2 text-xs text-zapp-text-muted">
                            <span className="font-medium text-zapp-text">{r.starter_name}</span> iniciou em {fmtDT(r.started_at)}
                          </p>
                          {r.first_message && (
                            <p className="mt-1.5 line-clamp-3 whitespace-pre-line rounded-md bg-zapp-panel px-2.5 py-1.5 text-sm">{r.first_message}</p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zapp-text-muted">
                            <span>{r.messages_in} recebidas · {r.messages_out} enviadas</span>
                            <span>
                              {gap ? `${byClient ? "Time respondeu" : "Cliente respondeu"} em ${gap}` : byClient ? "Time ainda não respondeu" : "Cliente ainda não respondeu"}
                            </span>
                            <span>Última: {fmtDT(r.last_at)}</span>
                            <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-[11px]"
                              onClick={() => { if (p.onOpenConversation) { p.onOpenConversation(r.conversation_id); return; } p.onOpenChange(false); navigate(`/roy-zapp?conversation=${r.conversation_id}`); }}>
                              Abrir conversa <ExternalLink className="ml-1 h-3 w-3" />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
          </ScrollArea>
        )}
        {!isLoading && rows.length > 0 && <PagerFor state={pg} itemLabel="conversas" />}
      </DialogContent>
    </Dialog>
  );
}
