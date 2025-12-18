import { useState } from "react";
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
  Phone
} from "lucide-react";
import { Link } from "react-router-dom";

export default function ExtensionPreview() {
  const [activeTab, setActiveTab] = useState("chat");
  const [searchQuery, setSearchQuery] = useState("");

  // Mock data for demonstration
  const mockClient = {
    name: "João Silva",
    phone: "+55 11 99999-8888",
    avatar: null,
    vnps: 8.5,
    vnpsClass: "promoter",
    escore: 75,
    roizometer: 68,
    trend: "up",
    status: "active",
    lastMessage: "Ótimo, vou implementar as mudanças que discutimos!",
    lastMessageTime: "10:45"
  };

  const mockMessages = [
    { id: 1, type: "received", text: "Bom dia! Como posso ajudar hoje?", time: "09:30" },
    { id: 2, type: "sent", text: "Olá! Queria discutir sobre o progresso do projeto", time: "09:32" },
    { id: 3, type: "received", text: "Claro! Tivemos bons avanços essa semana. O faturamento aumentou 15%", time: "09:35" },
    { id: 4, type: "sent", text: "Excelente! Isso é muito positivo", time: "09:36" },
    { id: 5, type: "received", text: "Sim! A equipe está bem motivada com os resultados", time: "09:38" },
  ];

  const mockRecentClients = [
    { name: "Maria Santos", vnps: 9.2, status: "promoter" },
    { name: "Pedro Oliveira", vnps: 6.5, status: "neutral" },
    { name: "Ana Costa", vnps: 4.2, status: "detractor" },
  ];

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
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-4">
              <Sparkles className="h-6 w-6 text-primary" />
              <div>
                <p className="font-medium">Esta é uma demonstração visual da extensão ROY</p>
                <p className="text-sm text-muted-foreground">
                  A extensão aparece como um painel lateral no WhatsApp Web, exibindo informações do cliente em tempo real.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Main Preview Area */}
          <div className="grid lg:grid-cols-[1fr,380px] gap-6">
            {/* WhatsApp Mock */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-[#075E54] text-white p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-white/20 text-white">JS</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{mockClient.name}</p>
                    <p className="text-xs text-white/70">online</p>
                  </div>
                  <Search className="h-5 w-5 text-white/70" />
                </div>
              </CardHeader>
              <CardContent className="p-0 bg-[#ECE5DD] min-h-[500px] relative">
                {/* Chat Background Pattern */}
                <div className="absolute inset-0 opacity-5" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }} />
                
                {/* Messages */}
                <div className="relative p-4 space-y-2">
                  {mockMessages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`flex ${msg.type === "sent" ? "justify-end" : "justify-start"}`}
                    >
                      <div 
                        className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm ${
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
                </div>

                {/* Input Area */}
                <div className="absolute bottom-0 left-0 right-0 bg-[#F0F0F0] p-2 flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="text-gray-500">
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Input 
                    placeholder="Digite uma mensagem" 
                    className="flex-1 bg-white border-0 rounded-full"
                  />
                  <Button variant="ghost" size="icon" className="text-gray-500">
                    <Mic className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Extension Panel Mock */}
            <Card className="overflow-hidden border-2 border-primary/30 shadow-xl">
              {/* Extension Header */}
              <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <span className="font-bold text-sm">ROY</span>
                    </div>
                    <span className="font-semibold">ROY Extension</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Client Info */}
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
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
                    <Button variant="ghost" size="sm" className="text-primary text-xs">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Scores */}
                <div className="p-4 border-b">
                  <div className="grid grid-cols-3 gap-3">
                    {/* V-NPS */}
                    <div className="text-center p-2 rounded-lg bg-green-500/10">
                      <div className="text-lg font-bold text-green-600">{mockClient.vnps}</div>
                      <div className="text-[10px] text-muted-foreground">V-NPS</div>
                      <Badge className="mt-1 text-[9px] bg-green-500 hover:bg-green-500">
                        Promotor
                      </Badge>
                    </div>
                    {/* E-Score */}
                    <div className="text-center p-2 rounded-lg bg-blue-500/10">
                      <div className="text-lg font-bold text-blue-600">{mockClient.escore}</div>
                      <div className="text-[10px] text-muted-foreground">E-Score</div>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span className="text-[9px] text-green-500">+5%</span>
                      </div>
                    </div>
                    {/* ROIzometer */}
                    <div className="text-center p-2 rounded-lg bg-amber-500/10">
                      <div className="text-lg font-bold text-amber-600">{mockClient.roizometer}</div>
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
                      className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2 text-xs"
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Chat
                    </TabsTrigger>
                    <TabsTrigger 
                      value="insights" 
                      className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2 text-xs"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Insights
                    </TabsTrigger>
                    <TabsTrigger 
                      value="history" 
                      className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2 text-xs"
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      Histórico
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="chat" className="p-4 space-y-3 mt-0">
                    {/* AI Analysis */}
                    <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium">Análise da Conversa</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Cliente demonstra satisfação com resultados. Mencionou aumento de 15% no faturamento - classificado como ROI tangível.
                      </p>
                    </div>

                    {/* Quick Actions */}
                    <div>
                      <p className="text-xs font-medium mb-2">Ações Rápidas</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="text-xs h-7">
                          <Plus className="h-3 w-3 mr-1" />
                          Registrar ROI
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Sinalizar Risco
                        </Button>
                      </div>
                    </div>

                    {/* Recent Events */}
                    <div>
                      <p className="text-xs font-medium mb-2">Eventos Recentes</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 text-xs">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span>ROI: Aumento de faturamento +15%</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded bg-blue-500/10 text-xs">
                          <MessageSquare className="h-3 w-3 text-blue-500" />
                          <span>Engajamento alto no WhatsApp</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="insights" className="p-4 space-y-3 mt-0">
                    <div className="text-center py-8 text-muted-foreground">
                      <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Insights da IA sobre o cliente</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="p-4 space-y-3 mt-0">
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Histórico de interações</p>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Footer */}
                <div className="p-3 border-t bg-muted/30">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Sincronizado há 2 min</span>
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-primary">
                      Abrir no ROY
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Features Description */}
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <h3 className="font-medium">Métricas em Tempo Real</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                V-NPS, E-Score e ROIzometer atualizados automaticamente enquanto você conversa.
              </p>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-medium">Análise por IA</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Detecção automática de ROI, riscos e oportunidades nas conversas.
              </p>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
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
