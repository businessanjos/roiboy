import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface AgentConversationsTarget {
  label: string;
  userId?: string | null;
  origin?: string | null;
}

interface Row {
  conversation_id: string;
  contact_name: string | null;
  phone: string | null;
  is_group: boolean;
  sent: number;
  last_sent: string;
}

interface Props {
  target: AgentConversationsTarget | null;
  onClose: () => void;
  sectorId: string | null;
  integrationId: string | null;
  includeGroups: boolean;
  from: Date;
  to: Date;
}

const PAGE = 50;

/** Conversas de um atendente ou de uma origem "sem atendente". Busca só ao abrir, paginado. */
export function ZappAgentConversationsDialog({ target, onClose, sectorId, integrationId, includeGroups, from, to }: Props) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const open = !!target;

  const { data, isLoading, error } = useQuery({
    queryKey: ["zapp-agent-conversations", target?.userId, target?.origin, sectorId, integrationId, includeGroups, from.toISOString(), to.toISOString(), page],
    enabled: open,
    staleTime: 60_000,
    queryFn: async (): Promise<{ total: number; rows: Row[] }> => {
      const { data, error } = await (supabase as any).rpc("zapp_productivity_agent_conversations", {
        _sector_id: sectorId,
        _from: from.toISOString(),
        _to: to.toISOString(),
        _integration_id: integrationId,
        _include_groups: includeGroups,
        _user_id: target?.userId ?? null,
        _origin: target?.userId ? null : target?.origin ?? null,
        _limit: PAGE,
        _offset: page * PAGE,
      });
      if (error) throw error;
      return (data as { total: number; rows: Row[] }) ?? { total: 0, rows: [] };
    },
  });

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setPage(0); onClose(); } }}>
      <DialogContent className="max-w-3xl bg-zapp-panel border-zapp-border text-zapp-text">
        <DialogHeader>
          <DialogTitle>{target?.label}</DialogTitle>
          <DialogDescription className="text-zapp-text-muted">
            Conversas com envios no período · {total} conversa(s)
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : error ? (
            <p className="py-6 text-center text-sm text-danger">Não foi possível carregar as conversas. Tente de novo.</p>
          ) : (data?.rows ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-zapp-text-muted">Nenhuma conversa no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead className="text-right">Envios</TableHead>
                  <TableHead className="text-right">Último envio</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.rows.map((r) => (
                  <TableRow key={r.conversation_id}>
                    <TableCell>
                      <div className="font-medium">{r.contact_name || "Contato"}{r.is_group ? " (grupo)" : ""}</div>
                      {!r.is_group && r.phone && <div className="text-xs text-zapp-text-muted">{r.phone}</div>}
                    </TableCell>
                    <TableCell className="text-right">{r.sent}</TableCell>
                    <TableCell className="text-right text-xs">{format(new Date(r.last_sent), "dd/MM HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => { onClose(); navigate(`/roy-zapp?conversation=${r.conversation_id}`); }}>
                        <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span>{page + 1} / {pages}</span>
            <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
