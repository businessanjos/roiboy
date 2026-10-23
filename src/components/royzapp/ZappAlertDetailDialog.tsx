import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePagedList } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink } from "lucide-react";

export type ZappAlertDetailKind = "unanswered" | "never_messaged" | "no_conversation";

interface UnansweredRow {
  conversation_id: string;
  contact_name: string;
  phone_e164: string | null;
  client_id: string | null;
  last_at: string;
  over_24h: boolean;
  messages_in: number;
  messages_out: number;
}

interface NeverRow {
  client_id: string;
  client_name: string;
  phone_e164: string | null;
  responsible: string | null;
  conversation_id: string | null;
  contact_name: string | null;
  last_out_at: string | null;
  messages_out: number;
}

interface NoConvRow {
  client_id: string;
  client_name: string;
  phone_e164: string | null;
  responsible: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ZappAlertDetailKind;
  sectorId: string | null;
  integrationId: string | null;
  includeGroups: boolean;
  agentUserId: string | null;
  from: Date;
  to: Date;
  periodLabel?: string;
  onOpenConversation?: (id: string) => void;
}

const TZ = "America/Sao_Paulo";
const fmtDT = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

const TITLES: Record<ZappAlertDetailKind, string> = {
  unanswered: "Conversas sem resposta",
  never_messaged: "Clientes que nunca escreveram",
  no_conversation: "Sem WhatsApp vinculado",
};

const DESCRIPTIONS: Record<ZappAlertDetailKind, string> = {
  unanswered: "Conversas em que a última mensagem é do cliente. Contatos com histórico anterior não entram, mesmo quando retomados no período.",
  never_messaged: "Clientes com contrato ativo que têm conversa nesta área, mas nunca enviaram mensagem — só recebem envio nosso.",
  no_conversation: "Clientes com contrato ativo sem nenhuma conversa nesta área — cobertura, não produtividade.",
};

