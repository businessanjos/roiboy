import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, MessageSquare, Link2, Link2Off, RefreshCw, ShieldAlert, Smartphone, WifiOff, Wifi, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sectors, SectorId } from "@/config/sectors";
import { usePermissions } from "@/hooks/usePermissions";

import type { Tables } from "@/integrations/supabase/types";

type Integration = Tables<"integrations">;

interface UazapiInstance {
  name: string;
  status: string;
  owner: string;
  profileName: string;
  profilePicUrl?: string;
  hasToken: boolean;
  // Linking properties
  linked_sector_id: string | null;
  linked_integration_id: string | null;
  linked_status: string | null;
}

interface WhatsAppSectorManagerProps {
  integrations: Integration[];
  accountId: string | null;
  onRefresh: () => void;
}

const WHATSAPP_SECTORS: { id: SectorId; name: string; description: string; color: string }[] = [
  { id: "operacoes", name: "Operações", description: "Atendimento CX/CS e suporte geral", color: "text-primary" },
  { id: "financeiro", name: "Finanças", description: "Cobranças, boletos e pagamentos", color: "text-emerald-600" },
  { id: "vendas", name: "Vendas", description: "Pipeline comercial e leads", color: "text-blue-600" },
  { id: "diretoria", name: "Diretoria", description: "Gestão executiva - Everton Pieri", color: "text-rose-600" },
];

