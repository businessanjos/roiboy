import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Phone, QrCode, CheckCircle2, XCircle, RefreshCw, Unplug } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface SupportWhatsAppSettings {
  instance_name: string | null;
  phone: string | null;
  status: "disconnected" | "connecting" | "connected";
  qr_code: string | null;
}

export function SupportWhatsAppConfig() {
  const queryClient = useQueryClient();
  const [instanceName, setInstanceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["support-whatsapp-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "support_whatsapp")
        .single();

      if (error) throw error;
      return data.value as unknown as SupportWhatsAppSettings;
    },
  });

  // Create/connect instance
  const createInstanceMutation = useMutation({
    mutationFn: async (name: string) => {
      const UAZAPI_URL = import.meta.env.VITE_UAZAPI_URL || "";
      
      // Call edge function to create instance
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: {
          action: "create_support_instance",
          instance_name: name,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["support-whatsapp-settings"] });
      toast.success("Instância criada! Escaneie o QR Code para conectar.");
      setInstanceName("");
    },
    onError: (error) => {
      console.error("Error creating instance:", error);
      toast.error("Erro ao criar instância");
    },
  });

  // Refresh QR Code
  const refreshQRMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: {
          action: "refresh_support_qr",
          instance_name: settings?.instance_name,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-whatsapp-settings"] });
      toast.success("QR Code atualizado");
    },
    onError: (error) => {
      console.error("Error refreshing QR:", error);
      toast.error("Erro ao atualizar QR Code");
    },
  });

  // Disconnect instance
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: {
          action: "disconnect_support",
          instance_name: settings?.instance_name,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-whatsapp-settings"] });
      toast.success("WhatsApp desconectado");
    },
    onError: (error) => {
      console.error("Error disconnecting:", error);
      toast.error("Erro ao desconectar");
    },
  });

  // Check connection status
  const checkStatusMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: {
          action: "check_support_status",
          instance_name: settings?.instance_name,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-whatsapp-settings"] });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = settings?.status === "connected";
  const isConnecting = settings?.status === "connecting";
  const hasInstance = !!settings?.instance_name;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Phone className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-lg">WhatsApp de Suporte</CardTitle>
              <CardDescription>
                Número dedicado para atendimento automático de suporte
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={isConnected ? "default" : isConnecting ? "secondary" : "outline"}
            className={isConnected ? "bg-green-500" : ""}
          >
            {isConnected ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Conectado
              </>
            ) : isConnecting ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Conectando
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Desconectado
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasInstance ? (
          // Create new instance
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instance-name">Nome da Instância</Label>
              <Input
                id="instance-name"
                placeholder="suporte-roy"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Um identificador único para esta conexão WhatsApp
              </p>
            </div>
            <Button
              onClick={() => createInstanceMutation.mutate(instanceName)}
              disabled={!instanceName.trim() || createInstanceMutation.isPending}
            >
              {createInstanceMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Criar Instância
                </>
              )}
            </Button>
          </div>
        ) : isConnected ? (
          // Connected state
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">
                  WhatsApp Conectado
                </p>
                <p className="text-sm text-muted-foreground">
                  Número: {settings.phone || "N/A"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Instância: {settings.instance_name}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => checkStatusMutation.mutate()}
                disabled={checkStatusMutation.isPending}
              >
                {checkStatusMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Verificar Status
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Unplug className="h-4 w-4 mr-2" />
                    Desconectar
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // Show QR Code for connecting
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-4">
              {settings?.qr_code ? (
                <div className="p-4 bg-white rounded-lg">
                  <QRCodeSVG value={settings.qr_code} size={200} />
                </div>
              ) : (
                <div className="flex items-center justify-center w-[232px] h-[232px] bg-muted rounded-lg">
                  <QrCode className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <p className="text-sm text-center text-muted-foreground">
                Escaneie o QR Code com o WhatsApp para conectar
              </p>
              <p className="text-xs text-center text-muted-foreground">
                Instância: {settings?.instance_name}
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => refreshQRMutation.mutate()}
                disabled={refreshQRMutation.isPending}
              >
                {refreshQRMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar QR Code
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => checkStatusMutation.mutate()}
                disabled={checkStatusMutation.isPending}
              >
                {checkStatusMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Verificar Conexão"
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
