import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_SCREENING_QUESTIONS, type ScreeningQuestion } from "@/lib/hr/screeningQuestions";

interface Props {
  jobId: string;
  answers: Record<string, unknown> | null | undefined;
}

export default function CandidateScreeningAnswers({ jobId, answers }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: job } = useQuery({
    queryKey: ["hr-job-screening-questions", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_jobs")
        .select("id, screening_questions")
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; screening_questions: unknown } | null;
    },
  });

  const questions: ScreeningQuestion[] = useMemo(() => {
    const custom = job?.screening_questions;
    if (Array.isArray(custom) && custom.length > 0) return custom as ScreeningQuestion[];
    return DEFAULT_SCREENING_QUESTIONS;
  }, [job]);

  const rows = useMemo(() => {
    const raw = (answers && typeof answers === "object" ? answers : {}) as Record<string, unknown>;
    const known = questions.map((q) => ({
      id: q.id,
      label: q.label,
      minLength: q.minLength,
      value: typeof raw[q.id] === "string" ? (raw[q.id] as string).trim() : "",
    }));
    const extras = Object.keys(raw)
      .filter((k) => !questions.some((q) => q.id === k))
      .map((k) => ({
        id: k,
        label: k,
        minLength: undefined as number | undefined,
        value: typeof raw[k] === "string" ? (raw[k] as string).trim() : JSON.stringify(raw[k]),
      }));
    return [...known, ...extras].filter((r) => r.value.length > 0);
  }, [answers, questions]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success("Resposta copiada");
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const copyAll = () => {
    const text = rows.map((r, i) => `${String(i + 1).padStart(2, "0")}. ${r.label}\n${r.value}`).join("\n\n");
    copy("__all__", text);
  };

  if (rows.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3 gap-2">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
          <MessageSquareQuote className="h-3.5 w-3.5" />
          Respostas do candidato
          <Badge variant="secondary" className="ml-1 text-[10px]">{rows.length}</Badge>
        </h4>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={copyAll}>
          {copiedKey === "__all__" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Copiar tudo
        </Button>
      </div>

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.id} className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug">
                <span className="text-muted-foreground mr-1.5">{String(i + 1).padStart(2, "0")}</span>
                {r.label}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => copy(r.id, r.value)}
                aria-label="Copiar resposta"
              >
                {copiedKey === r.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{r.value}</p>
            <p className="mt-2 text-[11px] text-muted-foreground/80">
              {r.value.length} caracteres{r.minLength ? ` · mín. ${r.minLength}` : ""}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
