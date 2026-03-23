import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Phone,
  Lock,
  Pencil,
  Trash2,
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
  RefreshCw,
  QrCode,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConnectQRCodeDialog } from "./ConnectQRCodeDialog";

export interface SectorInstance {
  id: string;
  sector_id: string | null;
  status: string;
  display_name: string | null;
  has_pin: boolean;
  instance_name: string;
  phone_number: string;
  profile_name: string;
  profile_pic_url: string;
  created_at: string;
  webhook_configured?: boolean;
}

interface SectorInstanceCardProps {
  instance: SectorInstance;
  isAdmin: boolean;
  onEdit: (instance: SectorInstance) => void;
  onRemove: (instance: SectorInstance) => Promise<void>;
  onRefresh?: () => void;
}

export function SectorInstanceCard({
  instance,
  isAdmin,
  onEdit,
  onRemove,
  onRefresh,
}: SectorInstanceCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [isReconfiguringWebhook, setIsReconfiguringWebhook] = useState(false);

  const isConnected = instance.status === "connected";
  const displayName = instance.display_name || instance.profile_name || instance.instance_name;
  const phoneDisplay = instance.phone_number
    ? instance.phone_number.replace(/^(\d{2})(\d{2})(\d{5})(\d{4})$/, "+$1 ($2) $3-$4")
    : "";
  
  // Show webhook warning only for connected instances without webhook
  const showWebhookWarning = isConnected && instance.webhook_configured === false;

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onRemove(instance);
    } finally {
      setIsRemoving(false);
      setShowRemoveDialog(false);
    }
  };

  const handleReconfigureWebhook = async () => {
    setIsReconfiguringWebhook(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: {
          action: "configure_webhook",
          integration_id: instance.id,
        },
      });

      if (error) throw error;

      if (data?.webhook_configured) {
        toast.success("Webhook configurado com sucesso!");
        onRefresh?.();
      } else {
        toast.error("Não foi possível configurar o webhook automaticamente. Configure manualmente no painel UAZAPI.");
      }
    } catch (err) {
      console.error("Failed to configure webhook:", err);
      toast.error("Erro ao configurar webhook");
    } finally {
      setIsReconfiguringWebhook(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        {/* Webhook warning alert */}
        {showWebhookWarning && isAdmin && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-xs">
                Webhook não configurado - mensagens não serão recebidas
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs ml-2"
                onClick={handleReconfigureWebhook}
                disabled={isReconfiguringWebhook}
              >
                {isReconfiguringWebhook ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Reconfigurar
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    isConnected 
                      ? showWebhookWarning 
                        ? "bg-amber-500" 
                        : "bg-green-500" 
                      : "bg-red-500"
                  }`} />
                </TooltipTrigger>
                <TooltipContent>
                  {isConnected 
                    ? showWebhookWarning 
                      ? "Conectado, mas webhook desconfigurado" 
                      : "Conectado e operacional"
                    : "Desconectado"
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Instance info */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{displayName}</span>
                {instance.has_pin && (
                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                )}
                {showWebhookWarning && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Webhook não configurado
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
                  {isConnected ? (
                    <><Wifi className="h-3 w-3 mr-1" /> Conectado</>
                  ) : (
                    <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>
                  )}
                </Badge>
              </div>
              {phoneDisplay && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {phoneDisplay}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          {isAdmin && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(instance)}
                title="Editar nome e PIN"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setShowRemoveDialog(true)}
                disabled={isRemoving}
                title="Remover instância"
              >
                {isRemoving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Remove confirmation dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Instância</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{displayName}</strong> deste setor?
              {phoneDisplay && <> ({phoneDisplay})</>}
              <br /><br />
              A instância continuará disponível na UAZAPI e poderá ser adicionada novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRemoving}
            >
              {isRemoving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Removendo...</>
              ) : (
                "Remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
