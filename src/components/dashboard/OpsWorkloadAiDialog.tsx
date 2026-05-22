import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const run = async () => {
    setLoading(true); setErr(null); setInsights("");
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
  };

  useEffect(() => {
    if (open && rows.length > 0 && !insights && !loading) {
      run();
    }
    if (!open) {
      setInsights(""); setErr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Resumo IA — Demanda das Consultoras
          </DialogTitle>
          <DialogDescription>
            Período: {periodLabel} · {rows.length} consultora(s) analisada(s)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {loading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Gerando análise com IA...
            </div>
          )}
          {err && !loading && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">Erro: {err}</div>
                <Button size="sm" variant="outline" className="mt-2" onClick={run}>
                  Tentar novamente
                </Button>
              </div>
            </div>
          )}
          {insights && !loading && (
            <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:mb-2 prose-headings:mt-4 prose-p:my-2 prose-ul:my-2">
              <ReactMarkdown>{insights}</ReactMarkdown>
            </article>
          )}
        </div>

        {insights && !loading && (
          <div className="flex justify-end pt-2 border-t">
            <Button size="sm" variant="outline" onClick={run}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Regenerar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
