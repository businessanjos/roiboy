import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAsaas, PAYMENT_STATUS_LABELS, BILLING_TYPE_LABELS } from "@/hooks/useAsaas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CreditCard,
  FileText,
  Receipt,
  Download,
  ExternalLink,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crown,
  Zap,
  Building2,
  Sparkles,
  RefreshCw,
  ArrowUpRight,
  Ban,
  Loader2,
  Package,
  Users,
  MessageSquare,
  BarChart3
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EmptyState } from "@/components/ui/empty-state";

interface Invoice {
  id: string;
  customer: string;
  value: number;
  netValue: number;
  status: string;
  billingType: string;
  dueDate: string;
  paymentDate?: string;
  description?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_period: string;
  max_clients: number | null;
  max_users: number | null;
  max_ai_analyses: number | null;
  max_whatsapp_connections: number | null;
  features: any;
  plan_type: string;
}

interface Account {
  id: string;
  name: string;
  plan_id: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  asaas_customer_id: string | null;
  payment_method_configured: boolean;
}

export default function BillingPortal() {
  const { currentUser, loading: userLoading } = useCurrentUser();
  const { listPayments, loading: asaasLoading } = useAsaas();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch account data
  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ["billing-account", currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return null;
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, plan_id, subscription_status, trial_ends_at, asaas_customer_id, payment_method_configured")
        .eq("id", currentUser.account_id)
        .single();
      if (error) throw error;
      return data as Account;
    },
    enabled: !!currentUser?.account_id
  });

  // Fetch current plan
  const { data: currentPlan } = useQuery({
    queryKey: ["billing-plan", account?.plan_id],
    queryFn: async () => {
      if (!account?.plan_id) return null;
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("id", account.plan_id)
        .single();
      if (error) throw error;
      return data as SubscriptionPlan;
    },
    enabled: !!account?.plan_id
  });

  // Fetch available plans
  const { data: availablePlans } = useQuery({
    queryKey: ["available-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .eq("plan_type", "base")
        .order("price", { ascending: true });
      if (error) throw error;
      return data as SubscriptionPlan[];
    }
  });

  // Fetch usage stats
  const { data: usageStats } = useQuery({
    queryKey: ["billing-usage", currentUser?.account_id],
    queryFn: async () => {
      if (!currentUser?.account_id) return null;
      
      const [clientsResult, usersResult, aiUsageResult] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("account_id", currentUser.account_id),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("account_id", currentUser.account_id),
        supabase.from("ai_usage_logs").select("id", { count: "exact", head: true }).eq("account_id", currentUser.account_id)
      ]);
      
      return {
        clients: clientsResult.count || 0,
        users: usersResult.count || 0,
        aiAnalyses: aiUsageResult.count || 0
      };
    },
    enabled: !!currentUser?.account_id
  });

  // Load invoices from Asaas
  const loadInvoices = async () => {
    if (!account?.asaas_customer_id) return;
    
    setLoadingInvoices(true);
    try {
      const result = await listPayments({ customer: account.asaas_customer_id, limit: 50 });
      if (result.data?.data) {
        setInvoices(result.data.data as Invoice[]);
      }
    } catch (err) {
      console.error("Error loading invoices:", err);
      toast.error("Erro ao carregar faturas");
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    if (account?.asaas_customer_id) {
      loadInvoices();
    }
  }, [account?.asaas_customer_id]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
      RECEIVED: { label: "Pago", variant: "default", icon: CheckCircle2 },
      CONFIRMED: { label: "Confirmado", variant: "default", icon: CheckCircle2 },
      PENDING: { label: "Pendente", variant: "secondary", icon: Clock },
      OVERDUE: { label: "Vencido", variant: "destructive", icon: AlertTriangle },
      REFUNDED: { label: "Estornado", variant: "outline", icon: Ban },
    };
    
    const config = statusConfig[status] || { label: PAYMENT_STATUS_LABELS[status] || status, variant: "outline" as const, icon: Clock };
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getSubscriptionStatusBadge = () => {
    if (!account) return null;
    
    const status = account.subscription_status || "trial";
    
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      trial: { label: "Período de teste", variant: "secondary" },
      active: { label: "Ativa", variant: "default" },
      cancelled: { label: "Cancelada", variant: "destructive" },
      past_due: { label: "Pagamento pendente", variant: "destructive" },
      paused: { label: "Pausada", variant: "outline" },
    };
    
    const config = statusConfig[status] || { label: status, variant: "outline" as const };
    
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTrialInfo = () => {
    if (!account?.trial_ends_at) return null;
    
    const trialEnd = new Date(account.trial_ends_at);
    const daysLeft = differenceInDays(trialEnd, new Date());
    const isExpired = isPast(trialEnd);
    
    if (isExpired) {
      return (
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">Período de teste expirado</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-2 text-primary">
        <Calendar className="h-4 w-4" />
        <span className="text-sm font-medium">
          {daysLeft === 0 
            ? "Último dia do período de teste" 
            : `${daysLeft} ${daysLeft === 1 ? "dia restante" : "dias restantes"} de teste`}
        </span>
      </div>
    );
  };

  const getPlanIcon = (planName: string) => {
    const name = planName?.toLowerCase() || "";
    if (name.includes("enterprise") || name.includes("business")) return Building2;
    if (name.includes("pro") || name.includes("premium")) return Crown;
    if (name.includes("starter") || name.includes("básico")) return Zap;
    return Sparkles;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
  };

  if (userLoading || accountLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  const PlanIcon = currentPlan ? getPlanIcon(currentPlan.name) : Sparkles;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-primary" />
            Portal de Cobrança
          </h1>
          <p className="text-muted-foreground">
            Gerencie seu plano, visualize faturas e acompanhe seu uso
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2">
              <Receipt className="h-4 w-4" />
              Faturas
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2">
              <Package className="h-4 w-4" />
              Planos
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Current Plan Card */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <PlanIcon className="h-5 w-5 text-primary" />
                      Seu Plano
                    </CardTitle>
                    {getSubscriptionStatusBadge()}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentPlan ? (
                    <>
                      <div>
                        <h3 className="text-2xl font-bold">{currentPlan.name}</h3>
                        <p className="text-muted-foreground text-sm">{currentPlan.description}</p>
                      </div>
                      
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-primary">
                          {formatPrice(currentPlan.price)}
                        </span>
                        <span className="text-muted-foreground">/mês</span>
                      </div>

                      {account?.subscription_status === "trial" && getTrialInfo()}

                      <Separator />

                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Limites do Plano</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{currentPlan.max_clients || "∞"} clientes</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{currentPlan.max_users || "∞"} usuários</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                            <span>{currentPlan.max_ai_analyses || "∞"} análises IA</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <span>{currentPlan.max_whatsapp_connections || "∞"} WhatsApp</span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">Nenhum plano selecionado</p>
                      <Button className="mt-4" onClick={() => setActiveTab("plans")}>
                        Escolher Plano
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Usage Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Uso Atual
                  </CardTitle>
                  <CardDescription>
                    Acompanhe o consumo dos recursos do seu plano
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {usageStats ? (
                    <>
                      <UsageBar
                        label="Clientes"
                        current={usageStats.clients}
                        max={currentPlan?.max_clients || null}
                        icon={Users}
                      />
                      <UsageBar
                        label="Usuários"
                        current={usageStats.users}
                        max={currentPlan?.max_users || null}
                        icon={Users}
                      />
                      <UsageBar
                        label="Análises de IA"
                        current={usageStats.aiAnalyses}
                        max={currentPlan?.max_ai_analyses || null}
                        icon={Sparkles}
                      />
                    </>
                  ) : (
                    <div className="space-y-3">
                      <Skeleton className="h-12" />
                      <Skeleton className="h-12" />
                      <Skeleton className="h-12" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Invoices */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    Últimas Faturas
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("invoices")}>
                    Ver todas
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingInvoices ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                ) : invoices.length > 0 ? (
                  <div className="space-y-3">
                    {invoices.slice(0, 3).map((invoice) => (
                      <InvoiceRow key={invoice.id} invoice={invoice} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma fatura encontrada</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-primary" />
                      Histórico de Faturas
                    </CardTitle>
                    <CardDescription>
                      Visualize e baixe suas faturas anteriores
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadInvoices}
                    disabled={loadingInvoices}
                  >
                    {loadingInvoices ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingInvoices ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                ) : invoices.length > 0 ? (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {invoices.map((invoice, index) => (
                        <motion.div
                          key={invoice.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <InvoiceRow invoice={invoice} expanded />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <EmptyState
                    icon={Receipt}
                    title="Nenhuma fatura"
                    description={
                      account?.asaas_customer_id
                        ? "Você ainda não possui faturas registradas"
                        : "Configure um método de pagamento para visualizar faturas"
                    }
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              {availablePlans?.map((plan) => {
                const isCurrentPlan = plan.id === currentPlan?.id;
                const PIcon = getPlanIcon(plan.name);
                
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className={`relative overflow-hidden ${isCurrentPlan ? "border-primary ring-2 ring-primary/20" : ""}`}>
                      {isCurrentPlan && (
                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-medium rounded-bl-lg">
                          Atual
                        </div>
                      )}
                      
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <PIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle>{plan.name}</CardTitle>
                            <CardDescription>{plan.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
                          <span className="text-muted-foreground text-sm">/mês</span>
                        </div>
                        
                        <Separator />
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>{plan.max_clients || "Ilimitados"} clientes</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>{plan.max_users || "Ilimitados"} usuários</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>{plan.max_ai_analyses || "Ilimitadas"} análises IA/mês</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>{plan.max_whatsapp_connections || "Ilimitadas"} conexões WhatsApp</span>
                          </div>
                        </div>
                        
                        <Button 
                          className="w-full" 
                          variant={isCurrentPlan ? "outline" : "default"}
                          disabled={isCurrentPlan}
                        >
                          {isCurrentPlan ? "Plano Atual" : "Selecionar Plano"}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
  );
}

// Usage Bar Component
function UsageBar({ 
  label, 
  current, 
  max, 
  icon: Icon 
}: { 
  label: string; 
  current: number; 
  max: number | null; 
  icon: typeof Users;
}) {
  const percentage = max ? Math.min((current / max) * 100, 100) : 0;
  const isUnlimited = !max;
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{label}</span>
        </div>
        <span className={`font-medium ${isAtLimit ? "text-destructive" : isNearLimit ? "text-amber-500" : ""}`}>
          {current} {isUnlimited ? "" : `/ ${max}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`h-full rounded-full ${
              isAtLimit ? "bg-destructive" : isNearLimit ? "bg-amber-500" : "bg-primary"
            }`}
          />
        </div>
      )}
    </div>
  );
}

// Invoice Row Component
function InvoiceRow({ invoice, expanded = false }: { invoice: Invoice; expanded?: boolean }) {
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
      RECEIVED: { label: "Pago", variant: "default", icon: CheckCircle2 },
      CONFIRMED: { label: "Confirmado", variant: "default", icon: CheckCircle2 },
      PENDING: { label: "Pendente", variant: "secondary", icon: Clock },
      OVERDUE: { label: "Vencido", variant: "destructive", icon: AlertTriangle },
      REFUNDED: { label: "Estornado", variant: "outline", icon: Ban },
    };
    
    const config = statusConfig[status] || { label: PAYMENT_STATUS_LABELS[status] || status, variant: "outline" as const, icon: Clock };
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="font-medium text-sm">{invoice.description || "Fatura"}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Vencimento: {formatDate(invoice.dueDate)}</span>
            {invoice.paymentDate && (
              <>
                <span>•</span>
                <span>Pago em: {formatDate(invoice.paymentDate)}</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-semibold">{formatPrice(invoice.value)}</p>
          <p className="text-xs text-muted-foreground">
            {BILLING_TYPE_LABELS[invoice.billingType] || invoice.billingType}
          </p>
        </div>
        
        {getStatusBadge(invoice.status)}
        
        {expanded && (
          <div className="flex items-center gap-2">
            {invoice.invoiceUrl && (
              <Button variant="ghost" size="icon" asChild>
                <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            {invoice.bankSlipUrl && (
              <Button variant="ghost" size="icon" asChild>
                <a href={invoice.bankSlipUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
