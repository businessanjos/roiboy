import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send, Loader2, Plus, Trash2, Pin, Sparkles,
  TrendingUp, TrendingDown, Minus, ArrowUpRight,
  Target, Users, Flame, Filter, LineChart,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PinKpiDialog } from "./PinKpiDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

const SUGGESTIONS: { icon: any; label: string; q: string }[] = [
  { icon: Target,    label: "CAC",          q: "Qual foi o CAC do último mês? Mostre a composição." },
  { icon: TrendingDown, label: "Churn",     q: "Quanto perdi em MRR por 'sem fit' nos últimos 30 dias?" },
  { icon: LineChart, label: "Funil M-1",   q: "Compare o funil deste mês vs o mês anterior." },
  { icon: Users,     label: "Closer fraco", q: "Qual closer está com pior conversão este mês?" },
  { icon: Flame,     label: "Top perdas",   q: "Top 5 motivos de perda em valor nos últimos 90 dias." },
  { icon: Filter,    label: "Melhor origem", q: "Qual a origem com melhor ticket médio em 2025?" },
];

const PERIOD_OPTIONS = [
  { label: "1m", value: 1 },
  { label: "3m", value: 3 },
  { label: "6m", value: 6 },
  { label: "12m", value: 12 },
  { label: "24m", value: 24 },
];

