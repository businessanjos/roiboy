import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Receipt, ExternalLink, CheckCircle2, Building2 } from "lucide-react";
import { FinancialPageHeader } from "@/components/financial/_shared";
import { Link } from "react-router-dom";

type EmissionMode = "manual" | "on_payment" | "on_won";

function formatCnpj(d?: string | null) {
  if (!d) return "";
  const c = d.replace(/\D/g, "");
  if (c.length !== 14) return d;
  return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12,14)}`;
}

export default function FinancialFiscalSettingsPage() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const qc = useQueryClient();

  const { data: account } = useQuery({
    queryKey: ["account-fiscal-base", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("accounts")
        .select("id, name, document, document_type, city, state")
        .eq("id", accountId!)
        .maybeSingle();
      return data;
    },
    enabled: !!accountId,
  });

  // Garante a contratada padrão automaticamente a partir dos dados da conta
  const { data: contratada, refetch: refetchContratada } = useQuery({
    queryKey: ["default-contratada", accountId],
    queryFn: async () => {
      const { data: ensured, error: rpcErr } = await supabase.rpc(
        "ensure_default_contratada" as any,
        { p_account_id: accountId! }
      );
      if (rpcErr) {
        // não bloqueia — pode ser que falte CNPJ na conta
        console.warn(rpcErr.message);
      }
      const { data } = await supabase
        .from("contratadas" as any)
        .select("*")
        .eq("account_id", accountId!)
        .eq("is_default", true)
        .maybeSingle();
      return data as any;
    },
    enabled: !!accountId,
  });

  const { data: settings } = useQuery({
    queryKey: ["account-settings-fiscal", accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from("account_settings")
        .select("nfse_emission_mode, nfse_auto_email, nfse_default_contratada_id")
        .eq("account_id", accountId!)
        .maybeSingle();
      return data;
    },
    enabled: !!accountId,
  });

  const updateSettings = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await supabase
        .from("account_settings")
        .update(patch)
        .eq("account_id", accountId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-settings-fiscal", accountId] });
      toast.success("Configuração atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateContratada = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!contratada?.id) throw new Error("Emissor não inicializado");
      const { error } = await supabase
        .from("contratadas" as any)
        .update(patch)
        .eq("id", contratada.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchContratada();
      toast.success("Dados fiscais atualizados");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const webhookUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co/nfse-webhook`;

  const accountHasCnpj = account?.document && account.document.replace(/\D/g, "").length === 14;

  return (
    <div className="p-6 space-y-6">
      <FinancialPageHeader
        title="Configuração Fiscal (NFS-e)"
        description="Emissão automática de notas fiscais usando o CNPJ da sua conta"
        icon={Receipt}
      />

      {!accountHasCnpj && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Building2 className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">CNPJ da conta não cadastrado</p>
              <p className="text-sm text-muted-foreground">
                Atualize o CNPJ em <Link to="/settings?tab=profile" className="text-primary underline">Configurações da Conta</Link> para emitir notas fiscais.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="emissor">
        <TabsList>
          <TabsTrigger value="emissor">Empresa Emissora</TabsTrigger>
          <TabsTrigger value="rules">Regras de Emissão</TabsTrigger>
          <TabsTrigger value="provider">Provedor / Webhook</TabsTrigger>
        </TabsList>

        <TabsContent value="emissor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> {account?.name || "Empresa"}
                {contratada && <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Ativa</Badge>}
              </CardTitle>
              <CardDescription>
                Esses dados vêm do cadastro da sua conta. Para alterar CNPJ ou razão social, edite em{" "}
                <Link to="/settings?tab=profile" className="text-primary underline">Configurações da Conta</Link>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/40">
                <div>
                  <Label className="text-xs text-muted-foreground">CNPJ</Label>
                  <div className="font-mono">{formatCnpj(account?.document)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Razão Social</Label>
                  <div>{account?.name}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cidade/UF</Label>
                  <div>{account?.city ? `${account.city} / ${account.state}` : "—"}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Provedor de NFS-e</Label>
                  <div className="capitalize">{contratada?.provider || "notazz"}</div>
                </div>
              </div>

              {contratada && (
                <>
                  <div className="pt-2 border-t">
                    <h4 className="font-medium mb-3 text-sm">Dados fiscais específicos da NF</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Inscrição Municipal</Label>
                        <Input
                          defaultValue={contratada.inscricao_municipal || ""}
                          onBlur={(e) => {
                            const v = e.target.value.trim() || null;
                            if (v !== (contratada.inscricao_municipal || null)) {
                              updateContratada.mutate({ inscricao_municipal: v });
                            }
                          }}
                          placeholder="Obrigatório p/ alguns municípios"
                        />
                      </div>
                      <div>
                        <Label>Regime Tributário</Label>
                        <Select
                          value={contratada.regime_tributario}
                          onValueChange={(v) => updateContratada.mutate({ regime_tributario: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                            <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                            <SelectItem value="lucro_real">Lucro Real</SelectItem>
                            <SelectItem value="mei">MEI</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Item LC 116/03</Label>
                        <Input
                          defaultValue={contratada.item_lista_servico || ""}
                          onBlur={(e) => {
                            const v = e.target.value.trim() || null;
                            if (v !== (contratada.item_lista_servico || null)) {
                              updateContratada.mutate({ item_lista_servico: v });
                            }
                          }}
                          placeholder="8.02"
                        />
                      </div>
                      <div>
                        <Label>Alíquota ISS (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={contratada.aliquota_iss ?? ""}
                          onBlur={(e) => {
                            const v = e.target.value ? parseFloat(e.target.value) : null;
                            if (v !== contratada.aliquota_iss) {
                              updateContratada.mutate({ aliquota_iss: v });
                            }
                          }}
                          placeholder="Ex: 2.00"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Código de Tributação Municipal (opcional)</Label>
                        <Input
                          defaultValue={contratada.codigo_tributacao_municipio || ""}
                          onBlur={(e) => {
                            const v = e.target.value.trim() || null;
                            if (v !== (contratada.codigo_tributacao_municipio || null)) {
                              updateContratada.mutate({ codigo_tributacao_municipio: v });
                            }
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Esses são os únicos campos que precisam ser preenchidos aqui — o restante já vem do cadastro da conta.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quando emitir a NFS-e</CardTitle>
              <CardDescription>Define o gatilho que dispara a emissão automática.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Modo de emissão</Label>
                <Select
                  value={settings?.nfse_emission_mode ?? "manual"}
                  onValueChange={(v) => updateSettings.mutate({ nfse_emission_mode: v as EmissionMode })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual — emito quando clicar no botão</SelectItem>
                    <SelectItem value="on_payment">Ao receber pagamento (regime de caixa)</SelectItem>
                    <SelectItem value="on_won">Ao ganhar deal (regime de competência)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Recomendado para Simples Nacional: <strong>Ao receber pagamento</strong>.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Enviar PDF por e-mail ao tomador</Label>
                  <p className="text-xs text-muted-foreground">Quando a NFS-e for autorizada, manda o link para o pagador.</p>
                </div>
                <Switch
                  checked={settings?.nfse_auto_email ?? true}
                  onCheckedChange={(v) => updateSettings.mutate({ nfse_auto_email: v })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="provider" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notazz</CardTitle>
              <CardDescription>API key configurada como secret no backend.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>URL do Webhook (cole no painel Notazz)</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("URL copiada"); }}>
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  No painel Notazz, configure este endpoint em <strong>Configurações → Webhooks</strong> para receber atualizações de status.
                </p>
              </div>
              <a href="https://app.notazz.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                Abrir Notazz <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
