import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Sparkles, Loader2, Plus, MessageSquareText, Trash2, Pin, BrainCircuit } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PinKpiDialog } from "./PinKpiDialog";

interface KpiPayload {
  label: string;
  value: number;
  value_text?: string;
  unit?: string | null;
  period?: string;
  comparison?: string;
  trend?: "up" | "down" | "flat";
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: { kpi?: KpiPayload | null; chart_hint?: any; analysis?: string };
  isStreaming?: boolean;
}

const SUGGESTIONS = [
  "Qual closer está com pior conversão este mês?",
  "Quanto perdi em MRR por 'sem fit' nos últimos 30 dias?",
  "Compare o funil deste mês vs o mês anterior",
  "Qual a origem com melhor ticket médio em 2025?",
  "Top 5 motivos de perda em valor nos últimos 90 dias",
];

export function SalesDashboardChatTab() {
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [stage, setStage] = useState<"idle" | "gemini" | "gpt">("idle");
  const [pinTarget, setPinTarget] = useState<{ kpi: KpiPayload; question: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: sessions = [] } = useQuery({
    queryKey: ["sales-chat-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_chat_sessions")
        .select("id,title,last_message_at")
        .order("last_message_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("sales_chat_messages")
        .select("id,role,content,metadata")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      setMessages((data ?? []) as Message[]);
    })();
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const newSession = () => {
    setSessionId(null);
    setMessages([]);
  };

  const deleteSession = async (id: string) => {
    await supabase.from("sales_chat_sessions").delete().eq("id", id);
    if (sessionId === id) newSession();
    qc.invalidateQueries({ queryKey: ["sales-chat-sessions"] });
  };

  const sendQuestion = async (question: string) => {
    if (!question.trim() || isStreaming) return;
    setIsStreaming(true);
    setStage("gemini");
    setInput("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada");
      setIsStreaming(false);
      return;
    }

    let sid = sessionId;
    if (!sid) {
      const { data: u } = await supabase.from("users").select("account_id").eq("auth_user_id", user.id).maybeSingle();
      if (!u?.account_id) {
        toast.error("Conta não encontrada");
        setIsStreaming(false);
        return;
      }
      const { data: s, error } = await supabase
        .from("sales_chat_sessions")
        .insert({ account_id: u.account_id, auth_user_id: user.id, title: question.slice(0, 60) })
        .select()
        .single();
      if (error || !s) {
        toast.error("Erro ao criar conversa");
        setIsStreaming(false);
        return;
      }
      sid = s.id;
      setSessionId(sid);
      qc.invalidateQueries({ queryKey: ["sales-chat-sessions"] });
    }

    const userMsgId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: question },
      { id: assistantId, role: "assistant", content: "", isStreaming: true },
    ]);

    await supabase.from("sales_chat_messages").insert({
      id: userMsgId,
      session_id: sid,
      auth_user_id: user.id,
      role: "user",
      content: question,
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-dashboard-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ question, session_id: sid, history }),
      });
      if (!resp.ok || !resp.body) {
        const t = await resp.text().catch(() => "");
        throw new Error(t || `HTTP ${resp.status}`);
      }
      setStage("gpt");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let metadata: any = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === "delta") {
              acc += parsed.content;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)),
              );
            } else if (parsed.type === "metadata") {
              metadata = { kpi: parsed.kpi, chart_hint: parsed.chart_hint, analysis: parsed.analysis };
            } else if (parsed.type === "error") {
              throw new Error(parsed.error);
            }
          } catch {/* incomplete */}
        }
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false, metadata } : m)),
      );
      await supabase.from("sales_chat_messages").insert({
        id: assistantId,
        session_id: sid,
        auth_user_id: user.id,
        role: "assistant",
        content: acc,
        metadata: metadata ?? {},
      });
      await supabase.from("sales_chat_sessions").update({ last_message_at: new Date().toISOString() }).eq("id", sid);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar resposta");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
      setStage("idle");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[600px]">
      {/* Sessions */}
      <Card className="p-3 flex flex-col gap-2 overflow-hidden">
        <Button onClick={newSession} variant="default" size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Nova conversa
        </Button>
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {sessions.map((s: any) => (
              <div
                key={s.id}
                className={cn(
                  "group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer text-sm hover:bg-muted",
                  sessionId === s.id && "bg-muted",
                )}
                onClick={() => setSessionId(s.id)}
              >
                <MessageSquareText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate flex-1">{s.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-4">Nenhuma conversa ainda.</p>
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Chat */}
      <Card className="flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <BrainCircuit className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">AION</p>
            <p className="text-xs text-muted-foreground">Gemini Pro analisa · GPT-5 gera o insight</p>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div ref={scrollRef} className="px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-3 pt-8">
                <p className="text-sm text-muted-foreground">Comece com uma pergunta:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendQuestion(s)}
                      className="text-xs px-3 py-2 rounded-full border bg-muted/40 hover:bg-muted transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-4 py-3 text-sm",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{m.content || (m.isStreaming ? "…" : "")}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                  {m.metadata?.kpi && (
                    <div className="mt-3 p-3 rounded-md bg-background border flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">{m.metadata.kpi.label}</p>
                        <p className="text-lg font-bold">{m.metadata.kpi.value_text ?? m.metadata.kpi.value}</p>
                        {m.metadata.kpi.comparison && (
                          <p className="text-xs text-muted-foreground">{m.metadata.kpi.comparison}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => {
                          const q = [...messages].reverse().find((x) => x.role === "user")?.content ?? "";
                          setPinTarget({ kpi: m.metadata!.kpi!, question: q });
                        }}
                      >
                        <Pin className="w-3.5 h-3.5" /> Fixar como KPI
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isStreaming && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                {stage === "gemini" ? "Gemini Pro analisando dados…" : "GPT-5 gerando insight…"}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendQuestion(input);
              }
            }}
            placeholder="Pergunte qualquer coisa sobre a operação…"
            disabled={isStreaming}
          />
          <Button onClick={() => sendQuestion(input)} disabled={isStreaming || !input.trim()} className="gap-2">
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar
          </Button>
        </div>
      </Card>

      {pinTarget && (
        <PinKpiDialog
          open={!!pinTarget}
          onOpenChange={(o) => !o && setPinTarget(null)}
          kpi={pinTarget.kpi}
          question={pinTarget.question}
          onPinned={() => {
            setPinTarget(null);
            qc.invalidateQueries({ queryKey: ["sales-pinned-kpis"] });
            toast.success("KPI fixado no dashboard");
          }}
        />
      )}
    </div>
  );
}
