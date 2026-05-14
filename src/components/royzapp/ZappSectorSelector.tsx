import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, Wifi, WifiOff, ArrowLeft, Lock, ChevronDown, Check, Settings, Plug } from "lucide-react";
import { SectorId, sectors } from "@/config/sectors";
import { useSectorAccess } from "@/hooks/useSectorAccess";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { withRetry } from "@/lib/retryFetch";
import { useNavigate } from "react-router-dom";
import { ZappPinDialog } from "./dialogs/ZappPinDialog";
import { ZappConnectionsSection } from "./settings/ZappConnectionsSection";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Setores que têm WhatsApp configurável
const WHATSAPP_SECTOR_IDS: SectorId[] = ["operacoes", "financeiro", "vendas", "marketing"];

interface SectorInstance {
  id: string;
  status: string;
  sector_id: string;
  display_name: string | null;
  phone_number: string | null;
  instance_name: string | null;
  connected: boolean;
  has_pin: boolean;
  pin_hash: string | null;
  // NEW: Indicates if this instance inherits sector-level PIN protection
  use_sector_pin: boolean;
}

interface WhatsAppSectorStatus {
  sectorId: SectorId;
  connected: boolean;
  instanceName: string | null;
  profileName: string | null;
  unreadCount: number;
  instances: SectorInstance[];
}

interface ZappSectorSelectorProps {
  onSelectSector: (sectorId: SectorId, integrationId?: string) => void;
}