export function ZappAlertDetailDialog({
  open,
  onOpenChange,
  kind,
  sectorId,
  integrationId,
  includeGroups,
  agentUserId,
  from,
  to,
  periodLabel,
  onOpenConversation,
}: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "zapp-productivity-detail",
      kind,
      sectorId,
      integrationId,
      includeGroups,
      agentUserId,
      from.toISOString(),
      to.toISOString(),
    ],
    enabled: open,
    staleTime: 60_000,
    queryFn: async (): Promise<(UnansweredRow | NeverRow | NoConvRow)[]> => {
      const { data, error } = await (supabase as any).rpc("zapp_productivity_detail", {
        _kind: kind,
        _sector_id: sectorId,
        _from: from.toISOString(),
        _to: to.toISOString(),
        _integration_id: integrationId,
        _include_groups: includeGroups,
        _agent_user_id: agentUserId,
      });
      if (error) throw error;
      return (data as (UnansweredRow | NeverRow | NoConvRow)[]) || [];
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = data || [];
    if (!term) return all;
    return all.filter((r) => {
      const haystacks =
        kind === "unanswered"
          ? [(r as UnansweredRow).contact_name, (r as UnansweredRow).phone_e164]
          : [(r as NeverRow | NoConvRow).client_name, (r as NeverRow | NoConvRow).phone_e164, (r as NeverRow | NoConvRow).responsible];
      return haystacks.some((v) => v?.toLowerCase().includes(term));
    });
  }, [data, search, kind]);

  const pg = usePagedList(rows, { resetKey: [kind, sectorId, integrationId, includeGroups, agentUserId, search], isLoading });

  const openConversation = (conversationId: string | null | undefined) => {
    if (!conversationId) return;
    if (onOpenConversation) { onOpenConversation(conversationId); return; }
    onOpenChange(false);
    navigate(`/roy-zapp?conversation=${conversationId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-zapp-panel border-zapp-border text-zapp-text">
        <DialogHeader>
          <DialogTitle>{TITLES[kind]}</DialogTitle>
          <DialogDescription className="text-zapp-text-muted">
            {DESCRIPTIONS[kind]}{periodLabel ? ` · ${periodLabel}` : ""} · {rows.length} {kind === "unanswered" ? "conversa(s)" : "cliente(s)"}
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Buscar por nome, telefone ou responsável..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zapp-bg border-zapp-border"
        />

        {error ? (
          <p className="text-sm text-destructive py-6">
            Não foi possível carregar: {(error as any)?.message}
          </p>
        ) : isLoading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zapp-text-muted py-8 text-center">
            Nenhum registro no período selecionado.
          </p>
        ) : kind === "unanswered" ? (
          <ScrollArea className="h-[55vh] pr-2">
            <Table>
              <TableHeader>
                <TableRow className="border-zapp-border">
                  <TableHead className="text-zapp-text-muted">Contato</TableHead>
                  <TableHead className="text-zapp-text-muted text-right">Recebidas</TableHead>
                  <TableHead className="text-zapp-text-muted text-right">Enviadas</TableHead>
                  <TableHead className="text-zapp-text-muted whitespace-nowrap">Última mensagem</TableHead>
                  <TableHead className="text-zapp-text-muted" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.items.map((r) => {
                  const row = r as UnansweredRow;
                  return (
                    <TableRow key={row.conversation_id} className="border-zapp-border">
                      <TableCell className="max-w-[260px]">
                        <p className="truncate font-medium">{row.contact_name}</p>
                        <p className="text-[11px] text-zapp-text-muted truncate">
                          {row.phone_e164 || "sem telefone"}
                          {row.client_id ? " · cliente cadastrado" : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.messages_in}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.messages_out}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          {fmtDT(row.last_at)}
                          {row.over_24h && (
                            <Badge variant="outline" className="border-destructive/50 text-destructive text-[10px]">
                              +24h
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto whitespace-nowrap p-0 text-xs"
                          onClick={() => openConversation(row.conversation_id)}
                        >
                          Abrir conversa <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : kind === "never_messaged" ? (
          <ScrollArea className="h-[55vh] pr-2">
            <Table>
              <TableHeader>
                <TableRow className="border-zapp-border">
                  <TableHead className="text-zapp-text-muted">Cliente</TableHead>
                  <TableHead className="text-zapp-text-muted">Responsável</TableHead>
                  <TableHead className="text-zapp-text-muted text-right">Envios no período</TableHead>
                  <TableHead className="text-zapp-text-muted whitespace-nowrap">Último envio nosso</TableHead>
                  <TableHead className="text-zapp-text-muted" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.items.map((r) => {
                  const row = r as NeverRow;
                  return (
                    <TableRow key={row.client_id} className="border-zapp-border">
                      <TableCell className="max-w-[240px]">
                        <p className="truncate font-medium">{row.client_name}</p>
                        <p className="text-[11px] text-zapp-text-muted truncate">
                          {row.phone_e164 || "sem telefone"}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <p className="truncate text-sm">{row.responsible || "—"}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.messages_out}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{fmtDT(row.last_out_at)}</TableCell>
                      <TableCell>
                        {row.conversation_id ? (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto whitespace-nowrap p-0 text-xs"
                            onClick={() => openConversation(row.conversation_id)}
                          >
                            Abrir conversa <ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <ScrollArea className="h-[55vh] pr-2">
            <Table>
              <TableHeader>
                <TableRow className="border-zapp-border">
                  <TableHead className="text-zapp-text-muted">Cliente</TableHead>
                  <TableHead className="text-zapp-text-muted">Telefone</TableHead>
                  <TableHead className="text-zapp-text-muted">Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.items.map((r) => {
                  const row = r as NoConvRow;
                  return (
                    <TableRow key={row.client_id} className="border-zapp-border">
                      <TableCell className="max-w-[260px]">
                        <p className="truncate font-medium">{row.client_name}</p>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate text-sm">{row.phone_e164 || "—"}</p>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <p className="truncate text-sm">{row.responsible || "—"}</p>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
        {!isLoading && rows.length > 0 && <PagerFor state={pg} itemLabel={kind === "unanswered" ? "conversas" : "clientes"} />}
      </DialogContent>
    </Dialog>
  );
}