function groupSessions(sessions: any[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;
  const weekAgo = today - 7 * 86_400_000;
  const groups: Record<string, any[]> = { Hoje: [], Ontem: [], "Últimos 7 dias": [], Anterior: [] };
  for (const s of sessions) {
    const t = new Date(s.last_message_at || 0).getTime();
    if (t >= today) groups["Hoje"].push(s);
    else if (t >= yesterday) groups["Ontem"].push(s);
    else if (t >= weekAgo) groups["Últimos 7 dias"].push(s);
    else groups["Anterior"].push(s);
  }
  return groups;
}

export function SalesDashboardChatTab() {
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [stage, setStage] = useState<"idle" | "gemini" | "gpt">("idle");
  const [pinTarget, setPinTarget] = useState<{ kpi: KpiPayload; question: string } | null>(null);
  const [periodMonths, setPeriodMonths] = useState<number>(12);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const grouped = useMemo(() => groupSessions(sessions), [sessions]);

  useEffect(() => {
    if (!sessionId) { setMessages([]); return; }
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

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const newSession = () => { setSessionId(null); setMessages([]); };

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
    if (!user) { toast.error("Sessão expirada"); setIsStreaming(false); return; }

    let sid = sessionId;
    if (!sid) {
      const { data: u } = await supabase.from("users").select("account_id").eq("auth_user_id", user.id).maybeSingle();
      if (!u?.account_id) { toast.error("Conta não encontrada"); setIsStreaming(false); return; }
      const { data: s, error } = await supabase
        .from("sales_chat_sessions")
        .insert({ account_id: u.account_id, auth_user_id: user.id, title: question.slice(0, 60) })
        .select().single();
      if (error || !s) { toast.error("Erro ao criar conversa"); setIsStreaming(false); return; }
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
      id: userMsgId, session_id: sid, auth_user_id: user.id, role: "user", content: question,
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-dashboard-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ question, session_id: sid, history, period_months: periodMonths }),
      });
      if (!resp.ok || !resp.body) {
        const t = await resp.text().catch(() => "");
        throw new Error(t || `HTTP ${resp.status}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = ""; let acc = ""; let metadata: any = null;
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
          let parsed: any;
          try { parsed = JSON.parse(payload); } catch { continue; }
          if (parsed.type === "delta") {
            acc += parsed.content;
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)));
          } else if (parsed.type === "status") {
            setStage(parsed.stage === "gpt" ? "gpt" : "gemini");
          } else if (parsed.type === "metadata") {
            metadata = { kpi: parsed.kpi, chart_hint: parsed.chart_hint, analysis: parsed.analysis };
          } else if (parsed.type === "error") {
            throw new Error(parsed.error);
          }
        }
      }
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false, metadata } : m)));
      await supabase.from("sales_chat_messages").insert({
        id: assistantId, session_id: sid, auth_user_id: user.id, role: "assistant", content: acc, metadata: metadata ?? {},
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
      <div className="rounded-xl border bg-card/50 backdrop-blur flex flex-col overflow-hidden">
        <div className="p-3 border-b">
          <Button onClick={newSession} size="sm" className="w-full gap-2 shadow-sm">
            <Plus className="w-4 h-4" /> Nova conversa
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-4">
            {Object.entries(grouped).map(([label, items]) =>
              items.length === 0 ? null : (
                <div key={label}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-2 mb-1 font-medium">{label}</p>
                  <div className="space-y-0.5">
                    {items.map((s: any) => (
                      <div
                        key={s.id}
                        onClick={() => setSessionId(s.id)}
                        className={cn(
                          "group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
                          sessionId === s.id ? "bg-primary/10 text-foreground" : "hover:bg-muted/60 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span className="truncate flex-1">{s.title}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )}
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-6 text-center">Nenhuma conversa ainda.</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat */}
      <div className="rounded-xl border bg-gradient-to-b from-card to-background flex flex-col overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b bg-card/40 backdrop-blur">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-amber-500/70 flex items-center justify-center shadow-[0_0_24px_-4px_hsl(var(--primary)/0.45)]">
              <Sparkles className="w-4.5 h-4.5 text-primary-foreground" strokeWidth={2.25} />
            </div>
            {isStreaming && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold tracking-tight leading-none">AION</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Copiloto executivo · dados em tempo real</p>
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-lg border bg-muted/40">
            {PERIOD_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setPeriodMonths(o.value)}
                className={cn(
                  "px-2.5 py-1 text-[11px] rounded-md font-medium transition-all",
                  periodMonths === o.value
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div ref={scrollRef} className="px-5 py-6 space-y-6 max-w-3xl mx-auto w-full">
            {messages.length === 0 && (
              <div className="pt-12 pb-4">
                <div className="text-center mb-8">
                  <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-amber-500/70 items-center justify-center mb-4 shadow-[0_0_40px_-8px_hsl(var(--primary)/0.5)]">
                    <Sparkles className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight">Pergunte à AION</h2>
                  <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
                    Análise comercial e financeira a partir dos seus dados reais. Pergunte qualquer coisa sobre funil, CAC, churn ou ranking de times.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.q}
                      onClick={() => sendQuestion(s.q)}
                      className="group flex items-start gap-3 text-left p-3 rounded-xl border bg-card hover:border-primary/40 hover:bg-primary/[0.03] transition-all"
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
                        <s.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-medium">{s.label}</p>
                        <p className="text-sm leading-snug mt-0.5">{s.q}</p>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm bg-primary text-primary-foreground shadow-sm">
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary via-primary/80 to-amber-500/70 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-3">
                    {(m.content || m.isStreaming) && (
                      <div className="prose prose-sm dark:prose-invert max-w-none
                        prose-headings:font-semibold prose-headings:tracking-tight
                        prose-p:leading-relaxed prose-p:my-2
                        prose-strong:text-foreground prose-strong:font-semibold
                        prose-table:my-3 prose-table:text-sm
                        prose-th:bg-muted/50 prose-th:font-medium prose-th:text-xs prose-th:uppercase prose-th:tracking-wider
                        prose-td:py-1.5 prose-em:text-muted-foreground prose-em:text-xs">
                        <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                      </div>
                    )}
                    {m.metadata?.kpi && (
                      <div className="rounded-xl border bg-card p-4 flex items-center gap-4 shadow-sm">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-medium">{m.metadata.kpi.period || "KPI"}</Badge>
                            {m.metadata.kpi.trend === "up" && <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
                            {m.metadata.kpi.trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-rose-500" />}
                            {m.metadata.kpi.trend === "flat" && <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5">{m.metadata.kpi.label}</p>
                          <p className="text-2xl font-bold tracking-tight mt-0.5 tabular-nums">{m.metadata.kpi.value_text ?? m.metadata.kpi.value}</p>
                          {m.metadata.kpi.comparison && (
                            <p className="text-xs text-muted-foreground mt-1">{m.metadata.kpi.comparison}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 shrink-0"
                          onClick={() => {
                            const q = [...messages].reverse().find((x) => x.role === "user")?.content ?? "";
                            setPinTarget({ kpi: m.metadata!.kpi!, question: q });
                          }}
                        >
                          <Pin className="w-3.5 h-3.5" /> Fixar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            ))}

            {isStreaming && (
              <div className="flex gap-3 items-center pl-10">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                </div>
                <span className="text-xs text-muted-foreground">
                  {stage === "gemini" ? "Analisando dados…" : "Gerando insight…"}
                </span>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className="border-t bg-card/40 backdrop-blur p-3">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 rounded-2xl border bg-background shadow-sm focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/40 transition-all">
              <textarea
                ref={textareaRef}
                rows={1}
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
                className="flex-1 resize-none bg-transparent px-4 py-3 text-sm focus:outline-none placeholder:text-muted-foreground/60 max-h-[200px]"
              />
              <Button
                onClick={() => sendQuestion(input)}
                disabled={isStreaming || !input.trim()}
                size="icon"
                className="m-1.5 rounded-xl shrink-0 h-9 w-9"
              >
                {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
              AION usa Gemini + GPT-5 sobre seus dados. Sempre confirme números críticos.
            </p>
          </div>
        </div>
      </div>

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
