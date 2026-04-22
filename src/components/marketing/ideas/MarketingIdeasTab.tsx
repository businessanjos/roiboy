import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, LayoutGrid, List, Filter, Sparkles, Loader2, ArrowUpRight, Target } from "lucide-react";
import { useMarketingIdeas, type MarketingIdea, type IdeaStatus, type AssigneeRole } from "@/hooks/useMarketingIdeas";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useContentProfile } from "@/contexts/ContentProfileContext";
import { useMarketingIdeaSuggestions } from "@/hooks/useMarketingIdeaSuggestions";
import { IdeaCard } from "./IdeaCard";
import { IdeaDialog } from "./IdeaDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const COLUMNS: { status: IdeaStatus; label: string; color: string }[] = [
  { status: "draft", label: "Rascunho", color: "bg-muted-foreground" },
  { status: "approved", label: "Aprovado", color: "bg-blue-500" },
  { status: "in_production", label: "Em produção", color: "bg-amber-500" },
  { status: "scheduled", label: "Agendado", color: "bg-purple-500" },
  { status: "posted", label: "Postado", color: "bg-green-500" },
];

type ViewMode = "kanban" | "list";

export function MarketingIdeasTab() {
  const { ideas, isLoading, createIdea } = useMarketingIdeas();
  const { currentUser } = useCurrentUser();
  const { selectedProfile } = useContentProfile();
  const { suggestIdeas } = useMarketingIdeaSuggestions();
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AssigneeRole | "all" | "mine">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<MarketingIdea | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<IdeaStatus>("draft");

  const filteredIdeas = useMemo(() => {
    return ideas.filter(i => {
      if (search && !i.title.toLowerCase().includes(search.toLowerCase()) && !i.hook?.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (roleFilter === "mine") {
        return i.assignees?.some(a => a.user_id === currentUser?.auth_user_id);
      }
      if (roleFilter !== "all") {
        return i.assignees?.some(a => a.role === roleFilter);
      }
      return true;
    });
  }, [ideas, search, roleFilter, currentUser?.auth_user_id]);

  const handleNewIdea = (status: IdeaStatus = "draft") => {
    setSelectedIdea(null);
    setDefaultStatus(status);
    setDialogOpen(true);
  };

  const handleEdit = (idea: MarketingIdea) => {
    setSelectedIdea(idea);
    setDialogOpen(true);
  };

  const handleSuggestIdeas = async () => {
    if (!selectedProfile) {
      toast.error("Selecione um perfil para a IA analisar");
      return;
    }

    await suggestIdeas.mutateAsync({
      profileId: selectedProfile.id,
      platform: selectedProfile.platform,
      username: selectedProfile.username,
      displayName: selectedProfile.display_name,
    });
  };

  const handleCreateSuggestedIdea = async (suggestion: NonNullable<typeof suggestIdeas.data>["clusters"][number]["ideas"][number]) => {
    await createIdea.mutateAsync({
      title: suggestion.title,
      hook: suggestion.hook,
      description: `${suggestion.reason}\n\nReaproveitamento sugerido: ${suggestion.reuseFrom}`,
      format: suggestion.format,
      platform: suggestion.platform,
      priority: suggestion.priorityScore >= 85 ? "urgent" : suggestion.priorityScore >= 70 ? "high" : suggestion.priorityScore >= 45 ? "medium" : "low",
      tags: suggestion.tags,
      status: "draft",
    });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[400px]" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">IA de priorização e reaproveitamento</CardTitle>
              </div>
              <CardDescription>
                A IA analisa o perfil selecionado, o backlog atual e conteúdos com melhor performance para sugerir clusters e ordenar o que vale produzir agora.
              </CardDescription>
            </div>

            <div className="flex flex-col items-start gap-2 lg:items-end">
              <Badge variant="outline" className="bg-background/80">
                {selectedProfile ? `Perfil ativo: @${selectedProfile.username}` : "Selecione um perfil"}
              </Badge>
              <Button onClick={handleSuggestIdeas} disabled={!selectedProfile || suggestIdeas.isPending} className="gap-2">
                {suggestIdeas.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Sugerir com IA
              </Button>
            </div>
          </div>
        </CardHeader>

        {suggestIdeas.data && (
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
              <div className="rounded-md border bg-background/80 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Leitura estratégica</p>
                <p className="mt-2 text-sm">{suggestIdeas.data.summary}</p>
              </div>
              <div className="rounded-md border bg-background/80 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Foco recomendado</p>
                <p className="mt-2 text-sm font-medium">{suggestIdeas.data.recommendedFocus}</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {suggestIdeas.data.clusters.map((cluster) => (
                <div key={cluster.name} className="rounded-md border bg-background/80 p-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">{cluster.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{cluster.rationale}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">3 ideias</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {cluster.reuseSignals.map((signal) => (
                        <Badge key={signal} variant="outline" className="text-[10px]">{signal}</Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    {cluster.ideas.map((suggestion, index) => (
                      <div key={`${cluster.name}-${suggestion.title}`} className="rounded-md border p-3 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                              <h4 className="text-sm font-medium leading-tight">{suggestion.title}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground">{suggestion.hook}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-semibold">{suggestion.priorityScore}</div>
                            <div className="text-[10px] text-muted-foreground">{suggestion.priorityLabel}</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">{suggestion.format}</Badge>
                          <Badge variant="outline" className="text-[10px]">{suggestion.platform}</Badge>
                          {suggestion.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px]">#{tag}</Badge>
                          ))}
                        </div>

                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex gap-2">
                            <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                            <span>{suggestion.reason}</span>
                          </div>
                          <div className="flex gap-2">
                            <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                            <span>{suggestion.reuseFrom}</span>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => handleCreateSuggestedIdea(suggestion)}
                          disabled={createIdea.isPending}
                        >
                          {createIdea.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          Criar no backlog
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => handleNewIdea()} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova ideia
          </Button>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ideias..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>

          <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
            <SelectTrigger className="w-52">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as funções</SelectItem>
              <SelectItem value="mine">⭐ Minhas tarefas</SelectItem>
              <SelectItem value="designer">🎨 Designer</SelectItem>
              <SelectItem value="social_media">📱 Social Media</SelectItem>
              <SelectItem value="videomaker">🎬 Videomaker</SelectItem>
              <SelectItem value="copywriter">✍️ Copywriter</SelectItem>
              <SelectItem value="strategist">🧠 Estrategista</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center border rounded-lg overflow-hidden">
          <Button
            variant={viewMode === "kanban" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("kanban")}
            className="rounded-none"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="rounded-none"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {COLUMNS.map(col => {
            const columnIdeas = filteredIdeas.filter(i => i.status === col.status);
            return (
              <div key={col.status} className="space-y-2 min-h-[400px]">
                <div className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${col.color}`} />
                    <span className="text-xs font-semibold uppercase tracking-wide">{col.label}</span>
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {columnIdeas.length}
                    </Badge>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleNewIdea(col.status)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {columnIdeas.map(idea => (
                    <IdeaCard key={idea.id} idea={idea} onClick={() => handleEdit(idea)} />
                  ))}
                  {columnIdeas.length === 0 && (
                    <button
                      onClick={() => handleNewIdea(col.status)}
                      className="w-full p-4 border-2 border-dashed border-muted rounded-md text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      + Adicionar ideia
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredIdeas.map(idea => (
            <IdeaCard key={idea.id} idea={idea} onClick={() => handleEdit(idea)} />
          ))}
          {filteredIdeas.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Nenhuma ideia encontrada. Comece criando uma!
            </div>
          )}
        </div>
      )}

      {dialogOpen && (
        <IdeaDialog
          key={selectedIdea?.id || "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          idea={selectedIdea}
          defaultStatus={defaultStatus}
        />
      )}
    </div>
  );
}
