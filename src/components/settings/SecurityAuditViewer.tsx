import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Search, AlertTriangle, CheckCircle, XCircle, LogIn, LogOut, RefreshCw, Key, UserPlus, Lock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SecurityLog {
  id: string;
  event_type: string;
  user_id: string | null;
  account_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const eventTypeLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  login_success: { label: "Login bem-sucedido", icon: <LogIn className="h-4 w-4" />, color: "bg-success/10 text-success" },
  login_failure: { label: "Falha no login", icon: <XCircle className="h-4 w-4" />, color: "bg-danger/10 text-danger" },
  logout: { label: "Logout", icon: <LogOut className="h-4 w-4" />, color: "bg-muted text-muted-foreground" },
  password_reset_request: { label: "Solicitação de reset de senha", icon: <Key className="h-4 w-4" />, color: "bg-warning/10 text-warning" },
  password_reset_success: { label: "Senha alterada", icon: <CheckCircle className="h-4 w-4" />, color: "bg-success/10 text-success" },
  signup_success: { label: "Novo cadastro", icon: <UserPlus className="h-4 w-4" />, color: "bg-primary/10 text-primary" },
  admin_action: { label: "Ação administrativa", icon: <Shield className="h-4 w-4" />, color: "bg-primary/10 text-primary" },
  permission_denied: { label: "Permissão negada", icon: <Lock className="h-4 w-4" />, color: "bg-danger/10 text-danger" },
  suspicious_activity: { label: "Atividade suspeita", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-danger/10 text-danger" },
  rate_limit_exceeded: { label: "Rate limit excedido", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-warning/10 text-warning" },
  event_checkin_success: { label: "Check-in de evento", icon: <CheckCircle className="h-4 w-4" />, color: "bg-success/10 text-success" },
  form_submission: { label: "Envio de formulário", icon: <CheckCircle className="h-4 w-4" />, color: "bg-success/10 text-success" },
};

export function SecurityAuditViewer() {
  const { currentUser } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["security-audit-logs", currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return [];
      
      const { data, error } = await supabase
        .from("security_audit_logs")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as SecurityLog[];
    },
    enabled: !!currentUser?.account_id,
  });

  const filteredLogs = (logs || []).filter((log) => {
    const matchesSearch = searchQuery === "" || 
      log.event_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.ip_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = eventTypeFilter === "all" || log.event_type === eventTypeFilter;
    
    return matchesSearch && matchesType;
  });

  const getEventInfo = (eventType: string) => {
    return eventTypeLabels[eventType] || { 
      label: eventType, 
      icon: <Shield className="h-4 w-4" />, 
      color: "bg-muted text-muted-foreground" 
    };
  };

  const uniqueEventTypes = [...new Set((logs || []).map((l) => l.event_type))];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Logs de Segurança</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
        <CardDescription>
          Monitore logins, tentativas de acesso e ações administrativas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nos logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tipo de evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {uniqueEventTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {getEventInfo(type).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum log de segurança encontrado
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => {
                  const eventInfo = getEventInfo(log.event_type);
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className={eventInfo.color} variant="secondary">
                            {eventInfo.icon}
                            <span className="ml-1">{eventInfo.label}</span>
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {log.ip_address || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                        {Object.keys(log.details || {}).length > 0 
                          ? JSON.stringify(log.details)
                          : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}