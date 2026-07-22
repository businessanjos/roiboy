import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Search, ExternalLink, ChevronDown, Sparkles, Trash2, Clock } from "lucide-react";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";
import { MarketResearchAnswer } from "./MarketResearchAnswer";

type Citation = { index: number; url: string; title: string | null };

type ResearchRow = {
  id: string;
  query: string;
  focus: string | null;
  answer: string;
  citations: Citation[] | null;
  model: string | null;
  recency: string | null;
  created_at: string;
};

const focusOptions = [
  { value: "geral", label: "Geral" },
  { value: "tam", label: "Tamanho de mercado (TAM/SAM/SOM)" },
  { value: "concorrentes", label: "Concorrentes" },
  { value: "cursos", label: "Cursos & formações" },
  { value: "tendencias", label: "Tendências recentes" },
  { value: "publico", label: "Público-alvo & jornada" },
];

const recencyOptions = [
  { value: "day", label: "Últimas 24h" },
  { value: "week", label: "Última semana" },
  { value: "month", label: "Último mês" },
  { value: "year", label: "Último ano" },
];

const suggestions = [
  "Quantas clínicas de estética existem no Brasil e qual o crescimento nos últimos 3 anos?",
  "Quantos médicos com especialização em HOF (Harmonização Orofacial) atuam no Brasil?",
  "Quais são os principais cursos e formações em harmonização facial no Brasil, com faixa de preço?",
  "Quais são os concorrentes diretos de programas de mentoria premium para dermatologistas e esteticistas?",
  "Quais tendências regulatórias da ANVISA impactam o mercado de procedimentos injetáveis em 2026?",
];

// Benchmark Eternum: perguntas fixas para comparar com o momento atual da empresa.
// Cada item define o foco ideal para a Perplexity.
const benchmarkQueries: { query: string; focus: string; label: string }[] = [
  { label: "Clínicas de estética no Brasil", focus: "tam", query: "Quantas clínicas de estética existem no Brasil hoje? Traga número total, fonte oficial (Sebrae, ABIHPEC, Receita Federal/CNAE 8690-9/04, IBGE) e recorte por região se possível." },
  { label: "Redes de franquia de estética", focus: "concorrentes", query: "Quantas redes de franquia de clínicas de estética existem no Brasil? Liste as principais redes (ex.: Onodera, Sóbrancelhas, Espaçolaser, Bio Ritmo Estética, Ella Clínica, etc.), com nome, ano de fundação e posicionamento." },
  { label: "Unidades por rede de franquia", focus: "concorrentes", query: "Para as principais redes de franquia de clínicas de estética no Brasil, informe o número de unidades por rede (últimos dados disponíveis) e o total agregado. Cite fonte (ABF, sites oficiais das redes)." },
  { label: "Clínicas individuais (não-rede)", focus: "tam", query: "Do total de clínicas de estética no Brasil, quantas são independentes/individuais (não pertencem a redes de franquia)? Traga estimativa, metodologia e fonte." },
  { label: "Médicos dermatologistas", focus: "publico", query: "Quantos médicos dermatologistas com título de especialista pela SBD (Sociedade Brasileira de Dermatologia) e/ou registro no CFM/RQE existem no Brasil? Traga número, ano de referência e fonte oficial." },
  { label: "Especialistas em HOF", focus: "publico", query: "Quantos profissionais especialistas em Harmonização Orofacial (HOF) atuam no Brasil hoje, considerando dentistas com especialização reconhecida pelo CFO e médicos com formação em HOF? Traga números separados por categoria (dentista vs médico) e fonte oficial (CFO, CFM, associações)." },
];



