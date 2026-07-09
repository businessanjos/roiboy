import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MegaphoneIcon,
  Plus,
  Send,
  Pause,
  Play,
  Trash2,
  Mail,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  PencilLine,
  History,
  Users,
} from "lucide-react";
import { FinancialPageHeader } from "@/components/financial/_shared";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Channel = "whatsapp" | "email";

interface Rule {
  id: string;
  account_id: string;
  name: string;
  days_offset: number;
  channels: Channel[];
  subject: string | null;
  message: string;
  active: boolean;
  sort_order: number;
}

interface ClientSetting {
  id: string;
  client_id: string;
  paused: boolean;
  pause_reason: string | null;
  custom_channels: Channel[] | null;
  notes: string | null;
  clients?: { full_name: string } | null;
}

interface SendLog {
  id: string;
  rule_id: string;
  installment_id: string;
  channel: string;
  recipient: string | null;
  status: string;
  error: string | null;
  message_preview: string | null;
  sent_at: string;
  billing_reminder_rules?: { name: string } | null;
  clients?: { full_name: string } | null;
}

const AVAILABLE_VARS = [
  { key: "{primeiro_nome}", desc: "Primeiro nome do cliente" },
  { key: "{nome}", desc: "Nome completo" },
  { key: "{valor}", desc: "Valor formatado (R$)" },
  { key: "{vencimento}", desc: "Data de vencimento (DD/MM/AAAA)" },
  { key: "{dias_para_vencer}", desc: "Dias que faltam até vencer" },
  { key: "{dias_atraso}", desc: "Dias de atraso" },
  { key: "{numero_parcela}", desc: "Nº da parcela" },
  { key: "{empresa}", desc: "Empresa emissora" },
];

function offsetLabel(days: number) {
  if (days < 0) return `${Math.abs(days)}d antes`;
  if (days === 0) return "No vencimento";
  return `D+${days}`;
}

