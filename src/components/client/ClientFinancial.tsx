import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Check
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

export function ClientFinancial({ clientId }: ClientFinancialProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

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
        <h3 className="font-medium">Dados Financeiros (Omie)</h3>
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

      {subscriptions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum dado financeiro</p>
          <p className="text-sm mt-1">
            Clique em "Sincronizar Omie" para buscar os dados de pagamento
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => {
            const statusConfig = paymentStatusConfig[sub.payment_status];
            const StatusIcon = statusConfig.icon;
            const isEditing = editingNoteId === sub.id;

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
