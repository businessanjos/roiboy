import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  BarChart3,
  MessageSquare,
  Calendar,
  Target,
  Shield,
  ArrowRight,
  Check,
  Zap,
  TrendingUp,
  Award,
  Phone,
  ChevronDown,
  Menu,
  X,
  Crown,
  Rocket,
  Building2,
} from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  max_clients: number | null;
  max_users: number | null;
  max_whatsapp_connections: number | null;
  max_ai_analyses: number | null;
}

const Home = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    async function loadPlans() {
      const { data } = await supabase
        .from("subscription_plans")
        .select("id, name, description, price, max_clients, max_users, max_whatsapp_connections, max_ai_analyses")
        .eq("is_active", true)
        .eq("plan_type", "main")
        .order("price", { ascending: true });
      if (data) setPlans(data);
    }
    loadPlans();
  }, []);

  const features = [
    {
      icon: Users,
      title: "Gestão de Clientes",
      description: "Kanban visual, timeline de atividades, contratos, diagnóstico, campos personalizados e relacionamentos entre clientes.",
    },
    {
      icon: BarChart3,
      title: "Métricas Inteligentes",
      description: "ROIzômetro, E-Score e vNPS para medir engajamento, risco de churn e satisfação dos membros em tempo real.",
    },
    {
      icon: MessageSquare,
      title: "WhatsApp e Grupos",
      description: "Sincronize grupos, capture mensagens e use IA para analisar sentimentos, detectar eventos de vida e gerar insights.",
    },
    {
      icon: Calendar,
      title: "Eventos Completos",
      description: "Check-in QR Code, lista de presença, custos, brindes, checklist, feedback personalizado e galeria de mídias.",
    },
    {
      icon: Target,
      title: "Formulários e Pesquisas",
      description: "Crie formulários personalizados para captura de leads, pesquisas NPS, cadastros e muito mais.",
    },
    {
      icon: Shield,
      title: "Lembretes e Campanhas CX",
      description: "Campanhas de Momentos CX, lembretes automáticos de aniversário e datas especiais para encantar clientes.",
    },
  ];

  const benefits = [
    "Reduza o churn com alertas inteligentes de IA",
    "Sincronize grupos do WhatsApp automaticamente",
    "Gerencie clientes em Kanban visual",
    "Crie formulários e pesquisas personalizadas",
    "Envie campanhas de Momentos CX",
    "Controle eventos com check-in QR Code",
    "Tome decisões baseadas em dados reais",
    "Escale sua operação com eficiência",
  ];

  const stats = [
    { value: "40%", label: "Redução de Churn" },
    { value: "3x", label: "Mais Engajamento" },
    { value: "60%", label: "Menos Tempo Operacional" },
    { value: "100%", label: "Visibilidade dos Dados" },
  ];

  const getPlanIcon = (name: string) => {
    if (name.toLowerCase().includes("starter") || name.toLowerCase().includes("básico")) {
      return Rocket;
    }
    if (name.toLowerCase().includes("pro") || name.toLowerCase().includes("profissional")) {
      return Crown;
    }
    return Building2;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img src="/roy-logo.png" alt="ROY" className="h-8 w-auto" />
            <span className="text-xl font-bold text-foreground">ROY</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Funcionalidades
            </a>
            <a href="#benefits" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Benefícios
            </a>
            <a href="#cta" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Começar
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Entrar
            </Button>
            <Button onClick={() => navigate("/auth?tab=signup")}>
              Criar Conta
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background px-4 py-4 space-y-4">
            <a href="#features" className="block text-sm font-medium text-muted-foreground hover:text-foreground">
              Funcionalidades
            </a>
            <a href="#benefits" className="block text-sm font-medium text-muted-foreground hover:text-foreground">
              Benefícios
            </a>
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
                Entrar
              </Button>
              <Button onClick={() => navigate("/auth?tab=signup")} className="w-full">
                Criar Conta
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6">
              <Zap className="h-3 w-3 mr-1" />
              Plataforma para acompanhamento de clientes high ticket
            </Badge>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
              Gerencie seus clientes{" "}
              <span className="text-primary">high ticket</span> com inteligência
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              O ROY centraliza a gestão de clientes premium, mentorias e comunidades 
              de alto valor. Reduza churn, aumente engajamento e maximize a retenção.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => navigate("/auth?tab=signup")} className="gap-2">
                Começar Gratuitamente
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/presentation")}>
                Ver Apresentação
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              Teste grátis por 14 dias • Sem cartão de crédito
            </p>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden md:block">
          <ChevronDown className="h-6 w-6 text-muted-foreground" />
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-muted/30 border-y">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              Funcionalidades
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Tudo para gestão de clientes high ticket
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Ferramentas poderosas para gerenciar mentorias, consultorias, 
              masterminds e comunidades de alto valor.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50">
                <CardContent className="pt-6">
                  <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-4">
                Benefícios
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Por que escolher o ROY APP?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Nossa plataforma foi desenvolvida por quem entende os desafios de gerenciar 
                comunidades e clubes de negócios. Cada funcionalidade foi pensada para 
                resolver problemas reais.
              </p>
              
              <div className="grid gap-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-primary/10">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="p-6 text-center">
                <TrendingUp className="h-10 w-10 text-primary mx-auto mb-3" />
                <h4 className="font-semibold text-foreground mb-1">ROIzômetro</h4>
                <p className="text-sm text-muted-foreground">Meça o valor percebido pelos membros</p>
              </Card>
              <Card className="p-6 text-center">
                <BarChart3 className="h-10 w-10 text-primary mx-auto mb-3" />
                <h4 className="font-semibold text-foreground mb-1">E-Score</h4>
                <p className="text-sm text-muted-foreground">Acompanhe o engajamento em tempo real</p>
              </Card>
              <Card className="p-6 text-center">
                <Award className="h-10 w-10 text-primary mx-auto mb-3" />
                <h4 className="font-semibold text-foreground mb-1">vNPS</h4>
                <p className="text-sm text-muted-foreground">Satisfação virtual automatizada</p>
              </Card>
              <Card className="p-6 text-center">
                <Phone className="h-10 w-10 text-primary mx-auto mb-3" />
                <h4 className="font-semibold text-foreground mb-1">WhatsApp</h4>
                <p className="text-sm text-muted-foreground">Integração completa com IA</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      {plans.length > 0 && (
        <section id="pricing" className="py-20 md:py-28">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4">
                Planos
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Escolha o plano ideal para você
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Comece gratuitamente por 14 dias. Sem cartão de crédito.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {plans.map((plan, index) => {
                const Icon = getPlanIcon(plan.name);
                const isPopular = index === 1;

                return (
                  <Card 
                    key={plan.id} 
                    className={`relative transition-all hover:shadow-lg ${
                      isPopular ? "border-primary shadow-md ring-2 ring-primary/20" : ""
                    }`}
                  >
                    {isPopular && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                        Mais Popular
                      </Badge>
                    )}
                    <CardContent className="pt-8 pb-6">
                      <div className="text-center mb-6">
                        <div className="mx-auto mb-3 p-3 rounded-full bg-primary/10 text-primary w-fit">
                          <Icon className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                        {plan.description && (
                          <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                        )}
                      </div>

                      <div className="text-center mb-6">
                        <span className="text-4xl font-bold text-foreground">
                          {formatPrice(plan.price)}
                        </span>
                        <span className="text-muted-foreground">/mês</span>
                      </div>

                      <ul className="space-y-3 mb-6">
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                          <span>Até {plan.max_clients || "∞"} clientes</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                          <span>Até {plan.max_users || "∞"} usuários</span>
                        </li>
                        {plan.max_whatsapp_connections != null && plan.max_whatsapp_connections > 0 && (
                          <li className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                            <span>
                              {plan.max_whatsapp_connections === 1 
                                ? "1 conexão WhatsApp" 
                                : `${plan.max_whatsapp_connections} conexões WhatsApp`}
                            </span>
                          </li>
                        )}
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                          <span>{plan.max_ai_analyses?.toLocaleString() || "∞"} análises IA/mês</span>
                        </li>
                      </ul>

                      <Button 
                        className="w-full" 
                        variant={isPopular ? "default" : "outline"}
                        onClick={() => navigate("/auth?tab=signup")}
                      >
                        Começar Grátis
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <p className="text-center text-sm text-muted-foreground mt-8">
              Precisa de mais conexões WhatsApp? Adicione conexões extras por R$ 200/mês cada.
            </p>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section id="cta" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <Card className="bg-primary text-primary-foreground overflow-hidden">
            <CardContent className="p-8 md:p-12 text-center relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.1)_0%,_transparent_50%)]" />
              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Pronto para transformar sua gestão?
                </h2>
                <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
                  Junte-se a dezenas de gestores de comunidades que já estão usando o ROY APP 
                  para escalar seus resultados.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => navigate("/auth?tab=signup")}
                    className="gap-2"
                  >
                    Criar Conta Grátis
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/auth")}
                    className="bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                  >
                    Já tenho conta
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/roy-logo.png" alt="ROY" className="h-6 w-auto" />
              <span className="font-semibold text-foreground">ROY APP</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="/terms-of-service" className="hover:text-foreground transition-colors">
                Termos de Uso
              </a>
              <a href="/privacy-policy" className="hover:text-foreground transition-colors">
                Política de Privacidade
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ROY APP. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
