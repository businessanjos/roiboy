import { useState, useEffect } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, MessageSquare, Trash2, Link2, ShieldAlert } from "lucide-react";
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
  hasToken: boolean;
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedSector, setSelectedSector] = useState<SectorId | "">("");
  const [availableInstances, setAvailableInstances] = useState<UazapiInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [linkingSectorId, setLinkingSectorId] = useState<string>("");
  const [loadingInstances, setLoadingInstances] = useState(false);

  // Filter WhatsApp integrations with sector
  const whatsappIntegrations = integrations.filter(
    (i) => (i.type as string) === "whatsapp"
  );

  // Get sectors that already have a WhatsApp connection
  const connectedSectors = whatsappIntegrations
    .map((i) => i.sector_id)
    .filter(Boolean) as string[];

  // Available sectors (not yet connected)
  const availableSectors = WHATSAPP_SECTORS.filter(
    (s) => !connectedSectors.includes(s.id)
  );

  const fetchAvailableInstances = async () => {
    setLoadingInstances(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "list_instances" },
      });

      if (error) throw error;
      
      // Handle nested response structure: data.data.instances or data.instances
      const instances = (data?.data?.instances || data?.instances || []) as UazapiInstance[];
      console.log("Available instances:", instances);
      setAvailableInstances(instances);
    } catch (error) {
      console.error("Error fetching instances:", error);
      toast.error("Erro ao buscar instâncias disponíveis");
    } finally {
      setLoadingInstances(false);
    }
  };

  const handleOpenLinkDialog = (sectorId: string) => {
    setLinkingSectorId(sectorId);
    setSelectedInstance("");
    setLinkDialogOpen(true);
    fetchAvailableInstances();
  };

  const handleLinkInstance = async () => {
    if (!selectedInstance || !linkingSectorId) {
      toast.error("Selecione uma instância");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { 
          action: "link_instance",
          instance_name: selectedInstance,
          sector_id: linkingSectorId,
        },
      });

      if (error) throw error;

      toast.success(`Instância ${selectedInstance} vinculada com sucesso!`);
      setLinkDialogOpen(false);
      setSelectedInstance("");
      setLinkingSectorId("");
      onRefresh();
    } catch (error: any) {
      console.error("Error linking instance:", error);
      toast.error(error.message || "Erro ao vincular instância");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConnection = async () => {
    if (!selectedSector || !accountId) {
      toast.error("Selecione um setor");
      return;
    }

    setLoading(true);

    try {
      // Create a new WhatsApp integration for this sector
      const { error } = await supabase.from("integrations").insert({
        account_id: accountId,
        type: "whatsapp" as any,
        status: "disconnected",
        sector_id: selectedSector,
        config: {
          sector_name: WHATSAPP_SECTORS.find((s) => s.id === selectedSector)?.name,
        },
      });

      if (error) throw error;

      toast.success(`Conexão WhatsApp para ${WHATSAPP_SECTORS.find((s) => s.id === selectedSector)?.name} criada!`);
      setDialogOpen(false);
      setSelectedSector("");
      onRefresh();
    } catch (error: any) {
      console.error("Error creating WhatsApp connection:", error);
      toast.error(error.message || "Erro ao criar conexão");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConnection = async (integrationId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta conexão?")) return;

    try {
      const { error } = await supabase
        .from("integrations")
        .delete()
        .eq("id", integrationId);

      if (error) throw error;

      toast.success("Conexão excluída");
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir conexão");
    }
  };

  const getConnectionStatus = (integration: Integration) => {
    const config = integration.config as Record<string, unknown> | null;
    const connectionState = config?.connection_state as string | undefined;
    const isConnected = integration.status === "connected" || connectionState === "open";
    return isConnected;
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
                Configure um número de WhatsApp diferente para cada setor
              </CardDescription>
            </div>
          </div>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={availableSectors.length === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Conexão
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Conexão WhatsApp</DialogTitle>
                <DialogDescription>
                  Escolha qual setor terá esta conexão de WhatsApp
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Setor</Label>
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
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateConnection} disabled={loading || !selectedSector}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Criar Conexão
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          )}
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
        {whatsappIntegrations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma conexão WhatsApp configurada</p>
            <p className="text-sm">Clique em "Nova Conexão" para adicionar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {whatsappIntegrations.map((integration) => {
              const sectorInfo = WHATSAPP_SECTORS.find(
                (s) => s.id === integration.sector_id
              );
              const isConnected = getConnectionStatus(integration);
              const config = integration.config as Record<string, unknown> | null;
              const phoneNumber = config?.owner as string | undefined;
              const instanceName = config?.instance_name as string | undefined;
              const profileName = config?.profileName as string | undefined;

              return (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isConnected ? "bg-green-500/10" : "bg-muted"
                      }`}
                    >
                      <MessageSquare
                        className={`h-5 w-5 ${
                          isConnected ? "text-green-500" : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${sectorInfo?.color || ""}`}>
                          {sectorInfo?.name || "Setor não definido"}
                        </span>
                        <Badge
                          variant={isConnected ? "default" : "outline"}
                          className="text-xs"
                        >
                          {isConnected ? "Conectado" : "Desconectado"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {profileName || instanceName || phoneNumber || sectorInfo?.description || "Configure a conexão"}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      {!isConnected && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenLinkDialog(integration.sector_id || "")}
                        >
                          <Link2 className="h-4 w-4 mr-2" />
                          Vincular
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteConnection(integration.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {availableSectors.length > 0 && whatsappIntegrations.length > 0 && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            {availableSectors.length} setor(es) disponível(eis) para nova conexão
          </p>
        )}
      </CardContent>

      {/* Dialog for linking existing instance */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Instância Existente</DialogTitle>
            <DialogDescription>
              Escolha uma instância da UAZAPI para vincular a este setor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {loadingInstances ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableInstances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma instância disponível na UAZAPI</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Instância</Label>
                <Select
                  value={selectedInstance}
                  onValueChange={setSelectedInstance}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableInstances.map((instance) => (
                      <SelectItem key={instance.name} value={instance.name}>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span>{instance.profileName || instance.name}</span>
                            <Badge 
                              variant={instance.status === "connected" ? "default" : "outline"}
                              className="text-xs"
                            >
                              {instance.status}
                            </Badge>
                          </div>
                          {instance.owner && (
                            <span className="text-xs text-muted-foreground">
                              {instance.owner}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleLinkInstance} 
                disabled={loading || !selectedInstance || loadingInstances}
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
