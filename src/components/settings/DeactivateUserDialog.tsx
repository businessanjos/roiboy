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
  Handshake, Route, ChevronDown, ChevronRight, Eye,
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

/** Regra usada para considerar cada item "em aberto". */
export const OPEN_ITEM_RULE: Record<OpenItemKey, string> = {
  deals: "Situação Aberto, sem ganho/perda e não excluídos",
  leads: "Situação Novo, Em contato ou Qualificado",
  activities: "Com data agendada e ainda sem conclusão",
  sales_meetings: "Agendada, pendente, confirmada ou remarcada",
  clients_sales: "Clientes Ativo, Pausado ou Risco de churn",
  clients: "Clientes Ativo, Pausado ou Risco de churn",
  conversations: "Conversas em triagem, pendentes, ativas ou aguardando",
  ruler: "Régua ativa, pendente ou pausada",
  support_tickets: "Chamados ainda não resolvidos, fechados ou cancelados",
  marketing_projects: "Projetos que não estão concluídos, cancelados ou arquivados",
  content_pieces: "Peças que não foram publicadas, concluídas ou canceladas",
  content_approvals: "Checklists de aprovação sob responsabilidade dele",
  event_checklist: "Itens sem conclusão e fora de Feito/Cancelado",
  event_deliverables: "Entregáveis fora de Entregue/Publicado/Cancelado",
  event_briefings: "Briefings de evento sob responsabilidade dele",
  dunning_cases: "Cobranças fora de recuperada, encerrada, cancelada ou perdida",
  hr_admissions: "Admissões que ainda não foram concluídas ou canceladas",
  hr_offboardings: "Desligamentos sem data de conclusão",
  tasks: "Tarefas pendentes, em andamento ou atrasadas",
  leader_actions: "Ações sem data de conclusão",
};

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

