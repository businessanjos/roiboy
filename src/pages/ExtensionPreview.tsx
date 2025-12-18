import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Search, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Settings,
  RefreshCw,
  Mic,
  Plus,
  ChevronRight,
  Sparkles,
  Clock,
  Phone,
  Loader2,
  FileText,
  Heart,
  ListTodo,
  DollarSign,
  ClipboardList,
  Calendar,
  User,
  Tag,
  ToggleLeft,
  Gift,
  Baby,
  Briefcase,
  Image,
  Send,
  MoreVertical,
  Edit,
  Trash2,
  RotateCcw,
  ExternalLink,
  Award,
  Lightbulb
} from "lucide-react";
import { Link } from "react-router-dom";
import { getMlsBadgeClasses, getMlsLevelLabel } from "@/lib/mls-utils";

export default function ExtensionPreview() {
  const [activeTab, setActiveTab] = useState("timeline");
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [showTyping, setShowTyping] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [animatedVnps, setAnimatedVnps] = useState(0);
  const [animatedEscore, setAnimatedEscore] = useState(0);
  const [animatedRoi, setAnimatedRoi] = useState(0);
  const [noteText, setNoteText] = useState("");
  const [demoKey, setDemoKey] = useState(0);

  const mockClient = {
    name: "João Silva",
    phone: "+55 11 99999-8888",
    vnps: 8.5,
    escore: 75,
    roizometer: 68,
    isMls: true,
    mlsLevel: "ouro",
  };

  const mockMessages = [
    { id: 1, type: "received", text: "Bom dia! Como posso ajudar hoje?", time: "09:30" },
    { id: 2, type: "sent", text: "Olá! Queria discutir sobre o progresso do projeto", time: "09:32" },
    { id: 3, type: "received", text: "Claro! Tivemos bons avanços essa semana. O faturamento aumentou 15%", time: "09:35" },
    { id: 4, type: "sent", text: "Excelente! Isso é muito positivo", time: "09:36" },
    { id: 5, type: "received", text: "Sim! A equipe está bem motivada com os resultados", time: "09:38" },
  ];

  const newMessage = {
    id: 6,
    type: "received",
    text: "Estamos planejando expandir para mais duas cidades no próximo trimestre!",
    time: "09:40"
  };

  const mockTimeline = [
    { type: "roi", icon: TrendingUp, text: "ROI: Aumento de faturamento +15%", time: "09:35", color: "success" },
    { type: "message", icon: MessageSquare, text: "5 mensagens trocadas hoje", time: "09:38", color: "accent" },
    { type: "task", icon: ListTodo, text: "Tarefa concluída: Enviar proposta", time: "Ontem", color: "primary" },
  ];

  const mockRecommendations = [
    { title: "Agendar reunião de alinhamento", priority: "high", action: "Ligar para cliente" },
    { title: "Enviar case de sucesso similar", priority: "medium", action: "Compartilhar material" },
  ];

  const mockFields = [
    { name: "Segmento", type: "select", value: "Varejo", color: "accent" },
    { name: "Potencial", type: "select", value: "Alto", color: "success" },
    { name: "Ativo no grupo", type: "boolean", value: true },
    { name: "Faturamento mensal", type: "currency", value: "R$ 150.000" },
    { name: "Responsável", type: "user", value: "Maria Santos" },
  ];

  const mockContract = {
    type: "Contrato de compra",
    status: "active",
    value: "R$ 24.000",
    startDate: "01/01/2025",
    endDate: "31/12/2025",
    daysRemaining: 348,
  };

  const mockFollowups = [
    { user: "Maria Santos", text: "Cliente muito satisfeito com os resultados do último mês.", time: "Há 2 dias" },
    { user: "Pedro Lima", text: "Agendada reunião de follow-up para próxima semana.", time: "Há 5 dias" },
  ];

  const mockLifeEvents = [
    { type: "birthday", icon: Gift, title: "Aniversário", date: "15/03", recurring: true },
    { type: "baby", icon: Baby, title: "Nascimento do filho", date: "20/06/2024", recurring: false },
    { type: "job", icon: Briefcase, title: "Promoção no trabalho", date: "10/01/2025", recurring: false },
  ];

  const mockTasks = [
    { title: "Enviar relatório mensal", status: "pending", dueDate: "Hoje", priority: "high" },
    { title: "Agendar reunião de alinhamento", status: "pending", dueDate: "Amanhã", priority: "medium" },
    { title: "Revisar contrato", status: "done", dueDate: "Ontem", priority: "low" },
  ];

  useEffect(() => {
    setVisibleMessages([]);
    setShowTyping(false);
    setShowNewMessage(false);
    setShowAnalysis(false);
    setShowEvent(false);
    setAnimatedVnps(0);
    setAnimatedEscore(0);
    setAnimatedRoi(0);

    const timer = setTimeout(() => {
      mockMessages.forEach((_, index) => {
        setTimeout(() => {
          setVisibleMessages(prev => [...prev, index]);
        }, index * 400);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [demoKey]);

  useEffect(() => {
    const duration = 1500;
    const steps = 30;
    const vnpsStep = mockClient.vnps / steps;
    const escoreStep = mockClient.escore / steps;
    const roiStep = mockClient.roizometer / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      setAnimatedVnps(Math.min(vnpsStep * currentStep, mockClient.vnps));
      setAnimatedEscore(Math.min(Math.round(escoreStep * currentStep), mockClient.escore));
      setAnimatedRoi(Math.min(Math.round(roiStep * currentStep), mockClient.roizometer));
      if (currentStep >= steps) clearInterval(interval);
    }, duration / steps);

    return () => clearInterval(interval);
  }, [demoKey]);

  useEffect(() => {
    const typingTimer = setTimeout(() => setShowTyping(true), mockMessages.length * 400 + 2000);
    const messageTimer = setTimeout(() => {
      setShowTyping(false);
      setShowNewMessage(true);
    }, mockMessages.length * 400 + 4500);
    const analysisTimer = setTimeout(() => setShowAnalysis(true), mockMessages.length * 400 + 5500);
    const eventTimer = setTimeout(() => setShowEvent(true), mockMessages.length * 400 + 6500);

    return () => {
      clearTimeout(typingTimer);
      clearTimeout(messageTimer);
      clearTimeout(analysisTimer);
      clearTimeout(eventTimer);
    };
  }, [demoKey]);

  useEffect(() => {
    const typingTimer = setTimeout(() => setShowTyping(true), mockMessages.length * 400 + 2000);
    const messageTimer = setTimeout(() => {
      setShowTyping(false);
      setShowNewMessage(true);
    }, mockMessages.length * 400 + 4500);
    const analysisTimer = setTimeout(() => setShowAnalysis(true), mockMessages.length * 400 + 5500);
    const eventTimer = setTimeout(() => setShowEvent(true), mockMessages.length * 400 + 6500);

    return () => {
      clearTimeout(typingTimer);
      clearTimeout(messageTimer);
      clearTimeout(analysisTimer);
      clearTimeout(eventTimer);
    };
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleResetDemo = () => {
    setDemoKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/presentation" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar</span>
          </Link>
          <h1 className="text-xl font-bold">Preview da Extensão Chrome</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleResetDemo} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Reiniciar Demo</span>
            </Button>
            <Link to="/api-docs">
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">API Docs</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Card className="mb-8 border-primary/20 bg-primary/5 animate-fade-in">
            <CardContent className="p-4 flex items-center gap-4">
              <Sparkles className="h-6 w-6 text-primary animate-pulse" />
              <div>
                <p className="font-medium">Extensão completa com todas as funcionalidades do cliente</p>
                <p className="text-sm text-muted-foreground">
                  Navegue pelas abas para ver Timeline, Campos, Financeiro, Acompanhamento, Momentos CX e Tarefas.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-[1fr,420px] gap-6">
            {/* WhatsApp Mock */}
            <Card className="overflow-hidden animate-fade-in" style={{ animationDelay: "200ms" }}>
              <CardHeader className="bg-[#075E54] text-white p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-2 ring-white/20">
                    <AvatarFallback className="bg-white/20 text-white">JS</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{mockClient.name}</p>
                    <p className="text-xs text-white/70 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      online
                    </p>
                  </div>
                  <Search className="h-5 w-5 text-white/70 cursor-pointer hover:text-white transition-colors" />
                </div>
              </CardHeader>
              <CardContent className="p-0 bg-[#ECE5DD] min-h-[600px] relative">
                <div className="absolute inset-0 opacity-5" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }} />
                
                <div className="relative p-4 space-y-2 pb-16">
                  {mockMessages.map((msg, index) => (
                    <div 
                      key={msg.id} 
                      className={`flex ${msg.type === "sent" ? "justify-end" : "justify-start"} transition-all duration-300 ${
                        visibleMessages.includes(index) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                      }`}
                    >
                      <div 
                        className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm transition-transform hover:scale-[1.02] cursor-pointer ${
                          msg.type === "sent" ? "bg-[#DCF8C6] rounded-tr-none" : "bg-white rounded-tl-none"
                        }`}
                      >
                        <p className="text-sm text-gray-800">{msg.text}</p>
                        <p className="text-[10px] text-gray-500 text-right mt-1">{msg.time}</p>
                      </div>
                    </div>
                  ))}

                  {showTyping && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="bg-white rounded-lg rounded-tl-none px-4 py-3 shadow-sm">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {showNewMessage && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="max-w-[70%] rounded-lg rounded-tl-none px-3 py-2 shadow-sm bg-white ring-2 ring-primary/30">
                        <p className="text-sm text-gray-800">{newMessage.text}</p>
                        <p className="text-[10px] text-gray-500 text-right mt-1">{newMessage.time}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 bg-[#F0F0F0] p-2 flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Input placeholder="Digite uma mensagem" className="flex-1 bg-white border-0 rounded-full" />
                  <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
                    <Mic className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Extension Panel - Full Featured */}
            <Card className="overflow-hidden border-2 border-primary/30 shadow-xl animate-fade-in" style={{ animationDelay: "400ms" }}>
              <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <span className="font-bold text-sm">ROY</span>
                    </div>
                    <span className="font-semibold">ROY Extension</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10" onClick={handleRefresh}>
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Client Info */}
                <div className="p-3 border-b bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 ring-2 ring-transparent group-hover:ring-primary/30">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">JS</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{mockClient.name}</h3>
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[9px]">Ativo</Badge>
                        {mockClient.isMls && (
                          <Badge className={`${getMlsBadgeClasses(mockClient.mlsLevel)} text-[8px] gap-0.5`}>
                            <Award className="h-2.5 w-2.5" />
                            MLS {getMlsLevelLabel(mockClient.mlsLevel)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" />
                        {mockClient.phone}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* Scores - Compact */}
                <div className="p-2 border-b">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-1.5 rounded bg-success/10 hover:bg-success/20 transition-colors cursor-pointer">
                      <div className="text-sm font-bold text-success">{animatedVnps.toFixed(1)}</div>
                      <div className="text-[9px] text-muted-foreground">V-NPS</div>
                    </div>
                    <div className="text-center p-1.5 rounded bg-accent/10 hover:bg-accent/20 transition-colors cursor-pointer">
                      <div className="text-sm font-bold text-accent">{animatedEscore}</div>
                      <div className="text-[9px] text-muted-foreground">E-Score</div>
                    </div>
                    <div className="text-center p-1.5 rounded bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer">
                      <div className="text-sm font-bold text-primary">{animatedRoi}</div>
                      <div className="text-[9px] text-muted-foreground">ROIzometer</div>
                    </div>
                  </div>
                </div>

                {/* Full Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0 grid grid-cols-6">
                    {[
                      { value: "timeline", icon: Clock, label: "Timeline" },
                      { value: "campos", icon: Tag, label: "Campos" },
                      { value: "financeiro", icon: DollarSign, label: "Financeiro" },
                      { value: "acompanhamento", icon: ClipboardList, label: "Acompanhar" },
                      { value: "cx", icon: Heart, label: "CX" },
                      { value: "tarefas", icon: ListTodo, label: "Tarefas" },
                    ].map((tab) => (
                      <TabsTrigger 
                        key={tab.value}
                        value={tab.value} 
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-1.5 px-1 text-[9px] flex flex-col gap-0.5 h-auto"
                      >
                        <tab.icon className="h-3 w-3" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <ScrollArea className="h-[340px]">
                    {/* Timeline Tab */}
                    <TabsContent value="timeline" className="p-3 space-y-2 mt-0">
                      {showAnalysis && (
                        <div className="p-2 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 animate-fade-in">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                            <span className="text-[10px] font-medium">Análise IA</span>
                            <Badge variant="secondary" className="text-[8px] bg-primary/20 text-primary h-4">Novo</Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            🎯 Plano de expansão detectado! Cliente menciona aumento de 15% no faturamento.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="text-[10px] h-6 hover:bg-success/10 hover:text-success hover:border-success/30">
                          <Plus className="h-2.5 w-2.5 mr-1" />
                          ROI
                        </Button>
                        <Button size="sm" variant="outline" className="text-[10px] h-6 hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                          Risco
                        </Button>
                        <Button size="sm" variant="outline" className="text-[10px] h-6 hover:bg-accent/10 hover:text-accent hover:border-accent/30">
                          <MessageSquare className="h-2.5 w-2.5 mr-1" />
                          Nota
                        </Button>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-medium text-muted-foreground">Eventos Recentes</p>
                        {showEvent && (
                          <div className="flex items-center gap-2 p-1.5 rounded bg-primary/10 text-[10px] animate-fade-in ring-1 ring-primary/30">
                            <Sparkles className="h-3 w-3 text-primary" />
                            <span className="font-medium">IA: Expansão detectada!</span>
                          </div>
                        )}
                        {mockTimeline.map((event, i) => {
                          const colorClasses = {
                            success: "bg-success/10 hover:bg-success/20 text-success",
                            accent: "bg-accent/10 hover:bg-accent/20 text-accent",
                            primary: "bg-primary/10 hover:bg-primary/20 text-primary",
                          }[event.color] || "bg-muted hover:bg-muted/80 text-muted-foreground";
                          return (
                            <div key={i} className={`flex items-center gap-2 p-1.5 rounded text-[10px] cursor-pointer transition-colors ${colorClasses.split(' ').slice(0, 2).join(' ')}`}>
                              <event.icon className={`h-3 w-3 ${colorClasses.split(' ').slice(2).join(' ')}`} />
                              <span className="flex-1 truncate">{event.text}</span>
                              <span className="text-[9px] text-muted-foreground">{event.time}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Recommendations */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                          <Lightbulb className="h-3 w-3" />
                          Recomendações IA
                        </p>
                        {mockRecommendations.map((rec, i) => (
                          <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors group">
                            <Lightbulb className="h-3 w-3 text-primary" />
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] truncate block">{rec.title}</span>
                              <span className="text-[9px] text-muted-foreground">{rec.action}</span>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={`text-[8px] h-4 ${rec.priority === 'high' ? 'border-destructive/30 text-destructive' : 'border-primary/30 text-primary'}`}
                            >
                              {rec.priority === 'high' ? 'Alta' : 'Média'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    {/* Campos Tab */}
                    <TabsContent value="campos" className="p-3 space-y-2 mt-0">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-medium">Campos Personalizados</p>
                        <Badge variant="outline" className="text-[9px]">4/5 preenchidos</Badge>
                      </div>
                      <div className="space-y-2">
                        {mockFields.map((field, i) => {
                          const colorClasses = field.color === "accent" 
                            ? "bg-accent/10 text-accent-foreground" 
                            : field.color === "success" 
                              ? "bg-success/10 text-success" 
                              : "bg-primary/10 text-primary";
                          return (
                            <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50 hover:bg-muted transition-colors cursor-pointer group">
                              <div className="flex items-center gap-2">
                                {field.type === "select" && <Tag className="h-3 w-3 text-muted-foreground" />}
                                {field.type === "boolean" && <ToggleLeft className="h-3 w-3 text-muted-foreground" />}
                                {field.type === "currency" && <DollarSign className="h-3 w-3 text-muted-foreground" />}
                                {field.type === "user" && <User className="h-3 w-3 text-muted-foreground" />}
                                <span className="text-[10px]">{field.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {field.type === "boolean" ? (
                                  <Checkbox checked={field.value as boolean} className="h-3.5 w-3.5" />
                                ) : field.type === "select" ? (
                                  <Badge variant="secondary" className={`text-[9px] ${colorClasses}`}>
                                    {field.value}
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] font-medium">{field.value}</span>
                                )}
                                <Edit className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <Button size="sm" variant="outline" className="w-full text-[10px] h-7 mt-2">
                        <Plus className="h-3 w-3 mr-1" />
                        Editar Campos
                      </Button>
                    </TabsContent>

                    {/* Financeiro Tab */}
                    <TabsContent value="financeiro" className="p-3 space-y-3 mt-0">
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="text-[11px] font-medium">{mockContract.type}</span>
                          </div>
                          <Badge className="bg-success text-success-foreground text-[9px]">Ativo</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <p className="text-muted-foreground">Valor</p>
                            <p className="font-semibold">{mockContract.value}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Restante</p>
                            <p className="font-semibold text-success">{mockContract.daysRemaining} dias</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Início</p>
                            <p>{mockContract.startDate}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Término</p>
                            <p>{mockContract.endDate}</p>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-success rounded-full" style={{ width: "5%" }} />
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="w-full text-[10px] h-7">
                        <Plus className="h-3 w-3 mr-1" />
                        Novo Contrato
                      </Button>
                    </TabsContent>

                    {/* Acompanhamento Tab */}
                    <TabsContent value="acompanhamento" className="p-3 space-y-2 mt-0">
                      <div className="space-y-2">
                        {mockFollowups.map((followup, i) => (
                          <div key={i} className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className="text-[8px] bg-primary/10">{followup.user.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                </Avatar>
                                <span className="text-[10px] font-medium">{followup.user}</span>
                              </div>
                              <span className="text-[9px] text-muted-foreground">{followup.time}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{followup.text}</p>
                            <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[9px]">👍</Button>
                              <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[9px]">❤️</Button>
                              <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[9px]">Responder</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        <Input 
                          placeholder="Adicionar nota..." 
                          className="flex-1 h-7 text-[10px]"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                        />
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                          <Image className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" className="h-7 px-2">
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                    </TabsContent>

                    {/* Momentos CX Tab */}
                    <TabsContent value="cx" className="p-3 space-y-2 mt-0">
                      <div className="space-y-2">
                        {mockLifeEvents.map((event, i) => (
                          <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group">
                            <div className="w-8 h-8 rounded-full bg-pink-500/10 flex items-center justify-center">
                              <event.icon className="h-4 w-4 text-pink-500" />
                            </div>
                            <div className="flex-1">
                              <p className="text-[11px] font-medium">{event.title}</p>
                              <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-2.5 w-2.5" />
                                {event.date}
                                {event.recurring && <Badge variant="outline" className="text-[8px] h-4 ml-1">Anual</Badge>}
                              </p>
                            </div>
                            <MoreVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                          </div>
                        ))}
                      </div>
                      <Button size="sm" variant="outline" className="w-full text-[10px] h-7 mt-2">
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar Momento
                      </Button>
                    </TabsContent>

                    {/* Tarefas Tab */}
                    <TabsContent value="tarefas" className="p-3 space-y-2 mt-0">
                      <div className="space-y-2">
                        {mockTasks.map((task, i) => (
                          <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border ${task.status === 'done' ? 'bg-muted/30 opacity-60' : 'bg-card'} hover:shadow-sm transition-all cursor-pointer group`}>
                            <Checkbox checked={task.status === 'done'} className="h-4 w-4" />
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-muted-foreground">{task.dueDate}</span>
                                <Badge 
                                  variant="outline" 
                                  className={`text-[8px] h-4 ${
                                    task.priority === 'high' ? 'border-destructive/30 text-destructive' :
                                    task.priority === 'medium' ? 'border-primary/30 text-primary' :
                                    'border-muted-foreground/30 text-muted-foreground'
                                  }`}
                                >
                                  {task.priority === 'high' ? 'Urgente' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button size="sm" variant="outline" className="w-full text-[10px] h-7 mt-2">
                        <Plus className="h-3 w-3 mr-1" />
                        Nova Tarefa
                      </Button>
                    </TabsContent>
                  </ScrollArea>
                </Tabs>

                {/* Footer */}
                <div className="p-2 border-t bg-muted/30">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {isRefreshing ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Sincronizando...</>
                      ) : (
                        <><span className="w-1.5 h-1.5 rounded-full bg-success" /> Sincronizado</>
                      )}
                    </span>
                    <Button variant="link" size="sm" className="h-auto p-0 text-[10px] text-primary">
                      Abrir no ROY
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Features Grid */}
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {[
              { icon: Clock, title: "Timeline Completa", desc: "Veja todo o histórico de interações, ROI e riscos em tempo real.", color: "blue" },
              { icon: Tag, title: "Campos Personalizados", desc: "Edite campos customizados diretamente da extensão.", color: "purple" },
              { icon: ListTodo, title: "Gestão de Tarefas", desc: "Crie e gerencie tarefas sem sair do WhatsApp.", color: "green" },
            ].map((feature, i) => (
              <Card key={i} className="p-4 hover:shadow-lg transition-shadow cursor-pointer group animate-fade-in" style={{ animationDelay: `${600 + i * 200}ms` }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg bg-${feature.color}-500/10 flex items-center justify-center group-hover:bg-${feature.color}-500/20 transition-colors`}>
                    <feature.icon className={`h-5 w-5 text-${feature.color}-500 group-hover:scale-110 transition-transform`} />
                  </div>
                  <h3 className="font-medium">{feature.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
