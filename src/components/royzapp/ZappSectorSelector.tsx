import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, Wifi, WifiOff, ArrowLeft } from "lucide-react";
import { SectorId, sectors } from "@/config/sectors";
import { useSectorAccess } from "@/hooks/useSectorAccess";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

// Setores que têm WhatsApp configurável
const WHATSAPP_SECTOR_IDS: SectorId[] = ["operacoes", "financeiro", "vendas", "marketing", "diretoria"];

interface WhatsAppSectorStatus {
  sectorId: SectorId;
  connected: boolean;
  instanceName: string | null;
  profileName: string | null;
  unreadCount: number;
}

interface ZappSectorSelectorProps {
  onSelectSector: (sectorId: SectorId) => void;
}

export function ZappSectorSelector({ onSelectSector }: ZappSectorSelectorProps) {
  const { hasSectorAccess, isLoading: accessLoading } = useSectorAccess();
  const { isAdmin, loading: permissionsLoading } = usePermissions();
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  
  const [sectorStatuses, setSectorStatuses] = useState<WhatsAppSectorStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Buscar status de conexão WhatsApp e contagem de mensagens por setor
  useEffect(() => {
    const fetchSectorStatuses = async () => {
      if (!currentUser?.account_id) return;
      
      setLoading(true);
      try {
        // Buscar integrações WhatsApp por setor
        const { data: integrations, error } = await supabase
          .from("integrations")
          .select("sector_id, status, config")
          .eq("account_id", currentUser.account_id)
          .eq("type", "whatsapp")
          .in("sector_id", WHATSAPP_SECTOR_IDS);

        if (error) throw error;
        
        console.log("[ZappSectorSelector] Integrations loaded:", integrations);

        // Buscar contagem de mensagens não lidas por departamento (setor)
        const { data: departments } = await supabase
          .from("zapp_departments")
          .select("id, sector_id")
          .eq("account_id", currentUser.account_id)
          .in("sector_id", WHATSAPP_SECTOR_IDS);

        // Buscar conversas não fechadas com unread > 0
        const { data: conversations } = await supabase
          .from("zapp_conversation_assignments")
          .select("department_id, zapp_conversation:zapp_conversations(unread_count)")
          .eq("account_id", currentUser.account_id)
          .neq("status", "closed");

        // Calcular unread por departamento
        const unreadByDept: Record<string, number> = {};
        (conversations || []).forEach((conv: any) => {
          if (conv.department_id && conv.zapp_conversation?.unread_count) {
            unreadByDept[conv.department_id] = (unreadByDept[conv.department_id] || 0) + conv.zapp_conversation.unread_count;
          }
        });

        // Mapear para setores
        const statuses: WhatsAppSectorStatus[] = WHATSAPP_SECTOR_IDS.map(sectorId => {
          const integration = integrations?.find(i => i.sector_id === sectorId);
          const dept = departments?.find(d => d.sector_id === sectorId);
          const unreadCount = dept ? (unreadByDept[dept.id] || 0) : 0;
          
          const config = integration?.config as any;
          // Considerar conectado se status === "connected" OU se tem instance_name
          const connected = integration?.status === "connected" || !!config?.instance_name;
          
          return {
            sectorId,
            connected: !!connected,
            instanceName: config?.instance_name || null,
            // Support both snake_case and camelCase field names
            profileName: config?.profile_name || config?.profileName || null,
            unreadCount,
          };
        });

        setSectorStatuses(statuses);
      } catch (error) {
        console.error("Error fetching sector statuses:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSectorStatuses();
  }, [currentUser?.account_id]);

  // Filtrar setores que o usuário tem acesso
  const accessibleSectors = WHATSAPP_SECTOR_IDS.filter(sectorId => {
    if (isAdmin) return true;
    return hasSectorAccess(sectorId);
  });

  // Obter informações do setor
  const getSectorInfo = (sectorId: SectorId) => {
    return sectors.find(s => s.id === sectorId);
  };

  const getStatusForSector = (sectorId: SectorId) => {
    return sectorStatuses.find(s => s.sectorId === sectorId);
  };

  if (permissionsLoading || accessLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accessibleSectors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <MessageSquare className="h-16 w-16 text-muted-foreground/50" />
        <div className="text-center">
          <h2 className="text-xl font-semibold">Sem acesso ao ROY zAPP</h2>
          <p className="text-muted-foreground mt-2">
            Você não tem acesso a nenhum setor do ROY zAPP.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">ROY zAPP</h1>
            <p className="text-sm text-muted-foreground">Escolha o setor para atender</p>
          </div>
        </div>
      </div>

      {/* Sector Grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {accessibleSectors.map(sectorId => {
            const sector = getSectorInfo(sectorId);
            const status = getStatusForSector(sectorId);
            
            if (!sector) return null;
            
            const Icon = sector.icon;
            
            return (
              <Card
                key={sectorId}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-lg hover:border-primary/50",
                  "group relative overflow-hidden"
                )}
                onClick={() => onSelectSector(sectorId)}
              >
                {/* Unread badge */}
                {status && status.unreadCount > 0 && (
                  <div className="absolute top-3 right-3">
                    <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-xs font-bold">
                      {status.unreadCount > 99 ? "99+" : status.unreadCount}
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", sector.bgColor)}>
                      <Icon className={cn("h-5 w-5", sector.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">{sector.name}</CardTitle>
                      <CardDescription className="text-xs truncate">
                        {sector.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {status?.connected ? (
                        <>
                          <Wifi className="h-4 w-4 text-emerald-500" />
                          <span className="text-xs text-emerald-600 font-medium">Online</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Desconectado</span>
                        </>
                      )}
                    </div>
                    
                    {status?.profileName && (
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {status.profileName}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
