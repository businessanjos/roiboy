import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAsaas } from "@/hooks/useAsaas";
import { 
  CreditCard, 
  Calendar, 
  AlertTriangle, 
  Check, 
  Loader2,
  Crown,
  Zap,
  Building2,
  Sparkles,
  Receipt,
  QrCode,
  FileText
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, differenceInDays, isPast, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Account {
  id: string;
  name: string;
  plan_id: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
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
  features: any;
}

export function SubscriptionManager() {
  const { toast } = useToast();
  const { createPayment, getPixQrCode, loading: asaasLoading } = useAsaas();
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'BOLETO'>('PIX');
  const [generatingPayment, setGeneratingPayment] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string; payload: string } | null>(null);

  useEffect(() => {
    loadAccountAndPlans();
  }, []);

  const loadAccountAndPlans = async () => {
    setLoading(true);
    try {
      // Load account
      const { data: accountData, error: accountError } = await supabase
        .from("accounts")
        .select("*")
        .single();

      if (accountError) throw accountError;
      setAccount(accountData);

      // Load available plans
      const { data: plansData, error: plansError } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (plansError) throw plansError;
      setAvailablePlans(plansData || []);

      // Find current plan
      if (accountData?.plan_id && plansData) {
        const plan = plansData.find(p => p.id === accountData.plan_id);
        setCurrentPlan(plan || null);
      }
    } catch (err) {
      console.error("Error loading subscription data:", err);
    }
    setLoading(false);
  };

  const handleGeneratePayment = async () => {
    if (!account || !currentPlan) {
      toast({
        title: "Erro",
        description: "Dados da conta ou plano não encontrados",
        variant: "destructive",
      });
      return;
    }

    setGeneratingPayment(true);
    setPixData(null);
    
    try {
      const dueDate = format(addMonths(new Date(), 0), 'yyyy-MM-dd');
      
      const result = await createPayment({
        customer: account.id,
        billingType: paymentMethod,
        value: currentPlan.price,
        dueDate,
        description: `Assinatura ${currentPlan.name} - ${account.name}`,
        externalReference: account.id,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      if (paymentMethod === 'PIX' && result.data?.id) {
        const pixResult = await getPixQrCode(result.data.id);
        if (pixResult.data) {
          setPixData({
            qrCode: pixResult.data.encodedImage,
            payload: pixResult.data.payload,
          });
        }
      }

      toast({
        title: "Cobrança gerada",
        description: "A cobrança foi gerada com sucesso!",
      });
      setIsPaymentDialogOpen(true);
    } catch (error: any) {
      console.error("Error generating payment:", error);
      toast({
        title: "Erro ao gerar cobrança",
        description: error.message || "Não foi possível gerar a cobrança",
        variant: "destructive",
      });
    } finally {
      setGeneratingPayment(false);
    }
  };

  const handleCopyPixCode = () => {
    if (pixData?.payload) {
      navigator.clipboard.writeText(pixData.payload);
      toast({
        title: "Copiado!",
        description: "Código PIX copiado para a área de transferência",
      });
    }
  };

  const handleCancelSubscription = async () => {
    if (!account) return;
    
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("accounts")
        .update({ subscription_status: "cancelled" })
        .eq("id", account.id);

      if (error) throw error;

      setAccount(prev => prev ? { ...prev, subscription_status: "cancelled" } : null);
      toast({
        title: "Assinatura cancelada",
        description: "Sua assinatura foi cancelada. Você ainda terá acesso até o fim do período atual.",
      });
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      toast({
        title: "Erro ao cancelar",
        description: "Não foi possível cancelar a assinatura. Tente novamente.",
        variant: "destructive",
      });
    }
    setCancelling(false);
  };

  const getStatusBadge = () => {
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
      <div className="flex items-center gap-2 text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span className="text-sm">
          {daysLeft === 0 
            ? "Último dia do período de teste" 
            : `${daysLeft} ${daysLeft === 1 ? "dia restante" : "dias restantes"} de teste`}
        </span>
      </div>
    );
  };

  const getPlanIcon = (planName: string) => {
    const name = planName.toLowerCase();
    if (name.includes("enterprise") || name.includes("business")) return Building2;
    if (name.includes("pro") || name.includes("premium")) return Crown;
    if (name.includes("starter") || name.includes("básico")) return Zap;
    return Sparkles;
  };

  const formatPrice = (price: number, billingPeriod: string) => {
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
    
    const periodLabels: Record<string, string> = {
      monthly: "/mês",
      quarterly: "/trimestre",
      semiannual: "/semestre",
      annual: "/ano",
      one_time: "",
    };
    
    return `${formatted}${periodLabels[billingPeriod] || ""}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Sua Assinatura
              </CardTitle>
              <CardDescription>
                Gerencie seu plano e informações de pagamento
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {account?.subscription_status === "trial" && getTrialInfo()}
          
          {currentPlan ? (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = getPlanIcon(currentPlan.name);
                    return <Icon className="h-8 w-8 text-primary" />;
                  })()}
                  <div>
                    <h3 className="font-semibold text-lg">{currentPlan.name}</h3>
                    {currentPlan.description && (
                      <p className="text-sm text-muted-foreground">{currentPlan.description}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    {formatPrice(currentPlan.price, currentPlan.billing_period)}
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                {currentPlan.max_clients && (
                  <div>
                    <p className="text-muted-foreground">Clientes</p>
                    <p className="font-medium">
                      {currentPlan.max_clients === 999999 ? "Ilimitado" : `Até ${currentPlan.max_clients}`}
                    </p>
                  </div>
                )}
                {currentPlan.max_users && (
                  <div>
                    <p className="text-muted-foreground">Usuários</p>
                    <p className="font-medium">
                      {currentPlan.max_users === 999999 ? "Ilimitado" : `Até ${currentPlan.max_users}`}
                    </p>
                  </div>
                )}
                {currentPlan.max_ai_analyses && (
                  <div>
                    <p className="text-muted-foreground">Análises IA/mês</p>
                    <p className="font-medium">
                      {currentPlan.max_ai_analyses === 999999 ? "Ilimitado" : currentPlan.max_ai_analyses.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Payment Generation Section */}
              <Separator />
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <Label className="text-sm mb-2 block">Método de pagamento</Label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'PIX' | 'BOLETO')}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">
                        <span className="flex items-center gap-2">
                          <QrCode className="h-4 w-4" />
                          PIX
                        </span>
                      </SelectItem>
                      <SelectItem value="BOLETO">
                        <span className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Boleto
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleGeneratePayment} 
                  disabled={generatingPayment}
                  className="gap-2"
                >
                  {generatingPayment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Receipt className="h-4 w-4" />
                  )}
                  Gerar Cobrança
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Nenhum plano ativo</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Escolha um plano para desbloquear todos os recursos
              </p>
              <Button>Escolher um plano</Button>
            </div>
          )}
        </CardContent>
        
        {currentPlan && account?.subscription_status !== "cancelled" && (
          <CardFooter className="flex justify-between border-t pt-6">
            <Button variant="outline">
              Trocar de plano
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  Cancelar assinatura
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar assinatura</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja cancelar sua assinatura? Você ainda terá acesso 
                    até o fim do período de faturamento atual, mas não será renovada automaticamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Manter assinatura</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelSubscription}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={cancelling}
                  >
                    {cancelling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Cancelando...
                      </>
                    ) : (
                      "Cancelar assinatura"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        )}
        
        {account?.subscription_status === "cancelled" && (
          <CardFooter className="border-t pt-6">
            <div className="w-full bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Assinatura cancelada</p>
                  <p className="text-sm text-muted-foreground">
                    Sua assinatura foi cancelada. Você pode reativar a qualquer momento.
                  </p>
                </div>
              </div>
              <Button className="mt-3" onClick={() => {/* TODO: Reactivate flow */}}>
                Reativar assinatura
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      {/* Available Plans */}
      {availablePlans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Planos Disponíveis</CardTitle>
            <CardDescription>
              Compare os planos e escolha o ideal para você
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availablePlans.map((plan) => {
                const Icon = getPlanIcon(plan.name);
                const isCurrent = plan.id === currentPlan?.id;
                
                return (
                  <div 
                    key={plan.id}
                    className={`relative rounded-lg border-2 p-4 transition-all ${
                      isCurrent 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {isCurrent && (
                      <Badge className="absolute -top-2 left-4">Plano atual</Badge>
                    )}
                    
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{plan.name}</h3>
                    </div>
                    
                    <p className="text-2xl font-bold mb-2">
                      {formatPrice(plan.price, plan.billing_period)}
                    </p>
                    
                    {plan.description && (
                      <p className="text-sm text-muted-foreground mb-4">
                        {plan.description}
                      </p>
                    )}
                    
                    <ul className="space-y-2 text-sm mb-4">
                      {plan.max_clients && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-success" />
                          {plan.max_clients === 999999 ? "Clientes ilimitados" : `Até ${plan.max_clients} clientes`}
                        </li>
                      )}
                      {plan.max_users && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-success" />
                          {plan.max_users === 999999 ? "Usuários ilimitados" : `Até ${plan.max_users} usuários`}
                        </li>
                      )}
                      {plan.max_ai_analyses && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-success" />
                          {plan.max_ai_analyses === 999999 ? "Análises IA ilimitadas" : `${plan.max_ai_analyses.toLocaleString()} análises IA/mês`}
                        </li>
                      )}
                    </ul>
                    
                    <Button 
                      className="w-full" 
                      variant={isCurrent ? "outline" : "default"}
                      disabled={isCurrent}
                    >
                      {isCurrent ? "Plano atual" : "Escolher plano"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PIX Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento via {paymentMethod}</DialogTitle>
            <DialogDescription>
              {paymentMethod === 'PIX' 
                ? 'Escaneie o QR Code ou copie o código para pagar'
                : 'Copie o código de barras do boleto'
              }
            </DialogDescription>
          </DialogHeader>
          
          {paymentMethod === 'PIX' && pixData ? (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img 
                  src={`data:image/png;base64,${pixData.qrCode}`} 
                  alt="QR Code PIX"
                  className="w-48 h-48"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Código PIX (Copia e Cola)</Label>
                <div className="flex gap-2">
                  <Input 
                    value={pixData.payload} 
                    readOnly 
                    className="text-xs font-mono"
                  />
                  <Button variant="outline" size="sm" onClick={handleCopyPixCode}>
                    Copiar
                  </Button>
                </div>
              </div>
            </div>
          ) : generatingPayment ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">Gerando cobrança...</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <Receipt className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">Cobrança gerada com sucesso!</p>
              {paymentMethod === 'BOLETO' && (
                <p className="text-xs text-muted-foreground mt-1">
                  O boleto será enviado para seu email.
                </p>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
