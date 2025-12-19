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
  const { createPayment, getPixQrCode, createPaymentWithCard, loading: asaasLoading } = useAsaas();
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'BOLETO' | 'CREDIT_CARD'>('PIX');
  const [generatingPayment, setGeneratingPayment] = useState(false);
  const [selectingPlan, setSelectingPlan] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string; payload: string } | null>(null);
  
  // Credit card form state
  const [cardForm, setCardForm] = useState({
    holderName: "",
    number: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
    cpfCnpj: "",
    email: "",
    phone: "",
    postalCode: "",
    addressNumber: "",
  });

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

    // If credit card, open the card dialog
    if (paymentMethod === 'CREDIT_CARD') {
      setIsCardDialogOpen(true);
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

  const handleCardPayment = async () => {
    if (!account || !currentPlan) return;

    // Validate card form
    if (!cardForm.holderName || !cardForm.number || !cardForm.expiryMonth || !cardForm.expiryYear || !cardForm.ccv) {
      toast({
        title: "Erro",
        description: "Preencha todos os dados do cartão",
        variant: "destructive",
      });
      return;
    }

    if (!cardForm.cpfCnpj || !cardForm.email || !cardForm.phone || !cardForm.postalCode || !cardForm.addressNumber) {
      toast({
        title: "Erro",
        description: "Preencha todos os dados do titular",
        variant: "destructive",
      });
      return;
    }

    setGeneratingPayment(true);
    
    try {
      const dueDate = format(new Date(), 'yyyy-MM-dd');
      
      const result = await createPaymentWithCard({
        customer: account.id,
        value: currentPlan.price,
        dueDate,
        description: `Assinatura ${currentPlan.name} - ${account.name}`,
        externalReference: account.id,
        creditCard: {
          holderName: cardForm.holderName,
          number: cardForm.number.replace(/\D/g, ''),
          expiryMonth: cardForm.expiryMonth,
          expiryYear: cardForm.expiryYear,
          ccv: cardForm.ccv,
        },
        creditCardHolderInfo: {
          name: cardForm.holderName,
          email: cardForm.email,
          cpfCnpj: cardForm.cpfCnpj.replace(/\D/g, ''),
          postalCode: cardForm.postalCode.replace(/\D/g, ''),
          addressNumber: cardForm.addressNumber,
          phone: cardForm.phone.replace(/\D/g, ''),
        },
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: "Pagamento realizado",
        description: "O pagamento foi processado com sucesso!",
      });
      
      setIsCardDialogOpen(false);
      // Reset form
      setCardForm({
        holderName: "",
        number: "",
        expiryMonth: "",
        expiryYear: "",
        ccv: "",
        cpfCnpj: "",
        email: "",
        phone: "",
        postalCode: "",
        addressNumber: "",
      });
      
      // Refresh data
      loadAccountAndPlans();
    } catch (error: any) {
      console.error("Error processing card payment:", error);
      toast({
        title: "Erro no pagamento",
        description: error.message || "Não foi possível processar o pagamento",
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

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (!account) return;
    
    setSelectingPlan(true);
    try {
      const { error } = await supabase
        .from("accounts")
        .update({ 
          plan_id: plan.id,
          subscription_status: account.subscription_status === "cancelled" ? "active" : account.subscription_status
        })
        .eq("id", account.id);

      if (error) throw error;

      setAccount(prev => prev ? { ...prev, plan_id: plan.id } : null);
      setCurrentPlan(plan);
      
      toast({
        title: "Plano selecionado!",
        description: `Você selecionou o plano ${plan.name}. Agora escolha a forma de pagamento.`,
      });
    } catch (err) {
      console.error("Error selecting plan:", err);
      toast({
        title: "Erro ao selecionar plano",
        description: "Não foi possível selecionar o plano. Tente novamente.",
        variant: "destructive",
      });
    }
    setSelectingPlan(false);
  };

  const scrollToPlans = () => {
    const plansSection = document.getElementById('available-plans');
    if (plansSection) {
      plansSection.scrollIntoView({ behavior: 'smooth' });
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
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'PIX' | 'BOLETO' | 'CREDIT_CARD')}>
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
                      <SelectItem value="CREDIT_CARD">
                        <span className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Cartão de Crédito
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
                  {paymentMethod === 'CREDIT_CARD' ? 'Pagar com Cartão' : 'Gerar Cobrança'}
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
              <Button onClick={scrollToPlans}>Escolher um plano</Button>
            </div>
          )}
        </CardContent>
        
        {currentPlan && account?.subscription_status !== "cancelled" && (
          <CardFooter className="flex justify-between border-t pt-6">
            <Button variant="outline" onClick={scrollToPlans}>
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

      {/* Payment Methods Card - Always visible */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Métodos de Pagamento
          </CardTitle>
          <CardDescription>
            Gerencie suas formas de pagamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Adicionar Cartão de Crédito</h4>
                <p className="text-sm text-muted-foreground">
                  Cadastre um cartão para pagamentos recorrentes
                </p>
              </div>
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => setIsCardDialogOpen(true)}
              >
                <CreditCard className="h-4 w-4" />
                Adicionar Cartão
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Também aceitamos PIX e Boleto. Escolha o método na hora do pagamento.</p>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      {availablePlans.length > 0 && (
        <Card id="available-plans">
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
                      disabled={isCurrent || selectingPlan}
                      onClick={() => handleSelectPlan(plan)}
                    >
                      {selectingPlan ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
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

      {/* Credit Card Dialog */}
      <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {currentPlan ? "Pagamento com Cartão de Crédito" : "Adicionar Cartão de Crédito"}
            </DialogTitle>
            <DialogDescription>
              {currentPlan 
                ? `Preencha os dados do cartão para processar o pagamento de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(currentPlan.price)}`
                : "Cadastre os dados do seu cartão para pagamentos futuros"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Card Details */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Dados do Cartão</h4>
              <div className="space-y-2">
                <Label htmlFor="card-holder">Nome no Cartão</Label>
                <Input
                  id="card-holder"
                  value={cardForm.holderName}
                  onChange={(e) => setCardForm(prev => ({ ...prev, holderName: e.target.value.toUpperCase() }))}
                  placeholder="NOME COMO ESTÁ NO CARTÃO"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="card-number">Número do Cartão</Label>
                <Input
                  id="card-number"
                  value={cardForm.number}
                  onChange={(e) => setCardForm(prev => ({ ...prev, number: e.target.value.replace(/\D/g, '').slice(0, 16) }))}
                  placeholder="0000 0000 0000 0000"
                  maxLength={16}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="card-month">Mês</Label>
                  <Input
                    id="card-month"
                    value={cardForm.expiryMonth}
                    onChange={(e) => setCardForm(prev => ({ ...prev, expiryMonth: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                    placeholder="MM"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="card-year">Ano</Label>
                  <Input
                    id="card-year"
                    value={cardForm.expiryYear}
                    onChange={(e) => setCardForm(prev => ({ ...prev, expiryYear: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    placeholder="AAAA"
                    maxLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="card-ccv">CVV</Label>
                  <Input
                    id="card-ccv"
                    type="password"
                    value={cardForm.ccv}
                    onChange={(e) => setCardForm(prev => ({ ...prev, ccv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    placeholder="000"
                    maxLength={4}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Holder Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Dados do Titular</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="holder-cpf">CPF/CNPJ</Label>
                  <Input
                    id="holder-cpf"
                    value={cardForm.cpfCnpj}
                    onChange={(e) => setCardForm(prev => ({ ...prev, cpfCnpj: e.target.value }))}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="holder-phone">Telefone</Label>
                  <Input
                    id="holder-phone"
                    value={cardForm.phone}
                    onChange={(e) => setCardForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="holder-email">E-mail</Label>
                <Input
                  id="holder-email"
                  type="email"
                  value={cardForm.email}
                  onChange={(e) => setCardForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="holder-cep">CEP</Label>
                  <Input
                    id="holder-cep"
                    value={cardForm.postalCode}
                    onChange={(e) => setCardForm(prev => ({ ...prev, postalCode: e.target.value }))}
                    placeholder="00000-000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="holder-number">Número</Label>
                  <Input
                    id="holder-number"
                    value={cardForm.addressNumber}
                    onChange={(e) => setCardForm(prev => ({ ...prev, addressNumber: e.target.value }))}
                    placeholder="123"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCardDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCardPayment} disabled={generatingPayment || !currentPlan}>
              {generatingPayment ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : currentPlan ? (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pagar {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(currentPlan.price)}
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Salvar Cartão
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
