import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, Check, Crown, Rocket, Building2, AlertTriangle, 
  CreditCard, QrCode, FileText, ArrowRight, Shield, Zap 
} from "lucide-react";
import { toast } from "sonner";
import { useAsaas } from "@/hooks/useAsaas";
import { format, addMonths } from "date-fns";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_period: string;
  features: unknown;
  max_clients: number | null;
  max_users: number | null;
  max_ai_analyses: number | null;
  plan_type: string;
}

type PaymentMethod = "PIX" | "BOLETO" | "CREDIT_CARD";

export default function ChoosePlan() {
  const navigate = useNavigate();
  const { 
    createPayment, getPixQrCode, createPaymentWithCard, 
    getOrCreateAsaasCustomer, getBoletoUrl, loading: asaasLoading 
  } = useAsaas();
  
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [step, setStep] = useState<"plans" | "payment">("plans");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [processing, setProcessing] = useState(false);
  
  // Payment data
  const [pixData, setPixData] = useState<{ qrCode: string; payload: string } | null>(null);
  const [boletoData, setBoletoData] = useState<{ barCode: string; identificationField: string; bankSlipUrl?: string } | null>(null);
  
  // Card form
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
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .eq("plan_type", "main")
        .order("price", { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error("Error loading plans:", error);
      toast.error("Erro ao carregar planos");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPlan(plan: SubscriptionPlan) {
    setSelectedPlan(plan);
    setStep("payment");
    setPixData(null);
    setBoletoData(null);
  }

  async function handlePayment() {
    if (!selectedPlan) return;
    
    setProcessing(true);
    setPixData(null);
    setBoletoData(null);

    try {
      // Get user account
      const { data: user } = await supabase
        .from("users")
        .select("account_id")
        .maybeSingle();

      if (!user?.account_id) {
        toast.error("Usuário não encontrado");
        return;
      }

      // Get or create Asaas customer
      const { customerId, error: customerError } = await getOrCreateAsaasCustomer(user.account_id);
      
      if (customerError || !customerId) {
        throw new Error(customerError || "Não foi possível criar cliente no Asaas");
      }

      const dueDate = format(addMonths(new Date(), 0), "yyyy-MM-dd");

      if (paymentMethod === "CREDIT_CARD") {
        // Validate card form
        if (!cardForm.holderName || !cardForm.number || !cardForm.expiryMonth || !cardForm.expiryYear || !cardForm.ccv) {
          toast.error("Preencha todos os dados do cartão");
          return;
        }
        if (!cardForm.cpfCnpj || !cardForm.email || !cardForm.phone || !cardForm.postalCode || !cardForm.addressNumber) {
          toast.error("Preencha todos os dados do titular");
          return;
        }

        const result = await createPaymentWithCard({
          customer: customerId,
          value: selectedPlan.price,
          dueDate,
          description: `Assinatura ${selectedPlan.name}`,
          externalReference: `account_${user.account_id}`,
          creditCard: {
            holderName: cardForm.holderName,
            number: cardForm.number.replace(/\D/g, ""),
            expiryMonth: cardForm.expiryMonth,
            expiryYear: cardForm.expiryYear,
            ccv: cardForm.ccv,
          },
          creditCardHolderInfo: {
            name: cardForm.holderName,
            email: cardForm.email,
            cpfCnpj: cardForm.cpfCnpj.replace(/\D/g, ""),
            postalCode: cardForm.postalCode.replace(/\D/g, ""),
            addressNumber: cardForm.addressNumber,
            phone: cardForm.phone.replace(/\D/g, ""),
          },
        });

        if (result.error) throw new Error(result.error);

        // Update account
        await supabase
          .from("accounts")
          .update({ plan_id: selectedPlan.id, subscription_status: "active" })
          .eq("id", user.account_id);

        toast.success("Pagamento aprovado! Bem-vindo ao plano " + selectedPlan.name);
        navigate("/dashboard");
        return;
      }

      // PIX or Boleto
      const result = await createPayment({
        customer: customerId,
        billingType: paymentMethod,
        value: selectedPlan.price,
        dueDate,
        description: `Assinatura ${selectedPlan.name}`,
        externalReference: `account_${user.account_id}`,
      });

      if (result.error) throw new Error(result.error);

      // Update account with pending status
      await supabase
        .from("accounts")
        .update({ plan_id: selectedPlan.id, subscription_status: "pending_payment" })
        .eq("id", user.account_id);

      if (paymentMethod === "PIX" && result.data?.id) {
        const pixResult = await getPixQrCode(result.data.id);
        if (pixResult.data) {
          setPixData({
            qrCode: pixResult.data.encodedImage,
            payload: pixResult.data.payload,
          });
        }
      }

      if (paymentMethod === "BOLETO" && result.data?.id) {
        const boletoResult = await getBoletoUrl(result.data.id);
        if (boletoResult.data) {
          setBoletoData({
            barCode: boletoResult.data.barCode,
            identificationField: boletoResult.data.identificationField,
            bankSlipUrl: result.data.bankSlipUrl,
          });
        }
      }

      toast.success("Cobrança gerada com sucesso!");
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Erro ao processar pagamento");
    } finally {
      setProcessing(false);
    }
  }

  function handleCopyPixCode() {
    if (pixData?.payload) {
      navigator.clipboard.writeText(pixData.payload);
      toast.success("Código PIX copiado!");
    }
  }

  function handleCopyBoleto() {
    if (boletoData?.identificationField) {
      navigator.clipboard.writeText(boletoData.identificationField);
      toast.success("Código do boleto copiado!");
    }
  }

  function getPlanIcon(name: string) {
    if (name.toLowerCase().includes("starter") || name.toLowerCase().includes("básico")) {
      return <Rocket className="h-6 w-6" />;
    }
    if (name.toLowerCase().includes("pro") || name.toLowerCase().includes("profissional")) {
      return <Crown className="h-6 w-6" />;
    }
    return <Building2 className="h-6 w-6" />;
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-2 rounded-full mb-4">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Seu período de teste expirou</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {step === "plans" ? "Escolha seu plano" : `Finalize sua assinatura`}
          </h1>
          <p className="text-muted-foreground">
            {step === "plans" 
              ? "Selecione o plano ideal para seu negócio" 
              : `Plano selecionado: ${selectedPlan?.name}`}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className={`flex items-center gap-2 ${step === "plans" ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${step === "plans" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              1
            </div>
            <span className="text-sm font-medium hidden sm:inline">Escolher plano</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className={`flex items-center gap-2 ${step === "payment" ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${step === "payment" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              2
            </div>
            <span className="text-sm font-medium hidden sm:inline">Pagamento</span>
          </div>
        </div>

        {step === "plans" && (
          <>
            {/* Plans Grid */}
            {plans.length === 0 ? (
              <Card className="max-w-md mx-auto">
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground mb-4">
                    Nenhum plano disponível no momento.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-3 gap-6">
                {plans.map((plan, index) => {
                  const isPopular = index === 1;
                  const features = (plan.features && typeof plan.features === "object" && Array.isArray(plan.features)) 
                    ? plan.features as string[] 
                    : [];

                  return (
                    <Card 
                      key={plan.id} 
                      className={`relative transition-all hover:shadow-lg cursor-pointer ${
                        isPopular ? "border-primary shadow-md ring-2 ring-primary/20" : ""
                      }`}
                      onClick={() => handleSelectPlan(plan)}
                    >
                      {isPopular && (
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                          Mais Popular
                        </Badge>
                      )}
                      <CardHeader className="text-center pb-2">
                        <div className="mx-auto mb-3 p-3 rounded-full bg-primary/10 text-primary w-fit">
                          {getPlanIcon(plan.name)}
                        </div>
                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                        <CardDescription>{plan.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-center">
                          <span className="text-4xl font-bold text-foreground">
                            {formatPrice(plan.price)}
                          </span>
                          <span className="text-muted-foreground">/mês</span>
                        </div>

                        <Separator />

                        <ul className="space-y-2 text-sm">
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                            <span>Até {plan.max_clients || "∞"} clientes</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                            <span>Até {plan.max_users || "∞"} usuários</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                            <span>{plan.max_ai_analyses?.toLocaleString() || "∞"} análises IA/mês</span>
                          </li>
                          {features.includes("whatsapp_integration") && (
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-500 shrink-0" />
                              <span>Integração WhatsApp</span>
                            </li>
                          )}
                          {features.includes("custom_fields") && (
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-500 shrink-0" />
                              <span>Campos personalizados</span>
                            </li>
                          )}
                          {features.includes("live_tracking") && (
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-500 shrink-0" />
                              <span>Tracking de lives</span>
                            </li>
                          )}
                        </ul>
                      </CardContent>
                      <CardFooter>
                        <Button className="w-full" variant={isPopular ? "default" : "outline"}>
                          Selecionar
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-6 mt-8 text-muted-foreground text-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Pagamento seguro</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span>Ativação imediata</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span>PIX, Boleto ou Cartão</span>
              </div>
            </div>
          </>
        )}

        {step === "payment" && selectedPlan && (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Finalizar pagamento</CardTitle>
                    <CardDescription>
                      {selectedPlan.name} - {formatPrice(selectedPlan.price)}/mês
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setStep("plans")}>
                    Trocar plano
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {!pixData && !boletoData ? (
                  <>
                    <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="PIX" className="gap-2">
                          <QrCode className="h-4 w-4" />
                          PIX
                        </TabsTrigger>
                        <TabsTrigger value="BOLETO" className="gap-2">
                          <FileText className="h-4 w-4" />
                          Boleto
                        </TabsTrigger>
                        <TabsTrigger value="CREDIT_CARD" className="gap-2">
                          <CreditCard className="h-4 w-4" />
                          Cartão
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="PIX" className="mt-4">
                        <div className="text-center py-4">
                          <QrCode className="h-12 w-12 text-primary mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Clique em "Pagar" para gerar o QR Code do PIX
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="BOLETO" className="mt-4">
                        <div className="text-center py-4">
                          <FileText className="h-12 w-12 text-primary mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Clique em "Pagar" para gerar o boleto bancário
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="CREDIT_CARD" className="mt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <Label>Nome no cartão</Label>
                            <Input
                              placeholder="NOME COMPLETO"
                              value={cardForm.holderName}
                              onChange={(e) => setCardForm(f => ({ ...f, holderName: e.target.value.toUpperCase() }))}
                            />
                          </div>
                          <div className="col-span-2">
                            <Label>Número do cartão</Label>
                            <Input
                              placeholder="0000 0000 0000 0000"
                              value={cardForm.number}
                              onChange={(e) => setCardForm(f => ({ ...f, number: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label>Validade</Label>
                            <div className="flex gap-2">
                              <Input
                                placeholder="MM"
                                maxLength={2}
                                value={cardForm.expiryMonth}
                                onChange={(e) => setCardForm(f => ({ ...f, expiryMonth: e.target.value }))}
                              />
                              <Input
                                placeholder="AAAA"
                                maxLength={4}
                                value={cardForm.expiryYear}
                                onChange={(e) => setCardForm(f => ({ ...f, expiryYear: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div>
                            <Label>CVV</Label>
                            <Input
                              placeholder="123"
                              maxLength={4}
                              value={cardForm.ccv}
                              onChange={(e) => setCardForm(f => ({ ...f, ccv: e.target.value }))}
                            />
                          </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <Label>CPF/CNPJ</Label>
                            <Input
                              placeholder="000.000.000-00"
                              value={cardForm.cpfCnpj}
                              onChange={(e) => setCardForm(f => ({ ...f, cpfCnpj: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label>E-mail</Label>
                            <Input
                              type="email"
                              placeholder="seu@email.com"
                              value={cardForm.email}
                              onChange={(e) => setCardForm(f => ({ ...f, email: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label>Telefone</Label>
                            <Input
                              placeholder="(00) 00000-0000"
                              value={cardForm.phone}
                              onChange={(e) => setCardForm(f => ({ ...f, phone: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label>CEP</Label>
                            <Input
                              placeholder="00000-000"
                              value={cardForm.postalCode}
                              onChange={(e) => setCardForm(f => ({ ...f, postalCode: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label>Número</Label>
                            <Input
                              placeholder="123"
                              value={cardForm.addressNumber}
                              onChange={(e) => setCardForm(f => ({ ...f, addressNumber: e.target.value }))}
                            />
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>

                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handlePayment}
                      disabled={processing || asaasLoading}
                    >
                      {processing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Processando...
                        </>
                      ) : (
                        <>
                          Pagar {formatPrice(selectedPlan.price)}
                        </>
                      )}
                    </Button>
                  </>
                ) : pixData ? (
                  <div className="text-center space-y-4">
                    <div className="bg-white p-4 rounded-lg inline-block mx-auto">
                      <img 
                        src={`data:image/png;base64,${pixData.qrCode}`} 
                        alt="QR Code PIX" 
                        className="w-48 h-48"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Escaneie o QR Code ou copie o código abaixo
                      </p>
                      <div className="flex gap-2">
                        <Input 
                          value={pixData.payload} 
                          readOnly 
                          className="font-mono text-xs"
                        />
                        <Button variant="outline" onClick={handleCopyPixCode}>
                          Copiar
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Após o pagamento, seu acesso será liberado automaticamente.
                    </p>
                    <Button variant="outline" onClick={() => navigate("/dashboard")}>
                      Já paguei, ir para o sistema
                    </Button>
                  </div>
                ) : boletoData ? (
                  <div className="text-center space-y-4">
                    <FileText className="h-16 w-16 text-primary mx-auto" />
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Copie o código de barras ou baixe o boleto
                      </p>
                      <div className="flex gap-2">
                        <Input 
                          value={boletoData.identificationField} 
                          readOnly 
                          className="font-mono text-xs"
                        />
                        <Button variant="outline" onClick={handleCopyBoleto}>
                          Copiar
                        </Button>
                      </div>
                    </div>
                    {boletoData.bankSlipUrl && (
                      <Button asChild>
                        <a href={boletoData.bankSlipUrl} target="_blank" rel="noopener noreferrer">
                          Baixar Boleto PDF
                        </a>
                      </Button>
                    )}
                    <p className="text-sm text-muted-foreground">
                      O boleto pode levar até 3 dias úteis para compensar.
                    </p>
                    <Button variant="outline" onClick={() => navigate("/dashboard")}>
                      Já paguei, ir para o sistema
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>Dúvidas? Entre em contato com nosso suporte.</p>
        </div>
      </div>
    </div>
  );
}
