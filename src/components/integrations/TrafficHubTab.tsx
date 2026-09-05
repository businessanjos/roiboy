import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Eye, EyeOff, Loader2, RefreshCw, Send, Save } from "lucide-react";

type Stats = { pending: number; sent: number; failed: number };

export function TrafficHubTab() {
  const { toast } = useToast();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const [endpointUrl, setEndpointUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [stats, setStats] = useState<Stats>({ pending: 0, sent: 0, failed: 0 });

  const loadAll = async () => {
    if (!accountId) return;
    setLoading(true);
    const sb = supabase as any;
    const { data } = await sb
      .from("traffic_hub_settings")
      .select("endpoint_url, auth_token, is_active")
      .eq("account_id", accountId)
      .maybeSingle();
    if (data) {
      setEndpointUrl(data.endpoint_url ?? "");
      setAuthToken(data.auth_token ?? "");
      setIsActive(data.is_active ?? true);
    }
    const { data: rows } = await sb
      .from("traffic_hub_deliveries")
      .select("status")
      .eq("account_id", accountId);
    const next: Stats = { pending: 0, sent: 0, failed: 0 };
    for (const r of rows ?? []) {
      if (r.status === "sent") next.sent++;
      else if (r.status === "failed") next.failed++;
      else next.pending++;
    }
    setStats(next);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const handleSave = async () => {
    if (!accountId) return;
    setSaving(true);
    const sb = supabase as any;
    const { error } = await sb.from("traffic_hub_settings").upsert(
      {
        account_id: accountId,
        endpoint_url: endpointUrl.trim() || null,
        auth_token: authToken.trim() || null,
        is_active: isActive,
      },
      { onConflict: "account_id" },
    );
    setSaving(false);
    if (error) {
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Configuração salva" });
  };

  const handleTest = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("traffic-hub-dispatch", {
      body: { action: "test" },
    });
    setTesting(false);
    if (error) {
      toast({ title: "Falha no teste", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: (data as any)?.ok ? "Central respondeu com sucesso" : "A Central recusou o envio",
      description: `Resposta: ${(data as any)?.status ?? "-"}`,
      variant: (data as any)?.ok ? undefined : "destructive",
    });
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    const { data, error } = await supabase.functions.invoke("traffic-hub-dispatch", {
      body: { action: "backfill" },
    });
    setBackfilling(false);
    if (error) {
      toast({ title: "Falha no reenvio", description: error.message, variant: "destructive" });
      return;
    }
    const d = data as any;
    toast({
      title: "Reenvio iniciado",
      description: `${d?.queued ?? 0} vendas na fila, ${d?.sent ?? 0} enviadas agora. O restante segue automaticamente.`,
    });
    loadAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Central de Tráfego</CardTitle>
        <CardDescription>
          Toda venda marcada como ganha é enviada na hora para a sua Central, com origem da venda,
          valor e contato. Se o envio falhar, o ROY tenta de novo sozinho.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="th-url">Endereço (endpoint) da Central</Label>
          <Input
            id="th-url"
            placeholder="https://sua-central.lovable.app/api/vendas"
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="th-token">Token da Central</Label>
          <div className="flex gap-2">
            <Input
              id="th-token"
              type={showToken ? "text" : "password"}
              autoComplete="off"
              placeholder="Cole aqui o token gerado na Central"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setShowToken((v) => !v)}>
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Só administradores conseguem ver ou alterar este campo.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Envio automático</p>
            <p className="text-xs text-muted-foreground">Enviar cada venda ganha no momento em que acontece</p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing || !endpointUrl}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Testar conexão
          </Button>
          <Button variant="outline" onClick={handleBackfill} disabled={backfilling || !endpointUrl}>
            {backfilling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Reenviar histórico
          </Button>
          <Button variant="ghost" onClick={loadAll}>
            Atualizar números
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="secondary">Enviadas: {stats.sent}</Badge>
          <Badge variant="outline">Na fila: {stats.pending}</Badge>
          <Badge variant={stats.failed ? "destructive" : "outline"}>Com erro: {stats.failed}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
