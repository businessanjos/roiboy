import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
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
  Archive
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AuditLog {
  id: string;
  account_id: string;
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
};

const actionColors: Record<string, string> = {
  create: "bg-green-500/10 text-green-500 border-green-500/20",
  update: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  delete: "bg-red-500/10 text-red-500 border-red-500/20",
  login: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  logout: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  view: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  export: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  import: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  assign: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  complete: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  archive: "bg-amber-500/10 text-amber-500 border-amber-500/20",
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
};

interface AuditLogViewerProps {
  accountId?: string; // If provided, shows logs for specific account (super admin view)
}

export function AuditLogViewer({ accountId }: AuditLogViewerProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["audit-logs", accountId, actionFilter, entityFilter],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (accountId) {
        query = query.eq("account_id", accountId);
      }

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Log de Auditoria
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por usuário, entidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas ações</SelectItem>
              <SelectItem value="create">Criação</SelectItem>
              <SelectItem value="update">Atualização</SelectItem>
              <SelectItem value="delete">Exclusão</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
              <SelectItem value="view">Visualização</SelectItem>
              <SelectItem value="export">Exportação</SelectItem>
              <SelectItem value="assign">Atribuição</SelectItem>
              <SelectItem value="complete">Conclusão</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas entidades</SelectItem>
              <SelectItem value="client">Clientes</SelectItem>
              <SelectItem value="user">Usuários</SelectItem>
              <SelectItem value="event">Eventos</SelectItem>
              <SelectItem value="task">Tarefas</SelectItem>
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
                <TableHead>Entidade</TableHead>
                <TableHead>Nome</TableHead>
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
                    <p className="text-sm text-muted-foreground">Entidade</p>
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