export default function FinancialCollectionsRulerPage() {
  const { data: currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("regua");
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const rulesQ = useQuery({
    queryKey: ["billing-reminder-rules", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_reminder_rules")
        .select("*")
        .eq("account_id", accountId!)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as Rule[];
    },
  });

  const settingsQ = useQuery({
    queryKey: ["billing-client-settings", accountId],
    enabled: !!accountId && tab === "clientes",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_reminder_client_settings")
        .select("*, clients:client_id(full_name)")
        .eq("account_id", accountId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ClientSetting[];
    },
  });

  const historyQ = useQuery({
    queryKey: ["billing-reminder-sends", accountId],
    enabled: !!accountId && tab === "historico",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_reminder_sends")
        .select("*, billing_reminder_rules:rule_id(name), clients:client_id(full_name)")
        .eq("account_id", accountId!)
        .order("sent_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as SendLog[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (rule: Rule) => {
      const { error } = await supabase
        .from("billing_reminder_rules")
        .update({ active: !rule.active })
        .eq("id", rule.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing-reminder-rules", accountId] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("billing_reminder_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Regra removida" });
      qc.invalidateQueries({ queryKey: ["billing-reminder-rules", accountId] });
    },
  });

  const upsertSetting = useMutation({
    mutationFn: async (s: Partial<ClientSetting> & { client_id: string }) => {
      const { error } = await supabase
        .from("billing_reminder_client_settings")
        .upsert(
          { ...s, account_id: accountId! } as unknown as Record<string, unknown>,
          { onConflict: "client_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing-client-settings", accountId] }),
  });

  const removeSetting = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("billing_reminder_client_settings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Override removido" });
      qc.invalidateQueries({ queryKey: ["billing-client-settings", accountId] });
    },
  });

  const runNow = async () => {
    if (!accountId) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-billing-reminders", {
        body: { account_id: accountId },
      });
      if (error) throw error;
      const d = data as { sent?: number; skipped?: number; failed?: number };
      toast({
        title: "Processamento concluído",
        description: `${d?.sent ?? 0} enviados · ${d?.skipped ?? 0} pulados · ${d?.failed ?? 0} falhas`,
      });
      qc.invalidateQueries({ queryKey: ["billing-reminder-sends", accountId] });
    } catch (e) {
      toast({
        title: "Erro ao processar",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <FinancialPageHeader
        icon={MegaphoneIcon}
        title="Régua de Cobrança"
        description="Lembretes automáticos antes do vencimento e cobrança escalonada de inadimplentes por WhatsApp e e-mail."
        actions={
          <>
            <Button variant="outline" onClick={runNow} disabled={processing}>
              {processing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Processar agora
            </Button>
            <Button onClick={() => setNewRuleOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova regra
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="regua">
            <MegaphoneIcon className="h-4 w-4 mr-2" />
            Régua padrão
          </TabsTrigger>
          <TabsTrigger value="clientes">
            <Users className="h-4 w-4 mr-2" />
            Clientes (overrides)
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regua" className="space-y-3">
          {rulesQ.isLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <div className="space-y-2">
              {(rulesQ.data || []).map((rule) => (
                <Card key={rule.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant={rule.days_offset < 0 ? "secondary" : rule.days_offset === 0 ? "default" : "destructive"}>
                          {offsetLabel(rule.days_offset)}
                        </Badge>
                        <h3 className="font-medium truncate">{rule.name}</h3>
                        {rule.channels.map((c) => (
                          <Badge key={c} variant="outline" className="text-xs">
                            {c === "whatsapp" ? (
                              <MessageCircle className="h-3 w-3 mr-1" />
                            ) : (
                              <Mail className="h-3 w-3 mr-1" />
                            )}
                            {c === "whatsapp" ? "WhatsApp" : "E-mail"}
                          </Badge>
                        ))}
                      </div>
                      {rule.subject && (
                        <p className="text-xs text-muted-foreground mb-1">
                          <strong>Assunto:</strong> {rule.subject}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-3">
                        {rule.message}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={rule.active}
                        onCheckedChange={() => toggleActive.mutate(rule)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => setEditingRule(rule)}>
                        <PencilLine className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Remover a regra "${rule.name}"?`)) deleteRule.mutate(rule.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              {(rulesQ.data || []).length === 0 && (
                <Card className="p-8 text-center text-muted-foreground">
                  Nenhuma regra configurada. Clique em "Nova regra" para começar.
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="clientes">
          <ClientOverridesTab
            settings={settingsQ.data || []}
            loading={settingsQ.isLoading}
            onUpsert={(s) => upsertSetting.mutate(s)}
            onRemove={(id) => removeSetting.mutate(id)}
            accountId={accountId}
          />
        </TabsContent>

        <TabsContent value="historico">
          <HistoryTab logs={historyQ.data || []} loading={historyQ.isLoading} />
        </TabsContent>
      </Tabs>

      <RuleDialog
        open={newRuleOpen || !!editingRule}
        onClose={() => {
          setNewRuleOpen(false);
          setEditingRule(null);
        }}
        rule={editingRule}
        accountId={accountId}
        onSaved={() => qc.invalidateQueries({ queryKey: ["billing-reminder-rules", accountId] })}
      />
    </div>
  );
}

// ================================================================
// RuleDialog
// ================================================================
function RuleDialog({
  open,
  onClose,
  rule,
  accountId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  rule: Rule | null;
  accountId?: string;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!rule;
  const [form, setForm] = useState({
    name: rule?.name || "",
    days_offset: rule?.days_offset ?? -3,
    channels: (rule?.channels || ["whatsapp"]) as Channel[],
    subject: rule?.subject || "",
    message: rule?.message || "",
    active: rule?.active ?? true,
    sort_order: rule?.sort_order ?? 100,
  });

  useMemo(() => {
    if (open) {
      setForm({
        name: rule?.name || "",
        days_offset: rule?.days_offset ?? -3,
        channels: (rule?.channels || ["whatsapp"]) as Channel[],
        subject: rule?.subject || "",
        message: rule?.message || "",
        active: rule?.active ?? true,
        sort_order: rule?.sort_order ?? 100,
      });
    }
  }, [open, rule]);

  const toggleChannel = (c: Channel) =>
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c],
    }));

  const save = async () => {
    if (!accountId) return;
    if (!form.name.trim() || !form.message.trim() || form.channels.length === 0) {
      toast({ title: "Preencha nome, mensagem e ao menos um canal", variant: "destructive" });
      return;
    }
    if (isEdit) {
      const { error } = await supabase
        .from("billing_reminder_rules")
        .update(form)
        .eq("id", rule!.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase
        .from("billing_reminder_rules")
        .insert({ ...form, account_id: accountId });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
    }
    toast({ title: isEdit ? "Regra atualizada" : "Regra criada" });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar regra" : "Nova regra"}</DialogTitle>
          <DialogDescription>
            Dias negativos = antes do vencimento · 0 = no dia · positivos = após o vencimento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: 3 dias antes do vencimento"
              />
            </div>
            <div>
              <Label>Dias</Label>
              <Input
                type="number"
                value={form.days_offset}
                onChange={(e) => setForm({ ...form, days_offset: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <Label>Canais</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                variant={form.channels.includes("whatsapp") ? "default" : "outline"}
                onClick={() => toggleChannel("whatsapp")}
                size="sm"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                type="button"
                variant={form.channels.includes("email") ? "default" : "outline"}
                onClick={() => toggleChannel("email")}
                size="sm"
              >
                <Mail className="h-4 w-4 mr-2" />
                E-mail
              </Button>
            </div>
          </div>

          {form.channels.includes("email") && (
            <div>
              <Label>Assunto do e-mail</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Ex: Lembrete de pagamento"
              />
            </div>
          )}

          <div>
            <Label>Mensagem</Label>
            <Textarea
              rows={7}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Olá, {primeiro_nome}! Sua parcela de {valor} vence em {vencimento}..."
            />
            <div className="mt-2 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Variáveis disponíveis:</p>
              <div className="flex flex-wrap gap-1">
                {AVAILABLE_VARS.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setForm({ ...form, message: form.message + " " + v.key })}
                    className="px-2 py-0.5 bg-muted rounded font-mono hover:bg-primary/20"
                    title={v.desc}
                  >
                    {v.key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={form.active}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
            />
            <Label>Ativa</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>{isEdit ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ================================================================
// Client overrides
// ================================================================
function ClientOverridesTab({
  settings,
  loading,
  onUpsert,
  onRemove,
  accountId,
}: {
  settings: ClientSetting[];
  loading: boolean;
  onUpsert: (s: Partial<ClientSetting> & { client_id: string }) => void;
  onRemove: (id: string) => void;
  accountId?: string;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const clientsQ = useQuery({
    queryKey: ["clients-picker", accountId, clientSearch],
    enabled: !!accountId && addOpen,
    queryFn: async () => {
      let q = supabase
        .from("clients")
        .select("id, full_name")
        .eq("account_id", accountId!)
        .order("full_name")
        .limit(20);
      if (clientSearch.trim()) q = q.ilike("full_name", `%${clientSearch.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Pause a régua para clientes específicos (ex: em renegociação) ou defina canais diferentes.
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar cliente
        </Button>
      </div>

      {settings.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhum cliente com regra personalizada. Todos seguem a régua padrão.
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Canais custom</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.clients?.full_name || "—"}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={s.paused ? "destructive" : "outline"}
                      onClick={() => onUpsert({ client_id: s.client_id, paused: !s.paused })}
                    >
                      {s.paused ? (
                        <>
                          <Pause className="h-3 w-3 mr-1" /> Pausado
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 mr-1" /> Ativo
                        </>
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.custom_channels?.length ? s.custom_channels.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                    {s.pause_reason || s.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => onRemove(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar cliente à régua personalizada</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Buscar cliente por nome..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
          />
          <div className="max-h-72 overflow-y-auto space-y-1">
            {clientsQ.data?.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onUpsert({ client_id: c.id, paused: true, pause_reason: "Pausado manualmente" });
                  setAddOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-muted rounded"
              >
                {c.full_name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ================================================================
// History
// ================================================================
function HistoryTab({ logs, loading }: { logs: SendLog[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-64" />;
  if (logs.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Nenhum envio registrado ainda.
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Regra</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Mensagem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="text-xs whitespace-nowrap">
                {format(new Date(l.sent_at), "dd/MM HH:mm", { locale: ptBR })}
              </TableCell>
              <TableCell className="font-medium">{l.clients?.full_name || "—"}</TableCell>
              <TableCell className="text-xs">{l.billing_reminder_rules?.name || "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {l.channel === "whatsapp" ? (
                    <MessageCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <Mail className="h-3 w-3 mr-1" />
                  )}
                  {l.channel}
                </Badge>
              </TableCell>
              <TableCell>
                {l.status === "sent" ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Enviado
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Falha
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                {l.error || l.message_preview || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
