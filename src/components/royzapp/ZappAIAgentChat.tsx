import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Bot, Send, User, Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AIAgent } from "./ZappAIAgentItem";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ZappAIAgentChatProps {
  agent: AIAgent;
  currentUserName: string;
  currentUserAvatar: string | null;
  onBack?: () => void;
  isMobile?: boolean;
}

const sectorColors: Record<string, { gradient: string; text: string }> = {
  operacoes: { gradient: "from-blue-500 to-indigo-600", text: "text-blue-400" },
  financas: { gradient: "from-emerald-500 to-green-600", text: "text-emerald-400" },
  vendas: { gradient: "from-purple-500 to-violet-600", text: "text-purple-400" },
};

export const ZappAIAgentChat = memo(function ZappAIAgentChat({
  agent,
  currentUserName,
  currentUserAvatar,
  onBack,
  isMobile = false,
}: ZappAIAgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const colors = sectorColors[agent.sector_id] || sectorColors.operacoes;

  // Add greeting message on mount
  useEffect(() => {
    if (agent.greeting_message && messages.length === 0) {
      setMessages([
        {
          id: `greeting-${agent.id}`,
          role: "assistant",
          content: agent.greeting_message,
          timestamp: new Date(),
        },
      ]);
    }
  }, [agent.id, agent.greeting_message]);

  // Reset messages when agent changes
  useEffect(() => {
    setMessages([]);
    if (agent.greeting_message) {
      setMessages([
        {
          id: `greeting-${agent.id}`,
          role: "assistant",
          content: agent.greeting_message,
          timestamp: new Date(),
        },
      ]);
    }
  }, [agent.id]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [agent.id]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    const currentMessages = [...messages];
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Preparar histórico de mensagens para a API
    const apiMessages = [...currentMessages, userMessage]
      .filter((m) => !m.id.startsWith("greeting-"))
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sector-agent-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            agentId: agent.id,
            messages: apiMessages,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      // Processar stream SSE
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Sem resposta");

      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantMessageId = (Date.now() + 1).toString();
      let textBuffer = "";

      // Adicionar mensagem vazia do assistente
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
        },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        // Processar linha por linha
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              // Atualizar mensagem do assistente
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessageId ? { ...m, content: assistantContent } : m
                )
              );
            }
          } catch {
            // JSON incompleto, colocar de volta no buffer
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error("Erro no chat:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao enviar mensagem");

      // Remover mensagem do usuário em caso de erro
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, agent.id]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-zapp-chat-bg">
      {/* Header */}
      <div className={cn("bg-gradient-to-r px-4 py-3 flex items-center gap-3", colors.gradient)}>
        {isMobile && onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-white hover:bg-white/20 -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Avatar className="h-10 w-10 border-2 border-white/30">
          <AvatarImage src={agent.avatar_url || undefined} />
          <AvatarFallback className="bg-white/20 text-white">
            <Bot className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white">{agent.name}</h3>
            <Badge className="bg-white/20 text-white text-[10px] px-1.5 py-0 h-4 border-0">
              <Sparkles className="h-2.5 w-2.5 mr-1" />
              IA
            </Badge>
          </div>
          <p className="text-xs text-white/80">{agent.display_name}</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={agent.avatar_url || undefined} />
                  <AvatarFallback className={cn("bg-gradient-to-br text-white", colors.gradient)}>
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                  message.role === "user"
                    ? "bg-zapp-accent text-white rounded-br-sm"
                    : "bg-zapp-panel text-zapp-text rounded-bl-sm"
                )}
              >
                {message.content || (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-zapp-text-muted">Pensando...</span>
                  </div>
                )}
              </div>
              {message.role === "user" && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={currentUserAvatar || undefined} />
                  <AvatarFallback className="bg-zapp-panel text-zapp-text text-xs">
                    {currentUserName?.slice(0, 2).toUpperCase() || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-zapp-border bg-zapp-panel">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Pergunte ao ${agent.name}...`}
            className="flex-1 bg-zapp-input border-0 text-zapp-text placeholder:text-zapp-text-muted focus-visible:ring-0"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className={cn("shrink-0 bg-gradient-to-br", colors.gradient)}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});
