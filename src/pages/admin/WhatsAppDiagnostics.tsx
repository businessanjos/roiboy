import { useState, useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle2, 
  MessageSquare, ArrowRight, Clock, Phone 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sectors } from "@/config/sectors";

// WhatsApp sector IDs
const WHATSAPP_SECTOR_IDS = ["operacoes", "vendas", "diretoria"] as const;

interface Integration {
  id: string;
  sector_id: string;
  status: string;
  config: {
    instance_name?: string;
    phone_number?: string;
    instance_token?: string;
    profile_name?: string;
  };
  created_at: string;
}

interface Conversation {
  id: string;
  sector_id: string;
  phone_e164: string;
  contact_name: string;
  created_at: string;
  last_message_at: string;
}

interface RealtimeMessage {
  id: string;
  conversation_id: string;
  body: string;
  from_me: boolean;
  created_at: string;
  conversation?: {
    sector_id: string;
    phone_e164: string;
    contact_name: string;
  };
}

export default function WhatsAppDiagnostics() {
  const { currentUser } = useCurrentUser();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [realtimeMessages, setRealtimeMessages] = useState<RealtimeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    if (!currentUser?.account_id) return;

    try {
      // Fetch integrations
      const { data: integrationsData } = await supabase
        .from("integrations")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .eq("type", "whatsapp");

      // Fetch recent conversations
      const { data: conversationsData } = await supabase
        .from("zapp_conversations")
        .select("id, sector_id, phone_e164, contact_name, created_at, last_message_at")
        .eq("account_id", currentUser.account_id)
        .order("created_at", { ascending: false })
        .limit(30);

      // Map integrations to our type
      const mappedIntegrations = (integrationsData || []).map((i) => ({
        id: i.id,
        sector_id: i.sector_id,
        status: i.status,
        config: i.config as Integration["config"],
        created_at: i.created_at,
      }));

      setIntegrations(mappedIntegrations);
      setConversations(conversationsData || []);
    } catch (error) {
      console.error("Error fetching diagnostics data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser?.account_id]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!currentUser?.account_id) return;

    const channel = supabase
      .channel("diagnostics-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "zapp_messages",
        },
        async (payload) => {
          const newMessage = payload.new as RealtimeMessage;
          
          // Fetch conversation details
          const { data: conv } = await supabase
            .from("zapp_conversations")
            .select("sector_id, phone_e164, contact_name")
            .eq("id", newMessage.conversation_id)
            .single();

          if (conv) {
            setRealtimeMessages((prev) => [
              {
                ...newMessage,
                conversation: conv,
              },
              ...prev.slice(0, 49), // Keep last 50
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.account_id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getSectorName = (sectorId: string) => {
    const sector = sectors.find((s) => s.id === sectorId);
    return sector?.name || sectorId;
  };

  const getSectorColor = (sectorId: string) => {
    const colors: Record<string, string> = {
      operacoes: "bg-blue-500",
      vendas: "bg-green-500",
      financeiro: "bg-amber-500",
      diretoria: "bg-purple-500",
    };
    return colors[sectorId] || "bg-gray-500";
  };

  // Group conversations by sector
  const conversationsBySector = conversations.reduce((acc, conv) => {
    if (!acc[conv.sector_id]) {
      acc[conv.sector_id] = [];
    }
    acc[conv.sector_id].push(conv);
    return acc;
  }, {} as Record<string, Conversation[]>);

  // Check for potential routing issues
  const checkRoutingIssues = () => {
    const issues: string[] = [];
    
    // Check if multiple integrations have same instance_name
    const instanceNames = integrations.map(i => i.config?.instance_name).filter(Boolean);
    const duplicates = instanceNames.filter((name, index) => instanceNames.indexOf(name) !== index);
    
    if (duplicates.length > 0) {
      issues.push(`Instâncias duplicadas detectadas: ${duplicates.join(", ")}`);
    }

    // Check integrations without sector_id
    const noSector = integrations.filter(i => !i.sector_id);
    if (noSector.length > 0) {
      issues.push(`${noSector.length} integração(ões) sem setor definido`);
    }

    return issues;
  };

  const routingIssues = checkRoutingIssues();

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Diagnóstico WhatsApp</h1>
          <p className="text-muted-foreground">
            Visualize em tempo real o roteamento de mensagens entre setores
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Routing Issues Alert */}
      {routingIssues.length > 0 && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5" />
              Problemas Detectados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {routingIssues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Integrations Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Integrações Configuradas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Setor</th>
                  <th className="text-left py-2 px-3 font-medium">Instância</th>
                  <th className="text-left py-2 px-3 font-medium">Telefone</th>
                  <th className="text-left py-2 px-3 font-medium">Status</th>
                  <th className="text-left py-2 px-3 font-medium">Token (8 chars)</th>
                  <th className="text-left py-2 px-3 font-medium">Última Atualização</th>
                </tr>
              </thead>
              <tbody>
                {integrations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhuma integração WhatsApp encontrada
                    </td>
                  </tr>
                ) : (
                  integrations.map((integration) => (
                    <tr key={integration.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-3">
                        <Badge className={`${getSectorColor(integration.sector_id)} text-white`}>
                          {getSectorName(integration.sector_id)}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs">
                        {integration.config?.instance_name || "-"}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {integration.config?.phone_number || "-"}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {integration.status === "connected" ? (
                          <div className="flex items-center gap-1.5 text-green-600">
                            <Wifi className="h-4 w-4" />
                            <span>Online</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <WifiOff className="h-4 w-4" />
                            <span>{integration.status || "Offline"}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                        {integration.config?.instance_token?.substring(0, 8) || "(vazio)"}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground text-xs">
                        {format(new Date(integration.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Realtime Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Mensagens em Tempo Real
              {realtimeMessages.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {realtimeMessages.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {realtimeMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                  <Clock className="h-8 w-8 mb-2 opacity-50" />
                  <p>Aguardando novas mensagens...</p>
                  <p className="text-xs">As mensagens aparecerão aqui em tempo real</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {realtimeMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(msg.created_at), "HH:mm:ss", { locale: ptBR })}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge className={`${getSectorColor(msg.conversation?.sector_id || "")} text-white text-xs`}>
                          {getSectorName(msg.conversation?.sector_id || "")}
                        </Badge>
                        {msg.from_me && (
                          <Badge variant="outline" className="text-xs">Enviada</Badge>
                        )}
                      </div>
                      <div className="text-sm font-medium">
                        {msg.conversation?.contact_name || msg.conversation?.phone_e164}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {msg.body?.substring(0, 100)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Conversations by Sector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimas Conversas por Setor</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {Object.entries(conversationsBySector).map(([sectorId, sectorConvs]) => (
                  <div key={sectorId}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={`${getSectorColor(sectorId)} text-white`}>
                        {getSectorName(sectorId)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {sectorConvs.length} conversa(s)
                      </span>
                    </div>
                    <div className="space-y-1 pl-2 border-l-2 border-muted">
                      {sectorConvs.slice(0, 5).map((conv) => (
                        <div
                          key={conv.id}
                          className="text-sm flex items-center justify-between py-1"
                        >
                          <span className="truncate max-w-[200px]">
                            {conv.contact_name || conv.phone_e164}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(conv.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Separator className="mt-3" />
                  </div>
                ))}

                {Object.keys(conversationsBySector).length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhuma conversa encontrada
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Stats Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo de Roteamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {WHATSAPP_SECTOR_IDS.map((sectorId) => {
              const sector = sectors.find(s => s.id === sectorId);
              if (!sector) return null;
              
              const sectorIntegration = integrations.find(i => i.sector_id === sectorId);
              const convCount = conversationsBySector[sectorId]?.length || 0;
              
              return (
                <div
                  key={sector.id}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${getSectorColor(sector.id)}`} />
                    <span className="font-medium">{sector.name}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Integração:</span>
                      {sectorIntegration ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conversas:</span>
                      <span className="font-mono">{convCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className={sectorIntegration?.status === "connected" ? "text-green-600" : "text-muted-foreground"}>
                        {sectorIntegration?.status === "connected" ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
