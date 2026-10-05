import { useEffect, useState } from "react";
import { usePaginationState } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";
import { fetchInChunks } from "@/lib/fetchInChunks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Filter,
  RefreshCw,
  User,
  Calendar,
  AlertCircle,
  Activity,
  Eye,
  Plus,
  Pencil,
  Trash2,
  LogIn,
  LogOut,
  Download,
  Upload,
  UserPlus,
  CheckCircle,
  Archive,
  ArrowRight,
  StickyNote,
  Paperclip,
  Flag,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface UnifiedLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  source: "audit" | "deal";
  /** A quem o registro pertence: "Lead Fulano", "Negócio X", "Cliente Y" */
  context?: string | null;
}

/** Linha crua retornada pela RPC audit_unified_page. */
interface UnifiedRpcRow {
  id: string;
  source: "audit" | "deal";
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  total_count: number;
}

/** Converte uma linha crua da RPC no formato usado pela tela. */
export function mapRpcRowToUnifiedLog(row: UnifiedRpcRow): UnifiedLog {
  return {
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name,
    user_email: row.user_email,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    entity_name: row.entity_name,
    details: row.details,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    created_at: row.created_at,
    source: row.source,
  };
}

const actionIcons: Record<string, React.ReactNode> = {
  create: <Plus className="h-4 w-4" />,
  update: <Pencil className="h-4 w-4" />,
  delete: <Trash2 className="h-4 w-4" />,
  login: <LogIn className="h-4 w-4" />,
  logout: <LogOut className="h-4 w-4" />,
  view: <Eye className="h-4 w-4" />,
  export: <Download className="h-4 w-4" />,
  import: <Upload className="h-4 w-4" />,
  assign: <UserPlus className="h-4 w-4" />,
  complete: <CheckCircle className="h-4 w-4" />,
  archive: <Archive className="h-4 w-4" />,
  stage_change: <ArrowRight className="h-4 w-4" />,
  status_change: <Flag className="h-4 w-4" />,
  note: <StickyNote className="h-4 w-4" />,
  image: <Paperclip className="h-4 w-4" />,
};

const actionColors: Record<string, string> = {
  create: "bg-success/10 text-success border-success/20",
  update: "bg-info/10 text-info border-info/20",
  delete: "bg-danger/10 text-danger border-danger/20",
  login: "bg-success/10 text-success border-success/20",
  logout: "bg-warning/10 text-warning border-warning/20",
  view: "bg-muted-foreground/10 text-muted-foreground border-border/20",
  export: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  import: "bg-info/10 text-info border-info/20",
  assign: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  complete: "bg-success/10 text-success border-success/20",
  archive: "bg-warning/10 text-warning border-warning/20",
  stage_change: "bg-info/10 text-info border-info/20",
  status_change: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  note: "bg-muted-foreground/10 text-muted-foreground border-border/20",
  image: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
};

/** Barra colorida na lateral da linha, para diferenciar o tipo de ação. */
const actionRowAccent: Record<string, string> = {
  create: "border-l-success",
  complete: "border-l-info",
  update: "border-l-warning",
  delete: "border-l-danger",
  stage_change: "border-l-purple-500",
  status_change: "border-l-indigo-500",
  note: "border-l-muted-foreground/40",
  image: "border-l-muted-foreground/40",
};

export const actionLabels: Record<string, string> = {
  create: "Criou",
  update: "Atualizou",
  delete: "Excluiu",
  login: "Login",
  logout: "Logout",
  view: "Visualizou",
  export: "Exportou",
  import: "Importou",
  assign: "Atribuiu",
  complete: "Completou",
  archive: "Arquivou",
  stage_change: "Mudou etapa",
  status_change: "Mudou status",
  note: "Registrou nota",
  image: "Anexou arquivo",
  "user.deactivated": "Desativou usuário",
  "user.activated": "Reativou usuário",
  "user.access_profile_changed": "Alterou permissões",
  "user.created": "Criou usuário",
};

