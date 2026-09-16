import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
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

interface UnifiedLog {
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

const actionLabels: Record<string, string> = {
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

const entityLabels: Record<string, string> = {
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

const DEAL_ACTIVITY_TYPES = ["stage_change", "status_change", "note", "image"];

const PERIOD_DAYS: Record<string, number> = {
  "7": 7,
  "30": 30,
  "90": 90,
  "180": 180,
};

/** Teto rígido de exibição na tela (os registros continuam no banco). */
const MAX_VISIBLE_DAYS = 180;

/** Ruído automático que não representa ação de pessoa. */
const NOISE_ACTIONS = new Set(["auto_heal_inactive"]);
const NOISE_ENTITIES = new Set(["hr_collaborators"]);

interface AuditLogViewerProps {
  accountId?: string; // If provided, shows logs for specific account (super admin view)
}

export function AuditLogViewer({ accountId }: AuditLogViewerProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("30");
  const [selectedLog, setSelectedLog] = useState<UnifiedLog | null>(null);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["audit-logs-unified", accountId, actionFilter, entityFilter, periodFilter],
    queryFn: async (): Promise<UnifiedLog[]> => {
      const sinceIso = subDays(new Date(), PERIOD_DAYS[periodFilter] ?? 30).toISOString();
      const wantsDeals = entityFilter === "all" || entityFilter === "deal";
      const wantsAudit = entityFilter !== "deal";

      const results: UnifiedLog[] = [];

      // 1) Log de auditoria existente (tarefas, eventos, pessoas...)
      if (wantsAudit) {
        let query = supabase
          .from("audit_logs")
          .select("*")
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(500);

        if (accountId) query = query.eq("account_id", accountId);
        if (actionFilter !== "all") query = query.eq("action", actionFilter);
        if (entityFilter !== "all") query = query.eq("entity_type", entityFilter);

        const { data, error } = await query;
        if (error) throw error;
        (data ?? []).forEach((row: any) => {
          results.push({
            id: `audit-${row.id}`,
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
            source: "audit",
          });
        });
      }

      // 2) Ações dentro dos negócios (apenas com autor identificado)
      if (wantsDeals) {
        const typeFilter = DEAL_ACTIVITY_TYPES.includes(actionFilter)
          ? [actionFilter]
          : actionFilter === "all"
            ? DEAL_ACTIVITY_TYPES
            : [];

        if (typeFilter.length > 0) {
          let activityQuery = supabase
            .from("deal_activities")
            .select("id, type, title, content, old_value, new_value, created_at, user_id, deal_id, deals(title)")
            .in("type", typeFilter)
            .not("user_id", "is", null)
            .gte("created_at", sinceIso)
            .order("created_at", { ascending: false })
            .limit(500);

          if (accountId) activityQuery = activityQuery.eq("account_id", accountId);

          const { data: activities, error: activityError } = await activityQuery;
          if (activityError) throw activityError;

          (activities ?? []).forEach((row: any) => {
            results.push({
              id: `deal-activity-${row.id}`,
              user_id: row.user_id,
              user_name: null,
              user_email: null,
              action: row.type,
              entity_type: "deal",
              entity_id: row.deal_id,
              entity_name: row.deals?.title ?? null,
              details: {
                titulo: row.title ?? null,
                conteudo: row.content ?? null,
                de: row.old_value ?? null,
                para: row.new_value ?? null,
              },
              created_at: row.created_at,
              source: "deal",
            });
          });
        }

        // 3) Negócios excluídos (autor gravado em deleted_by)
        if (actionFilter === "all" || actionFilter === "delete") {
          let deletedQuery = supabase
            .from("deals")
            .select("id, title, deleted_at, deleted_by")
            .not("deleted_at", "is", null)
            .not("deleted_by", "is", null)
            .gte("deleted_at", sinceIso)
            .order("deleted_at", { ascending: false })
            .limit(300);

          if (accountId) deletedQuery = deletedQuery.eq("account_id", accountId);

          const { data: deleted, error: deletedError } = await deletedQuery;
          if (deletedError) throw deletedError;

          (deleted ?? []).forEach((row: any) => {
            results.push({
              id: `deal-deleted-${row.id}`,
              user_id: row.deleted_by,
              user_name: null,
              user_email: null,
              action: "delete",
              entity_type: "deal",
              entity_id: row.id,
              entity_name: row.title,
              details: null,
              created_at: row.deleted_at,
              source: "deal",
            });
          });
        }
      }

      // Resolve os nomes das pessoas nas linhas vindas do comercial
      const missingUserIds = Array.from(
        new Set(results.filter((r) => !r.user_name && r.user_id).map((r) => r.user_id as string)),
      );
      if (missingUserIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, name, email")
          .in("id", missingUserIds);
        const map = new Map<string, { name: string | null; email: string | null }>();
        (users ?? []).forEach((u: any) => map.set(u.id, { name: u.name, email: u.email }));
        results.forEach((r) => {
          if (!r.user_name && r.user_id) {
            const found = map.get(r.user_id);
            if (found) {
              r.user_name = found.name;
              r.user_email = found.email;
            }
          }
        });
      }

      return results.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
  });

  const filteredLogs = logs?.filter((log) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      log.user_name?.toLowerCase().includes(searchLower) ||
      log.user_email?.toLowerCase().includes(searchLower) ||
      log.entity_name?.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower) ||
      log.entity_type.toLowerCase().includes(searchLower)
    );
  });

  const exportCsv = () => {
    const rows = filteredLogs ?? [];
    if (rows.length === 0) return;
    const header = ["Data/Hora", "Usuário", "E-mail", "Ação", "Tipo", "Registro", "Detalhe"];
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const body = rows.map((log) => {
      const detail = log.details
        ? Object.entries(log.details)
            .filter(([, v]) => v !== null && v !== undefined && v !== "")
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | ")
        : "";
      return [
        format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
        log.user_name ?? "",
        log.user_email ?? "",
        actionLabels[log.action] ?? log.action,
        entityLabels[log.entity_type] ?? log.entity_type,
        log.entity_name ?? "",
        detail,
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
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Log de Auditoria
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={!filteredLogs || filteredLogs.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
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
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
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
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="export">Exportação</SelectItem>
              <SelectItem value="assign">Atribuição</SelectItem>
            </SelectContent>
          </Select>
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
              <SelectItem value="event">Eventos</SelectItem>
              <SelectItem value="contract">Contratos</SelectItem>
              <SelectItem value="product">Produtos</SelectItem>
              <SelectItem value="form">Formulários</SelectItem>
              <SelectItem value="settings">Configurações</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Registro</TableHead>
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
              ) : filteredLogs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs?.map((log) => (
                  <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50">
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
                      <span className="text-sm font-medium truncate max-w-[200px] block">
                        {log.entity_name || "-"}
                      </span>
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
                    {selectedLog.entity_name && (
                      <p className="text-xs text-muted-foreground">{selectedLog.entity_name}</p>
                    )}
                  </div>
                </div>

                {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Detalhes</p>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-[200px]">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.user_agent && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">User Agent</p>
                    <p className="text-xs text-muted-foreground break-all">
                      {selectedLog.user_agent}
                    </p>
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
