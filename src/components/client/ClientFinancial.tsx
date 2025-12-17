import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Package, 
  Calendar, 
  DollarSign, 
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  PauseCircle,
  Loader2,
  RefreshCw,
  Pencil,
  X,
  Check,
  Plus,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Subscription {
  id: string;
  product_name: string;
  payment_status: "active" | "overdue" | "cancelled" | "trial" | "paused" | "pending";
  billing_period: "monthly" | "quarterly" | "semiannual" | "annual" | "one_time";
  amount: number;
  currency: string;
  start_date: string;
  next_billing_date: string | null;
  end_date: string | null;
  notes: string | null;
}

interface ClientFinancialProps {
  clientId: string;
}

const paymentStatusConfig = {
  active: { label: "Ativo", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  overdue: { label: "Em Atraso", icon: AlertCircle, className: "bg-red-500/10 text-red-600 border-red-500/30" },
  cancelled: { label: "Cancelado", icon: XCircle, className: "bg-slate-500/10 text-slate-600 border-slate-500/30" },
  trial: { label: "Trial", icon: Clock, className: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  paused: { label: "Pausado", icon: PauseCircle, className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  pending: { label: "Pendente", icon: Clock, className: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
};

const billingPeriodLabels = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
  one_time: "Único",
};

const emptyForm = {
  product_name: "",
  payment_status: "active" as const,
  billing_period: "monthly" as const,
  amount: "",
  currency: "BRL",
  start_date: new Date().toISOString().split("T")[0],
  next_billing_date: "",
  notes: "",
};

export function ClientFinancial({ clientId }: ClientFinancialProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from("client_subscriptions")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSubscriptions(data || []);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();

    const channel = supabase
      .channel(`subscriptions-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_subscriptions',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          fetchSubscriptions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const handleSyncOmie = async () => {
    setSyncing(true);
    try {
      const response = await supabase.functions.invoke('sync-omie', {
        body: { client_id: clientId },
      });

      if (response.error) throw response.error;

      const result = response.data;
      
      if (result.synced > 0) {
        toast.success(`Sincronizado com sucesso! Status atualizado.`);
      } else if (result.details?.[0]?.status === 'not_found') {
        toast.warning('Cliente não encontrado na Omie. Verifique se o telefone/nome está correto.');
      } else if (result.details?.[0]?.status === 'no_receivables') {
        toast.info('Nenhuma conta a receber encontrada na Omie para este cliente.');
      } else {
        toast.info('Sincronização concluída.');
      }
      
      fetchSubscriptions();
    } catch (error: any) {
      console.error('Error syncing with Omie:', error);
      toast.error(error.message || 'Erro ao sincronizar com Omie');
    } finally {
      setSyncing(false);
    }
  };

  const handleEditNote = (sub: Subscription) => {
    setEditingNoteId(sub.id);
    setNoteText(sub.notes || "");
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setNoteText("");
  };

  const handleSaveNote = async (subId: string) => {
    setSavingNote(true);
    try {
      const { error } = await supabase
        .from("client_subscriptions")
        .update({ notes: noteText.trim() || null })
        .eq("id", subId);

      if (error) throw error;

      toast.success("Nota salva com sucesso!");
      setEditingNoteId(null);
      setNoteText("");
      fetchSubscriptions();
    } catch (error: any) {
      console.error("Error saving note:", error);
      toast.error("Erro ao salvar nota");
    } finally {
      setSavingNote(false);
    }
  };

  const handleAddSubscription = async () => {
    if (!formData.product_name.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (!userData) throw new Error("Usuário não encontrado");

      const { error } = await supabase.from("client_subscriptions").insert({
        account_id: userData.account_id,
        client_id: clientId,
        product_name: formData.product_name.trim(),
        payment_status: formData.payment_status,
        billing_period: formData.billing_period,
        amount: parseFloat(formData.amount) || 0,
        currency: formData.currency,
        start_date: formData.start_date,
        next_billing_date: formData.next_billing_date || null,
        notes: formData.notes.trim() || null,
      });

      if (error) throw error;

      toast.success("Registro financeiro adicionado!");
      setDialogOpen(false);
      setFormData(emptyForm);
      fetchSubscriptions();
    } catch (error: any) {
      console.error("Error adding subscription:", error);
      toast.error(error.message || "Erro ao adicionar registro");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (subId: string) => {
    setDeletingId(subId);
    try {
      const { error } = await supabase
        .from("client_subscriptions")
        .delete()
        .eq("id", subId);

      if (error) throw error;

      toast.success("Registro excluído!");
      fetchSubscriptions();
    } catch (error: any) {
      console.error("Error deleting subscription:", error);
      toast.error("Erro ao excluir registro");
    } finally {
      setDeletingId(null);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <h3 className="font-medium">Dados Financeiros</h3>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Manual
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Registro Financeiro</DialogTitle>
                <DialogDescription>
                  Adicione manualmente um produto ou assinatura do cliente
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome do Produto *</Label>
                  <Input
                    placeholder="Ex: Mentoria Premium"
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status de Pagamento</Label>
                    <Select
                      value={formData.payment_status}
                      onValueChange={(v) => setFormData({ ...formData, payment_status: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="overdue">Em Atraso</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="paused">Pausado</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Período de Cobrança</Label>
                    <Select
                      value={formData.billing_period}
                      onValueChange={(v) => setFormData({ ...formData, billing_period: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="semiannual">Semestral</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                        <SelectItem value="one_time">Único</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Moeda</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(v) => setFormData({ ...formData, currency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BRL">BRL (R$)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data de Início</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Próximo Vencimento</Label>
                    <Input
                      type="date"
                      value={formData.next_billing_date}
                      onChange={(e) => setFormData({ ...formData, next_billing_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    placeholder="Notas adicionais..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddSubscription} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleSyncOmie}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sincronizar Omie
          </Button>
        </div>
      </div>

      {subscriptions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum dado financeiro</p>
          <p className="text-sm mt-1">
            Adicione manualmente ou sincronize com a Omie
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => {
            const statusConfig = paymentStatusConfig[sub.payment_status];
            const StatusIcon = statusConfig.icon;
            const isEditing = editingNoteId === sub.id;
            const isDeleting = deletingId === sub.id;

            return (
              <div key={sub.id} className="p-4 rounded-lg border border-border bg-card/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">{sub.product_name}</h4>
                      <Badge variant="outline" className={statusConfig.className}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                      <Badge variant="secondary">
                        {billingPeriodLabels[sub.billing_period]}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        {formatCurrency(sub.amount, sub.currency)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Início: {format(new Date(sub.start_date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      {sub.next_billing_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Venc: {format(new Date(sub.next_billing_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Adicione uma nota sobre este item financeiro..."
                          className="min-h-[80px] text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveNote(sub.id)}
                            disabled={savingNote}
                          >
                            {savingNote ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3 mr-1" />
                            )}
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            disabled={savingNote}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        {sub.notes ? (
                          <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded flex-1">
                            {sub.notes}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground/50 italic flex-1">
                            Sem notas
                          </p>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={() => handleEditNote(sub)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(sub.id)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}