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
  Megaphone, CalendarDays, Wallet, IdCard, LifeBuoy, ClipboardList, FileText,
  Handshake, Route, ChevronDown, ChevronRight,
} from "lucide-react";

export type OpenItemKey = string;

interface ItemMeta { label: string; icon: any; group: GroupKey }
type GroupKey = "sales" | "cs" | "marketing" | "events" | "financial" | "hr" | "general";

export const OPEN_ITEM_GROUPS: { key: GroupKey; label: string }[] = [
  { key: "sales", label: "Vendas" },
  { key: "cs", label: "Atendimento / CS" },
  { key: "marketing", label: "Marketing" },
  { key: "events", label: "Eventos" },
  { key: "financial", label: "Financeiro" },
  { key: "hr", label: "RH" },
  { key: "general", label: "Geral" },
];

export const OPEN_ITEM_META: Record<OpenItemKey, ItemMeta> = {
  // Vendas
  deals: { label: "Negócios em aberto", icon: Briefcase, group: "sales" },
  leads: { label: "Leads em aberto", icon: UserPlus, group: "sales" },
  activities: { label: "Atividades agendadas não concluídas", icon: CalendarClock, group: "sales" },
  sales_meetings: { label: "Reuniões de vendas agendadas", icon: Handshake, group: "sales" },
  clients_sales: { label: "Clientes onde é o vendedor", icon: Users, group: "sales" },
  // CS
  clients: { label: "Clientes da carteira (responsável)", icon: Users, group: "cs" },
  conversations: { label: "Conversas do RoyZapp em aberto", icon: MessageSquare, group: "cs" },
  ruler: { label: "Régua de relacionamento em andamento", icon: Route, group: "cs" },
  support_tickets: { label: "Chamados de suporte em aberto", icon: LifeBuoy, group: "cs" },
  // Marketing
  marketing_projects: { label: "Projetos de marketing que lidera", icon: Megaphone, group: "marketing" },
  content_pieces: { label: "Peças de conteúdo atribuídas", icon: FileText, group: "marketing" },
  content_approvals: { label: "Aprovações de conteúdo sob responsabilidade", icon: ClipboardList, group: "marketing" },
  // Eventos
  event_checklist: { label: "Itens de checklist de evento", icon: CheckSquare, group: "events" },
  event_deliverables: { label: "Entregáveis de conteúdo de evento", icon: FileText, group: "events" },
  event_briefings: { label: "Briefings de evento sob responsabilidade", icon: CalendarDays, group: "events" },
  // Financeiro
  dunning_cases: { label: "Cobranças / inadimplência em aberto", icon: Wallet, group: "financial" },
  // RH
  hr_admissions: { label: "Admissões que conduz", icon: IdCard, group: "hr" },
  hr_offboardings: { label: "Desligamentos que conduz", icon: IdCard, group: "hr" },
  // Geral
  tasks: { label: "Tarefas pendentes", icon: CheckSquare, group: "general" },
  leader_actions: { label: "Ações da reunião de líderes", icon: ClipboardList, group: "general" },
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

interface Candidate { id: string; name: string }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Membro alvo */
  user: { id: string; name: string; email: string; is_active?: boolean | null } | null;
  /** Demais membros ativos que podem receber os itens */
  candidates: Candidate[];
  /** Modo: inativar agora, ou apenas transferir pendências de quem já está inativo */
  mode: "deactivate" | "transfer";
  onDone: () => void;
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Seletor de pessoa com busca e destaque para o próprio usuário. */
function OwnerSelect({
  value, onChange, candidates, selfId, placeholder, className,
}: {
  value: string;
  onChange: (v: string) => void;
  candidates: Candidate[];
  selfId?: string | null;
  placeholder: string;
  className?: string;
}) {
  const [search, setSearch] = useState("");
  const self = useMemo(() => candidates.find((c) => c.id === selfId) || null, [candidates, selfId]);
  const matches = (name: string) => normalize(name).includes(normalize(search.trim()));
  const list = useMemo(
    () => candidates.filter((c) => c.id !== self?.id).filter((c) => !search.trim() || matches(c.name)),
    [candidates, self?.id, search],
  );

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className || "bg-card"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <div className="sticky top-0 z-10 bg-popover p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Buscar pessoa..."
              className="h-8 pl-7 text-sm"
            />
          </div>
        </div>
        {self && (!search.trim() || matches(self.name)) && (
          <SelectItem value={self.id} className="my-1 font-semibold text-primary">
            <span className="flex items-center gap-2">
              <Star className="h-3.5 w-3.5 text-primary" />
              Para mim mesmo ({self.name})
            </span>
          </SelectItem>
        )}
        {list.length === 0 && !self && (
          <div className="px-3 py-4 text-sm text-muted-foreground">Nenhuma pessoa encontrada.</div>
        )}
        {list.map((c) => (
          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DeactivateUserDialog({ open, onOpenChange, user, candidates, mode, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [counts, setCounts] = useState<OpenItemCounts | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [defaultOwner, setDefaultOwner] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const { currentUser } = useCurrentUser();

  const total = totalOpenItems(counts);

  const availableKeys = useMemo(
    () => OPEN_ITEM_KEYS.filter((k) => (counts?.[k] || 0) > 0),
    [counts],
  );
  const activeGroups = useMemo(
    () => OPEN_ITEM_GROUPS.filter((g) => availableKeys.some((k) => OPEN_ITEM_META[k].group === g.key)),
    [availableKeys],
  );

  const selectedKeys = useMemo(
    () => availableKeys.filter((k) => selected[k]),
    [availableKeys, selected],
  );
  const selectedTotal = useMemo(
    () => selectedKeys.reduce((s, k) => s + (counts?.[k] || 0), 0),
    [selectedKeys, counts],
  );
  const ownerFor = (key: string) => owners[key] || defaultOwner || "";
  const readyKeys = useMemo(
    () => selectedKeys.filter((k) => !!ownerFor(k)),
    [selectedKeys, owners, defaultOwner],
  );
  const pendingOwnerKeys = useMemo(
    () => selectedKeys.filter((k) => !ownerFor(k)),
    [selectedKeys, owners, defaultOwner],
  );
  /** Resumo: quantos itens vão para cada pessoa. */
  const summary = useMemo(() => {
    const map = new Map<string, number>();
    for (const key of readyKeys) {
      const id = ownerFor(key);
      map.set(id, (map.get(id) || 0) + (counts?.[key] || 0));
    }
    return Array.from(map.entries()).map(([id, count]) => ({
      id, count, name: candidates.find((c) => c.id === id)?.name || "—",
    }));
  }, [readyKeys, owners, defaultOwner, counts, candidates]);

  const transferableTotal = useMemo(
    () => readyKeys.reduce((s, k) => s + (counts?.[k] || 0), 0),
    [readyKeys, counts],
  );

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setDefaultOwner("");
      setOwners({});
      setCollapsed({});
      try {
        const { data, error } = await supabase.functions.invoke("deactivate-team-user", {
          body: { action: "count_open_items", user_id: user.id },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (!cancelled) {
          const c = (data.counts || {}) as OpenItemCounts;
          setCounts(c);
          setSelected(
            Object.fromEntries(OPEN_ITEM_KEYS.map((k) => [k, (c[k] || 0) > 0])) as Record<string, boolean>,
          );
        }

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

  const toggleGroup = (group: GroupKey, value: boolean) => {
    const keys = availableKeys.filter((k) => OPEN_ITEM_META[k].group === group);
    setSelected((s) => ({ ...s, ...Object.fromEntries(keys.map((k) => [k, value])) }));
  };

  const handleConfirm = async () => {
    if (!user) return;
    if (mode === "transfer" && readyKeys.length === 0) {
      toast.error("Marque ao menos um item e escolha quem vai receber");
      return;
    }

    setSubmitting(true);
    try {
      const assignments = readyKeys.map((key) => ({ key, to_user_id: ownerFor(key) }));
      const { data, error } = await supabase.functions.invoke("deactivate-team-user", {
        body: {
          action: mode === "deactivate" ? "deactivate" : "transfer_open_items",
          user_id: user.id,
          assignments,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const remaining = totalOpenItems(data?.remaining);
      if (Array.isArray(data?.warnings) && data.warnings.length > 0) {
        toast.warning(data.warnings.join(" · "));
      }
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
    const parts = Object.keys(moved)
      .filter((k) => (moved[k] || 0) > 0)
      .map((k) => `${moved[k]} ${(OPEN_ITEM_META[k]?.label || k).toLowerCase()}`);
    return `Transferiu para ${d.to_user_name || "outro responsável"}: ${parts.join(", ") || "nenhum item"}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
            {total > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Destinatário padrão (vale para as linhas sem escolha própria)
                </Label>
                <OwnerSelect
                  value={defaultOwner}
                  onChange={setDefaultOwner}
                  candidates={candidates}
                  selfId={currentUser?.id}
                  placeholder="Selecione quem recebe por padrão"
                  className="mt-2 bg-card"
                />
              </div>
            )}

            <div>
              <p className="text-sm font-semibold mb-2">1. Revise os itens em aberto</p>
              {total === 0 ? (
                <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                  Nenhuma pendência em aberto neste momento.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeGroups.map((group) => {
                    const keys = availableKeys.filter((k) => OPEN_ITEM_META[k].group === group.key);
                    const groupTotal = keys.reduce((s, k) => s + (counts?.[k] || 0), 0);
                    const allOn = keys.every((k) => selected[k]);
                    const isCollapsed = !!collapsed[group.key];
                    return (
                      <div key={group.key} className="rounded-lg border border-border overflow-hidden">
                        <div className="flex items-center gap-2 bg-muted/40 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setCollapsed((c) => ({ ...c, [group.key]: !isCollapsed }))}
                            className="flex items-center gap-1.5 text-sm font-semibold flex-1 text-left"
                          >
                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {group.label}
                            <Badge variant="secondary" className="ml-1">{groupTotal}</Badge>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => toggleGroup(group.key, !allOn)}
                          >
                            {allOn ? "Desmarcar área" : "Marcar área"}
                          </Button>
                        </div>
                        {!isCollapsed && (
                          <div className="divide-y divide-border">
                            {keys.map((key) => {
                              const count = counts?.[key] || 0;
                              const Icon = OPEN_ITEM_META[key].icon;
                              const isOn = !!selected[key];
                              return (
                                <div key={key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                                  <label className="flex items-center gap-3 flex-1 cursor-pointer">
                                    <Checkbox
                                      checked={isOn}
                                      onCheckedChange={(v) => setSelected((s) => ({ ...s, [key]: !!v }))}
                                    />
                                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="text-sm flex-1">{OPEN_ITEM_META[key].label}</span>
                                    <Badge variant="secondary">{count}</Badge>
                                  </label>
                                  <div className="sm:w-60">
                                    <OwnerSelect
                                      value={owners[key] || ""}
                                      onChange={(v) => setOwners((o) => ({ ...o, [key]: v }))}
                                      candidates={candidates}
                                      selfId={currentUser?.id}
                                      placeholder={
                                        defaultOwner
                                          ? `Padrão: ${candidates.find((c) => c.id === defaultOwner)?.name || ""}`
                                          : "Escolher destinatário"
                                      }
                                      className={`h-8 text-xs bg-card ${isOn && !ownerFor(key) ? "border-warning" : ""}`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {total > 0 && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-sm font-semibold mb-2">2. Resumo da transferência</p>
                {summary.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum item pronto para transferir — escolha o destinatário.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {summary.map((s) => (
                      <li key={s.id} className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                          {s.name}
                        </span>
                        <Badge variant="outline">{s.count} item(ns)</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                {pendingOwnerKeys.length > 0 && (
                  <p className="text-xs text-warning mt-2">
                    {pendingOwnerKeys.length} linha(s) marcada(s) sem destinatário não serão transferidas.
                  </p>
                )}
              </div>
            )}

            {mode === "deactivate" && total > 0 && transferableTotal < total && (
              <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <span>
                  {total - transferableTotal} item(ns) ficarão sem responsável. O membro aparecerá
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
