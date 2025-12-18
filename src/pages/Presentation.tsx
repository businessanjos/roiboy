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
  Monitor
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const features = [
  {
    icon: Users,
    title: "Gestão de Clientes",
    description: "Cadastro completo com campos personalizáveis, fotos, contratos e ciclo de vida do cliente.",
    highlights: ["Campos customizados", "Avatares e fotos", "Contratos com alertas", "Status automático"]
  },
  {
    icon: BarChart3,
    title: "Métricas de Engajamento",
    description: "E-Score e ROIzometer medem o engajamento e percepção de valor em tempo real.",
    highlights: ["E-Score (WhatsApp + Lives)", "ROIzometer (tangível + intangível)", "V-NPS comportamental", "Tendências automáticas"]
  },
  {
    icon: MessageSquare,
    title: "Análise de WhatsApp",
    description: "Integração com extensão Chrome para captura e análise automática de conversas.",
    highlights: ["Transcrição de áudios", "Detecção de riscos", "Eventos de ROI", "Momentos CX"]
  },
  {
    icon: CalendarDays,
    title: "Eventos e Agenda",
    description: "Gerencie lives, materiais e entregas com rastreamento automático de presença.",
    highlights: ["Lives online/presencial", "Webhook Zoom/Meet", "Confirmação automática", "Materiais e entregas"]
  },
  {
    icon: FileText,
    title: "Formulários Públicos",
    description: "Crie formulários personalizados e compartilhe com clientes sem necessidade de login.",
    highlights: ["Templates prontos", "Campos customizados", "Link compartilhável", "Respostas na timeline"]
  },
  {
    icon: Target,
    title: "Detecção de Riscos",
    description: "IA identifica automaticamente sinais de insatisfação, frustração e risco de churn.",
    highlights: ["Análise de sentimento", "Alertas automáticos", "Recomendações", "Histórico completo"]
  },
  {
    icon: Heart,
    title: "Momentos CX",
    description: "Rastreie eventos importantes na vida do cliente: aniversários, casamentos, filhos.",
    highlights: ["Detecção automática", "Lembretes", "Eventos recorrentes", "Personalização"]
  },
  {
    icon: Link2,
    title: "Integrações",
    description: "Conecte com Omie, Pipedrive, Zoom, Google Meet e Clínica Ryka.",
    highlights: ["Sync automático", "Webhooks", "Dados financeiros", "Pipeline de vendas"]
  }
];

const metrics = [
  { label: "E-Score", description: "Engajamento em WhatsApp e Lives", range: "0-100" },
  { label: "ROIzometer", description: "Percepção de ROI tangível + intangível", range: "0-100" },
  { label: "V-NPS", description: "NPS comportamental automático", range: "0-10" },
  { label: "Risk Index", description: "Índice de risco de churn", range: "0-100" }
];

const workflow = [
  { step: 1, title: "Cadastro", description: "Cliente entra via Pipedrive ou manualmente" },
  { step: 2, title: "Conexão", description: "WhatsApp identificado pela extensão Chrome" },
  { step: 3, title: "Análise", description: "IA analisa mensagens e detecta eventos" },
  { step: 4, title: "Métricas", description: "Scores calculados automaticamente" },
  { step: 5, title: "Ação", description: "Recomendações e alertas para a equipe" }
];

export default function Presentation() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
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
                ROY
              </span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Meça a percepção de valor dos seus clientes e encante-os em cada interação.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" onClick={() => navigate("/dashboard")} className="gap-2">
                <Play className="h-4 w-4" />
                Ir para Dashboard
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/clients")} className="gap-2">
                Ver Clientes
                <ArrowRight className="h-4 w-4" />
              </Button>
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

      {/* Integrations Section */}
      <section className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Integrações</h2>
            <p className="text-muted-foreground">Conecte suas ferramentas favoritas</p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {["Zoom", "Google Meet", "Omie", "Pipedrive", "Clínica Ryka"].map((integration) => (
              <Card key={integration} className="text-center py-4">
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
                <p className="text-sm text-muted-foreground">Para desenvolvedores da extensão Chrome</p>
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
                <Button onClick={() => navigate("/clients")} className="gap-2">
                  <Users className="h-4 w-4" />
                  Ver Clientes
                </Button>
                <Button variant="outline" onClick={() => navigate("/integrations")} className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Configurar Integrações
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
