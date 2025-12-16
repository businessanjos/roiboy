import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Package, 
  Calendar, 
  DollarSign, 
  Edit2, 
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  PauseCircle,
  Loader2
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
  created_at: string;
}

interface SubscriptionsProps {
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

export function Subscriptions({ clientId }: SubscriptionsProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [productName, setProductName] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<string>("active");
  const [billingPeriod, setBillingPeriod] = useState<string>("monthly");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [nextBillingDate, setNextBillingDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

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

    // Realtime subscription
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

  const resetForm = () => {
    setProductName("");
    setPaymentStatus("active");
    setBillingPeriod("monthly");
    setAmount("");
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setNextBillingDate("");
    setEndDate("");
    setNotes("");
    setEditingId(null);
  };

  const openEditDialog = (sub: Subscription) => {
    setEditingId(sub.id);
    setProductName(sub.product_name);
    setPaymentStatus(sub.payment_status);
    setBillingPeriod(sub.billing_period);
    setAmount(sub.amount.toString());
    setStartDate(sub.start_date);
    setNextBillingDate(sub.next_billing_date || "");
    setEndDate(sub.end_date || "");
    setNotes(sub.notes || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!productName.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (!userData) {
        toast.error("Perfil não encontrado");
        return;
      }

      const subscriptionData = {
        account_id: userData.account_id,
        client_id: clientId,
        product_name: productName.trim(),
        payment_status: paymentStatus as "active" | "overdue" | "cancelled" | "trial" | "paused" | "pending",
        billing_period: billingPeriod as "monthly" | "quarterly" | "semiannual" | "annual" | "one_time",
        amount: parseFloat(amount) || 0,
        start_date: startDate || format(new Date(), "yyyy-MM-dd"),
        next_billing_date: nextBillingDate || null,
        end_date: endDate || null,
        notes: notes.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("client_subscriptions")
          .update(subscriptionData)
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Assinatura atualizada!");
      } else {
        const { error } = await supabase
          .from("client_subscriptions")
          .insert([subscriptionData]);
        if (error) throw error;
        toast.success("Assinatura adicionada!");
      }

      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving subscription:", error);
      toast.error(error.message || "Erro ao salvar assinatura");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta assinatura?")) return;

    try {
      const { error } = await supabase
        .from("client_subscriptions")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Assinatura excluída!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir assinatura");
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
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Produtos e Assinaturas</h3>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => {
              resetForm();
              setStartDate(format(new Date(), "yyyy-MM-dd"));
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Assinatura" : "Nova Assinatura"}
              </DialogTitle>
              <DialogDescription>
                Gerencie os produtos e status de pagamento do cliente
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Produto/Plano *</Label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ex: Mentoria Premium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="overdue">Em Atraso</SelectItem>
                      <SelectItem value="paused">Pausado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Periodicidade</Label>
                  <Select value={billingPeriod} onValueChange={setBillingPeriod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                      <SelectItem value="semiannual">Semestral</SelectItem>
                      <SelectItem value="annual">Anual</SelectItem>
                      <SelectItem value="one_time">Pagamento Único</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  step="0.01"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Início</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Próxima Cobrança</Label>
                  <Input
                    type="date"
                    value={nextBillingDate}
                    onChange={(e) => setNextBillingDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data de Término (opcional)</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas adicionais..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? "Salvar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {subscriptions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum produto cadastrado</p>
          <p className="text-sm mt-1">Adicione produtos e assinaturas do cliente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => {
            const statusConfig = paymentStatusConfig[sub.payment_status];
            const StatusIcon = statusConfig.icon;

            return (
              <Card key={sub.id} className="shadow-sm">
                <CardContent className="p-4">
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
                          {sub.billing_period !== "one_time" && `/${billingPeriodLabels[sub.billing_period].toLowerCase().slice(0, 3)}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Início: {format(new Date(sub.start_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        {sub.next_billing_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Próx: {format(new Date(sub.next_billing_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                      </div>

                      {sub.notes && (
                        <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                          {sub.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(sub)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(sub.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}