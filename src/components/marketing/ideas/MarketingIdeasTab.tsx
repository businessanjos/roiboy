import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, LayoutGrid, List, Filter } from "lucide-react";
import { useMarketingIdeas, type MarketingIdea, type IdeaStatus, type AssigneeRole } from "@/hooks/useMarketingIdeas";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { IdeaCard } from "./IdeaCard";
import { IdeaDialog } from "./IdeaDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const COLUMNS: { status: IdeaStatus; label: string; color: string }[] = [
  { status: "draft", label: "Rascunho", color: "bg-muted-foreground" },
  { status: "approved", label: "Aprovado", color: "bg-blue-500" },
  { status: "in_production", label: "Em produção", color: "bg-amber-500" },
  { status: "scheduled", label: "Agendado", color: "bg-purple-500" },
  { status: "posted", label: "Postado", color: "bg-green-500" },
];

type ViewMode = "kanban" | "list";

export function MarketingIdeasTab() {
  const { ideas, isLoading } = useMarketingIdeas();
  const { currentUser } = useCurrentUser();
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

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[400px]" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
