import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import {
  AlertTriangle, Loader2, UserMinus, ArrowRightLeft, History, Briefcase,
  UserPlus, Users, CheckSquare, CalendarClock, MessageSquare, Search, Star,
} from "lucide-react";


export type OpenItemKey =
  | "deals" | "leads" | "clients" | "tasks" | "activities" | "conversations";

export const OPEN_ITEM_META: Record<OpenItemKey, { label: string; icon: any }> = {
  deals: { label: "Negócios em aberto", icon: Briefcase },
  leads: { label: "Leads em aberto", icon: UserPlus },
  clients: { label: "Clientes da carteira", icon: Users },
  tasks: { label: "Tarefas pendentes", icon: CheckSquare },
  activities: { label: "Atividades agendadas não concluídas", icon: CalendarClock },
  conversations: { label: "Conversas do RoyZapp em aberto", icon: MessageSquare },
};

export const OPEN_ITEM_KEYS = Object.keys(OPEN_ITEM_META) as OpenItemKey[];

export type OpenItemCounts = Record<OpenItemKey, number>;

export function totalOpenItems(counts?: OpenItemCounts | null): number {
  if (!counts) return 0;
  return OPEN_ITEM_KEYS.reduce((sum, key) => sum + (counts[key] || 0), 0);
}

interface AuditEntry {
  id: string;
  created_at: string;
  action: string;
  user_name: string | null;
  details: any;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Membro alvo */
  user: { id: string; name: string; email: string; is_active?: boolean | null } | null;
  /** Demais membros ativos que podem receber os itens */
  candidates: { id: string; name: string }[];
  /** Modo: inativar agora, ou apenas transferir pendências de quem já está inativo */
  mode: "deactivate" | "transfer";
  onDone: () => void;
}

