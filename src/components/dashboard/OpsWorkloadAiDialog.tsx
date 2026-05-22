import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Sparkles,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Users,
  Calendar,
  Brain,
  History,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import MarkdownRenderer from "@/components/sales/MarkdownRenderer";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: any[];
  periodLabel: string;
  rpcParams?: any;
}


interface SavedReport {
  id: string;
  created_at: string;
  period_label: string;
  rows_count: number;
  gemini_content: string | null;
  gpt_content: string | null;
  gemini_error: string | null;
  gpt_error: string | null;
}

type View = "current" | "history";

export function OpsWorkloadAiDialog({ open, onOpenChange, rows, periodLabel, rpcParams }: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [usedFallback, setUsedFallback] = useState(false);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<View>("current");
  const [history, setHistory] = useState<SavedReport[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          attended: a.attended + (r.clients_attended || 0),
          inbound: a.inbound + (r.inbound_msgs || 0),
          outbound: a.outbound + (r.outbound_msgs || 0),
        }),
        { attended: 0, inbound: 0, outbound: 0 }
      ),
    [rows]
  );

  const hasContent = !!content;

  const run = async () => {
    setLoading(true);
    setErr(null);
    setContent("");
    setUsedFallback(false);
    setStartedAt(Date.now());
    setElapsed(0);
    const { data, error } = await supabase.functions.invoke("ops-workload-insights", {
      body: { rows, periodLabel, rpcParams },
    });

    if (error) {
      setErr(error.message || "Falha ao gerar insights");
    } else if ((data as any)?.error) {
      setErr((data as any).error);
    } else {
      const d = data as any;
      setContent(d.content || "");
      setUsedFallback(!!d.usedFallback);
      loadHistory();
    }
    setLoading(false);
    setStartedAt(null);
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from("ops_workload_ai_reports")
      .select("id,created_at,period_label,rows_count,gemini_content,gpt_content,gemini_error,gpt_error,models_used")
      .order("created_at", { ascending: false })
      .limit(30);
    if (!error && data) setHistory(data as any);
    setHistoryLoading(false);
  };

  const openSaved = (r: SavedReport) => {
    const unified = (r as any).models_used?.unified_content as string | undefined;
    setContent(unified || r.gemini_content || r.gpt_content || "");
    setUsedFallback(!unified);
    setView("current");
  };

  const deleteSaved = async (id: string) => {
    if (!confirm("Excluir este resumo?")) return;
    const { error } = await supabase.from("ops_workload_ai_reports").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setHistory((h) => h.filter((x) => x.id !== id));
    toast({ title: "Excluído" });
  };

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 100) / 10), 100);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    if (open) {
      loadHistory();
      if (rows.length > 0 && !hasContent && !loading) run();
    }
    if (!open) {
      setContent(""); setErr(null); setCopied(false); setView("current"); setUsedFallback(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast({ title: "Copiado!", description: "Resumo copiado para a área de transferência." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0 border-0">
        {/* Hero header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-background border-b">
          <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          <DialogHeader className="relative px-7 pt-7 pb-4 space-y-4">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-primary/30 blur-xl rounded-2xl" />
                <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
                  <Brain className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  Resumo Inteligente
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                </DialogTitle>
                <DialogDescription className="text-sm mt-1">
                  Análise executiva com Gemini Pro e GPT — salva no histórico
                </DialogDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={view === "current" ? "secondary" : "ghost"}
                  onClick={() => setView("current")}
                  className="gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Atual
                </Button>
                <Button
                  size="sm"
                  variant={view === "history" ? "secondary" : "ghost"}
                  onClick={() => setView("history")}
                  className="gap-1.5"
                >
                  <History className="h-3.5 w-3.5" /> Histórico
                  {history.length > 0 && (
                    <span className="ml-1 text-[10px] rounded-full bg-primary/20 text-primary px-1.5">
                      {history.length}
                    </span>
                  )}
                </Button>
              </div>
            </div>

            {view === "current" && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
                  <Calendar className="h-3 w-3" /> {periodLabel}
                </Badge>
                <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
                  <Users className="h-3 w-3" /> {rows.length} consultora{rows.length !== 1 ? "s" : ""}
                </Badge>
                {totals.attended > 0 && (
                  <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
                    {totals.attended.toLocaleString("pt-BR")} atendidos
                  </Badge>
                )}
                {totals.inbound + totals.outbound > 0 && (
                  <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
                    {(totals.inbound + totals.outbound).toLocaleString("pt-BR")} msgs
                  </Badge>
                )}
              </div>
            )}
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-background">
          {view === "history" ? (
            <HistoryList
              items={history}
              loading={historyLoading}
              onOpen={openSaved}
              onDelete={deleteSaved}
              onRefresh={loadHistory}
            />
          ) : (
            <div className="px-7 py-5">
              {loading && <LoadingState elapsed={elapsed} />}

              {err && !loading && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-destructive text-sm">
                        Não foi possível gerar o resumo
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 break-words">{err}</p>
                      <Button size="sm" variant="outline" className="mt-3" onClick={run}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {hasContent && !loading && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {usedFallback && (
                    <div className="mb-3 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2 flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3" />
                      Síntese unificada indisponível — exibindo o melhor draft disponível.
                    </div>
                  )}
                  <MarkdownRenderer content={content} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {view === "current" && hasContent && !loading && (
          <div className="border-t bg-muted/30 px-7 py-3 flex items-center justify-between gap-3">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              Análise unificada (Gemini Pro + GPT) · salva no histórico
            </div>
            <div className="flex items-center gap-2">
              {content && (
                <Button size="sm" variant="ghost" onClick={handleCopy}>
                  {copied ? (
                    <><Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> Copiado</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar</>
                  )}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={run} disabled={loading || rows.length === 0}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Gerar novo
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ModelErrorBlock({ error, model }: { error: string | null; model: string }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-medium text-amber-700 dark:text-amber-300">
            {model} não retornou conteúdo
          </div>
          <div className="text-xs text-muted-foreground mt-1">{error || "Sem detalhes"}</div>
        </div>
      </div>
    </div>
  );
}

function HistoryList({
  items, loading, onOpen, onDelete, onRefresh,
}: {
  items: SavedReport[];
  loading: boolean;
  onOpen: (r: SavedReport) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="px-7 py-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Resumos salvos</h3>
        <Button size="sm" variant="ghost" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
        </Button>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Nenhum resumo salvo ainda. Gere um na aba "Atual".
        </div>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2 pr-2">
            {items.map((r) => (
              <div
                key={r.id}
                className="group rounded-lg border bg-card hover:border-primary/50 hover:bg-accent/40 transition-colors p-3 cursor-pointer flex items-center gap-3"
                onClick={() => onOpen(r)}
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Brain className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{r.period_label}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                    <span>
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                    <span>·</span>
                    <span>{r.rows_count} consultoras</span>
                    {r.gemini_content && (
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px] gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Gemini
                      </Badge>
                    )}
                    {r.gpt_content && (
                      <Badge variant="outline" className="h-4 px-1.5 text-[9px] gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> GPT
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(r.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function LoadingState({ elapsed }: { elapsed: number }) {
  const steps = [
    { label: "Coletando métricas das consultoras", threshold: 0 },
    { label: "Consultando Gemini Pro e GPT em paralelo", threshold: 2 },
    { label: "Identificando alertas e gargalos", threshold: 8 },
    { label: "Salvando resumo no histórico", threshold: 14 },
  ];
  const activeIdx = steps.reduce((acc, s, i) => (elapsed >= s.threshold ? i : acc), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-xl border bg-gradient-to-r from-primary/5 to-transparent p-4">
        <div className="relative">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div className="absolute inset-0 h-5 w-5 rounded-full bg-primary/30 blur-md animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{steps[activeIdx].label}...</div>
          <div className="text-xs text-muted-foreground">Processando · {elapsed.toFixed(1)}s</div>
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((s, i) => {
          const done = i < activeIdx;
          const current = i === activeIdx;
          return (
            <div key={i} className={`flex items-center gap-3 text-sm transition-opacity ${done || current ? "opacity-100" : "opacity-40"}`}>
              <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                done ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : current ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}>
                {done ? <Check className="h-3 w-3" /> : current
                  ? <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  : <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
              </div>
              <span className={done ? "text-muted-foreground line-through" : ""}>{s.label}</span>
            </div>
          );
        })}
      </div>

      <div className="space-y-3 pt-2">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <div className="pt-2" />
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
