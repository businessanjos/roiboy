import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquare, 
  Search, 
  User, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Settings,
  LogOut,
  RefreshCw,
  Send,
  Mic,
  Plus,
  ChevronRight,
  Sparkles,
  Clock,
  Phone,
  Loader2
} from "lucide-react";
import { Link } from "react-router-dom";

export default function ExtensionPreview() {
  const [activeTab, setActiveTab] = useState("chat");
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [showTyping, setShowTyping] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [animatedVnps, setAnimatedVnps] = useState(0);
  const [animatedEscore, setAnimatedEscore] = useState(0);
  const [animatedRoi, setAnimatedRoi] = useState(0);

  // Mock data for demonstration
  const mockClient = {
    name: "João Silva",
    phone: "+55 11 99999-8888",
    avatar: null,
    vnps: 8.5,
    escore: 75,
    roizometer: 68,
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

  // Animate messages appearing one by one
  useEffect(() => {
    const timer = setTimeout(() => {
      mockMessages.forEach((_, index) => {
        setTimeout(() => {
          setVisibleMessages(prev => [...prev, index]);
        }, index * 400);
      });
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Animate scores counting up
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

      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, duration / steps);

    return () => clearInterval(interval);
  }, []);

  // Show typing indicator and new message after initial messages
  useEffect(() => {
    const typingTimer = setTimeout(() => {
      setShowTyping(true);
    }, mockMessages.length * 400 + 2000);

    const messageTimer = setTimeout(() => {
      setShowTyping(false);
      setShowNewMessage(true);
    }, mockMessages.length * 400 + 4500);

    const analysisTimer = setTimeout(() => {
      setShowAnalysis(true);
    }, mockMessages.length * 400 + 5500);

    const eventTimer = setTimeout(() => {
      setShowEvent(true);
    }, mockMessages.length * 400 + 6500);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/presentation" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar</span>
          </Link>
          <h1 className="text-xl font-bold">Preview da Extensão Chrome</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Info Banner */}
          <Card className="mb-8 border-primary/20 bg-primary/5 animate-fade-in">
            <CardContent className="p-4 flex items-center gap-4">
              <Sparkles className="h-6 w-6 text-primary animate-pulse" />
              <div>
                <p className="font-medium">Esta é uma demonstração interativa da extensão ROY</p>
                <p className="text-sm text-muted-foreground">
                  Observe as mensagens aparecendo e a análise em tempo real no painel lateral.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Main Preview Area */}
          <div className="grid lg:grid-cols-[1fr,380px] gap-6">
            {/* WhatsApp Mock */}
            <Card className="overflow-hidden animate-fade-in" style={{ animationDelay: "200ms" }}>
              <CardHeader className="bg-[#075E54] text-white p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-2 ring-white/20 transition-all hover:ring-white/40">
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
              <CardContent className="p-0 bg-[#ECE5DD] min-h-[500px] relative">
                {/* Chat Background Pattern */}
                <div className="absolute inset-0 opacity-5" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }} />
                
                {/* Messages */}
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
                          msg.type === "sent" 
                            ? "bg-[#DCF8C6] rounded-tr-none" 
                            : "bg-white rounded-tl-none"
                        }`}
                      >
                        <p className="text-sm text-gray-800">{msg.text}</p>
                        <p className="text-[10px] text-gray-500 text-right mt-1">{msg.time}</p>
                      </div>
                    </div>
                  ))}

                  {/* Typing Indicator */}
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

                  {/* New Message */}
                  {showNewMessage && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="max-w-[70%] rounded-lg rounded-tl-none px-3 py-2 shadow-sm bg-white transition-transform hover:scale-[1.02] cursor-pointer ring-2 ring-primary/30">
                        <p className="text-sm text-gray-800">{newMessage.text}</p>
                        <p className="text-[10px] text-gray-500 text-right mt-1">{newMessage.time}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="absolute bottom-0 left-0 right-0 bg-[#F0F0F0] p-2 flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors">
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Input 
                    placeholder="Digite uma mensagem" 
                    className="flex-1 bg-white border-0 rounded-full focus:ring-2 focus:ring-[#075E54]/30"
                  />
                  <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors">
                    <Mic className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Extension Panel Mock */}
            <Card className="overflow-hidden border-2 border-primary/30 shadow-xl animate-fade-in" style={{ animationDelay: "400ms" }}>
              {/* Extension Header */}
              <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors cursor-pointer">
                      <span className="font-bold text-sm">ROY</span>
                    </div>
                    <span className="font-semibold">ROY Extension</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10"
                      onClick={handleRefresh}
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10">
                      <Settings className="h-4 w-4 hover:rotate-90 transition-transform duration-300" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Client Info */}
                <div className="p-4 border-b bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12 ring-2 ring-transparent group-hover:ring-primary/30 transition-all">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">JS</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{mockClient.name}</h3>
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]">
                          Ativo
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {mockClient.phone}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-primary text-xs group-hover:translate-x-1 transition-transform">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Scores */}
                <div className="p-4 border-b">
                  <div className="grid grid-cols-3 gap-3">
                    {/* V-NPS */}
                    <div className="text-center p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 transition-colors cursor-pointer group">
                      <div className="text-lg font-bold text-green-600 transition-transform group-hover:scale-110">
                        {animatedVnps.toFixed(1)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">V-NPS</div>
                      <Badge className="mt-1 text-[9px] bg-green-500 hover:bg-green-600 transition-colors">
                        Promotor
                      </Badge>
                    </div>
                    {/* E-Score */}
                    <div className="text-center p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors cursor-pointer group">
                      <div className="text-lg font-bold text-blue-600 transition-transform group-hover:scale-110">
                        {animatedEscore}
                      </div>
                      <div className="text-[10px] text-muted-foreground">E-Score</div>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span className="text-[9px] text-green-500">+5%</span>
                      </div>
                    </div>
                    {/* ROIzometer */}
                    <div className="text-center p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-colors cursor-pointer group">
                      <div className="text-lg font-bold text-amber-600 transition-transform group-hover:scale-110">
                        {animatedRoi}
                      </div>
                      <div className="text-[10px] text-muted-foreground">ROIzometer</div>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span className="text-[9px] text-green-500">+3%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0">
                    <TabsTrigger 
                      value="chat" 
                      className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2 text-xs transition-all hover:bg-muted/50"
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Chat
                    </TabsTrigger>
                    <TabsTrigger 
                      value="insights" 
                      className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2 text-xs transition-all hover:bg-muted/50"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Insights
                    </TabsTrigger>
                    <TabsTrigger 
                      value="history" 
                      className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2 text-xs transition-all hover:bg-muted/50"
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      Histórico
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="chat" className="p-4 space-y-3 mt-0">
                    {/* AI Analysis - Animated */}
                    <div className={`p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 transition-all duration-500 ${
                      showAnalysis ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                        <span className="text-xs font-medium">Análise da Conversa</span>
                        {showNewMessage && (
                          <Badge variant="secondary" className="text-[9px] bg-primary/20 text-primary animate-pulse">
                            Atualizado
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {showNewMessage 
                          ? "🎯 Cliente planeja expansão para 2 cidades - sinal forte de ROI! Menciona aumento de 15% no faturamento."
                          : "Cliente demonstra satisfação com resultados. Mencionou aumento de 15% no faturamento - classificado como ROI tangível."
                        }
                      </p>
                    </div>

                    {/* Quick Actions */}
                    <div>
                      <p className="text-xs font-medium mb-2">Ações Rápidas</p>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs h-7 hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/30 transition-colors"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Registrar ROI
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs h-7 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30 transition-colors"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Sinalizar Risco
                        </Button>
                      </div>
                    </div>

                    {/* Recent Events - Animated */}
                    <div>
                      <p className="text-xs font-medium mb-2">Eventos Recentes</p>
                      <div className="space-y-2">
                        {/* New Event */}
                        {showEvent && (
                          <div className="flex items-center gap-2 p-2 rounded bg-primary/10 text-xs animate-fade-in ring-2 ring-primary/30">
                            <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                            <span className="font-medium">IA: Plano de expansão detectado!</span>
                          </div>
                        )}
                        <div className={`flex items-center gap-2 p-2 rounded bg-green-500/10 text-xs transition-all hover:bg-green-500/20 cursor-pointer ${
                          showEvent ? "" : "animate-fade-in"
                        }`} style={{ animationDelay: "600ms" }}>
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span>ROI: Aumento de faturamento +15%</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded bg-blue-500/10 text-xs transition-all hover:bg-blue-500/20 cursor-pointer animate-fade-in" style={{ animationDelay: "800ms" }}>
                          <MessageSquare className="h-3 w-3 text-blue-500" />
                          <span>Engajamento alto no WhatsApp</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="insights" className="p-4 space-y-3 mt-0">
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-gradient-to-r from-green-500/5 to-green-500/10 border border-green-500/20">
                        <p className="text-xs font-medium text-green-600 mb-1">💡 Oportunidade Detectada</p>
                        <p className="text-xs text-muted-foreground">
                          Cliente em fase de expansão. Momento ideal para oferecer produtos complementares.
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500/5 to-blue-500/10 border border-blue-500/20">
                        <p className="text-xs font-medium text-blue-600 mb-1">📊 Padrão de Comportamento</p>
                        <p className="text-xs text-muted-foreground">
                          Engajamento consistente nos últimos 30 dias. Responde em média em 2h.
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="p-4 space-y-3 mt-0">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-muted-foreground">09:40</span>
                        <span>Mensagem recebida</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="text-muted-foreground">09:35</span>
                        <span>ROI tangível detectado</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-muted-foreground">09:30</span>
                        <span>Conversa iniciada</span>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Footer */}
                <div className="p-3 border-t bg-muted/30">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {isRefreshing ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          Sincronizado agora
                        </>
                      )}
                    </span>
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-primary hover:text-primary/80 transition-colors">
                      Abrir no ROY
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Features Description */}
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer group animate-fade-in" style={{ animationDelay: "600ms" }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                  <TrendingUp className="h-5 w-5 text-green-500 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="font-medium">Métricas em Tempo Real</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                V-NPS, E-Score e ROIzometer atualizados automaticamente enquanto você conversa.
              </p>
            </Card>
            
            <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer group animate-fade-in" style={{ animationDelay: "800ms" }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Sparkles className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="font-medium">Análise por IA</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Detecção automática de ROI, riscos e oportunidades nas conversas.
              </p>
            </Card>
            
            <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer group animate-fade-in" style={{ animationDelay: "1000ms" }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <MessageSquare className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="font-medium">Ações Rápidas</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Registre eventos de ROI e riscos com um clique, sem sair do WhatsApp.
              </p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
