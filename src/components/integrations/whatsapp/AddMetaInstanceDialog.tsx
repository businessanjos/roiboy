import { useState } from "react";
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
import { Loader2, Globe, CheckCircle2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddMetaInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorId: string;
  sectorName: string;
  onSuccess: () => void;
}

export function AddMetaInstanceDialog({
  open,
  onOpenChange,
  sectorId,
  sectorName,
  onSuccess,
}: AddMetaInstanceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; phone?: string; name?: string } | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-webhook`;

  const handleTestConnection = async () => {
    if (!phoneNumberId.trim()) {
      toast.error("Informe o Phone Number ID");
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      // Create a temporary integration to test
      const { data, error } = await supabase.functions.invoke("meta-manager", {
        body: {
          action: "status",
          test_phone_number_id: phoneNumberId.trim(),
        },
      });

      if (error) throw error;

      if (data?.data?.connected) {
        setTestResult({
          success: true,
          phone: data.data.phone_number,
          name: data.data.verified_name,
        });
        toast.success("Conexão com Meta API verificada!");
      } else {
        setTestResult({ success: false });
        toast.error("Falha ao conectar com Meta API", {
          description: data?.data?.error || "Verifique o token e Phone Number ID",
        });
      }
    } catch (err) {
      console.error("Meta test failed:", err);
      setTestResult({ success: false });
      toast.error("Erro ao testar conexão");
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!phoneNumberId.trim()) {
      toast.error("Informe o Phone Number ID");
      return;
    }

    setLoading(true);
    try {
      // Get current user's account_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", user.id)
        .single();

      if (!userData) throw new Error("User not found");

      // Create the integration record
      const { error: insertError } = await supabase.from("integrations").insert({
        account_id: userData.account_id,
        type: "whatsapp" as const,
        sector_id: sectorId,
        status: "disconnected" as const,
        display_name: displayName || `Meta API - ${sectorName}`,
        config: {
          provider: "meta_official",
          phone_number_id: phoneNumberId.trim(),
          ...(wabaId.trim() ? { waba_id: wabaId.trim() } : {}),
        },
      });

      if (insertError) throw insertError;

      // Test and update status
      const { data: statusData } = await supabase.functions.invoke("meta-manager", {
        body: {
          action: "status",
          sector_id: sectorId,
        },
      });

      toast.success(`Integração Meta API adicionada ao setor ${sectorName}!`);
      onSuccess();
      handleClose();
    } catch (err) {
      console.error("Failed to add Meta instance:", err);
      toast.error("Erro ao adicionar integração Meta API");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPhoneNumberId("");
    setWabaId("");
    setDisplayName("");
    setTestResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            Conectar Meta Cloud API
          </DialogTitle>
          <DialogDescription>
            Configure a API oficial do WhatsApp (Meta) para o setor <strong>{sectorName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Phone Number ID */}
          <div className="space-y-2">
            <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
            <Input
              id="phoneNumberId"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="Ex: 123456789012345"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Encontre em{" "}
              <a
                href="https://developers.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                developers.facebook.com <ExternalLink className="h-3 w-3" />
              </a>
              {" "}→ Seu App → WhatsApp → API Setup
            </p>
          </div>

          {/* WABA ID */}
          <div className="space-y-2">
            <Label htmlFor="wabaId">WhatsApp Business Account ID (opcional, para templates)</Label>
            <Input
              id="wabaId"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="Ex: 987654321098765"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Necessário para listar e enviar templates aprovados. Encontre em Meta Business Settings → Contas do WhatsApp.
            </p>
          </div>

          {/* Display name */}
          <div className="space-y-2">
            <Label htmlFor="metaDisplayName">Nome de exibição (opcional)</Label>
            <Input
              id="metaDisplayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={`Ex: WhatsApp ${sectorName} (Meta)`}
            />
          </div>

          {/* Webhook URL info */}
          <div className="space-y-2">
            <Label>URL do Webhook (para configurar na Meta)</Label>
            <div className="flex items-center gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-xs bg-muted"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast.success("URL copiada!");
                }}
              >
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure esta URL no painel Meta → Webhooks → Callback URL
            </p>
          </div>

          {/* Test connection */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !phoneNumberId.trim()}
              className="flex-1"
            >
              {testing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testando...</>
              ) : (
                "Testar Conexão"
              )}
            </Button>
          </div>

          {/* Test result */}
          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : null}
              <AlertDescription>
                {testResult.success ? (
                  <div className="space-y-1">
                    <p className="font-medium text-green-600">✅ Conexão OK!</p>
                    {testResult.name && <p className="text-sm">Nome: {testResult.name}</p>}
                    {testResult.phone && <p className="text-sm">Número: {testResult.phone}</p>}
                  </div>
                ) : (
                  <p>❌ Falha na conexão. Verifique o Token e Phone Number ID.</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Info */}
          <Alert>
            <AlertDescription className="text-xs">
              💡 O <strong>WhatsApp Token</strong> e o <strong>Verify Token</strong> já foram configurados no backend.
              Você só precisa informar o <strong>Phone Number ID</strong> específico deste setor.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !phoneNumberId.trim()}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
            ) : (
              "Adicionar Integração"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
