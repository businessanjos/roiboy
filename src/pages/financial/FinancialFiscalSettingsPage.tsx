import { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Star, Receipt, ExternalLink } from "lucide-react";
import { FinancialPageHeader } from "@/components/financial/_shared";

type EmissionMode = "manual" | "on_payment" | "on_won";

export default function FinancialFiscalSettingsPage() {
  const { user } = useCurrentUser();
  const accountId = (user as any)?.account_id as string | undefined;
  const qc = useQueryClient();

  const { data: contratadas } = useQuery({
    queryKey: ["contratadas", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratadas" as any)
        .select("*")
        .eq("account_id", accountId!)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
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

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("contratadas" as any).update({ is_default: false }).eq("account_id", accountId!);
      await supabase.from("contratadas" as any).update({ is_default: true }).eq("id", id);
      await supabase.from("account_settings").update({ nfse_default_contratada_id: id }).eq("account_id", accountId!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contratadas", accountId] });
      qc.invalidateQueries({ queryKey: ["account-settings-fiscal", accountId] });
      toast.success("CNPJ padrão atualizado");
    },
  });

  const deleteContratada = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contratadas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contratadas", accountId] });
      toast.success("CNPJ removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const webhookUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co/nfse-webhook`;

  return (
    <div className="p-6 space-y-6">
      <FinancialPageHeader
        title="Configuração Fiscal (NFS-e)"
        subtitle="CNPJs emissores e regras de emissão automática de notas fiscais"
        icon={Receipt}
      />

      <Tabs defaultValue="cnpjs">
        <TabsList>
          <TabsTrigger value="cnpjs">CNPJs Emissores</TabsTrigger>
          <TabsTrigger value="rules">Regras de Emissão</TabsTrigger>
          <TabsTrigger value="provider">Provedor / Webhook</TabsTrigger>
        </TabsList>

        <TabsContent value="cnpjs" className="space-y-4">
          <div className="flex justify-end">
            <ContratadaFormDialog accountId={accountId} onSaved={() => qc.invalidateQueries({ queryKey: ["contratadas", accountId] })} />
          </div>

          {!contratadas?.length && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              Nenhum CNPJ emissor cadastrado. Adicione o primeiro para começar a emitir NFS-e.
            </CardContent></Card>
          )}

          <div className="grid gap-3">
            {contratadas?.map((c) => (
              <Card key={c.id} className={c.is_default ? "border-primary" : ""}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{c.razao_social}</h3>
                      {c.is_default && <Badge variant="default" className="gap-1"><Star className="h-3 w-3" /> Padrão</Badge>}
                      <Badge variant="outline">{c.regime_tributario.replace("_", " ")}</Badge>
                      <Badge variant="secondary">{c.provider}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>CNPJ: {c.cnpj}</div>
                      {c.inscricao_municipal && <div>IM: {c.inscricao_municipal}</div>}
                      {c.item_lista_servico && <div>Item LC 116: {c.item_lista_servico} • ISS {c.aliquota_iss ?? 0}%</div>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!c.is_default && (
                      <Button size="sm" variant="ghost" onClick={() => setDefault.mutate(c.id)} title="Tornar padrão">
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (confirm(`Remover ${c.razao_social}?`)) deleteContratada.mutate(c.id);
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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

function ContratadaFormDialog({ accountId, onSaved }: { accountId?: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    cnpj: "",
    razao_social: "",
    nome_fantasia: "",
    inscricao_municipal: "",
    regime_tributario: "simples_nacional",
    item_lista_servico: "8.02",
    codigo_tributacao_municipio: "",
    aliquota_iss: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!accountId) return;
    const cnpjClean = form.cnpj.replace(/\D/g, "");
    if (cnpjClean.length !== 14) { toast.error("CNPJ inválido"); return; }
    if (!form.razao_social.trim()) { toast.error("Razão social obrigatória"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("contratadas" as any).insert({
        account_id: accountId,
        cnpj: cnpjClean,
        razao_social: form.razao_social,
        nome_fantasia: form.nome_fantasia || null,
        inscricao_municipal: form.inscricao_municipal || null,
        regime_tributario: form.regime_tributario,
        item_lista_servico: form.item_lista_servico || null,
        codigo_tributacao_municipio: form.codigo_tributacao_municipio || null,
        aliquota_iss: form.aliquota_iss ? parseFloat(form.aliquota_iss) : null,
        provider: "notazz",
      });
      if (error) throw error;
      toast.success("CNPJ cadastrado");
      onSaved();
      setOpen(false);
      setForm({ cnpj: "", razao_social: "", nome_fantasia: "", inscricao_municipal: "", regime_tributario: "simples_nacional", item_lista_servico: "8.02", codigo_tributacao_municipio: "", aliquota_iss: "" });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" /> Novo CNPJ emissor</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo CNPJ Emissor</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>CNPJ *</Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Label>Inscrição Municipal</Label>
              <Input value={form.inscricao_municipal} onChange={(e) => setForm({ ...form, inscricao_municipal: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Razão Social *</Label>
            <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
          </div>
          <div>
            <Label>Nome Fantasia</Label>
            <Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
          </div>
          <div>
            <Label>Regime Tributário</Label>
            <Select value={form.regime_tributario} onValueChange={(v) => setForm({ ...form, regime_tributario: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                <SelectItem value="lucro_real">Lucro Real</SelectItem>
                <SelectItem value="mei">MEI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Item LC 116/03</Label>
              <Input value={form.item_lista_servico} onChange={(e) => setForm({ ...form, item_lista_servico: e.target.value })} placeholder="8.02" />
            </div>
            <div>
              <Label>Cód. Trib. Mun.</Label>
              <Input value={form.codigo_tributacao_municipio} onChange={(e) => setForm({ ...form, codigo_tributacao_municipio: e.target.value })} />
            </div>
            <div>
              <Label>Alíquota ISS (%)</Label>
              <Input type="number" step="0.01" value={form.aliquota_iss} onChange={(e) => setForm({ ...form, aliquota_iss: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
