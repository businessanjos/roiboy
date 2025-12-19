import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Crown, Rocket, Building2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_period: string;
  features: unknown;
  max_clients: number | null;
  max_users: number | null;
  plan_type: string;
}

export default function ChoosePlan() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

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

  async function handleSelectPlan(planId: string) {
    setSelecting(planId);
    try {
      const { data: user } = await supabase
        .from("users")
        .select("account_id")
        .maybeSingle();

      if (!user?.account_id) {
        toast.error("Usuário não encontrado");
        return;
      }

      // Update account with selected plan
      const { error } = await supabase
        .from("accounts")
        .update({ 
          plan_id: planId,
          subscription_status: "pending_payment"
        })
        .eq("id", user.account_id);

      if (error) throw error;

      toast.success("Plano selecionado! Configure o pagamento para ativar.");
      navigate("/account-settings");
    } catch (error) {
      console.error("Error selecting plan:", error);
      toast.error("Erro ao selecionar plano");
    } finally {
      setSelecting(null);
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-2 rounded-full mb-6">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Seu período de teste expirou</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Escolha seu plano para continuar
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Selecione o plano ideal para seu negócio e continue aproveitando todos os recursos da plataforma.
          </p>
        </div>

        {/* Plans Grid */}
        {plans.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-4">
                Nenhum plano disponível no momento. Entre em contato com o suporte.
              </p>
              <Button variant="outline" onClick={() => navigate("/auth")}>
                Voltar ao login
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan, index) => {
              const isPopular = index === 1; // Middle plan is popular
              const features = (plan.features && typeof plan.features === 'object' && !Array.isArray(plan.features)) 
                ? plan.features as Record<string, boolean> 
                : {};

              return (
                <Card 
                  key={plan.id} 
                  className={`relative transition-all hover:shadow-lg ${
                    isPopular ? "border-primary shadow-md scale-105" : ""
                  }`}
                >
                  {isPopular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
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
                  <CardContent className="space-y-6">
                    {/* Price */}
                    <div className="text-center">
                      <span className="text-4xl font-bold text-foreground">
                        {formatPrice(plan.price)}
                      </span>
                      <span className="text-muted-foreground">
                        /{plan.billing_period === "monthly" ? "mês" : "ano"}
                      </span>
                    </div>

                    {/* Limits */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>Até {plan.max_clients || "∞"} clientes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>Até {plan.max_users || "∞"} usuários</span>
                      </div>
                      {features?.ai_analysis && (
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Análise com IA</span>
                        </div>
                      )}
                      {features?.whatsapp_integration && (
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Integração WhatsApp</span>
                        </div>
                      )}
                      {features?.custom_fields && (
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Campos personalizados</span>
                        </div>
                      )}
                    </div>

                    {/* CTA Button */}
                    <Button 
                      className="w-full" 
                      variant={isPopular ? "default" : "outline"}
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={selecting !== null}
                    >
                      {selecting === plan.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Selecionar plano
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-muted-foreground">
          <p>Precisa de ajuda? Entre em contato com nosso suporte.</p>
        </div>
      </div>
    </div>
  );
}
