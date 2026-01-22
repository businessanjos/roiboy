import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MentionInput, extractMentions } from "@/components/ui/mention-input";
import { ClientFinancialStatusBadge } from "./ClientFinancialStatusBadge";
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
  Trash2,
  Send,
  Camera,
  Paperclip,
  Shield,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  Link2,
  MessageSquareText
} from "lucide-react";
import { FinancialNotes } from "./FinancialNotes";
import { FinancialQuickNoteInput } from "./FinancialQuickNoteInput";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

interface StripeSubscription {
  id: string;
  status: string;
  customer_email: string;
  customer_name: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created: string;
  items: {
    id: string;
    price_id: string;
    product_name: string;
    product_description: string | null;
    unit_amount: number;
    currency: string;
    interval: string | null;
    interval_count: number;
    quantity: number;
  }[];
}

interface FinancialEntry {
  id: string;
  entry_type: "receivable" | "payable";
  description: string;
  amount: number;
  currency: string;
  due_date: string;
  payment_date: string | null;
  status: string;
  category?: { name: string; color: string } | null;
  supplier?: { name: string; document: string | null } | null;
  linked_via: "direct" | "cnpj";
}

interface ClientData {
  cnpj: string | null;
  company_name: string | null;
  companies: any[] | null;
  emails: any[] | null;
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

const entryStatusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-600" },
  paid: { label: "Pago", className: "bg-emerald-500/10 text-emerald-600" },
  overdue: { label: "Vencido", className: "bg-red-500/10 text-red-600" },
  cancelled: { label: "Cancelado", className: "bg-slate-500/10 text-slate-600" },
};

