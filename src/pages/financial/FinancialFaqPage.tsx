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
  Tag,
  TriangleAlert,
  CircleCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
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
import { FinancialPageHeader } from "@/components/financial/_shared/FinancialPageHeader";
import { FinancialEmptyState } from "@/components/financial/_shared/FinancialEmptyState";

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


const STATUS_META: Record<FaqArticle["status"], { label: string; className: string }> = {
  available: { label: "Disponível", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  not_implemented: { label: "Não implementado", className: "bg-destructive/10 text-destructive border-destructive/20" },
  planned: { label: "Planejado", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
};

const REVIEW_META: Record<ReviewStatus, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground border-border" },
  in_review: { label: "Em revisão", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  published: { label: "Publicado", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  changes_requested: {
    label: "Ajustes solicitados",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
};

const REVIEW_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
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

  const [textFilter, setTextFilter] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FaqArticle | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: articles = [], isLoading } = useQuery({
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
        if (reviewFilter !== "all" && a.review_status !== reviewFilter) return false;
        const tags = (a.keywords ?? []).map((k) => k.trim().toLowerCase());
        if (selectedTags.length > 0 && !selectedTags.every((t) => tags.includes(t))) return false;
        return true;
      })
      .map((a) => {
        if (tokens.length === 0) return { article: a, score: 0 };

        const question = normalize(a.question);
        const steps = normalize(a.answer_steps);
        const tags = (a.keywords ?? []).map((k) => normalize(k));
        const categoryLabel = normalize(CATEGORIES.find((c) => c.value === a.category)?.label ?? a.category);
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

        // Frase completa vale bônus
        if (question.includes(term)) score += 10;
        if (a.review_status === "published") score += 2;
        if (a.status === "available") score += 1;

        return { article: a, score: matchedAll ? score : 0 };
      })
      .filter((r) => tokens.length === 0 || r.score > 0);

    if (tokens.length > 0) scored.sort((a, b) => b.score - a.score);
    return scored.map((r) => r.article);
  }, [articles, categoryFilter, reviewFilter, selectedTags, textFilter]);

  const isRanked = normalize(textFilter).split(/\s+/).filter((t) => t.length >= 2).length > 0;


  const byId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);

  const runSearch = async () => {
    const q = query.trim();
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
        // Editar um artigo publicado devolve o conteúdo para revisão.
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


  return (
    <div className="space-y-6 p-6">
      <FinancialPageHeader
        title="Central de Ajuda"
        description="Pergunte como fazer algo no Financeiro e receba o passo a passo. Se ainda não existir, avisamos."
        icon={CircleHelp}
        actions={
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo artigo
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runSearch();
                }}
                placeholder="Ex.: como eu faço pra dar baixa em um boleto?"
                className="pl-9"
              />
            </div>
            <Button onClick={runSearch} disabled={searching} className="sm:w-40">
              {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {searching ? "Buscando..." : "Perguntar"}
            </Button>
          </div>

          {searching && (
            <div className="space-y-2">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          )}

          {answer && !searching && (
            <div
              className={`rounded-lg border p-4 ${
                answer.status === "answered"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-amber-500/30 bg-amber-500/5"
              }`}
            >
              <div className="flex items-start gap-2">
                {answer.status === "answered" ? (
                  <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                )}
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="font-semibold">{answer.title}</p>
                    <p className="text-sm text-muted-foreground">{answer.summary}</p>
                  </div>

                  {answer.steps?.length > 0 && (
                    <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                      {answer.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {answer.related_route && (
                      <Button size="sm" variant="outline" onClick={() => navigate(answer.related_route!)}>
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
                  </div>

                  {answer.related_article_ids?.length > 0 && (
                    <div className="space-y-1 border-t border-border pt-2">
                      <p className="text-xs font-medium uppercase text-muted-foreground">Também pode ajudar</p>
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
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">
            Todos os artigos
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {filtered.length} de {articles.length}
            </span>
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value)}
                placeholder="Filtrar por termo, tag ou tela"
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias ({articles.length})</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label} ({categoryCounts.get(c.value) ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={reviewFilter} onValueChange={setReviewFilter}>
              <SelectTrigger className="sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVIEW_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                    {f.value !== "all"
                      ? ` (${articles.filter((a) => a.review_status === f.value).length})`
                      : ` (${articles.length})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

          </div>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            {allTags.map(([tag, count]) => {
              const active = selectedTags.includes(tag);
              return (
                <button key={tag} type="button" onClick={() => toggleTag(tag)}>
                  <Badge
                    variant={active ? "default" : "outline"}
                    className="cursor-pointer text-xs font-normal"
                  >
                    {tag}
                    <span className="ml-1 opacity-60">{count}</span>
                  </Badge>
                </button>
              );
            })}
            {(selectedTags.length > 0 || textFilter || categoryFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  setSelectedTags([]);
                  setTextFilter("");
                  setCategoryFilter("all");
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <FinancialEmptyState
          icon={CircleHelp}
          title={articles.length === 0 ? "Nenhum artigo cadastrado" : "Nenhum artigo com esses filtros"}
          description={
            articles.length === 0
              ? "Cadastre o passo a passo das dúvidas mais frequentes do time."
              : "Ajuste o termo, a categoria ou as tags selecionadas."
          }
          action={{ label: "Novo artigo", onClick: openNew, icon: Plus }}
        />

      ) : (
        <Accordion type="multiple" className="rounded-lg border border-border">
          {filtered.map((a) => (
            <AccordionItem key={a.id} value={a.id} className="px-4">
              <AccordionTrigger className="text-left">
                <div className="flex flex-1 flex-wrap items-center gap-2 pr-3">
                  <span className="font-medium">{a.question}</span>
                  <Badge variant="outline" className={STATUS_META[a.status].className}>
                    {STATUS_META[a.status].label}
                  </Badge>
                  <Badge variant="outline" className={REVIEW_META[a.review_status].className}>
                    {REVIEW_META[a.review_status].label}
                  </Badge>

                  <Badge variant="secondary">
                    {CATEGORIES.find((c) => c.value === a.category)?.label ?? a.category}
                  </Badge>
                  {(a.keywords ?? []).slice(0, 4).map((k) => (
                    <Badge key={k} variant="outline" className="text-[11px] font-normal text-muted-foreground">
                      {k}
                    </Badge>
                  ))}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                {parseSteps(a.answer_steps).length > 0 ? (
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                    {parseSteps(a.answer_steps).map((s, i) => (
                      <li key={i}>{s}</li>
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
                {a.review_status === "in_review" && (
                  <p className="text-xs text-muted-foreground">
                    Aguardando revisão — ainda não aparece na busca do time.
                  </p>
                )}
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => requestChanges(a)}
                        disabled={reviewMutation.isPending}
                      >
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
                  {a.related_route && (

                    <Button size="sm" variant="outline" onClick={() => navigate(a.related_route!)}>
                      Abrir tela
                      <ArrowRight className="ml-2 h-4 w-4" />
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
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

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
                <p className="text-sm font-medium">
                  Situação: {REVIEW_META[editing.review_status].label}
                </p>
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