export const entityLabels: Record<string, string> = {
  client: "Cliente",
  user: "Usuário",
  event: "Evento",
  task: "Tarefa",
  contract: "Contrato",
  product: "Produto",
  form: "Formulário",
  followup: "Followup",
  subscription: "Assinatura",
  settings: "Configurações",
  integration: "Integração",
  role: "Cargo",
  permission: "Permissão",
  deal: "Negócio",
};

/** Frase legível: "Excluiu a tarefa 'Follow Up' — Lead Fulano" */
export function describeLog(log: UnifiedLog): string {
  const acao = actionLabels[log.action] ?? log.action;
  const tipo = (entityLabels[log.entity_type] ?? log.entity_type).toLowerCase();
  const nome = log.entity_name ? ` "${log.entity_name}"` : "";
  const onde = log.context ? ` — ${log.context}` : "";

  if (log.entity_type === "deal") {
    const de = (log.details as any)?.de;
    const para = (log.details as any)?.para;
    if (log.action === "stage_change" && (de || para)) {
      return `Moveu o negócio${nome} de "${de ?? "?"}" para "${para ?? "?"}"`;
    }
    if (log.action === "status_change" && para) {
      return `Marcou o negócio${nome} como "${para}"`;
    }
    if (log.action === "note") return `Registrou uma nota no negócio${nome}`;
    if (log.action === "image") return `Anexou um arquivo no negócio${nome}`;
    if (log.action === "delete") return `Excluiu o negócio${nome}`;
    if (log.action === "create") return `Criou o negócio${nome}`;
  }

  return `${acao} ${tipo}${nome}${onde}`;
}

const PERIOD_DAYS: Record<string, number> = {
  "7": 7,
  "30": 30,
  "90": 90,
  "180": 180,
};

/** Teto rígido de exibição na tela (os registros continuam no banco). */
const MAX_VISIBLE_DAYS = 180;

/** Tamanho de lote de exportação: segue até esgotar o conjunto filtrado, sem teto silencioso. */
const EXPORT_BATCH_SIZE = 1000;

interface AuditLogViewerProps {
  accountId?: string; // If provided, shows logs for specific account (super admin view)
  /** "commercial" = só negócios e tarefas de vendas; "system" = log geral. */
  scope?: "system" | "commercial";
}

/** Busca uma página da RPC unificada e devolve linhas mapeadas + total. */
export async function fetchUnifiedPage(params: {
  accountId?: string;
  scope: "system" | "commercial";
  sinceIso: string;
  actionFilter: string;
  entityFilter: string;
  userFilter: string;
  search: string;
  offset: number;
  limit: number;
}): Promise<{ rows: UnifiedLog[]; total: number }> {
  const { accountId, scope, sinceIso, actionFilter, entityFilter, userFilter, search, offset, limit } = params;
  const { data, error } = await (supabase.rpc as any)("audit_unified_page", {
    p_account_id: accountId ?? null,
    p_from: sinceIso,
    p_to: null,
    p_scope: scope,
    p_action: actionFilter,
    p_entity_type: entityFilter,
    p_user: userFilter,
    p_search: search || null,
    p_offset: offset,
    p_limit: limit,
  });
  if (error) throw error;
  const rows = (data || []) as UnifiedRpcRow[];
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return { rows: rows.map(mapRpcRowToUnifiedLog), total };
}

