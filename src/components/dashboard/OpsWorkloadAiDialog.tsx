import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MarkdownRenderer from "@/components/sales/MarkdownRenderer";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: any[];
  periodLabel: string;
}

export function OpsWorkloadAiDialog({ open, onOpenChange, rows, periodLabel }: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [insights, setInsights] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const totals = useMemo(() => {
    return rows.reduce(
      (a, r) => ({
        attended: a.attended + (r.clients_attended || 0),
        inbound: a.inbound + (r.inbound_msgs || 0),
        outbound: a.outbound + (r.outbound_msgs || 0),
      }),
      { attended: 0, inbound: 0, outbound: 0 }
    );
  }, [rows]);

  const run = async () => {
    setLoading(true);
    setErr(null);
    setInsights("");
    setStartedAt(Date.now());
    setElapsed(0);
    const { data, error } = await supabase.functions.invoke("ops-workload-insights", {
      body: { rows, periodLabel },
    });
    if (error) {
      setErr(error.message || "Falha ao gerar insights");
    } else if ((data as any)?.error) {
      setErr((data as any).error);
    } else {
      setInsights((data as any)?.insights || "");
    }
    setLoading(false);
    setStartedAt(null);
  };

  // Elapsed timer
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 100) / 10), 100);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    if (open && rows.length > 0 && !insights && !loading) {
      run();
    }
    if (!open) {
      setInsights("");
      setErr(null);
      setCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(insights);
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
        {/* Hero header with gradient */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-background border-b">
          {/* Decorative blobs */}
          <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          <DialogHeader className="relative px-7 pt-7 pb-5 space-y-4">
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
                  Análise executiva da demanda das consultoras de operações
                </DialogDescription>
              </div>
            </div>

            {/* Context chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
                <Calendar className="h-3 w-3" />
                {periodLabel}
              </Badge>
              <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
                <Users className="h-3 w-3" />
                {rows.length} consultora{rows.length !== 1 ? "s" : ""}
              </Badge>
              {totals.attended > 0 && (
                <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
                  {totals.attended.toLocaleString("pt-BR")} clientes atendidos
                </Badge>
              )}
              {totals.inbound + totals.outbound > 0 && (
                <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 font-normal">
                  {(totals.inbound + totals.outbound).toLocaleString("pt-BR")} mensagens
                </Badge>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-5 bg-background">
          {loading && <LoadingState elapsed={elapsed} />}

          {err && !loading && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-destructive text-sm">Não foi possível gerar o resumo</h4>
                  <p className="text-xs text-muted-foreground mt-1 break-words">{err}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={run}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
                  </Button>
                </div>
              </div>
            </div>
          )}

          {insights && !loading && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <MarkdownRenderer content={insights} />
            </div>
          )}
        </div>

        {/* Footer */}
        {insights && !loading && (
          <div className="border-t bg-muted/30 px-7 py-3 flex items-center justify-between gap-3">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              Gerado por IA · Sempre valide informações críticas
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={handleCopy}>
                {copied ? (
                  <><Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> Copiado</>
                ) : (
                  <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar</>
                )}
              </Button>
              <Button size="sm" variant="outline" onClick={run}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LoadingState({ elapsed }: { elapsed: number }) {
  const steps = [
    { label: "Coletando métricas das consultoras", threshold: 0 },
    { label: "Cruzando volume vs tempo de resposta", threshold: 2 },
    { label: "Identificando alertas e gargalos", threshold: 5 },
    { label: "Sintetizando recomendações executivas", threshold: 8 },
  ];
  const activeIdx = steps.reduce((acc, s, i) => (elapsed >= s.threshold ? i : acc), 0);

  return (
    <div className="space-y-6">
      {/* Animated status */}
      <div className="flex items-center gap-3 rounded-xl border bg-gradient-to-r from-primary/5 to-transparent p-4">
        <div className="relative">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div className="absolute inset-0 h-5 w-5 rounded-full bg-primary/30 blur-md animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{steps[activeIdx].label}...</div>
          <div className="text-xs text-muted-foreground">
            Processando · {elapsed.toFixed(1)}s
          </div>
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-2">
        {steps.map((s, i) => {
          const done = i < activeIdx;
          const current = i === activeIdx;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 text-sm transition-opacity ${
                done || current ? "opacity-100" : "opacity-40"
              }`}
            >
              <div
                className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  done
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : current
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? (
                  <Check className="h-3 w-3" />
                ) : current ? (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                )}
              </div>
              <span className={done ? "text-muted-foreground line-through" : ""}>{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Skeleton preview */}
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
