import { PagerFor } from "@/components/ui/list-pagination";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePagedList } from "@/hooks/usePagedList";
import { ChevronRight, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface ContactRow {
  contact_key: string;
  conversation_id: string | null;
  client_id: string | null;
  contact_name: string;
  phone_e164: string | null;
  messages_in: number;
  messages_out: number;
  first_at: string | null;
  last_at: string | null;
  last_direction: string | null;
  answered: boolean;
  agents: { name: string; messages: number; last_at: string }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: "inbound" | "outbound";
  sectorId: string | null;
  integrationId: string | null;
  includeGroups: boolean;
  agentUserId: string | null;
  from: Date;
  to: Date;
  periodLabel?: string;
  onOpenConversation?: (id: string) => void;
}

function fmt(dt: string | null) {
  if (!dt) return "—";
  return format(new Date(dt), "dd/MM HH:mm", { locale: ptBR });
}

/** Mesma grade para cabeçalho e linhas: as colunas nunca saem do prumo. */
const GRID =
  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_52px_52px_minmax(0,112px)_minmax(0,112px)_20px] items-center gap-2.5";

/** Etiquetas de quem atendeu: sempre uma linha, com "+N" quando não cabe tudo. */
function AgentPills({ agents, emptyLabel }: { agents: ContactRow["agents"]; emptyLabel: string }) {
  if (!agents?.length) {
    return (
      <Badge variant="outline" className="w-fit border-destructive/50 px-2 py-0 text-[11px] font-normal text-destructive">
        {emptyLabel}
      </Badge>
    );
  }
  const shown = agents.slice(0, 2);
  const rest = agents.length - shown.length;
  return (
    <div
      className="flex min-w-0 items-center gap-1"
      title={agents.map((a) => `${a.name} · ${a.messages}`).join(" · ")}
    >
      {shown.map((a) => (
        <Badge
          key={a.name}
          variant="outline"
          className="min-w-0 truncate border-zapp-border px-2 py-0 text-[11px] font-normal"
        >
          {a.name} · {a.messages}
        </Badge>
      ))}
      {rest > 0 && (
        <Badge variant="outline" className="shrink-0 border-zapp-border px-2 py-0 text-[11px] font-normal text-zapp-text-muted">
          +{rest}
        </Badge>
      )}
    </div>
  );
}