interface DetailRow {
  id: string;
  title: string;
  status: string | null;
  date: string | null;
  created_at: string | null;
}

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<Record<string, DetailRow[] | undefined>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const { currentUser } = useCurrentUser();

  const toggleDetails = async (key: string) => {
    const willOpen = !expanded[key];
    setExpanded((e) => ({ ...e, [key]: willOpen }));
    if (!willOpen || details[key] || !user) return;
    setLoadingDetails(key);
    try {
      const { data, error } = await supabase.functions.invoke("deactivate-team-user", {
        body: { action: "list_open_items", user_id: user.id, item_key: key },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDetails((d) => ({ ...d, [key]: (data.rows || []) as DetailRow[] }));
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Não foi possível listar os registros");
      setDetails((d) => ({ ...d, [key]: [] }));
    } finally {
      setLoadingDetails(null);
    }
  };

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
      setExpanded({});
      setDetails({});
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

  const initials = (user?.name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Cabeçalho */}
        <DialogHeader className="space-y-0 border-b border-border/60 bg-muted/30 px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-2 text-base">
                {mode === "deactivate"
                  ? `Inativar ${user?.name || "membro"}`
                  : `Transferir pendências de ${user?.name || "membro"}`}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed">
                {user?.email ? <span className="block text-muted-foreground/80">{user.email}</span> : null}
                O histórico permanece no nome dele. Só muda quem é o responsável atual dos itens ainda em aberto.
              </DialogDescription>
            </div>
            {!loading && total > 0 && (
              <div className="hidden shrink-0 rounded-xl border border-border/60 bg-card px-4 py-2 text-center sm:block">
                <p className="text-xl font-semibold leading-none">{total}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">em aberto</p>
              </div>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {total > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <Label className="text-xs font-semibold text-foreground">
                  Destinatário padrão
                </Label>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Vale para todas as linhas que não tiverem uma escolha própria.
                </p>
                <OwnerSelect
                  value={defaultOwner}
                  onChange={setDefaultOwner}
                  candidates={candidates}
                  selfId={currentUser?.id}
                  placeholder="Selecione quem recebe por padrão"
                  className="mt-3 h-10 bg-card"
                />
              </div>
            )}

            <div>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Itens em aberto
              </p>
              {total === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma pendência em aberto neste momento.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeGroups.map((group) => {
                    const keys = availableKeys.filter((k) => OPEN_ITEM_META[k].group === group.key);
                    const groupTotal = keys.reduce((s, k) => s + (counts?.[k] || 0), 0);
                    const allOn = keys.every((k) => selected[k]);
                    const isCollapsed = !!collapsed[group.key];
                    return (
                      <div
                        key={group.key}
                        className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"
                      >
                        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => setCollapsed((c) => ({ ...c, [group.key]: !isCollapsed }))}
                            className="flex flex-1 items-center gap-2 text-left text-sm font-semibold text-foreground"
                          >
                            {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            {group.label}
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {groupTotal}
                            </span>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => toggleGroup(group.key, !allOn)}
                          >
                            {allOn ? "Desmarcar área" : "Marcar área"}
                          </Button>
                        </div>
                        {!isCollapsed && (
                          <div className="divide-y divide-border/50">
                            {keys.map((key) => {
                              const count = counts?.[key] || 0;
                              const Icon = OPEN_ITEM_META[key].icon;
                              const isOn = !!selected[key];
                              const missing = isOn && !ownerFor(key);
                              const isOpenList = !!expanded[key];
                              const rows = details[key];
                              return (
                                <div key={key}>
                                  <div
                                    className={`flex flex-col gap-2 px-3 py-2.5 transition-colors sm:flex-row sm:items-center ${
                                      isOn ? "hover:bg-muted/40" : "opacity-60 hover:opacity-100"
                                    }`}
                                  >
                                    <label className="flex flex-1 cursor-pointer items-start gap-3">
                                      <Checkbox
                                        className="mt-0.5"
                                        checked={isOn}
                                        onCheckedChange={(v) => setSelected((s) => ({ ...s, [key]: !!v }))}
                                      />
                                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                      <span className="flex-1">
                                        <span className="block text-sm">{OPEN_ITEM_META[key].label}</span>
                                        <span className="block text-[11px] text-muted-foreground">
                                          {OPEN_ITEM_RULE[key]}
                                        </span>
                                      </span>
                                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                        {count}
                                      </span>
                                    </label>
                                    <div className="flex items-center gap-2 sm:w-64">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 shrink-0 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                                        onClick={() => toggleDetails(key)}
                                      >
                                        {loadingDetails === key ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Eye className="h-3.5 w-3.5" />
                                        )}
                                        <span className="ml-1 hidden sm:inline">Ver</span>
                                      </Button>
                                      <div className="flex-1">
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
                                          className={`h-9 bg-background text-xs ${missing ? "border-warning/70" : "border-border/60"}`}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {isOpenList && (
                                    <div className="border-t border-border/50 bg-muted/20 px-3 py-2">
                                      {!rows ? (
                                        <p className="py-2 text-xs text-muted-foreground">Carregando registros...</p>
                                      ) : rows.length === 0 ? (
                                        <p className="py-2 text-xs text-muted-foreground">Nenhum registro encontrado.</p>
                                      ) : (
                                        <>
                                          <p className="mb-1.5 text-[11px] text-muted-foreground">
                                            Mostrando {rows.length} de {count} registro(s)
                                          </p>
                                          <ScrollArea className="max-h-48 rounded-lg border border-border/50 bg-card">
                                            <ul className="divide-y divide-border/40">
                                              {rows.map((r) => (
                                                <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                                                  <span className="truncate">{r.title}</span>
                                                  <span className="shrink-0 text-[10px] text-muted-foreground">
                                                    {[r.status, r.date ? new Date(r.date).toLocaleDateString("pt-BR") : null]
                                                      .filter(Boolean)
                                                      .join(" · ")}
                                                  </span>
                                                </li>
                                              ))}
                                            </ul>
                                          </ScrollArea>
                                        </>
                                      )}
                                    </div>
                                  )}
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
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Resumo da transferência
                </p>
                {summary.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum item pronto para transferir — escolha o destinatário.
                  </p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {summary.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between rounded-lg bg-card px-3 py-2"
                      >
                        <span className="flex items-center gap-2">
                          <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                          {s.name}
                        </span>
                        <Badge variant="outline">{s.count} item(ns)</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                {pendingOwnerKeys.length > 0 && (
                  <p className="mt-2.5 text-xs text-warning">
                    {pendingOwnerKeys.length} linha(s) marcada(s) sem destinatário não serão transferidas.
                  </p>
                )}
              </div>
            )}

            {mode === "deactivate" && total > 0 && transferableTotal < total && (
              <div className="flex gap-2 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <span>
                  {total - transferableTotal} item(ns) ficarão sem responsável. O membro aparecerá
                  marcado em laranja na lista até que a transferência seja concluída.
                </span>
              </div>
            )}

            {history.length > 0 && (
              <div>
                <p className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <History className="h-3.5 w-3.5" /> Histórico deste membro
                </p>
                <ScrollArea className="max-h-36 rounded-xl border border-border/60">
                  <div className="divide-y divide-border/50">
                    {history.map((log) => (
                      <div key={log.id} className="p-3 text-xs">
                        <p className="text-foreground">{describeLog(log)}</p>
                        <p className="mt-0.5 text-muted-foreground">
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

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-6 py-4">
          <p className="hidden text-xs text-muted-foreground sm:block">
            {transferableTotal > 0
              ? `${transferableTotal} item(ns) prontos para transferir`
              : "Nada marcado para transferir ainda"}
          </p>
          <div className="flex w-full justify-end gap-2 sm:w-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={submitting || loading}>
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
              ) : mode === "deactivate" ? (
                <><UserMinus className="mr-2 h-4 w-4" /> Inativar membro</>
              ) : (
                <><ArrowRightLeft className="mr-2 h-4 w-4" /> Transferir</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
