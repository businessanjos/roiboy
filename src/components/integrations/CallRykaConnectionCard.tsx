import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface RykaStatus {
  connected: boolean;
  token_configured: boolean;
  webhook_secret_configured: boolean;
  external_source: string;
  organization: string | null;
  webhook_url: string;
  is_admin: boolean;
}

/** Configuração do Call Ryka. O token fica apenas no servidor. */
export function CallRykaConnectionCard({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<RykaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase.functions.invoke("ryka-call-auth", { body: { action: "status" } });
    if (data?.success) setStatus(data as RykaStatus);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const call = async (action: string, body: Record<string, unknown>, successMessage: string) => {
    setSaving(action);
    const { data, error } = await supabase.functions.invoke("ryka-call-auth", { body: { action, ...body } });
    setSaving(null);
    if (error || !data?.success) {
      toast.error(data?.error || "Não foi possível salvar.");
      return;
    }
    toast.success(successMessage);
    setToken("");
    await refresh();
    onChanged?.();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isAdmin = status?.is_admin ?? false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <MessageCircle className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Call Ryka
                {status?.connected ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">Conectado</Badge>
                ) : (
                  <Badge variant="outline">Não configurado</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Motor de ligação via WhatsApp. {status?.organization ? `Organização: ${status.organization}` : ""}
              </CardDescription>
            </div>
          </div>
          {status?.connected && isAdmin && (
            <Button
              variant="outline"
              size="sm"
              disabled={saving === "disconnect"}
              onClick={() => call("disconnect", {}, "Call Ryka desconectado.")}
            >
              Desconectar
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 text-xs">
            Token da organização
            <span className={status?.token_configured ? "text-emerald-600" : "text-muted-foreground"}>
              {status?.token_configured ? "Configurado ✓" : "Não configurado"}
            </span>
          </Label>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="rk_live_..."
              value={token}
              onChange={(event) => setToken(event.target.value)}
              disabled={!isAdmin}
            />
            <Button
              size="sm"
              disabled={!isAdmin || !token.trim() || saving === "set_token"}
              onClick={() => call("set_token", { api_token: token.trim(), external_source: "roy" }, "Call Ryka conectado.")}
            >
              {saving === "set_token" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Gere o token na sua conta do Call Ryka com os escopos de discagem e leitura de ligações. Origem enviada nas
            ligações: <code>{status?.external_source || "roy"}</code>.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Webhook</Label>
          <div className="flex gap-2">
            <Input readOnly value={status?.webhook_url || ""} className="font-mono text-xs" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(status?.webhook_url || "");
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder={status?.webhook_secret_configured ? "Configurado ✓ — trocar segredo" : "Segredo do webhook"}
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              disabled={!isAdmin || !status?.token_configured}
            />
            <Button
              size="sm"
              disabled={!isAdmin || !secret.trim() || saving === "set_webhook_secret"}
              onClick={() => {
                void call("set_webhook_secret", { webhook_secret: secret.trim() }, "Segredo do webhook salvo.").then(() =>
                  setSecret(""),
                );
              }}
            >
              {saving === "set_webhook_secret" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Cole essa URL e o segredo nos webhooks do Call Ryka. Lembre de autorizar o domínio iamroy.app para o discador
            embutido e cadastrar cada pessoa do ROY como operador com o mesmo e-mail.
          </p>
        </div>

        {!isAdmin && <p className="text-xs text-muted-foreground">Somente administradores podem alterar esta integração.</p>}
      </CardContent>
    </Card>
  );
}