export function ZappContactsBreakdownDialog({
  open,
  onOpenChange,
  direction,
  sectorId,
  integrationId,
  includeGroups,
  agentUserId,
  from,
  to,
  periodLabel,
  onOpenConversation,
}: Props) {
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "zapp-productivity-contacts",
      direction,
      sectorId,
      integrationId,
      includeGroups,
      agentUserId,
      from.toISOString(),
      to.toISOString(),
    ],
    enabled: open,
    staleTime: 60_000,
    queryFn: async (): Promise<ContactRow[]> => {
      const { data, error } = await (supabase as any).rpc("zapp_productivity_contacts", {
        _sector_id: sectorId,
        _from: from.toISOString(),
        _to: to.toISOString(),
        _integration_id: integrationId,
        _include_groups: includeGroups,
        _agent_user_id: agentUserId,
        _direction: direction,
      });
      if (error) throw error;
      return (data as ContactRow[]) || [];
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data || [];
    return (data || []).filter(
      (r) =>
        r.contact_name?.toLowerCase().includes(term) ||
        r.phone_e164?.toLowerCase().includes(term) ||
        r.agents?.some((a) => a.name.toLowerCase().includes(term))
    );
  }, [data, search]);

  const isInbound = direction === "inbound";
  const pg = usePagedList(rows, { resetKey: [direction, sectorId, integrationId, includeGroups, agentUserId, search], isLoading });

  const firstLabel = isInbound ? "1ª mensagem dele" : "1º contato nosso";
  const whoLabel = isInbound ? "Quem atendeu" : "Quem enviou";
  const emptyWhoLabel = isInbound ? "Sem resposta do time" : "Sem envio do time";
  const countLabel = `${rows.length} ${rows.length === 1 ? "contato" : "contatos"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-[94vw] max-w-5xl flex-col gap-3 overflow-hidden bg-zapp-panel border-zapp-border p-5 text-zapp-text">
        <DialogHeader className="pr-8">
          <DialogTitle>
            {isInbound ? "Contatos que nos chamaram" : "Contatos que o time chamou"}
          </DialogTitle>
          <DialogDescription className="text-zapp-text-muted">
            Quem falou com quem{periodLabel ? ` · ${periodLabel}` : ""} · {countLabel}
            {isInbound ? " que escreveram no período" : " que receberam mensagem nossa no período"}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zapp-text-muted" />
          <Input
            placeholder="Buscar por contato, telefone ou atendente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 bg-zapp-bg pl-9 text-sm border-zapp-border"
          />
        </div>

        {error ? (
          <p className="py-6 text-sm text-destructive">
            Não foi possível carregar: {(error as any)?.message}
          </p>
        ) : isLoading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-zapp-text-muted">
            Nenhum contato no período selecionado.
          </p>
        ) : (
          <div role="table" aria-label="Contatos do período" className="flex min-h-0 flex-1 flex-col">
            {/* Cabeçalho fixo: as colunas só fazem sentido com ele na tela. */}
            <div role="row" className={cn(GRID, "hidden shrink-0 items-end border-b border-zapp-border px-1 pb-2 lg:grid")}>
              <div role="columnheader" className="text-[10px] font-semibold uppercase tracking-wide text-zapp-text-muted">
                Contato
              </div>
              <div role="columnheader" className="text-[10px] font-semibold uppercase tracking-wide text-zapp-text-muted">
                {whoLabel}
              </div>
              <div role="columnheader" className="text-right text-[10px] font-semibold uppercase tracking-wide text-zapp-text-muted">
                Receb.
              </div>
              <div role="columnheader" className="text-right text-[10px] font-semibold uppercase tracking-wide text-zapp-text-muted">
                Enviad.
              </div>
              <div role="columnheader" className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-zapp-text-muted">
                {firstLabel}
              </div>
              <div role="columnheader" className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-zapp-text-muted">
                Última
              </div>
              <div role="columnheader" aria-hidden />
            </div>

            <ScrollArea className="min-h-0 flex-1 pr-1" role="rowgroup">
              {/* Desktop: grade alinhada, uma linha por contato. */}
              <div className="hidden lg:block">
                {pg.items.map((r) => {
                  const clickable = !!r.conversation_id && !!onOpenConversation;
                  return (
                    <div
                      key={r.contact_key}
                      role="row"
                      onClick={clickable ? () => onOpenConversation?.(r.conversation_id!) : undefined}
                      className={cn(
                        GRID,
                        "border-b border-zapp-border/60 px-1 py-2.5",
                        clickable && "cursor-pointer hover:bg-zapp-hover/50"
                      )}
                    >
                      <div role="cell" className="min-w-0">
                        <p className="truncate text-sm font-medium leading-tight">{r.contact_name}</p>
                        <p className="truncate text-[11px] leading-tight text-zapp-text-muted">
                          {r.phone_e164 || "sem telefone"}
                          {r.client_id ? <span className="text-zapp-accent"> · cliente</span> : null}
                        </p>
                      </div>
                      <div role="cell" className="min-w-0">
                        <AgentPills agents={r.agents} emptyLabel={emptyWhoLabel} />
                      </div>
                      <div
                        role="cell"
                        className={cn(
                          "text-right text-sm tabular-nums",
                          r.messages_in ? "text-zapp-text" : "text-zapp-text-muted/50"
                        )}
                      >
                        {r.messages_in}
                      </div>
                      <div
                        role="cell"
                        className={cn(
                          "text-right text-sm tabular-nums",
                          r.messages_out ? "text-zapp-text" : "text-zapp-text-muted/50"
                        )}
                      >
                        {r.messages_out}
                      </div>
                      <div role="cell" className="text-xs tabular-nums text-zapp-text-muted">
                        {fmt(r.first_at)}
                      </div>
                      <div role="cell" className="text-xs tabular-nums text-zapp-text-muted">
                        {fmt(r.last_at)}
                      </div>
                      <div role="cell" className="flex justify-end">
                        {clickable && <ChevronRight className="h-4 w-4 text-zapp-text-muted/60" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Celular: cartões, porque a tabela de 7 colunas não cabe. */}
              <ul className="space-y-2 lg:hidden">
                {pg.items.map((r) => {
                  const clickable = !!r.conversation_id && !!onOpenConversation;
                  return (
                    <li
                      key={r.contact_key}
                      onClick={clickable ? () => onOpenConversation?.(r.conversation_id!) : undefined}
                      className={cn(
                        "rounded-lg border border-zapp-border bg-zapp-bg/40 p-3",
                        clickable && "cursor-pointer active:bg-zapp-hover/60"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">{r.contact_name}</p>
                          <p className="truncate text-[11px] leading-tight text-zapp-text-muted">
                            {r.phone_e164 || "sem telefone"}
                            {r.client_id ? <span className="text-zapp-accent"> · cliente</span> : null}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] tabular-nums text-zapp-text-muted">
                          {fmt(r.last_at)}
                        </span>
                      </div>
                      <div className="mt-2">
                        <AgentPills agents={r.agents} emptyLabel={emptyWhoLabel} />
                      </div>
                      <p className="mt-1.5 text-[11px] tabular-nums text-zapp-text-muted">
                        {r.messages_in} recebidas · {r.messages_out} enviadas · 1º {fmt(r.first_at)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </div>
        )}
        {!isLoading && rows.length > 0 && (
          <PagerFor state={pg} itemLabel="contatos" className="shrink-0 rounded-lg border border-zapp-border bg-zapp-bg/40" />
        )}
      </DialogContent>
    </Dialog>
  );
}
