import { useState, useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle2, 
  MessageSquare, ArrowRight, Clock, Phone, Users, Database,
  Link2, Unlink, Loader2, History
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sectors } from "@/config/sectors";
import { toast } from "sonner";

// WhatsApp sector IDs
const WHATSAPP_SECTOR_IDS = ["operacoes", "vendas"] as const;

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
  integration_id: string | null;
  is_group: boolean;
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

interface OrphanStats {
  total_conversations: number;
  without_integration: number;
  without_assignment: number;
  groups_without_sync: number;
}

export default function WhatsAppDiagnostics() {
  const { currentUser } = useCurrentUser();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [realtimeMessages, setRealtimeMessages] = useState<RealtimeMessage[]>([]);
  const [orphanStats, setOrphanStats] = useState<OrphanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingLegacy, setSyncingLegacy] = useState(false);
  const [importingChats, setImportingChats] = useState<string | null>(null);
  const [syncingHistory, setSyncingHistory] = useState<string | null>(null);

  const fetchData = async () => {
    if (!currentUser?.account_id) return;

    try {
      // Fetch integrations
      const { data: integrationsData } = await supabase
        .from("integrations")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .eq("type", "whatsapp");

      // Fetch recent conversations with more details
      const { data: conversationsData } = await supabase
        .from("zapp_conversations")
        .select("id, sector_id, phone_e164, contact_name, created_at, last_message_at, integration_id, is_group")
        .eq("account_id", currentUser.account_id)
        .order("created_at", { ascending: false })
        .limit(50);

      // Calculate orphan stats
      const allConvos = conversationsData || [];
      const withoutIntegration = allConvos.filter(c => !c.integration_id);
      
      // Check for conversations without assignments
      const { count: withoutAssignment } = await supabase
        .from("zapp_conversations")
        .select("id", { count: "exact", head: true })
        .eq("account_id", currentUser.account_id)
        .not("id", "in", supabase
          .from("zapp_conversation_assignments")
          .select("zapp_conversation_id")
          .eq("account_id", currentUser.account_id)
        );

      // Check groups in whatsapp_groups without zapp_conversation
      const { data: allGroups } = await supabase
        .from("whatsapp_groups")
        .select("group_jid")
        .eq("account_id", currentUser.account_id);
      
      const groupJids = (allGroups || []).map(g => g.group_jid);
      const { data: groupConvos } = await supabase
        .from("zapp_conversations")
        .select("group_jid")
        .eq("account_id", currentUser.account_id)
        .eq("is_group", true)
        .in("group_jid", groupJids.length > 0 ? groupJids : ["none"]);
      
      const syncedGroupJids = new Set((groupConvos || []).map(g => g.group_jid));
      const groupsWithoutSync = groupJids.filter(jid => !syncedGroupJids.has(jid)).length;

      setOrphanStats({
        total_conversations: allConvos.length,
        without_integration: withoutIntegration.length,
        without_assignment: withoutAssignment || 0,
        groups_without_sync: groupsWithoutSync,
      });

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

  // Sync legacy conversations (add integration_id to orphans)
  const handleSyncLegacy = async () => {
    if (!currentUser?.account_id) return;
    
    setSyncingLegacy(true);
    try {
      // For each sector, find the active integration and update orphan conversations
      for (const sectorId of WHATSAPP_SECTOR_IDS) {
        const integration = integrations.find(i => i.sector_id === sectorId && i.status === "connected");
        
        if (integration) {
          const { data: updated, error } = await supabase
            .from("zapp_conversations")
            .update({ integration_id: integration.id })
            .eq("account_id", currentUser.account_id)
            .eq("sector_id", sectorId)
            .is("integration_id", null)
            .select("id");
          
          if (error) {
            console.error(`Error syncing ${sectorId}:`, error);
          } else if (updated && updated.length > 0) {
            console.log(`Synced ${updated.length} conversations for ${sectorId}`);
          }
        }
      }
      
      toast.success("Conversas legadas sincronizadas com integrações ativas");
      fetchData();
    } catch (error) {
      console.error("Error syncing legacy:", error);
      toast.error("Erro ao sincronizar conversas legadas");
    } finally {
      setSyncingLegacy(false);
    }
  };

  // Import conversations from WhatsApp for a specific sector
  const handleImportChats = async (sectorId: string) => {
    setImportingChats(sectorId);
    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "import-conversations", sector_id: sectorId },
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      toast.success(`Importação iniciada para ${getSectorName(sectorId)}`);
      // Refresh after a delay to show new data
      setTimeout(fetchData, 3000);
    } catch (error: any) {
      console.error("Error importing chats:", error);
      toast.error(error.message || "Erro ao importar conversas");
    } finally {
      setImportingChats(null);
    }
  };

  // Sync message history from UAZAPI
  const handleSyncHistory = async (integrationId: string, days: number = 7) => {
    setSyncingHistory(integrationId);
    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { 
          action: "sync-chat-history", 
          integration_id: integrationId,
          days,
        },
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const result = response.data?.data;
      if (result) {
        toast.success(
          `Sincronização concluída! ${result.synced} mensagens sincronizadas, ${result.skipped} já existiam.`,
          { duration: 5000 }
        );
        
        if (result.errors > 0) {
          toast.warning(`${result.errors} erros durante sincronização`, { duration: 3000 });
        }
      } else {
        toast.success("Sincronização concluída!");
      }
      
      // Refresh to show new messages
      fetchData();
    } catch (error: any) {
      console.error("Error syncing history:", error);
      toast.error(error.message || "Erro ao sincronizar histórico");
    } finally {
      setSyncingHistory(null);
    }
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

    // Check for orphan conversations
    if (orphanStats && orphanStats.without_integration > 0) {
      issues.push(`${orphanStats.without_integration} conversa(s) sem integration_id (legadas)`);
    }

    if (orphanStats && orphanStats.without_assignment > 0) {
      issues.push(`${orphanStats.without_assignment} conversa(s) sem assignment (invisíveis no zAPP)`);
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
            Visualize em tempo real o roteamento de mensagens e sincronize conversas
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Orphan Stats Cards */}
      {orphanStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Database className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{orphanStats.total_conversations}</p>
                  <p className="text-xs text-muted-foreground">Total de Conversas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={orphanStats.without_integration > 0 ? "border-amber-500" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Unlink className={`h-8 w-8 ${orphanStats.without_integration > 0 ? "text-amber-500" : "text-green-500"}`} />
                <div>
                  <p className="text-2xl font-bold">{orphanStats.without_integration}</p>
                  <p className="text-xs text-muted-foreground">Sem Integration ID</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={orphanStats.without_assignment > 0 ? "border-red-500" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`h-8 w-8 ${orphanStats.without_assignment > 0 ? "text-red-500" : "text-green-500"}`} />
                <div>
                  <p className="text-2xl font-bold">{orphanStats.without_assignment}</p>
                  <p className="text-xs text-muted-foreground">Sem Assignment</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={orphanStats.groups_without_sync > 0 ? "border-amber-500" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className={`h-8 w-8 ${orphanStats.groups_without_sync > 0 ? "text-amber-500" : "text-green-500"}`} />
                <div>
                  <p className="text-2xl font-bold">{orphanStats.groups_without_sync}</p>
                  <p className="text-xs text-muted-foreground">Grupos Órfãos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Routing Issues Alert */}
      {routingIssues.length > 0 && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-destructive flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5" />
                Problemas Detectados
              </CardTitle>
              {orphanStats && orphanStats.without_integration > 0 && (
                <Button 
                  onClick={handleSyncLegacy} 
                  disabled={syncingLegacy}
                  size="sm"
                  variant="outline"
                >
                  {syncingLegacy ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Vincular Conversas Legadas
                </Button>
              )}
            </div>
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
          <CardDescription>
            Clique em "Importar" para sincronizar conversas do WhatsApp
          </CardDescription>
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
                  <th className="text-left py-2 px-3 font-medium">Conversas</th>
                  <th className="text-left py-2 px-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {integrations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nenhuma integração WhatsApp encontrada
                    </td>
                  </tr>
                ) : (
                  integrations.map((integration) => {
                    const sectorConvos = conversationsBySector[integration.sector_id] || [];
                    const legacyCount = sectorConvos.filter(c => !c.integration_id).length;
                    
                    return (
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
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{sectorConvos.length}</span>
                            {legacyCount > 0 && (
                              <span className="text-xs text-amber-500">
                                ({legacyCount} legadas)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleImportChats(integration.sector_id)}
                              disabled={importingChats === integration.sector_id || integration.status !== "connected"}
                              title="Importar conversas do WhatsApp"
                            >
                              {importingChats === integration.sector_id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Importar"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSyncHistory(integration.id, 7)}
                              disabled={syncingHistory === integration.id || integration.status !== "connected"}
                              title="Sincronizar histórico de mensagens (últimos 7 dias)"
                            >
                              {syncingHistory === integration.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <History className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
                      {sectorConvs.filter(c => !c.integration_id).length > 0 && (
                        <Badge variant="outline" className="text-xs text-amber-500 border-amber-500">
                          {sectorConvs.filter(c => !c.integration_id).length} legadas
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 pl-2 border-l-2 border-muted">
                      {sectorConvs.slice(0, 5).map((conv) => (
                        <div
                          key={conv.id}
                          className="text-sm flex items-center justify-between py-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[150px]">
                              {conv.contact_name || conv.phone_e164}
                            </span>
                            {conv.is_group && (
                              <Users className="h-3 w-3 text-muted-foreground" />
                            )}
                            {!conv.integration_id && (
                              <Unlink className="h-3 w-3 text-amber-500" />
                            )}
                          </div>
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
              const sectorConvos = conversationsBySector[sectorId] || [];
              const legacyCount = sectorConvos.filter(c => !c.integration_id).length;
              const groupCount = sectorConvos.filter(c => c.is_group).length;
              
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
                      <span className="font-mono">{sectorConvos.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Grupos:</span>
                      <span className="font-mono">{groupCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Legadas:</span>
                      <span className={`font-mono ${legacyCount > 0 ? "text-amber-500" : ""}`}>
                        {legacyCount}
                      </span>
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