export function DeactivateUserDialog({ open, onOpenChange, user, candidates, mode, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [counts, setCounts] = useState<OpenItemCounts | null>(null);
  const [selected, setSelected] = useState<Record<OpenItemKey, boolean>>(
    () => Object.fromEntries(OPEN_ITEM_KEYS.map((k) => [k, true])) as Record<OpenItemKey, boolean>,
  );
  const [newOwner, setNewOwner] = useState<string>("");
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [ownerSearch, setOwnerSearch] = useState("");
  const { currentUser } = useCurrentUser();

  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const matchesSearch = (name: string) =>
    normalize(name).includes(normalize(ownerSearch.trim()));

  const selfCandidate = useMemo(
    () => candidates.find((c) => c.id === currentUser?.id) || null,
    [candidates, currentUser?.id],
  );
  const filteredCandidates = useMemo(
    () =>
      candidates
        .filter((c) => c.id !== selfCandidate?.id)
        .filter((c) => !ownerSearch.trim() || matchesSearch(c.name)),
    [candidates, selfCandidate?.id, ownerSearch],
  );

  const total = totalOpenItems(counts);


  const selectedKeys = useMemo(
    () => OPEN_ITEM_KEYS.filter((k) => selected[k] && (counts?.[k] || 0) > 0),
    [selected, counts],
  );
  const selectedTotal = useMemo(
    () => selectedKeys.reduce((s, k) => s + (counts?.[k] || 0), 0),
    [selectedKeys, counts],
  );

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setNewOwner("");
      setOwnerSearch("");
      setSelected(Object.fromEntries(OPEN_ITEM_KEYS.map((k) => [k, true])) as Record<OpenItemKey, boolean>);
      try {
        const { data, error } = await supabase.functions.invoke("deactivate-team-user", {
          body: { action: "count_open_items", user_id: user.id },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (!cancelled) setCounts(data.counts as OpenItemCounts);

        const { data: logs } = await supabase
          .from("audit_logs")
          .select("id, created_at, action, user_name, details")
          .eq("entity_type", "user")
          .eq("entity_id", user.id)
          .in("action", ["user.deactivated", "user.activated", "user.open_items_transferred"])
          .order("created_at", { ascending: false })
          .limit(20);
        if (!cancelled) setHistory((logs as AuditEntry[]) || []);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Não foi possível carregar as pendências");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [open, user?.id]);

  const handleConfirm = async () => {
    if (!user) return;
    if (selectedKeys.length > 0 && !newOwner) {
      toast.error("Selecione para quem transferir os itens marcados");
      return;
    }
    if (mode === "transfer" && selectedKeys.length === 0) {
      toast.error("Marque ao menos um item para transferir");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("deactivate-team-user", {
        body: {
          action: mode === "deactivate" ? "deactivate" : "transfer_open_items",
          user_id: user.id,
          new_owner_user_id: selectedKeys.length > 0 ? newOwner : null,
          items: selectedKeys,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const remaining = totalOpenItems(data?.remaining);
      if (mode === "deactivate") {
        toast.success(
          remaining > 0
            ? `${user.name} foi inativado. Ainda restam ${remaining} item(ns) sem responsável.`
            : `${user.name} foi inativado e todas as pendências foram transferidas.`,
        );
      } else {
        toast.success(
          remaining > 0
            ? `Transferência concluída. Ainda restam ${remaining} item(ns) sem responsável.`
            : "Todas as pendências foram transferidas.",
        );
      }
      onOpenChange(false);
      onDone();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao concluir a operação");
    } finally {
      setSubmitting(false);
    }
  };

  const describeLog = (log: AuditEntry) => {
    const d = log.details || {};
    if (log.action === "user.activated") return "Reativou o acesso";
    if (log.action === "user.deactivated") {
      const to = d.transferred_to ? ` e transferiu as pendências para ${d.transferred_to}` : "";
      return `Inativou o acesso${to}`;
    }
    const moved = d.moved || {};
    const parts = OPEN_ITEM_KEYS
      .filter((k) => (moved[k] || 0) > 0)
      .map((k) => `${moved[k]} ${OPEN_ITEM_META[k].label.toLowerCase()}`);
    return `Transferiu para ${d.to_user_name || "outro responsável"}: ${parts.join(", ") || "nenhum item"}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "deactivate" ? <UserMinus className="h-5 w-5 text-warning" /> : <ArrowRightLeft className="h-5 w-5 text-warning" />}
            {mode === "deactivate"
              ? `Inativar ${user?.name || "membro"}?`
              : `Transferir pendências de ${user?.name || "membro"}`}
          </DialogTitle>
          <DialogDescription>
            O histórico já registrado permanece no nome dele. Só muda quem é o responsável atual
            dos itens que ainda estão em aberto.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">1. Revise os itens em aberto</p>
              {total === 0 ? (
                <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                  Nenhuma pendência em aberto neste momento.
                </div>
              ) : (
                <div className="rounded-lg border border-border divide-y divide-border">
                  {OPEN_ITEM_KEYS.map((key) => {
                    const count = counts?.[key] || 0;
                    const Icon = OPEN_ITEM_META[key].icon;
                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-3 p-3 text-sm ${count === 0 ? "opacity-50" : "cursor-pointer hover:bg-muted/50"}`}
                      >
                        <Checkbox
                          checked={count > 0 && selected[key]}
                          disabled={count === 0}
                          onCheckedChange={(v) => setSelected((s) => ({ ...s, [key]: !!v }))}
                        />
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1">{OPEN_ITEM_META[key].label}</span>
                        <Badge variant={count > 0 ? "secondary" : "outline"}>{count}</Badge>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {total > 0 && (
              <div>
                <Label className="text-sm font-semibold">2. Novo responsável</Label>
                <Select value={newOwner} onValueChange={setNewOwner}>
                  <SelectTrigger className="mt-2 bg-card">
                    <SelectValue placeholder="Selecione quem vai receber os itens marcados" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="sticky top-0 z-10 bg-popover p-2 border-b">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          autoFocus
                          value={ownerSearch}
                          onChange={(e) => setOwnerSearch(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          placeholder="Buscar pessoa..."
                          className="h-8 pl-7 text-sm"
                        />
                      </div>
                    </div>
                    {selfCandidate && (!ownerSearch.trim() || matchesSearch(selfCandidate.name)) && (
                      <SelectItem
                        value={selfCandidate.id}
                        className="my-1 font-semibold text-primary data-[state=checked]:text-primary"
                      >
                        <span className="flex items-center gap-2">
                          <Star className="h-3.5 w-3.5 text-primary" />
                          Para mim mesmo ({selfCandidate.name})
                        </span>
                      </SelectItem>
                    )}
                    {filteredCandidates.length === 0 && !selfCandidate && (
                      <div className="px-3 py-4 text-sm text-muted-foreground">Nenhuma pessoa encontrada.</div>
                    )}
                    {filteredCandidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  {selectedTotal} item(ns) marcados para transferência.
                </p>
              </div>
            )}


            {mode === "deactivate" && total > 0 && selectedTotal < total && (
              <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <span>
                  {total - selectedTotal} item(ns) ficarão sem responsável. O membro aparecerá
                  marcado em laranja na lista até que a transferência seja concluída.
                </span>
              </div>
            )}

            {history.length > 0 && (
              <div>
                <p className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <History className="h-4 w-4" /> Histórico deste membro
                </p>
                <ScrollArea className="max-h-36 rounded-lg border border-border">
                  <div className="divide-y divide-border">
                    {history.map((log) => (
                      <div key={log.id} className="p-3 text-xs">
                        <p className="text-foreground">{describeLog(log)}</p>
                        <p className="text-muted-foreground mt-0.5">
                          {log.user_name || "Sistema"} ·{" "}
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || loading}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</>
            ) : mode === "deactivate" ? (
              <><UserMinus className="h-4 w-4 mr-2" /> Inativar membro</>
            ) : (
              <><ArrowRightLeft className="h-4 w-4 mr-2" /> Transferir</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