/** Enriquece uma página de logs com nomes/contextos (só para os registros exibidos). */
export async function enrichLogs(results: UnifiedLog[]): Promise<UnifiedLog[]> {
  const enriched = results.map((r) => ({ ...r }));

  // Resolve os nomes das pessoas nas linhas vindas do comercial
  const missingUserIds = Array.from(
    new Set(enriched.filter((r) => !r.user_name && r.user_id).map((r) => r.user_id as string)),
  );
  if (missingUserIds.length > 0) {
    const users = await fetchInChunks<{ id: string; name: string | null; email: string | null }>(
      missingUserIds,
      200,
      (chunk) => supabase.from("users").select("id, name, email").in("id", chunk),
    );
    const map = new Map<string, { name: string | null; email: string | null }>();
    users.forEach((u) => map.set(u.id, { name: u.name, email: u.email }));
    enriched.forEach((r) => {
      if (!r.user_name && r.user_id) {
        const found = map.get(r.user_id);
        if (found) {
          r.user_name = found.name;
          r.user_email = found.email;
        }
      }
    });
  }

  // Descobre a quem cada tarefa pertence (lead, negócio ou cliente)
  const taskIds = Array.from(
    new Set(
      enriched
        .filter((r) => r.entity_type === "task" && r.entity_id)
        .map((r) => r.entity_id as string),
    ),
  );
  if (taskIds.length > 0) {
    const tasks = await fetchInChunks<{ id: string; deal_id: string | null; lead_id: string | null; client_id: string | null }>(
      taskIds,
      200,
      (chunk) => supabase.from("internal_tasks").select("id, deal_id, lead_id, client_id").in("id", chunk),
    );

    const dealIds = new Set<string>();
    const leadIds = new Set<string>();
    const clientIds = new Set<string>();
    tasks.forEach((t) => {
      if (t.deal_id) dealIds.add(t.deal_id);
      if (t.lead_id) leadIds.add(t.lead_id);
      if (t.client_id) clientIds.add(t.client_id);
    });

    const [deals, leads, clients] = await Promise.all([
      fetchInChunks<{ id: string; title: string }>(Array.from(dealIds), 200, (chunk) =>
        supabase.from("deals").select("id, title").in("id", chunk),
      ),
      fetchInChunks<{ id: string; full_name: string }>(Array.from(leadIds), 200, (chunk) =>
        supabase.from("leads").select("id, full_name").in("id", chunk),
      ),
      fetchInChunks<{ id: string; full_name: string }>(Array.from(clientIds), 200, (chunk) =>
        supabase.from("clients").select("id, full_name").in("id", chunk),
      ),
    ]);

    const dealNames = new Map<string, string>();
    deals.forEach((d) => dealNames.set(d.id, d.title));
    const leadNames = new Map<string, string>();
    leads.forEach((l) => leadNames.set(l.id, l.full_name));
    const clientNames = new Map<string, string>();
    clients.forEach((c) => clientNames.set(c.id, c.full_name));

    const taskContext = new Map<string, string>();
    tasks.forEach((t) => {
      const label =
        (t.lead_id && leadNames.get(t.lead_id) && `Lead ${leadNames.get(t.lead_id)}`) ||
        (t.deal_id && dealNames.get(t.deal_id) && `Negócio ${dealNames.get(t.deal_id)}`) ||
        (t.client_id && clientNames.get(t.client_id) && `Cliente ${clientNames.get(t.client_id)}`) ||
        null;
      if (label) taskContext.set(t.id, label);
    });

    enriched.forEach((r) => {
      if (r.entity_type === "task" && r.entity_id) {
        r.context = taskContext.get(r.entity_id) ?? null;
      }
    });
  }

  return enriched;
}

export interface ExportProgress {
  loaded: number;
  total: number;
}

/**
 * Exporta TODO o conjunto filtrado em lotes de EXPORT_BATCH_SIZE, até esgotar —
 * sem teto silencioso. Reporta progresso via onProgress e propaga erro de
 * qualquer lote (nunca baixa um CSV parcial como se fosse completo).
 */
export async function exportAllFiltered(
  fetchPage: (offset: number, limit: number) => Promise<{ rows: UnifiedLog[]; total: number }>,
  onProgress?: (p: ExportProgress) => void,
): Promise<UnifiedLog[]> {
  const all: UnifiedLog[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const { rows, total: pageTotal } = await fetchPage(offset, EXPORT_BATCH_SIZE);
    total = pageTotal;
    all.push(...rows);
    offset += rows.length;
    onProgress?.({ loaded: all.length, total });
    if (rows.length === 0) break; // segurança: nunca entra em loop infinito
  }

  return all;
}