export default function MarketResearchTab() {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState("geral");
  const [recency, setRecency] = useState("month");

  const historyQuery = useQuery({
    queryKey: ["mi-market-research", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mi_market_research")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as ResearchRow[];
    },
    enabled: !!currentUser?.account_id,
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("mi-market-research", {
        body: { query: query.trim(), focus: focus === "geral" ? null : focus, recency },
      });
      if (error) {
        const msg = await extractEdgeFunctionError(error, "Falha ao pesquisar mercado");
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Pesquisa concluída");
      setQuery("");
      qc.invalidateQueries({ queryKey: ["mi-market-research", currentUser?.account_id] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro na pesquisa"),
  });

  const [batchRunning, setBatchRunning] = useState<string | null>(null);

  async function runBenchmarkOne(item: typeof benchmarkQueries[number]) {
    setBatchRunning(item.label);
    try {
      const { data, error } = await supabase.functions.invoke("mi-market-research", {
        body: { query: item.query, focus: item.focus, recency: "year" },
      });
      if (error) throw new Error(await extractEdgeFunctionError(error, "Falha na pesquisa"));
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`✓ ${item.label}`);
      qc.invalidateQueries({ queryKey: ["mi-market-research", currentUser?.account_id] });
    } catch (e: any) {
      toast.error(`${item.label}: ${e?.message || "erro"}`);
    } finally {
      setBatchRunning(null);
    }
  }

  async function runBenchmarkAll() {
    for (const item of benchmarkQueries) {
      await runBenchmarkOne(item);
    }
    toast.success("Benchmark Eternum concluído");
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mi_market_research").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pesquisa removida");
      qc.invalidateQueries({ queryKey: ["mi-market-research", currentUser?.account_id] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover"),
  });


  const isRunning = runMutation.isPending;

  return (
    <div className="space-y-4">
      <Card className="border-purple-200 bg-purple-50/30 dark:bg-purple-950/10">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                🎯 Benchmark Eternum — Panorama do mercado
              </CardTitle>
              <CardDescription>
                Perguntas fixas para dimensionar o mercado brasileiro de estética e comparar com o momento atual da empresa. Rode uma a uma ou tudo de uma vez.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="default"
              onClick={runBenchmarkAll}
              disabled={!!batchRunning || isRunning}
            >
              {batchRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Rodar tudo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {benchmarkQueries.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => runBenchmarkOne(item)}
                disabled={!!batchRunning || isRunning}
                className="flex items-center justify-between gap-2 text-left rounded-md border bg-background hover:bg-muted/60 transition-colors px-3 py-2 disabled:opacity-50"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{item.label}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{item.query}</div>
                </div>
                {batchRunning === item.label ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>

        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" /> Pesquisa de mercado ao vivo
          </CardTitle>
          <CardDescription>
            Pergunte qualquer coisa sobre o mercado de estética avançada, HOF, dermatologia,
            mentorias e formações. A IA (Perplexity Sonar) busca fontes reais e responde com
            citações verificáveis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex.: Quantos dermatologistas com CRM ativo existem no Brasil? Cite fonte."
            className="min-h-24"
            disabled={isRunning}
          />
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Foco:</span>
              <Select value={focus} onValueChange={setFocus} disabled={isRunning}>
                <SelectTrigger className="w-52 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {focusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Frescor:</span>
              <Select value={recency} onValueChange={setRecency} disabled={isRunning}>
                <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {recencyOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="ml-auto"
              onClick={() => runMutation.mutate()}
              disabled={isRunning || query.trim().length < 5}
            >
              {isRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Pesquisar mercado
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuery(s)}
                disabled={isRunning}
                className="text-xs px-2 py-1 rounded-md border bg-muted/40 hover:bg-muted transition-colors disabled:opacity-50"
              >
                {s.length > 70 ? s.slice(0, 68) + "…" : s}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Histórico de pesquisas
        </div>

        {historyQuery.isLoading && (
          <p className="text-sm text-muted-foreground italic">Carregando…</p>
        )}
        {historyQuery.data && historyQuery.data.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma pesquisa ainda. Comece fazendo uma pergunta acima.
            </CardContent>
          </Card>
        )}

        {historyQuery.data?.map((r) => (
          <Collapsible key={r.id} defaultOpen={historyQuery.data[0]?.id === r.id}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CollapsibleTrigger className="group text-left w-full">
                      <div className="flex items-start gap-2">
                        <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
                        <div className="flex-1">
                          <p className="font-medium text-sm leading-snug">{r.query}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {r.focus && <Badge variant="outline" className="text-[10px]">{r.focus}</Badge>}
                            {r.model && <Badge variant="outline" className="text-[10px]">{r.model}</Badge>}
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                            </span>
                            {r.citations && (
                              <span className="text-[10px] text-muted-foreground">
                                · {r.citations.length} fonte{r.citations.length === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(r.id)}
                    disabled={deleteMutation.isPending}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-3">
                  <MarketResearchAnswer answer={r.answer} />
                  {r.citations && r.citations.length > 0 && (
                    <div className="pt-3 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Fontes citadas</p>
                      <ol className="space-y-1.5">
                        {r.citations.map((c) => (
                          <li key={c.index} className="text-xs flex items-start gap-2">
                            <span className="text-muted-foreground tabular-nums shrink-0">[{c.index}]</span>
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline break-all inline-flex items-start gap-1"
                            >
                              <span>{c.title || c.url}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 mt-0.5" />
                            </a>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