export function ClientFinancial({ clientId }: ClientFinancialProps) {
  const { currentUser } = useCurrentUser();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [stripeSubscriptions, setStripeSubscriptions] = useState<StripeSubscription[]>([]);
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([]);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Quick comment state (kept for legacy inline usage, though FinancialQuickNoteInput manages its own)
  const [quickComment, setQuickComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchClientData = async (): Promise<ClientData | null> => {
    const { data } = await supabase
      .from("clients")
      .select("cnpj, company_name, companies, emails")
      .eq("id", clientId)
      .single();
    if (data) {
      const normalized: ClientData = {
        cnpj: data.cnpj,
        company_name: data.company_name,
        companies: Array.isArray(data.companies) ? data.companies : [],
        emails: Array.isArray(data.emails) ? data.emails : [],
      };
      setClientData(normalized);
      return normalized;
    }
    return null;
  };

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
    }
  };

  const fetchFinancialEntries = async (client: ClientData | null) => {
    try {
      // Get all CNPJs associated with this client
      const cnpjs: string[] = [];
      if (client?.cnpj) cnpjs.push(client.cnpj.replace(/\D/g, ""));
      if (client?.companies && Array.isArray(client.companies)) {
        client.companies.forEach((c: any) => {
          if (c.cnpj) cnpjs.push(c.cnpj.replace(/\D/g, ""));
        });
      }

      // 1. Fetch entries directly linked to this client
      const { data: directEntries } = await supabase
        .from("financial_entries")
        .select(`
          id, entry_type, description, amount, currency, due_date, payment_date, status,
          category:category_id(name, color),
          supplier:supplier_id(name, document)
        `)
        .eq("client_id", clientId)
        .order("due_date", { ascending: false })
        .limit(50);

      const entries: FinancialEntry[] = (directEntries || []).map((e: any) => ({
        ...e,
        linked_via: "direct" as const,
      }));

      // 2. If client has CNPJs, find suppliers with matching CNPJs and get their entries
      if (cnpjs.length > 0) {
        // Find suppliers with matching documents
        const { data: matchingSuppliers } = await supabase
          .from("suppliers")
          .select("id, document")
          .in("document", cnpjs.map(c => c.replace(/\D/g, "")));

        if (matchingSuppliers && matchingSuppliers.length > 0) {
          const supplierIds = matchingSuppliers.map(s => s.id);

          // Get entries linked to these suppliers (excluding already fetched direct ones)
          const directEntryIds = entries.map(e => e.id);
          const { data: supplierEntries } = await supabase
            .from("financial_entries")
            .select(`
              id, entry_type, description, amount, currency, due_date, payment_date, status,
              category:category_id(name, color),
              supplier:supplier_id(name, document)
            `)
            .in("supplier_id", supplierIds)
            .order("due_date", { ascending: false })
            .limit(50);

          // Add supplier entries that aren't already in the list
          (supplierEntries || []).forEach((e: any) => {
            if (!directEntryIds.includes(e.id)) {
              entries.push({ ...e, linked_via: "cnpj" as const });
            }
          });
        }
      }

      // Sort by due_date descending
      entries.sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
      setFinancialEntries(entries);
    } catch (error) {
      console.error("Error fetching financial entries:", error);
    }
  };

  const fetchStripeSubscriptions = async (client: ClientData | null) => {
    if (!client?.emails || client.emails.length === 0) {
      setStripeSubscriptions([]);
      return;
    }
    
    setLoadingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-customer-subscriptions', {
        body: { emails: client.emails },
      });
      
      if (error) {
        console.error('Error fetching Stripe subscriptions:', error);
        setStripeSubscriptions([]);
      } else {
        setStripeSubscriptions(data?.subscriptions || []);
      }
    } catch (err) {
      console.error('Error calling Stripe function:', err);
      setStripeSubscriptions([]);
    } finally {
      setLoadingStripe(false);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    const client = await fetchClientData();
    await Promise.all([
      fetchSubscriptions(),
      fetchFinancialEntries(client),
      fetchStripeSubscriptions(client),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();

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

    const entriesChannel = supabase
      .channel(`financial-entries-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_entries',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          fetchFinancialEntries(clientData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(entriesChannel);
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

  const handleQuickComment = async () => {
    if (!quickComment.trim() || !currentUser) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from("client_followups").insert({
        account_id: currentUser.account_id,
        client_id: clientId,
        user_id: currentUser.id,
        type: "financial_note",
        title: null,
        content: quickComment.trim(),
      });

      if (error) throw error;
      toast.success("Nota financeira adicionada!");
      setQuickComment("");
    } catch (error: any) {
      console.error("Error adding note:", error);
      toast.error(error.message || "Erro ao adicionar nota");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuickComment();
    }
  };

  const handleQuickFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 50MB.");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${clientId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("client-followups")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("client-followups")
        .getPublicUrl(fileName);

      const { error } = await supabase.from("client_followups").insert({
        account_id: currentUser.account_id,
        client_id: clientId,
        user_id: currentUser.id,
        type: type,
        title: file.name,
        content: null,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
      });

      if (error) throw error;
      toast.success(type === "image" ? "Imagem enviada!" : "Arquivo enviado!");
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      {/* Header with Status Badge */}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-medium">Dados Financeiros</h3>
          <ClientFinancialStatusBadge clientId={clientId} size="lg" />
        </div>
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

      {/* Company info if available */}
      {clientData && (clientData.company_name || clientData.cnpj) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
          <Building2 className="h-4 w-4" />
          <span>
            Vinculado a: <span className="font-medium text-foreground">{clientData.company_name || "Empresa"}</span>
            {clientData.cnpj && <span className="ml-2 text-xs">({clientData.cnpj})</span>}
          </span>
        </div>
      )}

      <Tabs defaultValue="entries" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="entries" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Lançamentos
            {financialEntries.length > 0 && (
              <Badge variant="secondary" className="ml-1">{financialEntries.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Assinaturas
            {(subscriptions.length + stripeSubscriptions.length) > 0 && (
              <Badge variant="secondary" className="ml-1">{subscriptions.length + stripeSubscriptions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4" />
            Anotações
          </TabsTrigger>
        </TabsList>

        {/* Financial Entries Tab */}
        <TabsContent value="entries" className="mt-4 space-y-4">
          {/* Quick note input for Admin and CX users */}
          {currentUser && (
            <FinancialQuickNoteInput
              clientId={clientId}
              currentUser={currentUser}
            />
          )}

          {financialEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum lançamento financeiro</p>
              <p className="text-sm mt-1">
                Lançamentos vinculados ao cliente ou CNPJ aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {financialEntries.map((entry) => {
                const isReceivable = entry.entry_type === "receivable";
                const statusConf = entryStatusConfig[entry.status] || entryStatusConfig.pending;

                return (
                  <div key={entry.id} className="p-3 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isReceivable ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                          {isReceivable ? (
                            <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{entry.description}</span>
                            {entry.linked_via === "cnpj" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-[10px] h-5 gap-1">
                                      <Link2 className="h-3 w-3" />
                                      CNPJ
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Vinculado via CNPJ da empresa</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{format(new Date(entry.due_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                            {entry.category && (
                              <Badge 
                                variant="outline" 
                                className="text-[10px] h-4"
                                style={{ borderColor: entry.category.color, color: entry.category.color }}
                              >
                                {entry.category.name}
                              </Badge>
                            )}
                            {entry.supplier && (
                              <span className="text-muted-foreground/70">{entry.supplier.name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <p className={`font-semibold ${isReceivable ? "text-emerald-600" : "text-red-600"}`}>
                          {isReceivable ? "+" : "-"} {formatCurrency(entry.amount, entry.currency)}
                        </p>
                        <Badge variant="outline" className={`text-[10px] ${statusConf.className}`}>
                          {statusConf.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions" className="mt-4 space-y-6">
          {/* Stripe Subscriptions Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <svg className="h-4 w-4" viewBox="0 0 32 32" fill="none">
                  <path d="M13.976 13.176c0-1.056.87-1.464 2.304-1.464 2.064 0 4.656.624 6.72 1.728V7.68a17.888 17.888 0 00-6.72-1.248c-5.472 0-9.12 2.856-9.12 7.632 0 7.44 10.248 6.264 10.248 9.48 0 1.248-1.08 1.656-2.592 1.656-2.256 0-5.136-.936-7.416-2.184v5.808a18.86 18.86 0 007.416 1.584c5.568 0 9.408-2.76 9.408-7.608-.024-8.016-10.248-6.624-10.248-9.624z" fill="#635BFF"/>
                </svg>
                Stripe
                {loadingStripe && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
            </div>
            
            {stripeSubscriptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma assinatura no Stripe</p>
                {clientData?.emails && clientData.emails.length === 0 && (
                  <p className="text-xs mt-1">Cadastre um e-mail para buscar assinaturas</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {stripeSubscriptions.map((stripeSub) => {
                  const stripeStatusConfig: Record<string, { label: string; className: string }> = {
                    active: { label: "Ativo", className: "bg-emerald-500/10 text-emerald-600" },
                    trialing: { label: "Trial", className: "bg-blue-500/10 text-blue-600" },
                    past_due: { label: "Atrasado", className: "bg-red-500/10 text-red-600" },
                    canceled: { label: "Cancelado", className: "bg-slate-500/10 text-slate-600" },
                    unpaid: { label: "Não pago", className: "bg-red-500/10 text-red-600" },
                    incomplete: { label: "Incompleto", className: "bg-amber-500/10 text-amber-600" },
                    incomplete_expired: { label: "Expirado", className: "bg-slate-500/10 text-slate-600" },
                    paused: { label: "Pausado", className: "bg-amber-500/10 text-amber-600" },
                  };
                  const statusConf = stripeStatusConfig[stripeSub.status] || { label: stripeSub.status, className: "bg-slate-500/10 text-slate-600" };
                  
                  return (
                    <div key={stripeSub.id} className="p-4 rounded-lg border border-border bg-card/50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          {stripeSub.items.map((item, idx) => (
                            <div key={item.id} className={idx > 0 ? "pt-2 border-t" : ""}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold">{item.product_name}</h4>
                                {idx === 0 && (
                                  <>
                                    <Badge variant="outline" className={statusConf.className}>
                                      {statusConf.label}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] gap-1 bg-[#635BFF]/10 text-[#635BFF] border-[#635BFF]/30">
                                      <svg className="h-3 w-3" viewBox="0 0 32 32" fill="none">
                                        <path d="M13.976 13.176c0-1.056.87-1.464 2.304-1.464 2.064 0 4.656.624 6.72 1.728V7.68a17.888 17.888 0 00-6.72-1.248c-5.472 0-9.12 2.856-9.12 7.632 0 7.44 10.248 6.264 10.248 9.48 0 1.248-1.08 1.656-2.592 1.656-2.256 0-5.136-.936-7.416-2.184v5.808a18.86 18.86 0 007.416 1.584c5.568 0 9.408-2.76 9.408-7.608-.024-8.016-10.248-6.624-10.248-9.624z" fill="currentColor"/>
                                      </svg>
                                      Stripe
                                    </Badge>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap mt-1">
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3.5 w-3.5" />
                                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: item.currency.toUpperCase() }).format(item.unit_amount / 100)}
                                  {item.interval && <span className="text-xs">/{item.interval === 'month' ? 'mês' : item.interval === 'year' ? 'ano' : item.interval}</span>}
                                </span>
                                {item.quantity > 1 && (
                                  <span className="text-xs">x{item.quantity}</span>
                                )}
                              </div>
                            </div>
                          ))}
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap pt-2 border-t">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Período: {format(new Date(stripeSub.current_period_start), "dd/MM/yy", { locale: ptBR })} - {format(new Date(stripeSub.current_period_end), "dd/MM/yy", { locale: ptBR })}
                            </span>
                            {stripeSub.customer_email && (
                              <span className="text-muted-foreground/70">{stripeSub.customer_email}</span>
                            )}
                            {stripeSub.cancel_at_period_end && (
                              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600">
                                Cancela no fim do período
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Internal Subscriptions Section */}
          {subscriptions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4" />
                Omie / Manual
              </div>
              
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
            </div>
          )}
          
          {/* Empty state when no subscriptions from either source */}
          {subscriptions.length === 0 && stripeSubscriptions.length === 0 && !loadingStripe && (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-sm">Nenhuma assinatura encontrada</p>
            </div>
          )}
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-4">
          <FinancialNotes clientId={clientId} currentUser={currentUser} />
        </TabsContent>
      </Tabs>

    </div>
  );
}