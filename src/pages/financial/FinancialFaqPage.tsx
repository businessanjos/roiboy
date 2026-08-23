import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  ArrowRight,
  CircleHelp,
  TriangleAlert,
  CircleCheck,
  SlidersHorizontal,
  X,
  BookOpen,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FinancialEmptyState } from "@/components/financial/_shared/FinancialEmptyState";
import { cn } from "@/lib/utils";

type ReviewStatus = "draft" | "in_review" | "published" | "changes_requested";

interface FaqArticle {
  id: string;
  question: string;
  answer_steps: string;
  category: string;
  keywords: string[];
  status: "available" | "not_implemented" | "planned";
  related_route: string | null;
  display_order: number;
  is_published: boolean;
  review_status: ReviewStatus;
  review_notes: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string | null;
}

interface FaqAnswer {
  status: "answered" | "not_implemented" | "not_found";
  article_id: string | null;
  title: string;
  summary: string;
  steps: string[];
  related_route: string | null;
  related_article_ids: string[];
}

const CATEGORIES = [
  { value: "dashboard", label: "Dashboard & Fluxo de Caixa" },
  { value: "lancamentos", label: "Lançamentos" },
  { value: "bancos", label: "Contas Bancárias" },
  { value: "recebiveis", label: "Recebíveis" },
  { value: "cobranca", label: "Cobrança" },
  { value: "notas_fiscais", label: "Notas Fiscais" },
  { value: "conciliacao", label: "Conciliação" },
  { value: "comissoes", label: "Comissões" },
  { value: "contratos", label: "Contratos" },
  { value: "cadastros", label: "Cadastros" },
  { value: "orcamento", label: "Orçamentos & Centros de Custo" },
  { value: "relatorios", label: "Relatórios" },
  { value: "integracoes", label: "Integrações" },
  { value: "geral", label: "Geral" },
];

const categoryLabelOf = (value: string) =>
  CATEGORIES.find((c) => c.value === value)?.label ?? value;

/** Normaliza texto para busca: minúsculas, sem acentos e sem espaços extras. */
const normalize = (value: string) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const STATUS_META: Record<FaqArticle["status"], { label: string; className: string }> = {
  available: { label: "Disponível", className: "bg-success/10 text-success border-success/20" },
  not_implemented: { label: "Não implementado", className: "bg-destructive/10 text-destructive border-destructive/20" },
  planned: { label: "Planejado", className: "bg-warning/10 text-warning border-warning/20" },
};

const REVIEW_META: Record<ReviewStatus, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground border-border" },
  in_review: { label: "Em revisão", className: "bg-info/10 text-info border-info/20" },
  published: { label: "Publicado", className: "bg-success/10 text-success border-success/20" },
  changes_requested: {
    label: "Ajustes solicitados",
    className: "bg-warning/10 text-warning border-warning/20",
  },
};

const REVIEW_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todas as situações" },
  { value: "published", label: "Publicados" },
  { value: "in_review", label: "Em revisão" },
  { value: "changes_requested", label: "Ajustes solicitados" },
  { value: "draft", label: "Rascunhos" },
];

const REVIEW_ACTION_TOAST: Record<ReviewStatus, string> = {
  draft: "Artigo devolvido para rascunho",
  in_review: "Artigo enviado para revisão",
  published: "Artigo aprovado e publicado",
  changes_requested: "Ajustes solicitados ao autor",
};

const SUGGESTIONS = [
  "Como dar baixa em um boleto?",
  "Como lançar uma despesa recorrente?",
  "Como conciliar o extrato do banco?",
  "Como emitir uma nota fiscal?",
];

const emptyForm = {
  question: "",
  answer_steps: "",
  category: "geral",
  keywords: "",
  status: "available" as FaqArticle["status"],
  related_route: "",
};

function parseSteps(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.replace(/^\s*(\d+[.)-]|[-*•])\s*/, "").trim())
    .filter(Boolean);
}

