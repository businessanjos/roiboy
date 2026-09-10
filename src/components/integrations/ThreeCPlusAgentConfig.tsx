import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Loader2, Save, User, Phone, Eye, EyeOff, KeyRound } from "lucide-react";

export function ThreeCPlusAgentConfig() {
  const { currentUser } = useCurrentUser();
  const [extension, setExtension] = useState("");
  const [password, setPassword] = useState("");
  const [agentToken, setAgentToken] = useState("");
  const [agentId, setAgentId] = useState("");
  const [needsAgentId, setNeedsAgentId] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAgentToken, setShowAgentToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serviceTokenConfigured, setServiceTokenConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.id) loadConfig();
  }, [currentUser?.id]);

  const loadConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_integrations")
      .select("id, access_token, metadata")
      .eq("user_id", currentUser!.id)
      .eq("provider", "3cplus")
      .maybeSingle();

    if (data) {
      const meta = data.metadata as Record<string, unknown> | null;
      setExtension((meta?.extension as string) || "");
      setPassword((meta?.extension_password as string) || "");
      setAgentId(meta?.agent_id ? String(meta.agent_id) : "");
      setAgentToken(data.access_token && data.access_token !== "account_level" ? data.access_token : "");
    }

    const { data: status } = await supabase.functions.invoke("threecplus-register-agent", {
      body: { action: "status" },
    });
    setServiceTokenConfigured(Boolean(status?.service_token_configured));

    setLoading(false);
  };

  const handleSave = async () => {
    if (!currentUser?.id) return;

    const trimmedExt = extension.trim();
    const trimmedPass = password.trim();
    const trimmedAgentToken = agentToken.trim();
    const trimmedAgentId = agentId.trim();

    if (!trimmedExt) {
      toast.error("Informe o número do ramal.");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-register-agent", {
        body: {
          action: "save_extension",
          api_token: trimmedAgentToken || null,
          extension: trimmedExt,
          extension_password: trimmedPass || null,
          agent_id: trimmedAgentId || null,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        setNeedsAgentId(Boolean(data?.needs_agent_id) || needsAgentId);
        toast.error("Não foi possível validar seu token na 3C Plus", {
          description: data?.error || "Confira o token e tente novamente.",
        });
        return;
      }

      if (data.agent_id) setAgentId(String(data.agent_id));
      setNeedsAgentId(false);

      toast.success("Ramal salvo com sucesso!", {
        description: `Ramal ${trimmedExt} vinculado ao agente ${data.agent_id} na 3C Plus.`,
      });
    } catch (err: any) {
      console.error("[ThreeCPlusAgentConfig] Save error:", err);
      toast.error("Erro ao salvar ramal", {
        description: err.message || "Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Meu Ramal — Click-to-Call</CardTitle>
            <CardDescription>
              Informe ramal e senha para discar. O ROY encontra seu agente na 3C automaticamente.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="agent-extension">
              <Phone className="mr-1.5 inline h-3.5 w-3.5" />
              Número do Ramal
            </Label>
            <Input
              id="agent-extension"
              placeholder="Ex: 1001"
              value={extension}
              onChange={(e) => setExtension(e.target.value)}
              maxLength={20}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-password">Senha do Ramal</Label>
            <div className="relative">
              <Input
                id="agent-password"
                type={showPassword ? "text" : "password"}
                placeholder="Senha do seu ramal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={50}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="agent-token">
            <KeyRound className="mr-1.5 inline h-3.5 w-3.5" />
            Token de API do Agente {serviceTokenConfigured ? "(opcional)" : ""}
          </Label>
          <div className="relative">
            <Input
              id="agent-token"
              type={showAgentToken ? "text" : "password"}
              placeholder="Cole aqui o token individual do agente"
              value={agentToken}
              onChange={(e) => setAgentToken(e.target.value)}
              maxLength={255}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowAgentToken(!showAgentToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showAgentToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {serviceTokenConfigured
              ? "Opcional. A conta já usa o token de serviço; deixe em branco."
              : "Enquanto a conta não tiver token de serviço, informe seu token individual (descontinuado em 01/10/2026)."}
          </p>
        </div>

        {(needsAgentId || agentId) && (
          <div className="space-y-2">
            <Label htmlFor="agent-id">ID do agente na 3C {needsAgentId ? "(obrigatório)" : "(opcional)"}</Label>
            <Input
              id="agent-id"
              placeholder="Ex: 56400"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value.replace(/\D/g, ""))}
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">
              Normalmente o ROY descobre esse número sozinho. Se a 3C pedir, pegue em Configurações &gt; Usuários no
              painel da 3C Plus: é o número que aparece no endereço ao abrir o seu usuário.
            </p>
          </div>
        )}



        <div className="flex items-center justify-between gap-4">
          <p className="max-w-md text-xs text-muted-foreground">
            Esses dados são usados pelo botão flutuante e pelos botões de ligação para discar com o seu usuário da 3C Plus.
          </p>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Salvar Ramal
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}