import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Send, Loader2, Bot, User, Wrench, Target, ClipboardList,
  FileText, Users as UsersIcon, Settings2, Trash2, Lightbulb, Rocket, ListTree, Calendar as CalendarIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useProjectCopilot } from "@/hooks/useProjectCopilot";

const SUGGESTIONS = [
  { icon: ListTree, text: "Quebre esse projeto num plano com marcos e datas (use as ferramentas pra criar)" },
  { icon: ClipboardList, text: "Liste as 8 tarefas críticas pra esse projeto e crie todas vinculadas" },
  { icon: Rocket, text: "Monte um plano de lançamento de 4 semanas com tarefas e marcos" },
  { icon: Lightbulb, text: "Quais são os 5 maiores riscos desse projeto e como mitigar?" },
];

const TOOL_META: Record<string, { icon: any; label: string }> = {
  criar_marco: { icon: Target, label: "Marco criado" },
  criar_tarefa: { icon: ClipboardList, label: "Tarefa criada" },
  criar_documento: { icon: FileText, label: "Documento adicionado" },
  adicionar_stakeholder_externo: { icon: UsersIcon, label: "Stakeholder adicionado" },
  atualizar_projeto: { icon: Settings2, label: "Projeto atualizado" },
};

export function ProjectCopilotPanel({ projectId }: { projectId: string }) {
  const { messages, isLoading, sendMessage, clearHistory } = useProjectCopilot(projectId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, 80);
  }, [messages, sendMessage.isPending]);

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sendMessage.isPending) return;
    setInput("");
    await sendMessage.mutateAsync(msg);
  };

  const renderMessages = () => {
    const items: JSX.Element[] = [];
    messages.forEach((m) => {
      if (m.role === "user") {
        items.push(
          <div key={m.id} className="flex gap-3 justify-end">
            <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
              <p className="text-sm whitespace-pre-wrap">{m.content}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <User className="h-4 w-4" />
            </div>
          </div>,
        );
      } else if (m.role === "assistant") {
        if (m.content || m.tool_calls) {
          items.push(
            <div key={m.id} className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 space-y-2 max-w-[85%]">
                {m.content && (
                  <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-2.5 prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:mt-2 prose-headings:mb-1">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
                {m.tool_calls?.map((tc: any) => {
                  const meta = TOOL_META[tc.function?.name] ?? { icon: Wrench, label: tc.function?.name };
                  const Icon = meta.icon;
                  let args: any = {};
                  try { args = JSON.parse(tc.function?.arguments || "{}"); } catch { /* ignore */ }
                  return (
                    <div key={tc.id} className="flex items-center gap-2 text-xs bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2">
                      <Icon className="h-3.5 w-3.5 text-purple-500" />
                      <span className="font-medium">{meta.label}:</span>
                      <span className="text-muted-foreground truncate">{args.title || args.name || args.status || JSON.stringify(args).slice(0, 60)}</span>
                    </div>
                  );
                })}
              </div>
            </div>,
          );
        }
      }
    });
    return items;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-22rem)] min-h-[480px] border rounded-xl bg-gradient-to-br from-purple-500/5 to-pink-500/5">
      <div className="flex items-center justify-between p-3 border-b bg-background/60 backdrop-blur rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="font-semibold text-sm">Copilot IA do Projeto</div>
            <div className="text-xs text-muted-foreground">Estratégia, planejamento e execução — pode criar marcos, tarefas, docs e stakeholders pra você</div>
          </div>
        </div>
        {messages.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => clearHistory.mutate()} title="Limpar conversa">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1" ref={scrollRef as any}>
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : messages.length === 0 ? (
            <div className="text-center space-y-4 py-6">
              <div className="h-14 w-14 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">Como posso ajudar nesse projeto?</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                  Peça pra montar o plano, criar marcos e tarefas, sugerir stakeholders, escrever briefings, identificar riscos.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl mx-auto pt-2">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s.text)}
                    className="text-left p-3 rounded-lg border bg-background hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group"
                  >
                    <s.icon className="h-4 w-4 text-purple-500 mb-1.5 group-hover:scale-110 transition-transform" />
                    <p className="text-sm">{s.text}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            renderMessages()
          )}
          {sendMessage.isPending && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Pensando...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t bg-background/60 backdrop-blur rounded-b-xl">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Peça um plano, novos marcos, tarefas, riscos, briefing..."
            className="min-h-[44px] max-h-32 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
          />
          <Button onClick={() => handleSend()} disabled={!input.trim() || sendMessage.isPending} size="icon" className="h-11 w-11 shrink-0">
            {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">Enter envia · Shift+Enter quebra linha · O Copilot pode criar marcos/tarefas/docs automaticamente</p>
      </div>
    </div>
  );
}