export function WhatsAppSectorManager({ integrations, accountId, onRefresh }: WhatsAppSectorManagerProps) {
  const { isAdmin } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [instances, setInstances] = useState<UazapiInstance[]>([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<UazapiInstance | null>(null);
  const [selectedSector, setSelectedSector] = useState<SectorId | "">("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Fetch instances on mount
  useEffect(() => {
    fetchInstances();
  }, []);

  // Get sectors that are already linked to an instance
  const linkedSectors = useMemo(() => {
    return instances
      .filter(i => i.linked_sector_id)
      .map(i => i.linked_sector_id as string);
  }, [instances]);

  // Available sectors (not yet linked)
  const availableSectors = useMemo(() => {
    return WHATSAPP_SECTORS.filter(s => !linkedSectors.includes(s.id));
  }, [linkedSectors]);

  const fetchInstances = async () => {
    setLoadingInstances(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "list_instances" },
      });

      if (error) throw error;
      
      const instancesList = (data?.data?.instances || data?.instances || []) as UazapiInstance[];
      console.log("Loaded instances with linking info:", instancesList);
      setInstances(instancesList);
    } catch (error) {
      console.error("Error fetching instances:", error);
      toast.error("Erro ao buscar instâncias da UAZAPI");
    } finally {
      setLoadingInstances(false);
    }
  };

  const handleOpenLinkDialog = (instance: UazapiInstance) => {
    setSelectedInstance(instance);
    setSelectedSector("");
    setLinkDialogOpen(true);
  };

  const handleLinkInstance = async () => {
    if (!selectedInstance || !selectedSector) {
      toast.error("Selecione um setor");
      return;
    }

    setLoading(true);

    try {
      // First, check if there's an existing integration for this sector
      // If not, we need to create one first
      const existingIntegration = integrations.find(
        i => (i.type as string) === "whatsapp" && i.sector_id === selectedSector
      );

      if (!existingIntegration && accountId) {
        // Create the integration first
        const { error: createError } = await supabase.from("integrations").insert({
          account_id: accountId,
          type: "whatsapp" as any,
          status: "disconnected",
          sector_id: selectedSector,
          config: {
            sector_name: WHATSAPP_SECTORS.find(s => s.id === selectedSector)?.name,
          },
        });

        if (createError) throw createError;
      }

      // Now link the instance
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { 
          action: "link_instance",
          instance_name: selectedInstance.name,
          sector_id: selectedSector,
        },
      });

      if (error) throw error;

      toast.success(`Instância ${selectedInstance.profileName || selectedInstance.name} vinculada com sucesso!`);
      setLinkDialogOpen(false);
      setSelectedInstance(null);
      setSelectedSector("");
      fetchInstances();
      onRefresh();
    } catch (error: any) {
      console.error("Error linking instance:", error);
      toast.error(error.message || "Erro ao vincular instância");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkInstance = async (instance: UazapiInstance) => {
    if (!instance.linked_integration_id) {
      toast.error("Instância não está vinculada");
      return;
    }

    if (!confirm(`Tem certeza que deseja desvincular ${instance.profileName || instance.name}?`)) {
      return;
    }

    setActionInProgress(instance.name);

    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { 
          action: "unlink_instance",
          integration_id: instance.linked_integration_id,
        },
      });

      if (error) throw error;

      toast.success(`Instância ${instance.profileName || instance.name} desvinculada com sucesso!`);
      fetchInstances();
      onRefresh();
    } catch (error: any) {
      console.error("Error unlinking instance:", error);
      toast.error(error.message || "Erro ao desvincular instância");
    } finally {
      setActionInProgress(null);
    }
  };

  const getSectorInfo = (sectorId: string | null) => {
    if (!sectorId) return null;
    return WHATSAPP_SECTORS.find(s => s.id === sectorId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <Wifi className="h-4 w-4 text-green-500" />;
      case "disconnected":
        return <WifiOff className="h-4 w-4 text-destructive" />;
      default:
        return <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
            Conectado
          </Badge>
        );
      case "disconnected":
        return (
          <Badge variant="outline" className="text-destructive border-destructive/20">
            Desconectado
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {status}
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>WhatsApp por Setor</CardTitle>
              <CardDescription>
                Vincule suas instâncias da UAZAPI aos setores do ROY APP
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchInstances}
            disabled={loadingInstances}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingInstances ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Admin-only notice */}
        {!isAdmin && (
          <Alert className="mb-4">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              Apenas administradores podem gerenciar conexões WhatsApp por setor.
            </AlertDescription>
          </Alert>
        )}

        {loadingInstances ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando instâncias...</p>
            </div>
          </div>
        ) : instances.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Smartphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma instância encontrada na UAZAPI</p>
            <p className="text-sm mt-1">Crie uma instância no painel da UAZAPI primeiro</p>
          </div>
        ) : (
          <div className="space-y-3">
            {instances.map((instance) => {
              const sectorInfo = getSectorInfo(instance.linked_sector_id);
              const isLinked = !!instance.linked_sector_id;
              const isActionLoading = actionInProgress === instance.name;

              return (
                <div
                  key={instance.name}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Profile picture or icon */}
                    <div className="relative">
                      {instance.profilePicUrl ? (
                        <img 
                          src={instance.profilePicUrl} 
                          alt={instance.profileName || instance.name}
                          className="h-12 w-12 rounded-full object-cover border-2 border-background"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      {/* Status indicator */}
                      <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-background flex items-center justify-center ${
                        instance.status === 'connected' ? 'bg-green-500' : 'bg-muted'
                      }`}>
                        {instance.status === 'connected' ? (
                          <span className="h-2 w-2 rounded-full bg-white" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Instance info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {instance.profileName || instance.name}
                        </span>
                        {getStatusBadge(instance.status)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {instance.owner && (
                          <span className="text-xs text-muted-foreground">
                            {instance.owner}
                          </span>
                        )}
                        {isLinked && sectorInfo && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <Badge variant="secondary" className={`text-xs ${sectorInfo.color}`}>
                              <Link2 className="h-3 w-3 mr-1" />
                              {sectorInfo.name}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      {isLinked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnlinkInstance(instance)}
                          disabled={isActionLoading}
                          className="text-destructive hover:text-destructive"
                        >
                          {isActionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Link2Off className="h-4 w-4 mr-2" />
                              Desvincular
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenLinkDialog(instance)}
                          disabled={availableSectors.length === 0}
                        >
                          <Link2 className="h-4 w-4 mr-2" />
                          Vincular a setor
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Info text */}
        <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-muted">
          <p className="text-xs text-muted-foreground">
            💡 As instâncias são gerenciadas no painel da UAZAPI. 
            Aqui você apenas vincula cada instância ao setor correspondente no ROY APP.
          </p>
        </div>
      </CardContent>

      {/* Dialog for linking instance to sector */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Instância a Setor</DialogTitle>
            <DialogDescription>
              Escolha qual setor do ROY APP receberá as mensagens desta instância
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {selectedInstance && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                {selectedInstance.profilePicUrl ? (
                  <img 
                    src={selectedInstance.profilePicUrl} 
                    alt={selectedInstance.profileName || selectedInstance.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{selectedInstance.profileName || selectedInstance.name}</p>
                  {selectedInstance.owner && (
                    <p className="text-xs text-muted-foreground">{selectedInstance.owner}</p>
                  )}
                </div>
                {getStatusBadge(selectedInstance.status)}
              </div>
            )}

            <div className="space-y-2">
              <Label>Setor</Label>
              {availableSectors.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Todos os setores já estão vinculados a outras instâncias.
                </p>
              ) : (
                <Select
                  value={selectedSector}
                  onValueChange={(value) => setSelectedSector(value as SectorId)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSectors.map((sector) => (
                      <SelectItem key={sector.id} value={sector.id}>
                        <div className="flex flex-col">
                          <span className={sector.color}>{sector.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {sector.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleLinkInstance} 
                disabled={loading || !selectedSector || availableSectors.length === 0}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Vincular Instância
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
