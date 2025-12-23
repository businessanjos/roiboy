import { useState } from "react";
import { 
  TrendingUp, 
  Users, 
  MessageSquare, 
  BarChart3, 
  CheckCircle2,
  ArrowRight,
  Play,
  LogInIcon,
  Star,
  Zap,
  Shield,
  Clock,
  Target,
  Heart,
  AlertTriangle,
  TrendingDown,
  ThumbsUp,
  Quote,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Bell,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import royLogo from "@/assets/roy-logo.png";

const tourSlides = [
  {
    title: "Dashboard Inteligente",
    description: "Veja todos seus clientes em um só lugar. Métricas de engajamento, alertas de risco e oportunidades de encantamento.",
    icon: LayoutDashboard,
    features: ["E-Score e ROIzometer em tempo real", "Alertas automáticos de churn", "Visão 360º do cliente"]
  },
  {
    title: "Análise de Conversas com IA",
    description: "Conecte seu WhatsApp e deixe a IA analisar cada mensagem automaticamente.",
    icon: MessageSquare,
    features: ["Transcrição de áudios", "Detecção de sentimentos", "Identificação de riscos e oportunidades"]
  },
  {
    title: "Métricas que Importam",
    description: "Scores exclusivos calculados automaticamente a partir do comportamento real do cliente.",
    icon: BarChart3,
    features: ["E-Score: engajamento em WhatsApp e Lives", "ROIzometer: percepção de valor", "V-NPS: NPS comportamental automático"]
  },
  {
    title: "Gestão de Eventos",
    description: "Crie eventos, faça check-in por QR Code e colete feedback NPS automaticamente.",
    icon: Calendar,
    features: ["Check-in por QR Code", "Feedback pós-evento", "Relatórios de presença"]
  },
  {
    title: "Alertas Proativos",
    description: "Receba notificações antes que problemas aconteçam. Aja no momento certo.",
    icon: Bell,
    features: ["Alertas de risco de churn", "Lembretes de aniversários", "Oportunidades de upsell"]
  }
];

const painPoints = [
  {
    icon: AlertTriangle,
    title: "Clientes cancelam sem aviso",
    description: "Você só descobre quando já é tarde demais"
  },
  {
    icon: TrendingDown,
    title: "Não sabe quem está em risco",
    description: "Churn acontece e você não viu os sinais"
  },
  {
    icon: Clock,
    title: "Horas analisando conversas",
    description: "Tempo perdido que poderia ser usado vendendo"
  },
  {
    icon: Target,
    title: "Ações reativas, não proativas",
    description: "Sempre apagando incêndio ao invés de prevenir"
  }
];

const benefits = [
  {
    icon: Zap,
    title: "Detecte riscos antes do churn",
    description: "IA analisa cada conversa e identifica sinais de insatisfação automaticamente.",
    highlight: "Redução de até 40% no churn"
  },
  {
    icon: BarChart3,
    title: "Veja o ROI que seu cliente percebe",
    description: "O ROIzometer mostra em tempo real se seu cliente acha que está valendo a pena.",
    highlight: "Métrica exclusiva do ROY"
  },
  {
    icon: Heart,
    title: "Encante nos momentos certos",
    description: "Saiba aniversários, conquistas e eventos importantes para surpreender.",
    highlight: "Relacionamento que fideliza"
  },
  {
    icon: Users,
    title: "Escale sem perder qualidade",
    description: "Gerencie centenas de clientes com a mesma atenção que daria a poucos.",
    highlight: "10x mais eficiência"
  }
];

const howItWorks = [
  {
    step: "01",
    title: "Conecte suas conversas",
    description: "Instale nossa extensão Chrome ou app Desktop e conecte seu WhatsApp em segundos."
  },
  {
    step: "02",
    title: "IA trabalha por você",
    description: "Análise automática de cada mensagem: riscos, oportunidades e eventos importantes."
  },
  {
    step: "03",
    title: "Aja no momento certo",
    description: "Receba alertas e recomendações para agir antes que problemas aconteçam."
  }
];

const testimonials = [
  {
    name: "Maria Silva",
    role: "CEO, Consultoria XYZ",
    content: "Reduzi meu churn em 35% nos primeiros 3 meses. Agora sei exatamente quem precisa de atenção.",
    avatar: "MS"
  },
  {
    name: "João Santos",
    role: "Fundador, Mentoria ABC",
    content: "Economizo 10 horas por semana que gastava analisando conversas manualmente.",
    avatar: "JS"
  },
  {
    name: "Ana Costa",
    role: "Head de CS, Startup DEF",
    content: "Finalmente consigo ver o engajamento real de cada cliente, não só feeling.",
    avatar: "AC"
  }
];

const stats = [
  { value: "40%", label: "menos churn" },
  { value: "10h", label: "economizadas/semana" },
  { value: "3x", label: "mais retenção" },
  { value: "500+", label: "clientes ativos" }
];

export default function Presentation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [showTour, setShowTour] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const isPublicRoute = location.pathname === "/sobre";

  const handleLogin = () => {
    navigate("/auth?tab=login");
  };

  const handleSignup = () => {
    navigate("/auth?tab=signup");
  };

  const openTour = () => {
    setCurrentSlide(0);
    setShowTour(true);
  };

  const nextSlide = () => {
    if (currentSlide < tourSlides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  return (
    <>
    {/* Product Tour Modal */}
    <Dialog open={showTour} onOpenChange={setShowTour}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        <div className="relative">
          {/* Slide Content */}
          <div className="p-8 pb-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-primary/10 text-primary">
                {(() => {
                  const Icon = tourSlides[currentSlide].icon;
                  return <Icon className="h-8 w-8" />;
                })()}
              </div>
              <div>
                <Badge variant="secondary" className="mb-2">
                  {currentSlide + 1} de {tourSlides.length}
                </Badge>
                <DialogTitle className="text-2xl">
                  {tourSlides[currentSlide].title}
                </DialogTitle>
              </div>
            </div>
            
            <p className="text-lg text-muted-foreground mb-6">
              {tourSlides[currentSlide].description}
            </p>
            
            <div className="space-y-3">
              {tourSlides[currentSlide].features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Navigation */}
          <div className="flex items-center justify-between p-6 bg-muted/30 border-t">
            <Button
              variant="ghost"
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            
            {/* Dots */}
            <div className="flex gap-2">
              {tourSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    idx === currentSlide ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
            
            {currentSlide === tourSlides.length - 1 ? (
              <Button onClick={() => { setShowTour(false); handleSignup(); }} className="gap-2">
                Começar Grátis
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={nextSlide} className="gap-2">
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <div className="min-h-screen bg-background">
      {/* Header */}
      {isPublicRoute && (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 max-w-screen-xl items-center justify-between px-4 mx-auto">
            <div className="flex items-center gap-2">
              <img src={royLogo} alt="ROY APP" className="h-10 w-10 object-contain" />
              <span className="font-bold text-xl">ROY APP</span>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <Button onClick={() => navigate("/dashboard")} size="lg">
                  Ir para Dashboard
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={handleLogin}>
                    Entrar
                  </Button>
                  <Button onClick={handleSignup}>
                    Começar Grátis
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50" />
        
        <div className="relative container max-w-screen-xl mx-auto px-4 py-20 lg:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              <Sparkles className="h-4 w-4 mr-2" />
              Plataforma de Customer Success com IA
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-tight">
              Pare de perder clientes
              <span className="block bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                que você poderia salvar
              </span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              O ROY analisa suas conversas com IA e te avisa <strong>antes</strong> do cliente cancelar. 
              Transforme cada interação em encantamento.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" onClick={handleSignup} className="gap-2 text-lg px-8 py-6">
                Começar Grátis por 7 dias
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={openTour} className="gap-2 text-lg px-8 py-6">
                <Play className="h-5 w-5" />
                Ver como funciona
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground">
              ✓ Cartão necessário, cancele quando quiser &nbsp; ✓ Setup em 5 minutos &nbsp; ✓ Sem cobrança nos primeiros 7 dias
            </p>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border bg-muted/50">
        <div className="container max-w-screen-xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl lg:text-5xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="container max-w-screen-xl mx-auto px-4 py-20 lg:py-28">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">O Problema</Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Você conhece essa dor?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A maioria dos negócios perde clientes que poderiam ser salvos com ação proativa.
          </p>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {painPoints.map((pain) => (
            <Card key={pain.title} className="border-destructive/20 bg-destructive/5 hover:border-destructive/40 transition-colors">
              <CardHeader>
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive w-fit mb-3">
                  <pain.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg">{pain.title}</CardTitle>
                <CardDescription>{pain.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Solution/Benefits Section */}
      <section className="bg-muted/30 border-y border-border">
        <div className="container max-w-screen-xl mx-auto px-4 py-20 lg:py-28">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">A Solução</Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              O ROY te dá superpoderes
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Pare de reagir e comece a prevenir. Veja o que você ganha:
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-8">
            {benefits.map((benefit) => (
              <Card key={benefit.title} className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <benefit.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{benefit.title}</CardTitle>
                      <CardDescription className="text-base">{benefit.description}</CardDescription>
                      <Badge variant="secondary" className="mt-3">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {benefit.highlight}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="container max-w-screen-xl mx-auto px-4 py-20 lg:py-28">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Simples de usar</Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Funcionando em 5 minutos
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Sem integrações complexas. Sem configurações técnicas.
          </p>
        </div>
        
        <div className="grid lg:grid-cols-3 gap-8">
          {howItWorks.map((step, index) => (
            <div key={step.step} className="relative">
              {index < howItWorks.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent -translate-x-1/2" />
              )}
              <Card className="h-full text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="text-6xl font-bold text-primary/20 mb-4">{step.step}</div>
                  <CardTitle className="text-xl">{step.title}</CardTitle>
                  <CardDescription className="text-base">{step.description}</CardDescription>
                </CardHeader>
              </Card>
            </div>
          ))}
        </div>
        
        <div className="text-center mt-12">
          <Button size="lg" onClick={handleSignup} className="gap-2 text-lg px-8 py-6">
            Começar Agora - É Grátis
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Social Proof / Testimonials */}
      <section className="bg-muted/30 border-y border-border">
        <div className="container max-w-screen-xl mx-auto px-4 py-20 lg:py-28">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">Prova Social</Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Quem usa, recomenda
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Veja o que nossos clientes estão dizendo
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.name} className="h-full">
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                    ))}
                  </div>
                  <Quote className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-lg mb-6 leading-relaxed">{testimonial.content}</p>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <div className="relative container max-w-screen-xl mx-auto px-4 py-20 lg:py-28">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
              Pronto para parar de perder clientes?
            </h2>
            <p className="text-xl text-muted-foreground">
              Comece grátis hoje e veja seus primeiros insights em minutos.
              Sem compromisso, sem cartão de crédito.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={handleSignup} className="gap-2 text-lg px-10 py-7">
                Criar Conta Grátis
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                7 dias grátis
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Cancele antes de cobrar
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Suporte humano
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="container max-w-screen-xl mx-auto px-4 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src={royLogo} alt="ROY APP" className="h-8 w-8 object-contain" />
              <span className="font-bold">ROY APP</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="/termos" className="hover:text-foreground transition-colors">Termos de Uso</a>
              <a href="/privacidade" className="hover:text-foreground transition-colors">Privacidade</a>
              <a href="/download" className="hover:text-foreground transition-colors">Download</a>
            </div>
            <div className="text-sm text-muted-foreground">
              © 2025 ROY APP. Todos os direitos reservados.
            </div>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}
