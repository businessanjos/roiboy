import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Save, ShieldCheck, Trash2 } from "lucide-react";

interface Props {
  domain?: string | null;
  onChanged?: () => void;
}

export function ThreeCPlusServiceToken({ domain, onChanged }: Props) {
  const [token, setToken] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("threecplus-auth", { body: { action: "status" } });
      setConfigured(Boolean(data?.service_token_configured));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSave = async () => {
    if (!token.trim()) {
      toast.error("Cole o token de serviço da 3C Plus.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-auth", {
        body: { action: "set_service_token", service_token: token.trim(), domain: domain || null },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error("Não foi possível validar o token de serviço", { description: data?.error });
        return;
      }
      setToken("");
      setConfigured(true);
      toast.success("Token de serviço salvo e validado na 3C Plus.");
      onChanged?.();
    } catch (err: any) {
      toast.error("Erro ao salvar token de serviço", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await supabase.functions.invoke("threecplus-auth", { body: { action: "clear_service_token" } });
      setConfigured(false);
      toast.success("Token de serviço removido.");
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Token de serviço (conta)</CardTitle>
              <CardDescription>
                Um único token autentica toda a equipe. Os tokens individuais serão descontinuados em 01/10/2026.
              </CardDescription>
            </div>
          </div>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : configured ? (
            <Badge variant="default">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Token de serviço configurado
            </Badge>
          ) : (
            <Badge variant="secondary">
              <AlertTriangle className="mr-1 h-3 w-3" /> Usando tokens individuais
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="service-token">Token de serviço</Label>
          <Input
            id="service-token"
            type="password"
            className="font-mono text-sm"
            placeholder={configured ? "Token salvo — cole um novo para substituir" : "Cole aqui o token de serviço"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Gere em Config. &gt; Integração &gt; Tokens de serviço, dentro do painel da 3C Plus. O token fica guardado
            com segurança e nunca aparece nesta tela.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving || !token.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar token de serviço
          </Button>
          {configured && (
            <Button size="sm" variant="outline" onClick={handleClear} disabled={saving}>
              <Trash2 className="mr-2 h-4 w-4" /> Remover
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
