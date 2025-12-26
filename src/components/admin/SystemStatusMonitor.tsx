import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock,
  Loader2,
  Zap,
  MessageSquare,
  Brain,
  Webhook,
  Mail,
  CreditCard,
  Users,
  Database,
  Server,
  Activity
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SystemFunction {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  icon: React.ReactNode;
  category: "core" | "integration" | "ai" | "communication";
  method?: "GET" | "POST";
  requiresAuth?: boolean;
}

interface FunctionStatus {
  id: string;
  status: "online" | "offline" | "degraded" | "checking";
  responseTime?: number;
  lastChecked: Date;
  error?: string;
}

const SYSTEM_FUNCTIONS: SystemFunction[] = [
  // Core Functions
  {
    id: "process-ai-queue",
    name: "Fila de IA",
    description: "Processador de análises de IA em fila",
    endpoint: "/functions/v1/process-ai-queue",
    icon: <Brain className="h-4 w-4" />,
    category: "ai",
    method: "POST",
    requiresAuth: true,
  },
  {
    id: "analyze-message",
    name: "Análise de Mensagem",
    description: "Analisa mensagens com IA para ROI/Risco",
    endpoint: "/functions/v1/analyze-message",
    icon: <Brain className="h-4 w-4" />,
    category: "ai",
    method: "POST",
    requiresAuth: true,
  },
  {
    id: "uazapi-webhook",
    name: "Webhook UAZAPI",
    description: "Recebe mensagens do WhatsApp",
    endpoint: "/functions/v1/uazapi-webhook",
    icon: <Webhook className="h-4 w-4" />,
    category: "integration",
    method: "POST",
  },
  {
    id: "uazapi-manager",
    name: "UAZAPI Manager",
    description: "Gerencia instâncias WhatsApp",
    endpoint: "/functions/v1/uazapi-manager",
    icon: <MessageSquare className="h-4 w-4" />,
    category: "integration",
    method: "POST",
    requiresAuth: true,
  },
  {
    id: "send-reminder",
    name: "Envio de Lembretes",
    description: "Dispara lembretes via WhatsApp",
    endpoint: "/functions/v1/send-reminder",
    icon: <Mail className="h-4 w-4" />,
    category: "communication",
    method: "POST",
    requiresAuth: true,
  },
  {
    id: "send-email",
    name: "Envio de Email",
    description: "Dispara emails via Resend",
    endpoint: "/functions/v1/send-email",
    icon: <Mail className="h-4 w-4" />,
    category: "communication",
    method: "POST",
    requiresAuth: true,
  },
  {
    id: "asaas-api",
    name: "API Asaas",
    description: "Integração de pagamentos",
    endpoint: "/functions/v1/asaas-api",
    icon: <CreditCard className="h-4 w-4" />,
    category: "integration",
    method: "POST",
    requiresAuth: true,
  },
  {
    id: "asaas-webhook",
    name: "Webhook Asaas",
    description: "Recebe eventos de pagamento",
    endpoint: "/functions/v1/asaas-webhook",
    icon: <CreditCard className="h-4 w-4" />,
    category: "integration",
    method: "POST",
  },
  {
    id: "support-webhook",
    name: "Webhook Suporte",
    description: "Recebe tickets de suporte",
    endpoint: "/functions/v1/support-webhook",
    icon: <Users className="h-4 w-4" />,
    category: "communication",
    method: "POST",
  },
  {
    id: "evolution-webhook",
    name: "Webhook Evolution",
    description: "Integração Evolution API",
    endpoint: "/functions/v1/evolution-webhook",
    icon: <Webhook className="h-4 w-4" />,
    category: "integration",
    method: "POST",
  },
  {
    id: "event-checkin",
    name: "Check-in Eventos",
    description: "Registra presença em eventos",
    endpoint: "/functions/v1/event-checkin",
    icon: <Users className="h-4 w-4" />,
    category: "core",
    method: "POST",
  },
  {
    id: "download-media",
    name: "Download Mídia",
    description: "Baixa mídias do WhatsApp",
    endpoint: "/functions/v1/download-media",
    icon: <Database className="h-4 w-4" />,
    category: "core",
    method: "POST",
    requiresAuth: true,
  },
  {
    id: "recompute-scores",
    name: "Recálculo de Scores",
    description: "Atualiza scores dos clientes",
    endpoint: "/functions/v1/recompute-scores",
    icon: <Activity className="h-4 w-4" />,
    category: "ai",
    method: "POST",
    requiresAuth: true,
  },
];

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  core: { label: "Core", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  integration: { label: "Integração", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  ai: { label: "IA", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  communication: { label: "Comunicação", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
};

export function SystemStatusMonitor() {
  const [statuses, setStatuses] = useState<Record<string, FunctionStatus>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [lastFullCheck, setLastFullCheck] = useState<Date | null>(null);

  // Get Supabase URL from environment
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  // Query AI queue stats
  const { data: queueStats, refetch: refetchQueueStats } = useQuery({
    queryKey: ["ai-queue-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ai_queue_stats");
      if (error) throw error;
      return data as { pending: number; processing: number; completed_today: number; failed_today: number };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Query database health
  const { data: dbHealth } = useQuery({
    queryKey: ["db-health"],
    queryFn: async () => {
      const start = Date.now();
      const { count, error } = await supabase
        .from("accounts")
        .select("id", { count: "exact", head: true });
      const responseTime = Date.now() - start;
      
      return {
        status: error ? "offline" : "online",
        responseTime,
        error: error?.message,
      };
    },
    refetchInterval: 30000,
  });

  const checkFunction = async (func: SystemFunction): Promise<FunctionStatus> => {
    const start = Date.now();
    
    try {
      // For edge functions, we do a simple health check
      const url = `${supabaseUrl}${func.endpoint}`;
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (func.requiresAuth) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }
      }

      // Use HEAD request first, fallback to OPTIONS, then POST with empty body
      // Edge functions typically respond to any HTTP method when deployed
      let response: Response;
      
      try {
        // Try OPTIONS first (CORS preflight)
        response = await fetch(url, {
          method: "OPTIONS",
          headers,
        });
        
        // If OPTIONS returns 405 or fails, try a POST with minimal body
        if (!response.ok && response.status !== 204) {
          response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ healthCheck: true }),
          });
        }
      } catch {
        // Network error - try POST as last resort
        response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ healthCheck: true }),
        });
      }

      const responseTime = Date.now() - start;
      
      // Consider online if we get any response (even 4xx means the function is running)
      // Only network errors or 5xx should be considered offline
      // 401/403 means function is running but needs auth
      // 400 means function is running but got invalid payload
      const isOnline = response.status < 500 || response.status === 204;
      
      return {
        id: func.id,
        status: isOnline ? "online" : "offline",
        responseTime,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        id: func.id,
        status: "offline",
        responseTime: Date.now() - start,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  };

  const checkAllFunctions = async () => {
    setIsChecking(true);
    
    // Set all to checking
    const checkingStatuses: Record<string, FunctionStatus> = {};
    SYSTEM_FUNCTIONS.forEach(func => {
      checkingStatuses[func.id] = {
        id: func.id,
        status: "checking",
        lastChecked: new Date(),
      };
    });
    setStatuses(checkingStatuses);

    // Check all functions in parallel
    const results = await Promise.all(
      SYSTEM_FUNCTIONS.map(func => checkFunction(func))
    );

    // Update statuses
    const newStatuses: Record<string, FunctionStatus> = {};
    results.forEach(result => {
      newStatuses[result.id] = result;
    });
    setStatuses(newStatuses);
    setLastFullCheck(new Date());
    setIsChecking(false);
    
    // Refresh queue stats too
    refetchQueueStats();

    const onlineCount = results.filter(r => r.status === "online").length;
    const offlineCount = results.filter(r => r.status === "offline").length;
    
    if (offlineCount === 0) {
      toast.success(`Todas as ${onlineCount} funções estão online!`);
    } else {
      toast.warning(`${onlineCount} online, ${offlineCount} offline`);
    }
  };

  // Initial check on mount
  useEffect(() => {
    checkAllFunctions();
  }, []);

  const getStatusBadge = (status: FunctionStatus["status"]) => {
    switch (status) {
      case "online":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Online
          </Badge>
        );
      case "offline":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 gap-1">
            <XCircle className="h-3 w-3" />
            Offline
          </Badge>
        );
      case "degraded":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1">
            <AlertCircle className="h-3 w-3" />
            Degradado
          </Badge>
        );
      case "checking":
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Verificando
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
            <Clock className="h-3 w-3" />
            Pendente
          </Badge>
        );
    }
  };

  const onlineCount = Object.values(statuses).filter(s => s.status === "online").length;
  const offlineCount = Object.values(statuses).filter(s => s.status === "offline").length;
  const totalCount = SYSTEM_FUNCTIONS.length;

  const groupedFunctions = SYSTEM_FUNCTIONS.reduce((acc, func) => {
    if (!acc[func.category]) acc[func.category] = [];
    acc[func.category].push(func);
    return acc;
  }, {} as Record<string, SystemFunction[]>);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status Geral</p>
                <p className="text-2xl font-bold mt-1">
                  {offlineCount === 0 ? "Operacional" : offlineCount < 3 ? "Degradado" : "Crítico"}
                </p>
              </div>
              <div className={`p-3 rounded-full ${offlineCount === 0 ? "bg-green-500/10" : offlineCount < 3 ? "bg-amber-500/10" : "bg-red-500/10"}`}>
                {offlineCount === 0 ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : offlineCount < 3 ? (
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-500" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Funções Online</p>
                <p className="text-2xl font-bold mt-1">
                  {onlineCount} / {totalCount}
                </p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Server className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fila de IA</p>
                <p className="text-2xl font-bold mt-1">
                  {queueStats?.pending || 0} pendentes
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {queueStats?.processing || 0} processando
                </p>
              </div>
              <div className="p-3 rounded-full bg-emerald-500/10">
                <Brain className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Banco de Dados</p>
                <p className="text-2xl font-bold mt-1">
                  {dbHealth?.status === "online" ? "Online" : "Offline"}
                </p>
                {dbHealth?.responseTime && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {dbHealth.responseTime}ms latência
                  </p>
                )}
              </div>
              <div className={`p-3 rounded-full ${dbHealth?.status === "online" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                <Database className={`h-6 w-6 ${dbHealth?.status === "online" ? "text-green-500" : "text-red-500"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Queue Stats */}
      {queueStats && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-500" />
              Estatísticas da Fila de IA (Hoje)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{queueStats.pending}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-500/10">
                <p className="text-2xl font-bold text-blue-500">{queueStats.processing}</p>
                <p className="text-xs text-muted-foreground">Processando</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-500/10">
                <p className="text-2xl font-bold text-green-500">{queueStats.completed_today}</p>
                <p className="text-xs text-muted-foreground">Concluídos</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-500/10">
                <p className="text-2xl font-bold text-red-500">{queueStats.failed_today}</p>
                <p className="text-xs text-muted-foreground">Falhas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Functions List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Edge Functions</CardTitle>
            <CardDescription>
              Status das funções do sistema
              {lastFullCheck && (
                <span className="ml-2 text-xs">
                  • Última verificação: {format(lastFullCheck, "HH:mm:ss", { locale: ptBR })}
                </span>
              )}
            </CardDescription>
          </div>
          <Button onClick={checkAllFunctions} disabled={isChecking} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
            Verificar Todas
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(groupedFunctions).map(([category, functions]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Badge variant="outline" className={CATEGORY_LABELS[category].color}>
                  {CATEGORY_LABELS[category].label}
                </Badge>
                <span className="text-muted-foreground">
                  {functions.filter(f => statuses[f.id]?.status === "online").length}/{functions.length} online
                </span>
              </h3>
              <div className="grid gap-2">
                {functions.map(func => {
                  const status = statuses[func.id];
                  return (
                    <div
                      key={func.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          {func.icon}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{func.name}</p>
                          <p className="text-xs text-muted-foreground">{func.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {status?.responseTime && status.status === "online" && (
                          <span className="text-xs text-muted-foreground">
                            {status.responseTime}ms
                          </span>
                        )}
                        {getStatusBadge(status?.status || "checking")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
