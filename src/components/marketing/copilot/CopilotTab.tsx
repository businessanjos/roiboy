import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Plus, Sparkles, Send, Trash2, Bot, User, Wrench, Lightbulb, Flame, Search, ListChecks, BookmarkPlus, Loader2 } from "lucide-react";
import { useMarketingCopilot, type CopilotMessage } from "@/hooks/useMarketingCopilot";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = [
  { icon: Lightbulb, text: "Crie 5 ideias de Reels pra essa semana baseado nas trends" },
  { icon: Flame, text: "Quais são meus melhores hooks salvos? Sugira variações" },
  { icon: Search, text: "Analise minhas tendências ativas e sugira ângulos novos" },
  { icon: ListChecks, text: "Liste minhas ideias em rascunho e priorize as 3 mais urgentes" },
];

const TOOL_ICONS: Record<string, any> = {
  criar_ideia: Lightbulb,
  salvar_hook: BookmarkPlus,
  buscar_trends: Flame,
  buscar_hooks: Search,
  listar_ideias_recentes: ListChecks,
};

const TOOL_LABELS: Record<string, string> = {
  criar_ideia: "Ideia criada",
  salvar_hook: "Hook salvo",
  buscar_trends: "Trends consultadas",
  buscar_hooks: "Hooks consultados",
  listar_ideias_recentes: "Ideias listadas",
};

export function CopilotTab() {
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    conversations, loadingConvs,
    messages, loadingMsgs,
    createConversation, sendMessage, deleteConversation,
  } = useMarketingCopilot(activeConvId);

  useEffect(() => {
    if (!activeConvId && conversations.length > 0) setActiveConvId(conversations[0].id);
  }, [conversations, activeConvId]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
  }, [messages, sendMessage.isPending]);

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg) return;

    let convId = activeConvId;
    if (!convId) {
      const conv = await createConversation.mutateAsync(msg.slice(0, 60));
      convId = conv.id;
      setActiveConvId(convId);
    }
    setInput("");
    await sendMessage.mutateAsync({ conversationId: convId, message: msg });
  };

  const handleNewConversation = async () => {
    const conv = await createConversation.mutateAsync("Nova conversa");
    setActiveConvId(conv.id);
  };

  // Renderiza mensagens agrupando tool calls visualmente
  const renderMessages = () => {
    const items: JSX.Element[] = [];
    messages.forEach((m, idx) => {
      if (m.role === "user") {
        items.push(
          <div key={m.id} className="flex gap-3 justify-end">
            <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
              <p className="text-sm whitespace-pre-wrap">{m.content}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0"><User className="h-4 w-4" /></div>
          </div>
        );
      } else if (m.role === "assistant") {
        if (m.tool_calls?.length) {
          // chip de ação
          m.tool_calls.forEach((tc: any) => {
            const Icon = TOOL_ICONS[tc.function?.name] || Wrench;
            items.push(
              <div key={`${m.id}-${tc.id}`} className="flex gap-3 items-center pl-11">
                <Badge variant="outline" className="gap-1.5 py-1">
                  <Icon className="h-3 w-3" />
                  {TOOL_LABELS[tc.function?.name] || tc.function?.name}
                </Badge>
              </div>
            );
          });
        }
        if (m.content) {
          items.push(
            <div key={`${m.id}-content`} className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0"><Bot className="h-4 w-4 text-primary" /></div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%]">
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1 [&>p]:my-1.5 [&>ul]:my-1.5 [&>ol]:my-1.5">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          );
        }
      }
      // role 'tool' → escondido (já mostrado como chip)
    });
    return items;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[500px]">
      {/* Sidebar conversas */}
      <Card className="overflow-hidden flex flex-col">
        <div className="p-3 border-b">
          <Button onClick={handleNewConversation} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" /> Nova conversa
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingConvs ? (
              <div className="text-center text-xs text-muted-foreground py-4">Carregando...</div>
            ) : conversations.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-4 px-2">
                Nenhuma conversa. Clique em "Nova conversa" pra começar.
              </div>
            ) : (
              conversations.map(c => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-muted text-sm ${activeConvId === c.id ? "bg-muted" : ""}`}
                  onClick={() => setActiveConvId(c.id)}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate flex-1">{c.title}</span>
                  <Button
                    size="icon" variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); deleteConversation.mutate(c.id); if (activeConvId === c.id) setActiveConvId(null); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Chat principal */}
      <Card className="overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center gap-2 bg-muted/30">
          <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-sm">Roy Marketing Copilot</div>
            <div className="text-xs text-muted-foreground">Estrategista de conteúdo com seu tom de voz e persona</div>
          </div>
        </div>

        <ScrollArea className="flex-1" ref={scrollRef as any}>
          <div className="p-4 space-y-4">
            {!activeConvId || messages.length === 0 ? (
              <div className="space-y-6 py-8">
                <div className="text-center space-y-2">
                  <div className="h-14 w-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
                    <Sparkles className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">Como posso ajudar hoje?</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Crio ideias, gero hooks, busco trends e organizo seu calendário editorial — tudo no seu tom de voz.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto">
                  {SUGGESTIONS.map((s, i) => (
                    <Card
                      key={i}
                      className="cursor-pointer hover:border-primary/50 transition"
                      onClick={() => handleSend(s.text)}
                    >
                      <CardContent className="p-3 flex items-start gap-2">
                        <s.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{s.text}</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : loadingMsgs ? (
              <div className="text-center text-sm text-muted-foreground py-4">Carregando...</div>
            ) : (
              <>
                {renderMessages()}
                {sendMessage.isPending && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center"><Bot className="h-4 w-4 text-primary" /></div>
                    <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs text-muted-foreground">Pensando...</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t bg-background">
          <div className="flex gap-2 items-end">
            <Textarea
              placeholder="Pergunte ou peça algo… (Ex: 'Crie 3 ideias de carrossel sobre objeções de preço')"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              className="resize-none"
              disabled={sendMessage.isPending}
            />
            <Button onClick={() => handleSend()} disabled={!input.trim() || sendMessage.isPending} size="icon" className="h-[60px] w-12">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 px-1">Enter pra enviar • Shift+Enter pra quebrar linha</p>
        </div>
      </Card>
    </div>
  );
}