export default function FinancialFaqPage() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<FaqAnswer | null>(null);
  const [searching, setSearching] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [reviewFilter, setReviewFilter] = useState<string>("all");
  const [manageMode, setManageMode] = useState(false);

  const [textFilter, setTextFilter] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FaqArticle | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: allArticles = [], isLoading } = useQuery({
    queryKey: ["financial-faq-articles", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("financial_faq_articles")
        .select("*")
        .eq("account_id", accountId)
        .order("display_order", { ascending: true })
        .order("question", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FaqArticle[];
    },
    enabled: !!accountId,
  });

  // No modo leitura o time só vê o que está publicado — sem ruído de rascunho.
  const articles = useMemo(
    () => (manageMode ? allArticles : allArticles.filter((a) => a.review_status === "published")),
    [allArticles, manageMode],
  );

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    articles.forEach((a) => map.set(a.category, (map.get(a.category) ?? 0) + 1));
    return map;
  }, [articles]);

  const allTags = useMemo(() => {
    const map = new Map<string, number>();
    articles.forEach((a) =>
      (a.keywords ?? []).forEach((k) => {
        const tag = k.trim().toLowerCase();
        if (tag) map.set(tag, (map.get(tag) ?? 0) + 1);
      }),
    );
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [articles]);

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const filtered = useMemo(() => {
    const term = normalize(textFilter);
    const tokens = term.split(/\s+/).filter((t) => t.length >= 2);

    const scored = articles
      .filter((a) => {
        if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
        if (manageMode && reviewFilter !== "all" && a.review_status !== reviewFilter) return false;
        const tags = (a.keywords ?? []).map((k) => k.trim().toLowerCase());
        if (selectedTags.length > 0 && !selectedTags.every((t) => tags.includes(t))) return false;
        return true;
      })
      .map((a) => {
        if (tokens.length === 0) return { article: a, score: 0 };

        const question = normalize(a.question);
        const steps = normalize(a.answer_steps);
        const tags = (a.keywords ?? []).map((k) => normalize(k));
        const categoryLabel = normalize(categoryLabelOf(a.category));
        const route = normalize(a.related_route ?? "");

        let score = 0;
        let matchedAll = true;

        for (const token of tokens) {
          let tokenScore = 0;
          if (question.includes(token)) tokenScore += question.startsWith(token) ? 12 : 8;
          if (tags.some((t) => t === token)) tokenScore += 7;
          else if (tags.some((t) => t.includes(token))) tokenScore += 4;
          if (categoryLabel.includes(token)) tokenScore += 3;
          if (steps.includes(token)) tokenScore += 2;
          if (route.includes(token)) tokenScore += 1;
          if (tokenScore === 0) matchedAll = false;
          score += tokenScore;
        }

        if (question.includes(term)) score += 10;
        if (a.review_status === "published") score += 2;
        if (a.status === "available") score += 1;

        return { article: a, score: matchedAll ? score : 0 };
      })
      .filter((r) => tokens.length === 0 || r.score > 0);

    if (tokens.length > 0) scored.sort((a, b) => b.score - a.score);
    return scored.map((r) => r.article);
  }, [articles, categoryFilter, reviewFilter, selectedTags, textFilter, manageMode]);

  const isRanked = normalize(textFilter).split(/\s+/).filter((t) => t.length >= 2).length > 0;

  // Agrupa por categoria quando não há busca por termo — leitura muito mais calma.
  const grouped = useMemo(() => {
    if (isRanked) return null;
    const map = new Map<string, FaqArticle[]>();
    filtered.forEach((a) => {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    });
    return [...map.entries()].sort((a, b) =>
      categoryLabelOf(a[0]).localeCompare(categoryLabelOf(b[0])),
    );
  }, [filtered, isRanked]);

  const hasFilters = selectedTags.length > 0 || !!textFilter || categoryFilter !== "all" || reviewFilter !== "all";
  const clearFilters = () => {
    setSelectedTags([]);
    setTextFilter("");
    setCategoryFilter("all");
    setReviewFilter("all");
  };

  const byId = useMemo(() => new Map(allArticles.map((a) => [a.id, a])), [allArticles]);

  const runSearch = async (raw?: string) => {
    const q = (raw ?? query).trim();
    if (raw) setQuery(raw);
    if (q.length < 3) {
      toast({ title: "Escreva a pergunta", description: "Use pelo menos 3 caracteres.", variant: "destructive" });
      return;
    }
    setSearching(true);
    setAnswer(null);
    try {
      const { data, error } = await supabase.functions.invoke("financial-faq-search", { body: { query: q } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const result = data as FaqAnswer;
      setAnswer(result);
      if (accountId) {
        await supabase.from("financial_faq_searches").insert({
          account_id: accountId,
          query: q,
          answered: result.status === "answered",
          matched_article_id: result.article_id,
          user_id: currentUser?.id ?? null,
        } as any);
      }
    } catch (e: any) {
      toast({ title: "Não consegui buscar", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!accountId) throw new Error("Conta não identificada");
      const payload = {
        account_id: accountId,
        question: form.question.trim(),
        answer_steps: form.answer_steps.trim(),
        category: form.category,
        keywords: Array.from(
          new Set(
            form.keywords
              .split(",")
              .map((k) => k.trim().toLowerCase())
              .filter(Boolean),
          ),
        ),
        status: form.status,
        related_route: form.related_route.trim() || null,
        updated_by: currentUser?.id ?? null,
      };
      if (editing) {
        const nextReview =
          editing.review_status === "published" ? { review_status: "in_review", review_notes: null } : {};
        const { error } = await supabase
          .from("financial_faq_articles")
          .update({ ...payload, ...nextReview } as any)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("financial_faq_articles")
          .insert({ ...payload, review_status: "draft", created_by: currentUser?.id ?? null } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-faq-articles"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: "Artigo salvo" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_faq_articles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-faq-articles"] });
      toast({ title: "Artigo excluído" });
    },
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ article, next, notes }: { article: FaqArticle; next: ReviewStatus; notes?: string }) => {
      const patch: Record<string, any> = {
        review_status: next,
        updated_by: currentUser?.id ?? null,
      };
      if (next === "in_review") {
        patch.submitted_by = currentUser?.id ?? null;
        patch.review_notes = null;
      }
      if (next === "published" || next === "changes_requested") {
        patch.reviewed_by = currentUser?.id ?? null;
        patch.review_notes = notes?.trim() || null;
      }
      const { error } = await supabase.from("financial_faq_articles").update(patch as any).eq("id", article.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["financial-faq-articles"] });
      toast({ title: REVIEW_ACTION_TOAST[vars.next] });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setManageMode(true);
    setDialogOpen(true);
  };

  const openEdit = (a: FaqArticle) => {
    setEditing(a);
    setForm({
      question: a.question,
      answer_steps: a.answer_steps,
      category: a.category,
      keywords: (a.keywords ?? []).join(", "),
      status: a.status,
      related_route: a.related_route ?? "",
    });
    setDialogOpen(true);
  };

  const requestChanges = (a: FaqArticle) => {
    const notes = window.prompt("O que precisa ser ajustado neste artigo?");
    if (notes === null) return;
    reviewMutation.mutate({ article: a, next: "changes_requested", notes });
  };

  const renderArticle = (a: FaqArticle) => (
    <AccordionItem
      key={a.id}
      value={a.id}
      className="border-b border-border/60 last:border-b-0"
    >
      <AccordionTrigger className="px-4 py-3.5 text-left hover:no-underline">
        <div className="flex min-w-0 flex-1 items-center gap-3 pr-3">
          <span className="min-w-0 truncate text-sm font-medium">{a.question}</span>
          {a.status !== "available" && (
            <Badge variant="outline" className={cn("shrink-0 text-[11px]", STATUS_META[a.status].className)}>
              {STATUS_META[a.status].label}
            </Badge>
          )}
          {manageMode && a.review_status !== "published" && (
            <Badge variant="outline" className={cn("shrink-0 text-[11px]", REVIEW_META[a.review_status].className)}>
              {REVIEW_META[a.review_status].label}
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 px-4 pb-5">
        {parseSteps(a.answer_steps).length > 0 ? (
          <ol className="space-y-2 text-sm">
            {parseSteps(a.answer_steps).map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="leading-relaxed text-foreground/90">{s}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">Sem passo a passo cadastrado.</p>
        )}

        {a.review_status === "changes_requested" && a.review_notes && (
          <Alert>
            <TriangleAlert className="h-4 w-4" />
            <AlertDescription>Ajustes solicitados: {a.review_notes}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {a.related_route && (
            <Button size="sm" variant="secondary" onClick={() => navigate(a.related_route!)}>
              Abrir tela
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          {(a.keywords ?? []).slice(0, 4).map((k) => (
            <button key={k} type="button" onClick={() => toggleTag(k.toLowerCase())}>
              <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                {k}
              </Badge>
            </button>
          ))}
        </div>

        {manageMode && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-2">
              {(a.review_status === "draft" || a.review_status === "changes_requested") && (
                <Button
                  size="sm"
                  onClick={() => reviewMutation.mutate({ article: a, next: "in_review" })}
                  disabled={reviewMutation.isPending}
                >
                  Enviar para revisão
                </Button>
              )}
              {a.review_status === "in_review" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => reviewMutation.mutate({ article: a, next: "published" })}
                    disabled={reviewMutation.isPending}
                  >
                    <CircleCheck className="mr-2 h-4 w-4" />
                    Aprovar e publicar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => requestChanges(a)} disabled={reviewMutation.isPending}>
                    Solicitar ajustes
                  </Button>
                </>
              )}
              {a.review_status === "published" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reviewMutation.mutate({ article: a, next: "draft" })}
                  disabled={reviewMutation.isPending}
                >
                  Despublicar
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                <Edit2 className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => deleteMutation.mutate(a.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            </div>
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  );

  return (
    <div className="mx-auto w-full max-w-4xl p-6 pb-16">
      {/* Hero de busca — foco total na pergunta */}
      <section className="pt-2 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <CircleHelp className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Como podemos ajudar?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pergunte com suas palavras e receba o passo a passo do Financeiro.
        </p>

        <div className="mx-auto mt-5 flex max-w-2xl flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
              placeholder="Ex.: como dar baixa em um boleto?"
              className="h-11 rounded-xl pl-10 text-base shadow-sm"
            />
          </div>
          <Button onClick={() => runSearch()} disabled={searching} className="h-11 rounded-xl sm:w-36">
            {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {searching ? "Buscando" : "Perguntar"}
          </Button>
        </div>

        {!answer && !searching && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => runSearch(s)}
                className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </section>

      {searching && (
        <Card className="mt-6">
          <CardContent className="space-y-2 pt-6">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </CardContent>
        </Card>
      )}

      {answer && !searching && (
        <Card className="mt-6 overflow-hidden">
          <div
            className={cn(
              "h-1 w-full",
              answer.status === "answered" ? "bg-success" : "bg-warning",
            )}
          />
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              {answer.status === "answered" ? (
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              ) : (
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              )}
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <p className="font-semibold">{answer.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{answer.summary}</p>
                </div>

                {answer.steps?.length > 0 && (
                  <ol className="space-y-2 text-sm">
                    {answer.steps.map((s, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed text-foreground/90">{s}</span>
                      </li>
                    ))}
                  </ol>
                )}

                <div className="flex flex-wrap gap-2">
                  {answer.related_route && (
                    <Button size="sm" onClick={() => navigate(answer.related_route!)}>
                      Abrir tela
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                  {answer.status !== "answered" && (
                    <Button size="sm" variant="outline" onClick={openNew}>
                      <Plus className="mr-2 h-4 w-4" />
                      Cadastrar esse passo a passo
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setAnswer(null)}>
                    Fechar
                  </Button>
                </div>

                {answer.related_article_ids?.length > 0 && (
                  <div className="space-y-1 border-t border-border pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Também pode ajudar
                    </p>
                    {answer.related_article_ids.map((id) => {
                      const a = byId.get(id);
                      if (!a) return null;
                      return (
                        <p key={id} className="text-sm text-muted-foreground">
                          • {a.question}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Biblioteca */}
      <section className="mt-10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Artigos
              <span className="text-sm font-normal text-muted-foreground">
                {filtered.length}
                {isRanked && " · por relevância"}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-44 sm:w-60">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value)}
                placeholder="Filtrar artigos"
                className="h-9 pl-9"
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtros
                  {(selectedTags.length > 0 || categoryFilter !== "all" || reviewFilter !== "all") && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                      {selectedTags.length + (categoryFilter !== "all" ? 1 : 0) + (reviewFilter !== "all" ? 1 : 0)}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {CATEGORIES.filter((c) => (categoryCounts.get(c.value) ?? 0) > 0).map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label} ({categoryCounts.get(c.value)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {manageMode && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Situação</Label>
                    <Select value={reviewFilter} onValueChange={setReviewFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REVIEW_FILTERS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                            {f.value !== "all" &&
                              ` (${allArticles.filter((a) => a.review_status === f.value).length})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {allTags.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tags</Label>
                    <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                      {allTags.map(([tag, count]) => (
                        <button key={tag} type="button" onClick={() => toggleTag(tag)}>
                          <Badge
                            variant={selectedTags.includes(tag) ? "default" : "outline"}
                            className="cursor-pointer text-[11px] font-normal"
                          >
                            {tag}
                            <span className="ml-1 opacity-60">{count}</span>
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {hasFilters && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
                    <X className="mr-2 h-4 w-4" />
                    Limpar filtros
                  </Button>
                )}
              </PopoverContent>
            </Popover>

            <Button
              variant={manageMode ? "default" : "ghost"}
              size="sm"
              className="h-9 gap-2"
              onClick={() => {
                setManageMode((v) => !v);
                setReviewFilter("all");
              }}
            >
              <Settings2 className="h-4 w-4" />
              Gerenciar
            </Button>
          </div>
        </div>

        {manageMode && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-2.5">
            <p className="text-xs text-muted-foreground">
              Modo gestão: rascunhos e artigos em revisão também aparecem aqui.
            </p>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Novo artigo
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <FinancialEmptyState
              icon={CircleHelp}
              title={articles.length === 0 ? "Nenhum artigo publicado ainda" : "Nada encontrado com esses filtros"}
              description={
                articles.length === 0
                  ? "Cadastre o passo a passo das dúvidas mais frequentes do time."
                  : "Ajuste o termo, a categoria ou as tags selecionadas."
              }
              action={
                hasFilters
                  ? { label: "Limpar filtros", onClick: clearFilters, icon: X }
                  : { label: "Novo artigo", onClick: openNew, icon: Plus }
              }
            />
          </Card>
        ) : grouped ? (
          <div className="space-y-5">
            {grouped.map(([category, list]) => (
              <div key={category} className="space-y-2">
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {categoryLabelOf(category)}
                  <span className="ml-2 font-normal opacity-70">{list.length}</span>
                </p>
                <Card className="overflow-hidden">
                  <Accordion type="multiple">{list.map(renderArticle)}</Accordion>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <Accordion type="multiple">{filtered.map(renderArticle)}</Accordion>
          </Card>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar artigo" : "Novo artigo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pergunta</Label>
              <Input
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="Como eu faço pra dar baixa em um boleto?"
              />
            </div>
            <div className="space-y-2">
              <Label>Passo a passo (um passo por linha)</Label>
              <Textarea
                rows={8}
                value={form.answer_steps}
                onChange={(e) => setForm({ ...form, answer_steps: e.target.value })}
                placeholder={"Abra Financeiro > Recebíveis > Boletos\nLocalize o boleto pelo nome do cliente\nClique em Ações > Dar baixa"}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as FaqArticle["status"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponível</SelectItem>
                    <SelectItem value="planned">Planejado</SelectItem>
                    <SelectItem value="not_implemented">Não implementado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tags / palavras-chave (separadas por vírgula)</Label>
                <Input
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  placeholder="boleto, baixa, quitar"
                />
              </div>
              <div className="space-y-2">
                <Label>Tela relacionada (rota)</Label>
                <Input
                  value={form.related_route}
                  onChange={(e) => setForm({ ...form, related_route: e.target.value })}
                  placeholder="/financial/recebiveis?tab=boletos"
                />
              </div>
            </div>
            {editing && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Situação: {REVIEW_META[editing.review_status].label}</p>
                <p className="text-xs text-muted-foreground">
                  Artigos só aparecem para o time depois de aprovados. Ao editar um artigo publicado, ele volta para
                  revisão.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.question.trim()}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
