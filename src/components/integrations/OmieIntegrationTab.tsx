import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { OmieFieldMapper } from "./OmieFieldMapper";
import { OmieLogsTable } from "./OmieLogsTable";
import { Loader2, CheckCircle2, XCircle, Settings, Zap, RefreshCw } from "lucide-react";

interface FieldMapping {
  source: string;
  customFieldId?: string;
}

interface OmieIntegrationTabProps {
  settingsId?: string;
}

export function OmieIntegrationTab({ settingsId: propSettingsId }: OmieIntegrationTabProps = {}) {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [defaultServiceCode, setDefaultServiceCode] = useState("");
  const [defaultServiceLc116Code, setDefaultServiceLc116Code] = useState("");
  const [defaultCategoryCode, setDefaultCategoryCode] = useState("");
  const [defaultBankAccountCode, setDefaultBankAccountCode] = useState("");
  const [defaultTaxType, setDefaultTaxType] = useState("01");
  const [defaultRetemISS, setDefaultRetemISS] = useState("N");
  const [defaultCity, setDefaultCity] = useState("");
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
  const [bankAccounts, setBankAccounts] = useState<{ nCodCC: number; descricao: string }[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  useEffect(() => {
    if (!currentUser?.account_id) return;
    loadSettings();
  }, [currentUser?.account_id, propSettingsId]);

  const loadSettings = async () => {
    setLoading(true);
    let query = supabase.from("omie_settings").select("*");
    if (propSettingsId) {
      query = query.eq("id", propSettingsId);
    } else {
      query = query.eq("account_id", currentUser!.account_id).order("is_default", { ascending: false }).limit(1);
    }
    const { data: rows } = await query;
    const data = rows && rows.length > 0 ? rows[0] : null;
    
    if (data) {
      setSettingsId(data.id);
      setAppKey(data.app_key || "");
      setAppSecret(data.app_secret || "");
      setIsEnabled(data.is_enabled || false);
      setDefaultServiceCode(data.default_service_code || "");
      setDefaultServiceLc116Code(data.default_service_lc116_code || "");
      setDefaultCategoryCode(data.default_category_code || "");
      setDefaultBankAccountCode(data.default_bank_account_code || "");
      setDefaultTaxType(data.default_tax_type || "01");
      setDefaultRetemISS(data.default_retem_iss || "N");
      setDefaultCity(data.default_city || "");
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
      default_service_lc116_code: defaultServiceLc116Code,
      default_category_code: defaultCategoryCode,
      default_bank_account_code: defaultBankAccountCode,
      default_tax_type: defaultTaxType,
      default_retem_iss: defaultRetemISS,
      default_city: defaultCity,
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

  const handleLoadBankAccounts = async () => {
    if (!appKey || !appSecret) {
      toast({ title: "Preencha as credenciais", description: "Insira APP_KEY e APP_SECRET primeiro.", variant: "destructive" });
      return;
    }
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-omie-accounts", {
        body: { app_key: appKey, app_secret: appSecret },
      });
      if (error || !data?.success) {
        toast({ title: "Erro ao buscar contas", description: data?.error || error?.message || "Erro desconhecido", variant: "destructive" });
      } else {
        setBankAccounts(data.accounts || []);
        if (data.accounts?.length === 0) {
          toast({ title: "Nenhuma conta encontrada", description: "Não foram encontradas contas correntes no Omie.", variant: "destructive" });
        } else {
          toast({ title: "Contas carregadas", description: `${data.accounts.length} conta(s) corrente(s) encontrada(s).` });
        }
      }
    } catch (err: any) {
      toast({ title: "Erro de rede", description: err.message, variant: "destructive" });
    } finally {
      setLoadingAccounts(false);
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
      const { data, error } = await supabase.functions.invoke("test-omie-connection", {
        body: { app_key: appKey, app_secret: appSecret },
      });

      if (error) {
        setTestResult("error");
        toast({ title: "Erro de rede", description: error.message, variant: "destructive" });
      } else if (!data?.success) {
        setTestResult("error");
        toast({ title: "Falha na conexão", description: data?.error || "Erro desconhecido", variant: "destructive" });
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
            <Label>Código Municipal do Serviço (cCodServMun)</Label>
            <Input
              value={defaultServiceCode}
              onChange={(e) => setDefaultServiceCode(e.target.value)}
              placeholder="Ex: 8599604"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">Código do serviço municipal usado na OS.</p>
          </div>

          <div className="space-y-2">
            <Label>Código do Serviço LC116 (cCodServLC116)</Label>
            <Input
              value={defaultServiceLc116Code}
              onChange={(e) => setDefaultServiceLc116Code(e.target.value)}
              placeholder="Ex: 14.01"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">Código padronizado nacional do serviço (Lei Complementar 116). Formato: XX.XX</p>
          </div>

          <div className="space-y-2">
            <Label>Código da Categoria</Label>
            <Input
              value={defaultCategoryCode}
              onChange={(e) => setDefaultCategoryCode(e.target.value)}
              placeholder="Ex: 1.01.02"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">Código da categoria financeira usada na OS (obrigatório).</p>
          </div>

          <div className="space-y-2">
            <Label>Conta Corrente (nCodCC)</Label>
            <div className="flex gap-2 max-w-md">
              <Select
                value={defaultBankAccountCode}
                onValueChange={setDefaultBankAccountCode}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={defaultBankAccountCode || "Selecione uma conta corrente"} />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((acc) => (
                    <SelectItem key={acc.nCodCC} value={String(acc.nCodCC)}>
                      {acc.descricao} ({acc.nCodCC})
                    </SelectItem>
                  ))}
                  {bankAccounts.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Clique em "Buscar Contas" para carregar
                    </div>
                  )}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadBankAccounts}
                disabled={loadingAccounts || !appKey || !appSecret}
                className="shrink-0"
              >
                {loadingAccounts ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Buscar Contas
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Conta corrente cadastrada no Omie (Finanças {'>'} Contas Correntes). Obrigatório.</p>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Tributação do Serviço (cTribServ)</Label>
            <Select value={defaultTaxType} onValueChange={setDefaultTaxType}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Selecione o tipo de tributação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="01">01 — Tributação no Município</SelectItem>
                <SelectItem value="02">02 — Tributação Fora do Município</SelectItem>
                <SelectItem value="03">03 — Isenção</SelectItem>
                <SelectItem value="04">04 — Imune</SelectItem>
                <SelectItem value="05">05 — Exigibilidade Suspensa por Decisão Judicial</SelectItem>
                <SelectItem value="06">06 — Exigibilidade Suspensa por Procedimento Administrativo</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Tipo de tributação do serviço usado na OS (obrigatório).</p>
          </div>

          <div className="space-y-2">
            <Label>Retenção de ISS (cRetemISS)</Label>
            <Select value={defaultRetemISS} onValueChange={setDefaultRetemISS}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="N">Não — ISS não retido</SelectItem>
                <SelectItem value="S">Sim — ISS retido pelo tomador</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Define se o ISS será retido pelo tomador do serviço (obrigatório).</p>
          </div>

          <div className="space-y-2">
            <Label>Cidade de Prestação do Serviço (cCidPrestServ)</Label>
            <Input
              value={defaultCity}
              onChange={(e) => setDefaultCity(e.target.value)}
              placeholder="Ex: SAO PAULO (SP)"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">Cidade onde o serviço é prestado, no formato CIDADE (UF). Recomendado.</p>
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
