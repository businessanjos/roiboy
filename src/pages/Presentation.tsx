import { useState } from "react";
import { 
  TrendingUp, 
  Users, 
  MessageSquare, 
  BarChart3, 
  FileText, 
  CalendarDays, 
  Link2, 
  Bell, 
  Target, 
  Heart, 
  Shield, 
  Zap,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Play,
  Code2,
  Chrome,
  Server,
  Database,
  Brain,
  ArrowDown,
  ArrowLeftRight,
  Monitor,
  Download,
  Settings,
  LogIn,
  RefreshCw,
  Eye,
  Mic,
  LogInIcon,
  Laptop,
  Apple,
  Terminal,
  Gift,
  Ticket,
  Package,
  ClipboardList,
  UsersRound,
  QrCode,
  Star
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import royLogo from "@/assets/roy-logo.png";

const features = [
  {
    icon: Users,
    title: "Gestão de Clientes",
    description: "Cadastro completo com campos personalizáveis, fotos, contratos e ciclo de vida do cliente.",
    highlights: ["Campos customizados", "Avatares e logos", "Diagnóstico completo", "Relacionamentos"]
  },
  {
    icon: BarChart3,
    title: "Métricas de Engajamento",
    description: "E-Score e ROIzometer medem o engajamento e percepção de valor em tempo real.",
    highlights: ["E-Score (WhatsApp + Lives)", "ROIzometer (tangível + intangível)", "V-NPS comportamental", "Status MLS"]
  },
  {
    icon: MessageSquare,
    title: "Análise de WhatsApp",
    description: "App Desktop ou extensão Chrome para captura e análise automática de conversas.",
    highlights: ["Transcrição de áudios", "Detecção de riscos", "Eventos de ROI", "Sync histórico"]
  },
  {
    icon: CalendarDays,
    title: "Gestão de Eventos",
    description: "Eventos completos com check-in QR Code, feedback NPS, custos, cronograma e muito mais.",
    highlights: ["Check-in QR Code", "Feedback e NPS", "Gestão de custos", "Cronograma e equipe"]
  },
  {
    icon: Target,
    title: "Tarefas e Kanban",
    description: "Gerencie tarefas da equipe com quadro Kanban, prazos, responsáveis e subtarefas.",
    highlights: ["Kanban drag-and-drop", "Subtarefas", "Prazos e alertas", "Filtros avançados"]
  },
  {
    icon: FileText,
    title: "Contratos e Produtos",
    description: "Gestão de contratos com renovações, alertas e catálogo de produtos vinculados.",
    highlights: ["Alertas de vencimento", "Histórico completo", "Catálogo de produtos", "Cupons de desconto"]
  },
  {
    icon: Heart,
    title: "Momentos CX",
    description: "Rastreie eventos importantes na vida do cliente: aniversários, casamentos, filhos.",
    highlights: ["Detecção por IA", "Lembretes automáticos", "Eventos recorrentes", "Personalização"]
  },
  {
    icon: Link2,
    title: "Integrações",
    description: "Conecte com Omie, Pipedrive, Zoom, Google Meet, WhatsApp Evolution e mais.",
    highlights: ["Sync automático", "Webhooks", "API completa", "Multi-plataforma"]
  }
];

const metrics = [
  { label: "E-Score", description: "Engajamento em WhatsApp e Lives", range: "0-100" },
  { label: "ROIzometer", description: "Percepção de ROI tangível + intangível", range: "0-100" },
  { label: "V-NPS", description: "NPS comportamental automático", range: "0-10" },
  { label: "MLS", description: "Member Loyalty Score (Ouro, Prata, Bronze)", range: "Níveis" }
];

const workflow = [
  { step: 1, title: "Cadastro", description: "Cliente entra via integração ou manualmente" },
  { step: 2, title: "Captura", description: "App Desktop ou extensão captura conversas" },
  { step: 3, title: "Análise IA", description: "IA analisa mensagens, riscos e eventos" },
  { step: 4, title: "Métricas", description: "Scores e MLS calculados automaticamente" },
  { step: 5, title: "Ação", description: "Tarefas, alertas e recomendações" }
];

export default function Presentation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [isDesktopModalOpen, setIsDesktopModalOpen] = useState(false);
  
  // Check if we're on the public route
  const isPublicRoute = location.pathname === "/sobre";

  return (
    <div className="min-h-screen bg-background">
      {/* Public Header */}
      {isPublicRoute && (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <img src={royLogo} alt="ROY APP" className="h-8 w-8 object-contain" />
              <span className="font-bold text-lg">ROY APP</span>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <Button onClick={() => navigate("/dashboard")} className="gap-2">
                  <Play className="h-4 w-4" />
                  Ir para Dashboard
                </Button>
              ) : (
                <Button onClick={() => navigate("/auth")} className="gap-2">
                  <LogInIcon className="h-4 w-4" />
                  Entrar
                </Button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="relative p-4 sm:p-6 lg:p-8 py-12 sm:py-16 lg:py-20">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="h-3 w-3 mr-1" />
              Plataforma de Encantamento
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                ROY APP
              </span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Meça a percepção de valor dos seus clientes e encante-os em cada interação.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              {isPublicRoute ? (
                <>
                  {user ? (
                    <Button size="lg" onClick={() => navigate("/dashboard")} className="gap-2">
                      <Play className="h-4 w-4" />
                      Ir para Dashboard
                    </Button>
                  ) : (
                    <>
                      <Button size="lg" onClick={() => navigate("/auth")} className="gap-2">
                        <LogInIcon className="h-4 w-4" />
                        Começar Agora
                      </Button>
                      <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="gap-2">
                        Criar Conta Grátis
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Button size="lg" onClick={() => navigate("/dashboard")} className="gap-2">
                    <Play className="h-4 w-4" />
                    Ir para Dashboard
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/clients")} className="gap-2">
                    Ver Clientes
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Overview */}
      <section className="p-4 sm:p-6 lg:p-8 border-t border-border bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Métricas Principais</h2>
            <p className="text-muted-foreground">Indicadores calculados automaticamente a partir do comportamento do cliente</p>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric) => (
              <Card key={metric.label} className="text-center">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{metric.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">{metric.description}</p>
                  <Badge variant="outline">{metric.range}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Funcionalidades</h2>
            <p className="text-muted-foreground">Tudo que você precisa para encantar seus clientes</p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature) => (
              <Card key={feature.title} className="group hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <feature.icon className="h-5 w-5" />
                    </div>
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                  <CardDescription className="text-sm">{feature.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-1">
                    {feature.highlights.map((highlight) => (
                      <li key={highlight} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="p-4 sm:p-6 lg:p-8 border-t border-border bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Como Funciona</h2>
            <p className="text-muted-foreground">O fluxo de trabalho do ROY em 5 passos</p>
          </div>
          
          <div className="relative">
            {/* Connection line - hidden on mobile */}
            <div className="hidden lg:block absolute top-8 left-0 right-0 h-0.5 bg-border" />
            
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {workflow.map((item, index) => (
                <div key={item.step} className="relative">
                  <Card className="text-center h-full">
                    <CardContent className="pt-6">
                      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-3 font-bold relative z-10">
                        {item.step}
                      </div>
                      <h3 className="font-semibold mb-1">{item.title}</h3>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Diagram Section */}
      <section className="p-4 sm:p-6 lg:p-8 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Arquitetura do Sistema</h2>
            <p className="text-muted-foreground">Fluxo de dados entre extensão, API e dashboard</p>
          </div>
          
          {/* Architecture Diagram */}
          <div className="relative">
            {/* Desktop View */}
            <div className="hidden lg:block">
              <div className="flex items-start justify-between gap-4">
                {/* Chrome Extension */}
                <Card className="w-64 border-2 border-blue-500/30 bg-blue-500/5 animate-fade-in opacity-0 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20 hover:border-blue-500/60" style={{ animationDelay: "0ms", animationFillMode: "forwards" }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <Chrome className="h-5 w-5 text-blue-600" />
                      </div>
                      <CardTitle className="text-base">Extensão Chrome</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Captura mensagens</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      <span>Transcreve áudios</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>Identifica clientes</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Arrow */}
                <div className="flex-1 flex items-center justify-center pt-12 animate-fade-in opacity-0" style={{ animationDelay: "150ms", animationFillMode: "forwards" }}>
                  <div className="flex flex-col items-center gap-1">
                    <div className="h-0.5 w-full bg-gradient-to-r from-blue-500/50 to-amber-500/50" />
                    <span className="text-xs text-muted-foreground">HTTP/REST</span>
                  </div>
                </div>

                {/* API Layer */}
                <Card className="w-72 border-2 border-amber-500/30 bg-amber-500/5 animate-fade-in opacity-0 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-amber-500/20 hover:border-amber-500/60" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-amber-500/20">
                        <Server className="h-5 w-5 text-amber-600" />
                      </div>
                      <CardTitle className="text-base">Edge Functions (API)</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-xs">
                    <Badge variant="outline" className="text-xs">extension-auth</Badge>
                    <Badge variant="outline" className="text-xs">get-client-by-phone</Badge>
                    <Badge variant="outline" className="text-xs">create-client</Badge>
                    <Badge variant="outline" className="text-xs">ingest-whatsapp-message</Badge>
                    <Badge variant="outline" className="text-xs">ingest-whatsapp-audio</Badge>
                    <Badge variant="outline" className="text-xs">bulk-ingest-messages</Badge>
                    <Badge variant="outline" className="text-xs">analyze-message (IA)</Badge>
                  </CardContent>
                </Card>

                {/* Arrow */}
                <div className="flex-1 flex items-center justify-center pt-12 animate-fade-in opacity-0" style={{ animationDelay: "450ms", animationFillMode: "forwards" }}>
                  <div className="flex flex-col items-center gap-1">
                    <div className="h-0.5 w-full bg-gradient-to-r from-amber-500/50 to-green-500/50" />
                    <span className="text-xs text-muted-foreground">Realtime</span>
                  </div>
                </div>

                {/* Dashboard */}
                <Card className="w-64 border-2 border-green-500/30 bg-green-500/5 animate-fade-in opacity-0 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-green-500/20 hover:border-green-500/60" style={{ animationDelay: "600ms", animationFillMode: "forwards" }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <Monitor className="h-5 w-5 text-green-600" />
                      </div>
                      <CardTitle className="text-base">Dashboard Web</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <BarChart3 className="h-3.5 w-3.5" />
                      <span>Métricas em tempo real</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Bell className="h-3.5 w-3.5" />
                      <span>Alertas e notificações</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Target className="h-3.5 w-3.5" />
                      <span>Recomendações de ação</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Database and AI Row */}
              <div className="mt-4 flex justify-center gap-4 animate-fade-in opacity-0" style={{ animationDelay: "750ms", animationFillMode: "forwards" }}>
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              
              <div className="mt-2 flex justify-center gap-6">
                <Card className="w-52 border-2 border-purple-500/30 bg-purple-500/5 animate-fade-in opacity-0 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20 hover:border-purple-500/60" style={{ animationDelay: "900ms", animationFillMode: "forwards" }}>
                  <CardContent className="py-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <Database className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Supabase</p>
                      <p className="text-xs text-muted-foreground">PostgreSQL + Realtime</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="w-52 border-2 border-pink-500/30 bg-pink-500/5 animate-fade-in opacity-0 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-pink-500/20 hover:border-pink-500/60" style={{ animationDelay: "1050ms", animationFillMode: "forwards" }}>
                  <CardContent className="py-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-pink-500/20">
                      <Brain className="h-5 w-5 text-pink-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Lovable AI</p>
                      <p className="text-xs text-muted-foreground">Análise + Transcrição</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden space-y-4">
              <Card className="border-2 border-blue-500/30 bg-blue-500/5 animate-fade-in opacity-0 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 hover:border-blue-500/60" style={{ animationDelay: "0ms", animationFillMode: "forwards" }}>
                <CardContent className="py-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <Chrome className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Extensão Chrome</p>
                    <p className="text-xs text-muted-foreground">Captura mensagens do WhatsApp</p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-center animate-fade-in opacity-0" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
                <ArrowDown className="h-5 w-5 text-muted-foreground" />
              </div>

              <Card className="border-2 border-amber-500/30 bg-amber-500/5 animate-fade-in opacity-0 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/20 hover:border-amber-500/60" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
                <CardContent className="py-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Server className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium">API (Edge Functions)</p>
                    <p className="text-xs text-muted-foreground">Processa e armazena dados</p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-center animate-fade-in opacity-0" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
                <ArrowDown className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Card className="border-2 border-purple-500/30 bg-purple-500/5 animate-fade-in opacity-0 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 hover:border-purple-500/60" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
                  <CardContent className="py-3 flex flex-col items-center gap-2">
                    <Database className="h-5 w-5 text-purple-600" />
                    <p className="text-xs font-medium">Database</p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-pink-500/30 bg-pink-500/5 animate-fade-in opacity-0 transition-all duration-300 hover:shadow-lg hover:shadow-pink-500/20 hover:border-pink-500/60" style={{ animationDelay: "500ms", animationFillMode: "forwards" }}>
                  <CardContent className="py-3 flex flex-col items-center gap-2">
                    <Brain className="h-5 w-5 text-pink-600" />
                    <p className="text-xs font-medium">IA</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-center animate-fade-in opacity-0" style={{ animationDelay: "600ms", animationFillMode: "forwards" }}>
                <ArrowDown className="h-5 w-5 text-muted-foreground" />
              </div>

              <Card className="border-2 border-green-500/30 bg-green-500/5 animate-fade-in opacity-0 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20 hover:border-green-500/60" style={{ animationDelay: "700ms", animationFillMode: "forwards" }}>
                <CardContent className="py-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Monitor className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Dashboard Web</p>
                    <p className="text-xs text-muted-foreground">Visualização em tempo real</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Data Flow Description */}
          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            <Card className="animate-fade-in opacity-0" style={{ animationDelay: "1200ms", animationFillMode: "forwards" }}>
              <CardContent className="pt-4">
                <Badge className="mb-2 bg-blue-500">1. Captura</Badge>
                <p className="text-sm text-muted-foreground">
                  Extensão Chrome monitora WhatsApp Web e captura mensagens de texto e áudio em tempo real.
                </p>
              </CardContent>
            </Card>
            <Card className="animate-fade-in opacity-0" style={{ animationDelay: "1350ms", animationFillMode: "forwards" }}>
              <CardContent className="pt-4">
                <Badge className="mb-2 bg-amber-500">2. Processamento</Badge>
                <p className="text-sm text-muted-foreground">
                  API recebe dados, IA analisa sentimento, detecta eventos de ROI/risco e gera recomendações.
                </p>
              </CardContent>
            </Card>
            <Card className="animate-fade-in opacity-0" style={{ animationDelay: "1500ms", animationFillMode: "forwards" }}>
              <CardContent className="pt-4">
                <Badge className="mb-2 bg-green-500">3. Visualização</Badge>
                <p className="text-sm text-muted-foreground">
                  Dashboard atualiza em tempo real com métricas, alertas e timeline do cliente.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* WhatsApp Capture Section */}
      <section className="p-4 sm:p-6 lg:p-8 border-t border-border bg-gradient-to-br from-blue-500/5 via-transparent to-green-500/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary border-primary/30">
              <MessageSquare className="h-3 w-3 mr-1" />
              Captura WhatsApp
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Capture Mensagens do WhatsApp</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              Escolha entre a extensão Chrome ou o app desktop para captura automática de mensagens
            </p>
          </div>

          {/* Tabs for Extension vs Desktop App */}
          <Tabs defaultValue="desktop" className="mb-8">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
              <TabsTrigger value="desktop" className="gap-2">
                <Laptop className="h-4 w-4" />
                App Desktop
              </TabsTrigger>
              <TabsTrigger value="extension" className="gap-2">
                <Chrome className="h-4 w-4" />
                Extensão Chrome
              </TabsTrigger>
            </TabsList>

            {/* Desktop App Tab */}
            <TabsContent value="desktop" className="space-y-6">
              <div className="text-center">
                <Badge className="mb-4 bg-green-500/10 text-green-600 border-green-500/30">
                  Recomendado
                </Badge>
                <h3 className="text-xl font-semibold mb-2">App Desktop para Windows, Mac e Linux</h3>
                <p className="text-muted-foreground max-w-xl mx-auto mb-6">
                  Mais estável e robusto. Roda em segundo plano e reconecta automaticamente.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                  <Dialog open={isDesktopModalOpen} onOpenChange={setIsDesktopModalOpen}>
                    <DialogTrigger asChild>
                      <Button size="lg" className="gap-2 bg-green-600 hover:bg-green-700">
                        <Download className="h-4 w-4" />
                        Baixar App Desktop
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                          <Laptop className="h-5 w-5 text-green-600" />
                          Download e Instalação do App Desktop
                        </DialogTitle>
                        <DialogDescription>
                          Siga as instruções para instalar o ROY WhatsApp Capture no seu computador
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-6 mt-4">
                        {/* Requirements */}
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-green-600" />
                            Requisitos do Sistema
                          </h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Windows 10/11, macOS 10.15+ ou Linux</li>
                            <li>• Node.js 18 ou superior (para desenvolvedores)</li>
                            <li>• Conta ativa no ROY</li>
                            <li>• WhatsApp conectado ao celular</li>
                          </ul>
                        </div>

                        {/* Download Options */}
                        <div className="space-y-3">
                          <h4 className="font-semibold">Escolha seu sistema operacional:</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <a 
                              href="https://mtzoavtbtqflufyccern.supabase.co/storage/v1/object/public/app-downloads/ROY-APP-Setup.exe"
                              download
                              className="block"
                            >
                              <Button variant="outline" size="lg" className="w-full h-auto py-4 flex-col gap-2">
                                <Monitor className="h-6 w-6" />
                                <span>Windows</span>
                                <span className="text-xs text-muted-foreground">.exe</span>
                              </Button>
                            </a>
                            <a 
                              href="https://mtzoavtbtqflufyccern.supabase.co/storage/v1/object/public/app-downloads/ROY-APP.dmg"
                              download
                              className="block"
                            >
                              <Button variant="outline" size="lg" className="w-full h-auto py-4 flex-col gap-2">
                                <Apple className="h-6 w-6" />
                                <span>macOS</span>
                                <span className="text-xs text-muted-foreground">.dmg</span>
                              </Button>
                            </a>
                            <a 
                              href="https://mtzoavtbtqflufyccern.supabase.co/storage/v1/object/public/app-downloads/ROY-APP.AppImage"
                              download
                              className="block"
                            >
                              <Button variant="outline" size="lg" className="w-full h-auto py-4 flex-col gap-2">
                                <Terminal className="h-6 w-6" />
                                <span>Linux</span>
                                <span className="text-xs text-muted-foreground">.AppImage</span>
                              </Button>
                            </a>
                          </div>
                        </div>

                        {/* For Developers */}
                        <div className="p-4 bg-muted/50 border rounded-lg">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Code2 className="h-4 w-4" />
                            Para Desenvolvedores
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Clone o repositório e execute localmente:
                          </p>
                          <div className="bg-background rounded-md p-3 font-mono text-xs space-y-1">
                            <p>git clone https://github.com/businessanjos/roiboy.git</p>
                            <p>cd roiboy/electron-app</p>
                            <p>npm install</p>
                            <p>npm start</p>
                          </div>
                        </div>

                        {/* Steps */}
                        <div className="space-y-4">
                          <h4 className="font-semibold">Como Usar:</h4>
                          
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">1</div>
                            <div>
                              <p className="font-medium text-sm">Instale e abra o app</p>
                              <p className="text-xs text-muted-foreground">Execute o instalador e abra o ROY WhatsApp Capture</p>
                            </div>
                          </div>
                          
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">2</div>
                            <div>
                              <p className="font-medium text-sm">Faça login com suas credenciais do ROY</p>
                              <p className="text-xs text-muted-foreground">Use o mesmo email e senha do sistema</p>
                            </div>
                          </div>
                          
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">3</div>
                            <div>
                              <p className="font-medium text-sm">Clique em "Conectar" para abrir o WhatsApp</p>
                              <p className="text-xs text-muted-foreground">O WhatsApp Web abrirá dentro do app</p>
                            </div>
                          </div>
                          
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">4</div>
                            <div>
                              <p className="font-medium text-sm">Escaneie o QR Code com seu celular</p>
                              <p className="text-xs text-muted-foreground">A captura inicia automaticamente após conectar</p>
                            </div>
                          </div>
                        </div>

                        {/* Advantages */}
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            Vantagens do App Desktop
                          </h4>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Roda em segundo plano mesmo com o navegador fechado</li>
                            <li>• Reconecta automaticamente se o WhatsApp desconectar</li>
                            <li>• Mais estável que extensões de navegador</li>
                            <li>• Não é afetado por atualizações do Chrome</li>
                          </ul>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Desktop App Features */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="text-center hover:shadow-md transition-shadow border-green-500/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="p-2 rounded-lg bg-green-500/10 w-fit mx-auto mb-2">
                      <RefreshCw className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="font-medium text-sm">Auto Reconexão</p>
                    <p className="text-xs text-muted-foreground">Nunca perde dados</p>
                  </CardContent>
                </Card>
                <Card className="text-center hover:shadow-md transition-shadow border-green-500/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="p-2 rounded-lg bg-green-500/10 w-fit mx-auto mb-2">
                      <Monitor className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="font-medium text-sm">Background</p>
                    <p className="text-xs text-muted-foreground">Roda minimizado</p>
                  </CardContent>
                </Card>
                <Card className="text-center hover:shadow-md transition-shadow border-green-500/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="p-2 rounded-lg bg-green-500/10 w-fit mx-auto mb-2">
                      <Shield className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="font-medium text-sm">Mais Estável</p>
                    <p className="text-xs text-muted-foreground">Sem conflitos</p>
                  </CardContent>
                </Card>
                <Card className="text-center hover:shadow-md transition-shadow border-green-500/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="p-2 rounded-lg bg-green-500/10 w-fit mx-auto mb-2">
                      <Zap className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="font-medium text-sm">Tempo Real</p>
                    <p className="text-xs text-muted-foreground">Sync instantâneo</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Chrome Extension Tab */}
            <TabsContent value="extension" className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2">Extensão para Google Chrome</h3>
                <p className="text-muted-foreground max-w-xl mx-auto mb-6">
                  Leve e simples. Funciona diretamente no navegador enquanto você trabalha.
                </p>
            
                {/* Download Button and Preview Link */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                  <Dialog open={isExtensionModalOpen} onOpenChange={setIsExtensionModalOpen}>
                    <DialogTrigger asChild>
                      <Button size="lg" className="gap-2 bg-blue-600 hover:bg-blue-700">
                        <Download className="h-4 w-4" />
                        Baixar Extensão
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                          <Chrome className="h-5 w-5 text-blue-600" />
                          Instruções de Instalação da Extensão
                        </DialogTitle>
                        <DialogDescription>
                          Siga o passo a passo completo para instalar e configurar a extensão do ROY para WhatsApp Web
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-6 mt-4">
                        {/* Requirements */}
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-amber-600" />
                            Requisitos
                          </h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Google Chrome versão 88 ou superior</li>
                            <li>• Conta ativa no ROY</li>
                            <li>• WhatsApp conectado ao celular</li>
                          </ul>
                        </div>

                        {/* Steps */}
                        <div className="space-y-4">
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">1</div>
                            <div>
                              <p className="font-medium text-sm">Baixe o arquivo .zip</p>
                              <p className="text-xs text-muted-foreground">Solicite ao administrador do sistema</p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">2</div>
                            <div>
                              <p className="font-medium text-sm">Extraia os arquivos</p>
                              <p className="text-xs text-muted-foreground">Descompacte em uma pasta de fácil acesso</p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">3</div>
                            <div>
                              <p className="font-medium text-sm">Acesse chrome://extensions</p>
                              <p className="text-xs text-muted-foreground">Ative o "Modo desenvolvedor"</p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">4</div>
                            <div>
                              <p className="font-medium text-sm">Carregue a extensão</p>
                              <p className="text-xs text-muted-foreground">Clique em "Carregar sem compactação"</p>
                            </div>
                          </div>
                        </div>

                        {/* Privacy Note */}
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            Privacidade e Segurança
                          </h4>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            <li>• Apenas conversas de clientes cadastrados são capturadas</li>
                            <li>• Áudios são transcritos e imediatamente deletados</li>
                            <li>• Todos os dados são criptografados</li>
                          </ul>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="gap-2 border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                    onClick={() => navigate("/extension-preview")}
                  >
                    <Eye className="h-4 w-4" />
                    Ver Preview
                  </Button>
                </div>
              </div>

              {/* Extension Features */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="text-center hover:shadow-md transition-shadow border-blue-500/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="p-2 rounded-lg bg-blue-500/10 w-fit mx-auto mb-2">
                      <MessageSquare className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="font-medium text-sm">Captura de Textos</p>
                    <p className="text-xs text-muted-foreground">Em tempo real</p>
                  </CardContent>
                </Card>
                <Card className="text-center hover:shadow-md transition-shadow border-blue-500/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="p-2 rounded-lg bg-purple-500/10 w-fit mx-auto mb-2">
                      <Mic className="h-5 w-5 text-purple-600" />
                    </div>
                    <p className="font-medium text-sm">Transcrição de Áudios</p>
                    <p className="text-xs text-muted-foreground">Automático</p>
                  </CardContent>
                </Card>
                <Card className="text-center hover:shadow-md transition-shadow border-blue-500/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="p-2 rounded-lg bg-amber-500/10 w-fit mx-auto mb-2">
                      <Users className="h-5 w-5 text-amber-600" />
                    </div>
                    <p className="font-medium text-sm">Identificação</p>
                    <p className="text-xs text-muted-foreground">Por telefone</p>
                  </CardContent>
                </Card>
                <Card className="text-center hover:shadow-md transition-shadow border-blue-500/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="p-2 rounded-lg bg-green-500/10 w-fit mx-auto mb-2">
                      <RefreshCw className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="font-medium text-sm">Sync Histórico</p>
                    <p className="text-xs text-muted-foreground">Mensagens antigas</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Important Notes - shared by both tabs */}
          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 flex-shrink-0">
                  <Shield className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-sm mb-1">Importante sobre Privacidade</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                      Áudios são transcritos e imediatamente deletados — não são armazenados
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                      Apenas conversas de clientes cadastrados são capturadas
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                      Dados são criptografados em trânsito e em repouso
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Additional Features Section */}
      <section className="p-4 sm:p-6 lg:p-8 border-t border-border bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4">
              <Star className="h-3 w-3 mr-1" />
              Funcionalidades Extras
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Muito Mais para Sua Gestão</h2>
            <p className="text-muted-foreground">Ferramentas completas para clubes de negócios, mentorias e comunidades</p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="group hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="p-2 rounded-lg bg-orange-500/10 w-fit mb-3">
                  <Package className="h-5 w-5 text-orange-600" />
                </div>
                <h3 className="font-semibold mb-1">Catálogo de Produtos</h3>
                <p className="text-sm text-muted-foreground">Gerencie seus produtos e serviços com preços, categorias e vinculação a contratos.</p>
              </CardContent>
            </Card>
            
            <Card className="group hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="p-2 rounded-lg bg-pink-500/10 w-fit mb-3">
                  <Ticket className="h-5 w-5 text-pink-600" />
                </div>
                <h3 className="font-semibold mb-1">Cupons de Desconto</h3>
                <p className="text-sm text-muted-foreground">Crie cupons com desconto fixo ou percentual, limite de uso e validade.</p>
              </CardContent>
            </Card>
            
            <Card className="group hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="p-2 rounded-lg bg-cyan-500/10 w-fit mb-3">
                  <ClipboardList className="h-5 w-5 text-cyan-600" />
                </div>
                <h3 className="font-semibold mb-1">Diagnóstico de Clientes</h3>
                <p className="text-sm text-muted-foreground">Formulário completo para entender o negócio, desafios e objetivos do cliente.</p>
              </CardContent>
            </Card>
            
            <Card className="group hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="p-2 rounded-lg bg-violet-500/10 w-fit mb-3">
                  <UsersRound className="h-5 w-5 text-violet-600" />
                </div>
                <h3 className="font-semibold mb-1">Gestão de Equipe</h3>
                <p className="text-sm text-muted-foreground">Convide membros, defina papéis (admin, gestor, viewer) e gerencie acessos.</p>
              </CardContent>
            </Card>
            
            <Card className="group hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="p-2 rounded-lg bg-emerald-500/10 w-fit mb-3">
                  <QrCode className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="font-semibold mb-1">Check-in por QR Code</h3>
                <p className="text-sm text-muted-foreground">Gere QR Codes únicos para eventos e faça check-in rápido de participantes.</p>
              </CardContent>
            </Card>
            
            <Card className="group hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="p-2 rounded-lg bg-rose-500/10 w-fit mb-3">
                  <Gift className="h-5 w-5 text-rose-600" />
                </div>
                <h3 className="font-semibold mb-1">Gestão de Brindes</h3>
                <p className="text-sm text-muted-foreground">Controle estoque de brindes, custo unitário e distribuição em eventos.</p>
              </CardContent>
            </Card>
            
            <Card className="group hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="p-2 rounded-lg bg-blue-500/10 w-fit mb-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-1">Formulários Públicos</h3>
                <p className="text-sm text-muted-foreground">Crie formulários personalizados e compartilhe via link sem necessidade de login.</p>
              </CardContent>
            </Card>
            
            <Card className="group hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="p-2 rounded-lg bg-amber-500/10 w-fit mb-3">
                  <Link2 className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="font-semibold mb-1">Relacionamentos</h3>
                <p className="text-sm text-muted-foreground">Vincule clientes como sócios, cônjuges, indicações ou dependentes.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Integrações</h2>
            <p className="text-muted-foreground">Conecte suas ferramentas favoritas</p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {["Zoom", "Google Meet", "Omie", "Pipedrive", "WhatsApp Evolution", "Asaas"].map((integration) => (
              <Card key={integration} className="text-center py-4 hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <p className="font-medium text-sm">{integration}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* API Documentation Link */}
          <Card className="bg-muted/50 border-dashed cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/api-docs")}>
            <CardContent className="py-6 flex items-center justify-center gap-3">
              <Code2 className="h-5 w-5 text-primary" />
              <div className="text-center">
                <p className="font-medium">Documentação da API</p>
                <p className="text-sm text-muted-foreground">Webhooks, endpoints e integrações customizadas</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="p-4 sm:p-6 lg:p-8 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="py-8">
              <Zap className="h-10 w-10 text-primary mx-auto mb-4" />
              <h2 className="text-xl sm:text-2xl font-bold mb-2">Pronto para começar?</h2>
              <p className="text-muted-foreground mb-6">
                Comece a medir o encantamento dos seus clientes agora mesmo.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {isPublicRoute ? (
                  <>
                    {user ? (
                      <>
                        <Button onClick={() => navigate("/clients")} className="gap-2">
                          <Users className="h-4 w-4" />
                          Ver Clientes
                        </Button>
                        <Button variant="outline" onClick={() => navigate("/dashboard")} className="gap-2">
                          <Play className="h-4 w-4" />
                          Ir para Dashboard
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={() => navigate("/auth")} className="gap-2">
                          <LogInIcon className="h-4 w-4" />
                          Criar Conta Grátis
                        </Button>
                        <Button variant="outline" onClick={() => navigate("/auth")} className="gap-2">
                          Fazer Login
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Button onClick={() => navigate("/clients")} className="gap-2">
                      <Users className="h-4 w-4" />
                      Ver Clientes
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/integrations")} className="gap-2">
                      <Link2 className="h-4 w-4" />
                      Configurar Integrações
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
