import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { OmieFieldMapper } from "./OmieFieldMapper";
import { OmieLogsTable } from "./OmieLogsTable";
import { Loader2, CheckCircle2, XCircle, Settings, Zap } from "lucide-react";

interface FieldMapping {
  source: string;
  customFieldId?: string;
}

export function OmieIntegrationTab() {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [defaultServiceCode, setDefaultServiceCode] = useState("");
  const [fieldMappings, setFieldMappings] = useState<Record<string, FieldMapping>>({
    cliente: { source: "client.cpf_cnpj" },
    vendedor: { source: "deal.responsible" },
    descricao: { source: "deal.description" },
    valor: { source: "deal.value" },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.account_id) return;
    loadSettings();
  }, [currentUser?.account_id]);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("omie_settings")
      .select("*")
      .eq("account_id", currentUser!.account_id)
      .maybeSingle();
    
    if (data) {
      setSettingsId(data.id);
      setAppKey(data.app_key || "");
      setAppSecret(data.app_secret || "");
      setIsEnabled(data.is_enabled || false);
      setDefaultServiceCode(data.default_service_code || "");
      if (data.field_mappings && typeof data.field_mappings === "object" && !Array.isArray(data.field_mappings)) {
        setFieldMappings(data.field_mappings as unknown as Record<string, FieldMapping>);
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!currentUser?.account_id) return;
    setSaving(true);

    const payload = {
      account_id: currentUser.account_id,
      app_key: appKey,
      app_secret: appSecret,
      is_enabled: isEnabled,
      default_service_code: defaultServiceCode,
      field_mappings: fieldMappings as unknown as Record<string, any>,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (settingsId) {
      ({ error } = await supabase
        .from("omie_settings")
        .update(payload)
        .eq("id", settingsId));
    } else {
      const { data, error: insertErr } = await supabase
        .from("omie_settings")
        .insert(payload)
        .select("id")
        .single();
      error = insertErr;
      if (data) setSettingsId(data.id);
    }

    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: "Falha ao salvar configurações.", variant: "destructive" });
    } else {
      toast({ title: "Salvo!", description: "Configurações Omie salvas com sucesso." });
    }
  };

  const handleTestConnection = async () => {
    if (!appKey || !appSecret) {
      toast({ title: "Preencha as credenciais", description: "Insira APP_KEY e APP_SECRET para testar.", variant: "destructive" });
      return;
    }
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("https://app.omie.com.br/api/v1/geral/clientes/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call: "ListarClientes",
          app_key: appKey,
          app_secret: appSecret,
          param: [{ pagina: 1, registros_por_pagina: 1 }],
        }),
      });
      const result = await response.json();
      if (result.faultstring) {
        setTestResult("error");
        toast({ title: "Falha na conexão", description: result.faultstring, variant: "destructive" });
      } else {
        setTestResult("success");
        toast({ title: "Conexão OK!", description: "Credenciais válidas." });
      }
    } catch (err: any) {
      setTestResult("error");
      toast({ title: "Erro de rede", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Credentials Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuração Omie
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Insira suas credenciais de API do Omie para ativar a integração.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>APP_KEY</Label>
              <Input
                type="password"
                value={appKey}
                onChange={(e) => setAppKey(e.target.value)}
                placeholder="Sua APP_KEY do Omie"
              />
            </div>
            <div className="space-y-2">
              <Label>APP_SECRET</Label>
              <Input
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder="Sua APP_SECRET do Omie"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Código do Serviço Padrão (Município)</Label>
            <Input
              value={defaultServiceCode}
              onChange={(e) => setDefaultServiceCode(e.target.value)}
              placeholder="Ex: 14.01"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">Código do serviço municipal usado na OS.</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : testResult === "success" ? (
                <CheckCircle2 className="h-4 w-4 mr-2 text-primary" />
              ) : testResult === "error" ? (
                <XCircle className="h-4 w-4 mr-2 text-destructive" />
              ) : null}
              Testar Conexão
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Ativar Automação
              </Label>
              <p className="text-xs text-muted-foreground">
                Criar OS automaticamente ao marcar negócio como "Ganho".
              </p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Field Mapper */}
      <OmieFieldMapper fieldMappings={fieldMappings} onChange={setFieldMappings} />

      {/* Logs */}
      <OmieLogsTable />
    </div>
  );
}
