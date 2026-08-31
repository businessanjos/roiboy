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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
}

function fmt(dt: string | null) {
  if (!dt) return "—";
  return format(new Date(dt), "dd/MM HH:mm", { locale: ptBR });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-zapp-panel border-zapp-border text-zapp-text">
        <DialogHeader>
          <DialogTitle>
            {isInbound ? "Contatos que nos chamaram" : "Contatos que o time chamou"}
          </DialogTitle>
          <DialogDescription className="text-zapp-text-muted">
            Quem falou com quem {periodLabel ? `· ${periodLabel}` : ""} · {rows.length} contato(s)
            {isInbound ? " que escreveram no período" : " que receberam mensagem nossa no período"}
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Buscar por contato, telefone ou atendente..."
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
            Nenhum contato no período selecionado.
          </p>
        ) : (
          <ScrollArea className="h-[55vh] pr-2">
            <Table>
              <TableHeader>
                <TableRow className="border-zapp-border">
                  <TableHead className="text-zapp-text-muted">Contato</TableHead>
                  <TableHead className="text-zapp-text-muted">Quem atendeu</TableHead>
                  <TableHead className="text-zapp-text-muted text-right">Recebidas</TableHead>
                  <TableHead className="text-zapp-text-muted text-right">Enviadas</TableHead>
                  <TableHead className="text-zapp-text-muted whitespace-nowrap">
                    {isInbound ? "1ª mensagem dele" : "1º contato nosso"}
                  </TableHead>
                  <TableHead className="text-zapp-text-muted whitespace-nowrap">Última</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.contact_key} className="border-zapp-border">
                    <TableCell className="max-w-[220px]">
                      <p className="truncate font-medium">{r.contact_name}</p>
                      <p className="text-[11px] text-zapp-text-muted truncate">
                        {r.phone_e164 || "sem telefone"}
                        {r.client_id ? " · cliente cadastrado" : ""}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      {r.agents?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {r.agents.map((a) => (
                            <Badge
                              key={a.name}
                              variant="outline"
                              className="border-zapp-border text-[11px]"
                            >
                              {a.name} · {a.messages}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <Badge variant="outline" className="border-destructive/50 text-destructive text-[11px]">
                          Sem resposta do time
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.messages_in}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.messages_out}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{fmt(r.first_at)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{fmt(r.last_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