export function ZappSectorSelector({ onSelectSector }: ZappSectorSelectorProps) {
  const { hasSectorAccess, isLoading: accessLoading } = useSectorAccess();
  const { isAdmin, loading: permissionsLoading } = usePermissions();
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  
  const [sectorStatuses, setSectorStatuses] = useState<WhatsAppSectorStatus[]>([]);
  const [loading, setLoading] = useState(true);
  
  // User's selected instance per sector (persisted to database)
  const [selectedInstances, setSelectedInstances] = useState<Partial<Record<SectorId, string>>>({});
  
  // Estado para PIN
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pendingInstance, setPendingInstance] = useState<{ 
    sectorId: SectorId; 
    integrationId: string; 
    instanceName: string;
    useSectorPin: boolean; // NEW: Flag to use sector PIN instead of instance PIN
  } | null>(null);
  const [pinVerifiedInstances, setPinVerifiedInstances] = useState<Set<string>>(new Set());
  // NEW: Track which sectors have been verified (for sector-level PINs)
  const [pinVerifiedSectors, setPinVerifiedSectors] = useState<Set<string>>(new Set());

  // Manage connections sheet
  const [manageSector, setManageSector] = useState<{ id: SectorId; name: string } | null>(null);

  // Buscar preferências do usuário
  const fetchUserPreferences = async () => {
    if (!currentUser?.auth_user_id || !currentUser?.account_id) return;
    
    try {
      const { data, error } = await supabase
        .from("user_instance_preferences")
        .select("sector_id, integration_id")
        .eq("user_id", currentUser.auth_user_id)
        .eq("account_id", currentUser.account_id);
      
      if (error) throw error;
      
      const prefs: Partial<Record<SectorId, string>> = {};
      (data || []).forEach((p: any) => {
        prefs[p.sector_id as SectorId] = p.integration_id;
      });
      setSelectedInstances(prefs);
    } catch (error) {
      console.error("Error fetching user preferences:", error);
    }
  };

  // Salvar preferência do usuário
  const saveUserPreference = async (sectorId: SectorId, integrationId: string) => {
    if (!currentUser?.auth_user_id || !currentUser?.account_id) return;
    
    try {
      const { error } = await supabase
        .from("user_instance_preferences")
        .upsert({
          user_id: currentUser.auth_user_id,
          account_id: currentUser.account_id,
          sector_id: sectorId,
          integration_id: integrationId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,account_id,sector_id",
        });
      
      if (error) throw error;
      
      setSelectedInstances(prev => ({ ...prev, [sectorId]: integrationId }));
    } catch (error) {
      console.error("Error saving user preference:", error);
    }
  };

  // Buscar status de conexão WhatsApp e contagem de mensagens por setor
  useEffect(() => {
    const fetchSectorStatuses = async () => {
      if (!currentUser?.account_id) return;
      
      setLoading(true);
      try {
        const [integrations, sectorSettings, departments, conversations] = await withRetry(async () => {
          const [intRes, settingsRes, deptsRes, convsRes] = await Promise.all([
            supabase
              .from("integrations")
              .select("id, sector_id, status, config, pin_hash")
              .eq("account_id", currentUser.account_id)
              .eq("type", "whatsapp")
              .in("sector_id", WHATSAPP_SECTOR_IDS),
            supabase
              .from("sector_settings")
              .select("sector_id, pin_hash")
              .eq("account_id", currentUser.account_id)
              .in("sector_id", WHATSAPP_SECTOR_IDS),
            supabase
              .from("zapp_departments")
              .select("id, sector_id")
              .eq("account_id", currentUser.account_id)
              .in("sector_id", WHATSAPP_SECTOR_IDS),
            supabase
              .from("zapp_conversation_assignments")
              .select("department_id, zapp_conversation:zapp_conversations(unread_count)")
              .eq("account_id", currentUser.account_id)
              .neq("status", "closed"),
          ]);

          if (intRes.error) throw intRes.error;

          return [intRes.data, settingsRes.data, deptsRes.data, convsRes.data] as const;
        }, 3, 1500);
        
        console.log("[ZappSectorSelector] Integrations loaded:", integrations);

        // Create a map of sector -> has PIN at sector level
        const sectorPinMap: Record<string, boolean> = {};
        (sectorSettings || []).forEach((s: any) => {
          sectorPinMap[s.sector_id] = !!s.pin_hash;
        });

        // Calcular unread por departamento
        const unreadByDept: Record<string, number> = {};
        (conversations || []).forEach((conv: any) => {
          if (conv.department_id && conv.zapp_conversation?.unread_count) {
            unreadByDept[conv.department_id] = (unreadByDept[conv.department_id] || 0) + conv.zapp_conversation.unread_count;
          }
        });

        // Agrupar instâncias por setor
        const instancesBySector: Record<SectorId, SectorInstance[]> = {} as any;
        WHATSAPP_SECTOR_IDS.forEach(sid => {
          instancesBySector[sid] = [];
        });
        
        (integrations || []).forEach((integration: any) => {
          const sectorId = integration.sector_id as SectorId;
          const config = integration.config as any;
          const connected = integration.status === "connected" || !!config?.instance_name;
          
          // Instance has its own PIN
          const instanceHasPin = !!integration.pin_hash || !!config?.pin_hash;
          // Sector has a PIN that protects all its instances
          const sectorHasPin = !!sectorPinMap[sectorId];
          // Effective PIN protection: instance OR sector
          const effectiveHasPin = instanceHasPin || sectorHasPin;
          // If instance doesn't have its own PIN but sector does, use sector PIN
          const useSectorPin = !instanceHasPin && sectorHasPin;
          
          instancesBySector[sectorId].push({
            id: integration.id,
            status: integration.status,
            sector_id: sectorId,
            display_name: config?.display_name || config?.profile_name || config?.profileName || config?.instance_name || null,
            phone_number: config?.phone_number || null,
            instance_name: config?.instance_name || null,
            connected,
            has_pin: effectiveHasPin,
            pin_hash: integration.pin_hash || config?.pin_hash || null,
            use_sector_pin: useSectorPin,
          });
        });

        // Mapear para setores
        const statuses: WhatsAppSectorStatus[] = WHATSAPP_SECTOR_IDS.map(sectorId => {
          const instances = instancesBySector[sectorId] || [];
          const dept = departments?.find(d => d.sector_id === sectorId);
          const unreadCount = dept ? (unreadByDept[dept.id] || 0) : 0;
          
          // A instância "principal" é a primeira conectada ou a primeira da lista
          const primaryInstance = instances.find(i => i.connected) || instances[0];
          
          return {
            sectorId,
            connected: instances.some(i => i.connected),
            instanceName: primaryInstance?.instance_name || null,
            profileName: primaryInstance?.display_name || null,
            unreadCount,
            instances,
          };
        });

        setSectorStatuses(statuses);
        
        // Buscar preferências do usuário
        await fetchUserPreferences();
        
      } catch (error) {
        console.error("Error fetching sector statuses:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSectorStatuses();
  }, [currentUser?.account_id, currentUser?.auth_user_id]);

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

  // Obter a instância selecionada para um setor
  const getSelectedInstance = (sectorId: SectorId): SectorInstance | null => {
    const status = getStatusForSector(sectorId);
    if (!status || status.instances.length === 0) return null;
    
    const selectedId = selectedInstances[sectorId];
    if (selectedId) {
      const found = status.instances.find(i => i.id === selectedId);
      if (found) return found;
    }
    
    // Fallback: primeira instância conectada ou primeira da lista
    return status.instances.find(i => i.connected) || status.instances[0];
  };

  // Handler para selecionar instância no dropdown
  const handleInstanceSelect = (sectorId: SectorId, instance: SectorInstance) => {
    // Check if already verified: either instance-level or sector-level
    const isVerified = pinVerifiedInstances.has(instance.id) || 
                       (instance.use_sector_pin && pinVerifiedSectors.has(sectorId));
    
    // Verificar se a instância requer PIN e ainda não foi verificada
    if (instance.has_pin && !isVerified) {
      setPendingInstance({
        sectorId,
        integrationId: instance.id,
        instanceName: instance.display_name || instance.instance_name || "Instância",
        useSectorPin: instance.use_sector_pin,
      });
      setShowPinDialog(true);
      return;
    }
    
    // Salvar preferência e selecionar
    saveUserPreference(sectorId, instance.id);
  };

  // Handler para clique no setor - abre o zAPP com a instância selecionada
  const handleSectorClick = (sectorId: SectorId) => {
    const selectedInstance = getSelectedInstance(sectorId);
    
    // Se não há instância selecionada ou não há instâncias, apenas abrir o setor
    if (!selectedInstance) {
      onSelectSector(sectorId);
      return;
    }
    
    // Check if already verified: either instance-level or sector-level
    const isVerified = pinVerifiedInstances.has(selectedInstance.id) || 
                       (selectedInstance.use_sector_pin && pinVerifiedSectors.has(sectorId));
    
    // Verificar se a instância selecionada requer PIN
    if (selectedInstance.has_pin && !isVerified) {
      setPendingInstance({
        sectorId,
        integrationId: selectedInstance.id,
        instanceName: selectedInstance.display_name || selectedInstance.instance_name || "Instância",
        useSectorPin: selectedInstance.use_sector_pin,
      });
      setShowPinDialog(true);
      return;
    }
    
    onSelectSector(sectorId, selectedInstance.id);
  };

  // Callback quando o PIN é verificado com sucesso
  const handlePinSuccess = () => {
    if (pendingInstance) {
      // Mark as verified based on PIN type
      if (pendingInstance.useSectorPin) {
        // Sector PIN verified - mark sector as verified (all instances in this sector are now accessible)
        setPinVerifiedSectors(prev => new Set([...prev, pendingInstance.sectorId]));
      } else {
        // Instance PIN verified - mark only this instance
        setPinVerifiedInstances(prev => new Set([...prev, pendingInstance.integrationId]));
      }
      
      // Salvar preferência
      saveUserPreference(pendingInstance.sectorId, pendingInstance.integrationId);
      
      // Abrir o setor
      onSelectSector(pendingInstance.sectorId, pendingInstance.integrationId);
      setPendingInstance(null);
    }
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
          <div className="flex-1">
            <h1 className="text-xl font-semibold">ROY zAPP</h1>
            <p className="text-sm text-muted-foreground">Escolha o setor para atender</p>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => navigate("/integrations/whatsapp")}
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações avançadas</span>
            </Button>
          )}
        </div>
      </div>

      {/* Sector Grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {accessibleSectors.map(sectorId => {
            const sector = getSectorInfo(sectorId);
            const status = getStatusForSector(sectorId);
            const selectedInstance = getSelectedInstance(sectorId);
            const instances = status?.instances || [];
            const hasMultipleInstances = instances.length > 1;
            
            if (!sector) return null;
            
            const Icon = sector.icon;
            
            return (
              <Card
                key={sectorId}
                className={cn(
                  "transition-all hover:shadow-lg hover:border-primary/50",
                  "group relative overflow-hidden"
                )}
              >
                {/* Unread badge */}
                {status && status.unreadCount > 0 && (
                  <div className="absolute top-3 right-3">
                    <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-xs font-bold">
                      {status.unreadCount > 99 ? "99+" : status.unreadCount}
                    </Badge>
                  </div>
                )}
                
                <CardHeader 
                  className="pb-2 cursor-pointer"
                  onClick={() => handleSectorClick(sectorId)}
                >
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
                  <div className="flex items-center justify-between gap-2">
                    {/* Connection status */}
                    <div className="flex items-center gap-2">
                      {selectedInstance?.connected ? (
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
                    
                    {/* Instance selector dropdown */}
                    {instances.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2 text-xs gap-1 max-w-[140px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {selectedInstance?.has_pin && 
                              !pinVerifiedInstances.has(selectedInstance.id) && 
                              !(selectedInstance.use_sector_pin && pinVerifiedSectors.has(sectorId)) && (
                              <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                            )}
                            <span className="truncate">
                              {selectedInstance?.display_name || selectedInstance?.instance_name || "Selecionar"}
                            </span>
                            {hasMultipleInstances && <ChevronDown className="h-3 w-3 shrink-0" />}
                          </Button>
                        </DropdownMenuTrigger>
                        {hasMultipleInstances && (
                          <DropdownMenuContent align="end" className="w-56 bg-zapp-panel border-zapp-border">
                            {instances.map((instance) => {
                              const isSelected = selectedInstance?.id === instance.id;
                              // Check if verified: instance-level OR sector-level
                              const isVerified = pinVerifiedInstances.has(instance.id) || 
                                                 (instance.use_sector_pin && pinVerifiedSectors.has(sectorId));
                              
                              return (
                                <DropdownMenuItem
                                  key={instance.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleInstanceSelect(sectorId, instance);
                                  }}
                                  className="flex items-center gap-2"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {/* Connection indicator */}
                                    <div className={cn(
                                      "w-2 h-2 rounded-full shrink-0",
                                      instance.connected ? "bg-emerald-500" : "bg-muted-foreground"
                                    )} />
                                    
                                    {/* PIN lock indicator */}
                                    {instance.has_pin && !isVerified && (
                                      <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                                    )}
                                    
                                    {/* Instance name */}
                                    <span className="truncate flex-1">
                                      {instance.display_name || instance.instance_name || "Sem nome"}
                                    </span>
                                    
                                    {/* Phone number */}
                                    {instance.phone_number && (
                                      <span className="text-xs text-muted-foreground shrink-0">
                                        {instance.phone_number}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Selected check */}
                                  {isSelected && (
                                    <Check className="h-4 w-4 text-primary shrink-0" />
                                  )}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        )}
                      </DropdownMenu>
                    )}

                    {/* Configure / Connect button */}
                    {isAdmin && (
                      instances.length === 0 ? (
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setManageSector({ id: sectorId, name: sector.name });
                          }}
                        >
                          <Plug className="h-3 w-3" />
                          Conectar
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Gerenciar conexões"
                          onClick={(e) => {
                            e.stopPropagation();
                            setManageSector({ id: sectorId, name: sector.name });
                          }}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Manage connections sheet */}
      <Sheet open={!!manageSector} onOpenChange={(o) => !o && setManageSector(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Conexões — {manageSector?.name}</SheetTitle>
            <SheetDescription>
              Gerencie números de WhatsApp conectados a este setor (UAZAPI ou Meta Cloud API).
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {manageSector && (
              <ZappConnectionsSection sectorId={manageSector.id} sectorName={manageSector.name} />
            )}
          </div>
        </SheetContent>
      </Sheet>
      
      {/* PIN Dialog - supports both instance and sector PINs */}
      <ZappPinDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        sectorId={pendingInstance?.sectorId || ""}
        integrationId={pendingInstance?.useSectorPin ? undefined : pendingInstance?.integrationId}
        instanceName={pendingInstance?.instanceName || "Instância"}
        useSectorPin={pendingInstance?.useSectorPin}
        onSuccess={handlePinSuccess}
      />
    </div>
  );
}