export function AuditLogViewer({ accountId, scope = "system" }: AuditLogViewerProps) {
  const isCommercial = scope === "commercial";
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("30");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<UnifiedLog | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const sinceIso = (() => {
    const days = Math.min(PERIOD_DAYS[periodFilter] ?? 30, MAX_VISIBLE_DAYS);
    return periodFilter === "today"
      ? startOfDay(new Date()).toISOString()
      : subDays(new Date(), days).toISOString();
  })();

  const [total, setTotal] = useState(0);
  const pg = usePaginationState(total, {
    resetKey: [scope, accountId, actionFilter, entityFilter, periodFilter, userFilter, debouncedSearch],
  });

  const {
    data: pageResult,
    isLoading,
    isError,
    error: logsError,
    refetch,
  } = useQuery({
    queryKey: [
      "audit-logs-unified-page",
      scope,
      accountId,
      actionFilter,
      entityFilter,
      periodFilter,
      userFilter,
      debouncedSearch,
      pg.from,
      pg.to,
    ],
    queryFn: async (): Promise<{ rows: UnifiedLog[]; total: number }> => {
      const { rows, total: pageTotal } = await fetchUnifiedPage({
        accountId,
        scope,
        sinceIso,
        actionFilter,
        entityFilter,
        userFilter,
        search: debouncedSearch,
        offset: pg.from,
        limit: pg.pageSize,
      });
      const enriched = await enrichLogs(rows);
      return { rows: enriched, total: pageTotal };
    },
  });

  useEffect(() => {
    if (pageResult) setTotal(pageResult.total);
  }, [pageResult]);

  const logs = pageResult?.rows ?? [];

  // Pessoas que aparecem na página carregada (lista completa viria de uma fonte à parte se necessário)
  const people = Array.from(
    new Map(
      logs
        .filter((l) => l.user_id)
        .map((l) => [l.user_id as string, l.user_name || l.user_email || "Sem nome"]),
    ).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const selectedPersonName =
    userFilter === "all" ? "Todas as pessoas" : people.find(([id]) => id === userFilter)?.[1] ?? "Pessoa";

  const exportCsv = async () => {
    if (
      !window.confirm(
        `Exportar todos os registros do conjunto filtrado (período, ações e pessoa selecionados)? O CSV será baixado ao final, em lotes de ${EXPORT_BATCH_SIZE}.`,
      )
    ) {
      return;
    }

    setExporting(true);
    setExportError(null);
    setExportProgress({ loaded: 0, total: 0 });

    try {
      const rows = await exportAllFiltered(
        (offset, limit) =>
          fetchUnifiedPage({
            accountId,
            scope,
            sinceIso,
            actionFilter,
            entityFilter,
            userFilter,
            search: debouncedSearch,
            offset,
            limit,
          }),
        (p) => setExportProgress(p),
      );
      const enriched = await enrichLogs(rows);

      if (enriched.length === 0) {
        setExporting(false);
        return;
      }

      const header = ["Data/Hora", "Usuário", "E-mail", "Ação", "Tipo", "Registro", "Vinculado a", "Descrição"];
      const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const body = enriched.map((log) => {
        return [
          format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
          log.user_name ?? "",
          log.user_email ?? "",
          actionLabels[log.action] ?? log.action,
          entityLabels[log.entity_type] ?? log.entity_type,
          log.entity_name ?? "",
          log.context ?? "",
          describeLog(log),
        ]
          .map(escape)
          .join(";");
      });
      const csv = [header.map(escape).join(";"), ...body].join("\n");
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `log-acoes-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Falha ao exportar os registros.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {isCommercial ? "Logs da equipe comercial" : "Log de Auditoria"}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={exporting || total === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting
                ? `Exportando${exportProgress ? ` ${exportProgress.loaded}/${exportProgress.total}` : "..."}`
                : "Exportar"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isError && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Não foi possível carregar o log completo
            {logsError instanceof Error ? `: ${logsError.message}` : "."} Os registros abaixo podem estar
            incompletos — clique em "Atualizar" para tentar novamente.
          </div>
        )}
        {exportError && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Falha ao exportar: {exportError}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por pessoa, negócio, tarefa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start font-normal">
                <User className="h-4 w-4 mr-2 shrink-0" />
                <span className="truncate">{selectedPersonName}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar pessoa..." />
                <CommandList>
                  <CommandEmpty>Ninguém encontrado</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="Todas as pessoas"
                      onSelect={() => {
                        setUserFilter("all");
                        setUserPickerOpen(false);
                      }}
                    >
                      Todas as pessoas
                    </CommandItem>
                    {people.map(([id, name]) => (
                      <CommandItem
                        key={id}
                        value={name}
                        onSelect={() => {
                          setUserFilter(id);
                          setUserPickerOpen(false);
                        }}
                      >
                        {name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 6 meses</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[170px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas ações</SelectItem>
              <SelectItem value="create">Criação</SelectItem>
              <SelectItem value="update">Atualização</SelectItem>
              <SelectItem value="delete">Exclusão</SelectItem>
              <SelectItem value="complete">Conclusão</SelectItem>
              <SelectItem value="stage_change">Mudança de etapa</SelectItem>
              <SelectItem value="status_change">Mudança de status</SelectItem>
              <SelectItem value="note">Nota no negócio</SelectItem>
              <SelectItem value="image">Anexo no negócio</SelectItem>
              {!isCommercial && <SelectItem value="login">Login</SelectItem>}
              {!isCommercial && <SelectItem value="export">Exportação</SelectItem>}
              {!isCommercial && <SelectItem value="assign">Atribuição</SelectItem>}
            </SelectContent>
          </Select>
          {!isCommercial && (
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="deal">Negócios</SelectItem>
                <SelectItem value="task">Tarefas</SelectItem>
                <SelectItem value="client">Clientes</SelectItem>
                <SelectItem value="user">Usuários</SelectItem>
                <SelectItem value="contract">Contratos</SelectItem>
                <SelectItem value="product">Produtos</SelectItem>
                <SelectItem value="form">Formulários</SelectItem>
                <SelectItem value="settings">Configurações</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          Esta tela exibe até 6 meses de histórico para manter o carregamento rápido. Os registros
          anteriores continuam guardados e podem ser consultados sob demanda.
        </p>

        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>O que aconteceu</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando logs...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className={`cursor-pointer hover:bg-muted/50 border-l-4 ${
                      actionRowAccent[log.action] ?? "border-l-transparent"
                    }`}
                  >
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{log.user_name || "Sistema"}</p>
                          <p className="text-xs text-muted-foreground">{log.user_email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`gap-1 ${actionColors[log.action] || ""}`}
                      >
                        {actionIcons[log.action]}
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {entityLabels[log.entity_type] || log.entity_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium block max-w-[420px]">
                        {describeLog(log)}
                      </span>
                      {log.context && (
                        <span className="text-xs text-muted-foreground block">{log.context}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
        <PagerFor state={pg} itemLabel="logs" />

        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes do Log</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Data/Hora</p>
                    <p className="font-medium">
                      {format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ação</p>
                    <Badge
                      variant="outline"
                      className={`gap-1 ${actionColors[selectedLog.action] || ""}`}
                    >
                      {actionIcons[selectedLog.action]}
                      {actionLabels[selectedLog.action] || selectedLog.action}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Usuário</p>
                    <p className="font-medium">{selectedLog.user_name || "Sistema"}</p>
                    <p className="text-xs text-muted-foreground">{selectedLog.user_email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo</p>
                    <p className="font-medium">
                      {entityLabels[selectedLog.entity_type] || selectedLog.entity_type}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">O que aconteceu</p>
                  <p className="font-medium">{describeLog(selectedLog)}</p>
                </div>

                {selectedLog.entity_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Registro</p>
                    <p className="font-medium">{selectedLog.entity_name}</p>
                  </div>
                )}

                {selectedLog.context && (
                  <div>
                    <p className="text-sm text-muted-foreground">Vinculado a</p>
                    <p className="font-medium">{selectedLog.context}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
