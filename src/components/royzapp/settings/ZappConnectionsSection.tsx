import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Wifi,
  WifiOff,
  Loader2,
  Smartphone,
  Globe,
  Lock,
  Trash2,
  QrCode,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { ZappConnectionWizard } from "./ZappConnectionWizard";
import { ConnectQRCodeDialog } from "@/components/integrations/whatsapp/ConnectQRCodeDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SectorConnection {
  id: string;
  sector_id: string | null;
  status: string;
  display_name: string | null;
  has_pin: boolean;
  instance_name: string;
  phone_number: string;
  profile_name: string;
  provider?: "uazapi" | "meta_official";
  webhook_configured?: boolean;
}

interface ZappConnectionsSectionProps {
  sectorId: string | null;
  sectorName: string;
}

export function ZappConnectionsSection({ sectorId, sectorName }: ZappConnectionsSectionProps) {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState<SectorConnection[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [qrInstance, setQrInstance] = useState<SectorConnection | null>(null);
  const [removing, setRemoving] = useState<SectorConnection | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fixingWebhookId, setFixingWebhookId] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!sectorId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "list_sector_instances" },
      });
      if (error) throw error;
      const all = (data?.data?.instances || data?.instances || []) as SectorConnection[];
      setConnections(all.filter((i) => i.sector_id === sectorId));
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar conexões");
    } finally {
      setLoading(false);
    }
  }, [sectorId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleRemove = async () => {
    if (!removing) return;
    setBusyId(removing.id);
    try {
      const { error } = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "unlink_instance", integration_id: removing.id },
      });
      if (error) throw error;
      toast.success("Conexão removida");
      setRemoving(null);
      fetchConnections();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao remover conexão");
    } finally {
      setBusyId(null);
    }
  };

  const handleFixWebhook = async (connection: SectorConnection) => {
    setFixingWebhookId(connection.id);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "configure_webhook", integration_id: connection.id },
      });
      if (error) throw error;

      if (data?.success || data?.webhook_configured || data?.data?.success || data?.data?.webhook_configured) {
        toast.success("Recebimento reativado para esta instância");
        fetchConnections();
        return;
      }

      toast.error("Não foi possível corrigir o webhook automaticamente");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao corrigir recebimento de mensagens");
    } finally {
      setFixingWebhookId(null);
    }
  };

  if (!sectorId) {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-zapp-text text-sm font-medium">Conexões WhatsApp</p>
          <p className="text-zapp-text-muted text-xs">
            Selecione um setor para gerenciar conexões.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zapp-text text-sm font-medium">Conexões WhatsApp</p>
          <p className="text-zapp-text-muted text-xs">
            Números do setor <strong>{sectorName}</strong>
          </p>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            onClick={() => setShowWizard(true)}
            className="bg-zapp-accent hover:bg-zapp-accent-hover text-white h-8"
          >
            <Plus className="h-4 w-4 mr-1" /> Nova
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-zapp-text-muted" />
        </div>
      ) : connections.length === 0 ? (
        <div className="p-4 rounded-lg bg-zapp-panel border border-dashed border-zapp-border text-center">
          <p className="text-xs text-zapp-text-muted mb-2">
            Nenhuma conexão neste setor
          </p>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowWizard(true)}
              className="border-zapp-accent text-zapp-accent hover:bg-zapp-accent/10 h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" /> Adicionar conexão
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((c) => {
            const s = getInstanceStatus({
              status: c.status,
              webhook_configured: c.webhook_configured ?? null,
              provider: c.provider ?? null,
            });
            const { connected, operational, webhookBroken, isMeta, label: statusLabel } = s;
            return (
              <div
                key={c.id}
                className={cn(
                  "p-3 rounded-lg border bg-zapp-panel",
                  operational
                    ? "border-emerald-500/30"
                    : webhookBroken
                      ? "border-amber-500/40"
                      : "border-zapp-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      isMeta ? "bg-blue-500/15" : "bg-emerald-500/15"
                    )}
                  >
                    {isMeta ? (
                      <Globe className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Smartphone className="h-4 w-4 text-emerald-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-zapp-text truncate">
                        {c.display_name || c.profile_name || c.instance_name}
                      </p>
                      {c.has_pin && (
                        <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4",
                          operational
                            ? "border-emerald-500/40 text-emerald-500"
                            : webhookBroken
                              ? "border-amber-500/50 text-amber-500"
                            : "border-red-500/40 text-red-500"
                        )}
                      >
                        {operational ? (
                          <><Wifi className="h-2.5 w-2.5 mr-0.5" />{statusLabel}</>
                        ) : webhookBroken ? (
                          <><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{statusLabel}</>
                        ) : (
                          <><WifiOff className="h-2.5 w-2.5 mr-0.5" />{statusLabel}</>
                        )}
                      </Badge>
                      <span className="text-[10px] text-zapp-text-muted">
                        {isMeta ? "Meta API" : "UAZAPI"}
                      </span>
                      {c.phone_number && (
                        <span className="text-[10px] text-zapp-text-muted truncate">
                          {c.phone_number}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRemoving(c)}
                        disabled={busyId === c.id}
                        className="h-7 px-2 text-red-500 hover:bg-red-500/10"
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {webhookBroken && (
                  <div className="mt-3 rounded-md border border-amber-500/35 bg-amber-500/10 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-zapp-text">
                          Instância ligada, mas mensagens recebidas não chegam no RoyZapp
                        </p>
                        <p className="text-[11px] text-zapp-text-muted mt-0.5">
                          O webhook desta conexão está ausente. Corrija aqui, neste mesmo painel.
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <Button
                        size="sm"
                        onClick={() => handleFixWebhook(c)}
                        disabled={fixingWebhookId === c.id}
                        className="w-full mt-3 bg-amber-500 hover:bg-amber-600 text-white gap-2"
                      >
                        {fixingWebhookId === c.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        Corrigir recebimento
                      </Button>
                    )}
                  </div>
                )}

                {!isMeta && !connected && (
                  <Button
                    size="sm"
                    onClick={() => setQrInstance(c)}
                    className="w-full mt-3 bg-zapp-accent hover:bg-zapp-accent-hover text-white gap-2"
                  >
                    <QrCode className="h-4 w-4" />
                    Reconectar via QR Code
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && (
        <button
          type="button"
          onClick={() => navigate(`/roy-zapp?view=whatsapp-admin${sectorId ? `&sector=${sectorId}` : ""}`)}
          className="w-full flex items-center justify-center gap-1 text-[11px] text-zapp-text-muted hover:text-zapp-accent transition-colors py-1"
        >
          Abrir painel técnico de conexões <RefreshCw className="h-3 w-3" />
        </button>
      )}

      <ZappConnectionWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        sectorId={sectorId}
        sectorName={sectorName}
        existingInstanceNames={connections.map((c) => c.instance_name).filter(Boolean)}
        onSuccess={fetchConnections}
      />

      {qrInstance && (
        <ConnectQRCodeDialog
          open={!!qrInstance}
          onOpenChange={(o) => !o && setQrInstance(null)}
          integrationId={qrInstance.id}
          instanceName={qrInstance.instance_name}
          sectorId={sectorId || undefined}
          onConnected={() => {
            setQrInstance(null);
            fetchConnections();
          }}
        />
      )}

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conexão?</AlertDialogTitle>
            <AlertDialogDescription>
              A conexão "{removing?.display_name || removing?.instance_name}" será desvinculada
              do setor. Mensagens recebidas por ela deixarão de aparecer aqui.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
