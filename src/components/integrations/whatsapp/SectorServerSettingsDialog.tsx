import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Server, Info, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SectorServerSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  sectorName: string;
  onSaved?: () => void;
}

interface ServerConfig {
  host: string | null;
  admin_token_secret_name: string | null;
  secret_configured: boolean;
  using_global_fallback: boolean;
  global_host: string | null;
}

export function SectorServerSettingsDialog({
  open,
  onOpenChange,
  sectorId,
  sectorName,
  onSaved,
}: SectorServerSettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [host, setHost] = useState("");
  const [secretName, setSecretName] = useState("");

  useEffect(() => {
    if (!open) return;
    void fetchConfig();
  }, [open, sectorId]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "get_sector_server", sector_id: sectorId },
      });
      if (error) throw error;
      const cfg = (data?.data || data) as ServerConfig;
      setConfig(cfg);
      setHost(cfg?.host || "");
      setSecretName(cfg?.admin_token_secret_name || "");
    } catch (err) {
      console.error("Failed to load sector server config:", err);
      toast.error("Erro ao carregar configuração do servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: {
          action: "update_sector_server",
          sector_id: sectorId,
          host: host.trim() || null,
          admin_token_secret_name: secretName.trim() || null,
        },
      });
      if (error) throw error;
      // Edge function may pack error inside `data.error`
      const errMsg = (data as any)?.error;
      if (errMsg) throw new Error(errMsg);
      toast.success(`Servidor do setor ${sectorName} salvo`);
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Failed to save sector server:", err);
      toast.error(err?.message || "Erro ao salvar servidor");
    } finally {
      setSaving(false);
    }
  };

  const handleClearOverride = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("uazapi-manager", {
        body: {
          action: "update_sector_server",
          sector_id: sectorId,
          host: null,
          admin_token_secret_name: null,
        },
      });
      if (error) throw error;
      toast.success(`Setor ${sectorName} voltou a usar o servidor global`);
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Failed to clear sector server:", err);
      toast.error(err?.message || "Erro ao remover override");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Servidor RoyZapp — {sectorName}
          </DialogTitle>
          <DialogDescription>
            Configure um servidor UAZAPI específico para este setor. Quando vazio, o setor usa o
            servidor global padrão.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Current status */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {config?.using_global_fallback ? (
                  <>
                    Usando servidor <strong>global</strong>:{" "}
                    <code className="text-xs">{config?.global_host || "(não configurado)"}</code>
                  </>
                ) : (
                  <>
                    Usando servidor <strong>dedicado</strong> deste setor.
                  </>
                )}
              </AlertDescription>
            </Alert>

            {/* Host */}
            <div className="space-y-2">
              <Label htmlFor="host">Host do servidor (URL completa)</Label>
              <Input
                id="host"
                placeholder="https://cs-roy-eternum.uazapi.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Ex: <code>https://cs-roy-eternum.uazapi.com</code> (sem barra no final).
              </p>
            </div>

            {/* Secret name */}
            <div className="space-y-2">
              <Label htmlFor="secret" className="flex items-center gap-2">
                Nome do secret do admin token
                {secretName && config?.admin_token_secret_name === secretName && (
                  <Badge
                    variant={config?.secret_configured ? "default" : "destructive"}
                    className="text-[10px]"
                  >
                    {config?.secret_configured ? "✓ configurado" : "✗ ausente"}
                  </Badge>
                )}
              </Label>
              <Input
                id="secret"
                placeholder="UAZAPI_OPERACOES_ADMIN_TOKEN"
                value={secretName}
                onChange={(e) => setSecretName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Nome exato do secret (env var) que guarda o admin token desse servidor. O valor
                em si é gerenciado nos secrets do backend.
              </p>
            </div>

            <Alert variant="default">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Se host ou secret estiverem vazios — ou se o secret não existir no backend — o
                sistema retorna automaticamente para o servidor global. Isso garante zero risco
                para os outros setores.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleClearOverride}
            disabled={loading || saving || config?.using_global_fallback}
          >
            Voltar para global
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading || saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
