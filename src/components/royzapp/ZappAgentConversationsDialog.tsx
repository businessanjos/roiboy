import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, ExternalLink, UserPlus, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface AgentConversationsTarget {
  label: string;
  userId?: string | null;
  origin?: string | null;
  mode?: "sent" | "new";
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
  /** Admin/gestor: pode direcionar e tirar conversas da contagem. */
  canManage?: boolean;
  onChanged?: () => void;
}

const PAGE = 50;

/** Conversas de um atendente ou de uma origem "sem atendente". Busca só ao abrir, paginado. */
export function ZappAgentConversationsDialog({ target, onClose, sectorId, integrationId, includeGroups, from, to, canManage, onChanged }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [excludeRow, setExcludeRow] = useState<Row | null>(null);
  const open = !!target;
  const showActions = !!canManage && !target?.userId;
  const mode = target?.mode ?? "sent";

  const queryKey = ["zapp-agent-conversations", target?.userId, target?.origin, mode, sectorId, integrationId, includeGroups, from.toISOString(), to.toISOString(), page];
  const { data, isLoading, error } = useQuery({
    queryKey,
    enabled: open,
    staleTime: 30_000,
    refetchInterval: open ? 60_000 : false,
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
        _mode: mode,
      });
      if (error) throw error;
      return (data as { total: number; rows: Row[] }) ?? { total: 0, rows: [] };
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["zapp-active-agents", currentUser?.account_id],
    enabled: open && showActions && !!currentUser?.account_id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("zapp_agents")
        .select("id, user:users!zapp_agents_user_id_fkey(name)")
        .eq("account_id", currentUser!.account_id)
        .eq("is_active", true);
      if (error) throw error;
      return ((data || []) as { id: string; user: { name: string } | null }[])
        .map((a) => ({ id: a.id, name: a.user?.name?.trim() || "Atendente" }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["zapp-agent-conversations"] });
    onChanged?.();
  };

  const assign = async (row: Row, agent: { id: string; name: string }) => {
    setAssignFor(null);
    setBusy(row.conversation_id);
    try {
      const { data: rows, error } = await (supabase as any)
        .from("zapp_conversation_assignments")
        .select("id")
        .eq("zapp_conversation_id", row.conversation_id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      if (!rows?.length) {
        toast.error("Essa conversa ainda não está na fila de atendimento. Abra a conversa para transferir.");
        return;
      }
      const now = new Date().toISOString();
      const { error: upErr } = await (supabase as any)
        .from("zapp_conversation_assignments")
        .update({ agent_id: agent.id, status: "active", assigned_at: now, updated_at: now })
        .eq("id", rows[0].id);
      if (upErr) throw upErr;
      toast.success(`Conversa direcionada para ${agent.name}`);
      refresh();
    } catch {
      toast.error("Não foi possível direcionar a conversa. Tente de novo.");
    } finally {
      setBusy(null);
    }
  };

  const exclude = async (row: Row) => {
    setExcludeRow(null);
    if (!currentUser?.account_id) return;
    setBusy(row.conversation_id);
    try {
      const { error } = await (supabase as any)
        .from("zapp_metrics_excluded_conversations")
        .upsert({ conversation_id: row.conversation_id, account_id: currentUser.account_id, created_by: currentUser.id });
      if (error) throw error;
      if (!row.is_group && row.phone) {
        await (supabase as any).from("zapp_internal_contacts").insert({
          account_id: currentUser.account_id,
          phone_e164: row.phone,
          label: `Fora da produtividade: ${row.contact_name || row.phone}`,
          created_by: currentUser.id,
        });
      }
      toast.success("Conversa tirada da contagem");
      refresh();
    } catch {
      toast.error("Não foi possível tirar a conversa da lista. Tente de novo.");
    } finally {
      setBusy(null);
    }
  };

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setPage(0); onClose(); } }}>
        <DialogContent className="max-w-4xl bg-zapp-panel border-zapp-border text-zapp-text">
          <DialogHeader>
            <DialogTitle>{target?.label}</DialogTitle>
            <DialogDescription className="text-zapp-text-muted">
              {mode === "new" ? "Conversas que começaram com uma mensagem desta pessoa no período" : "Conversas com envios no período"} · {total} conversa(s)
              {showActions && " · Direcione para um atendente ou tire da contagem"}
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
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.rows.map((r) => (
                    <TableRow key={r.conversation_id}>
                      <TableCell>
                        <div className="font-medium">{r.contact_name || "Contato"}{r.is_group ? " (grupo)" : ""}</div>
                        {!r.is_group && r.phone && <div className="text-xs text-zapp-text-muted">{r.phone}</div>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.sent}</TableCell>
                      <TableCell className="text-right text-xs">{format(new Date(r.last_sent), "dd/MM HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {busy === r.conversation_id && <Loader2 className="h-4 w-4 animate-spin" />}
                          {showActions && (
                            <>
                              <Popover open={assignFor === r.conversation_id} onOpenChange={(o) => setAssignFor(o ? r.conversation_id : null)}>
                                <PopoverTrigger asChild>
                                  <Button size="sm" variant="outline" disabled={!!busy}>
                                    <UserPlus className="h-4 w-4 mr-1" /> Direcionar
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-0" align="end">
                                  <Command>
                                    <CommandInput placeholder="Buscar atendente..." />
                                    <CommandList>
                                      <CommandEmpty>Nenhum atendente.</CommandEmpty>
                                      <CommandGroup>
                                        {agents.map((a) => (
                                          <CommandItem key={a.id} value={a.name} onSelect={() => assign(r, a)}>
                                            {a.name}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setExcludeRow(r)} title="Tirar da contagem">
                                <EyeOff className="h-4 w-4 mr-1" /> Tirar
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => { onClose(); navigate(`/roy-zapp?conversation=${r.conversation_id}`); }}>
                            <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                          </Button>
                        </div>
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

      <AlertDialog open={!!excludeRow} onOpenChange={(o) => !o && setExcludeRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tirar da contagem?</AlertDialogTitle>
            <AlertDialogDescription>
              "{excludeRow?.contact_name || excludeRow?.phone || "Contato"}" deixa de contar nos indicadores de produtividade, para todos.
              A conversa e as mensagens continuam normais no RoyZapp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excludeRow && exclude(excludeRow)}>Tirar da contagem</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
