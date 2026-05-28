import { useState } from "react";
import { Plus, Search, FolderKanban, Users, Calendar, ClipboardList, Target, DollarSign, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMarketingProjects, MarketingProject, PROJECT_STATUS_META, MarketingProjectStatus } from "@/hooks/useMarketingProjects";
import { ProjectFormDialog } from "@/components/marketing/projects/ProjectFormDialog";
import { ProjectDetailSheet } from "@/components/marketing/projects/ProjectDetailSheet";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_FILTERS: { value: MarketingProjectStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "planning", label: "Planejamento" },
  { value: "active", label: "Em execução" },
  { value: "launched", label: "Lançado" },
  { value: "on_hold", label: "Pausado" },
  { value: "completed", label: "Concluído" },
];

export default function MarketingProjects() {
  const { projects, isLoading, create, update, remove } = useMarketingProjects();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MarketingProjectStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingProject | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = projects.filter(p => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-purple-500" />
            Projetos de Marketing
          </h1>
          <p className="text-muted-foreground">
            Lançamentos, eventos internacionais e grandes iniciativas. Visão de portfólio com stakeholders, marcos, orçamento e ligação direta com eventos e tarefas.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" /> Novo Projeto
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar projeto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <Button
              key={s.value}
              variant={statusFilter === s.value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <div>
              <p className="font-medium">Nenhum projeto ainda</p>
              <p className="text-sm text-muted-foreground">Crie seu primeiro projeto — lançamento de livro, evento internacional, campanha grande.</p>
            </div>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Criar projeto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => setDetailId(project.id)}
              onEdit={() => { setEditing(project); setFormOpen(true); }}
              onDelete={() => {
                if (confirm(`Remover o projeto "${project.name}"? Esta ação não pode ser desfeita.`)) {
                  remove.mutate(project.id);
                }
              }}
            />
          ))}
        </div>
      )}

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editing}
        onSubmit={(data) => {
          if (editing) {
            update.mutate({ id: editing.id, ...data }, { onSuccess: () => setFormOpen(false) });
          } else {
            create.mutate(data, { onSuccess: () => setFormOpen(false) });
          }
        }}
      />

      <ProjectDetailSheet
        projectId={detailId}
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
      />
    </div>
  );
}

function ProjectCard({ project, onOpen, onEdit, onDelete }: { project: MarketingProject; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  const status = PROJECT_STATUS_META[project.status];
  const milestoneProgress = project.milestones_count
    ? Math.round(((project.milestones_done ?? 0) / project.milestones_count) * 100)
    : 0;

  const daysToTarget = project.target_date
    ? differenceInDays(parseISO(project.target_date), new Date())
    : null;

  return (
    <Card
      className="group relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 border-l-4"
      style={{ borderLeftColor: project.cover_color || "#8b5cf6" }}
      onClick={onOpen}
    >
      <div
        className="h-16 relative"
        style={{
          background: `linear-gradient(135deg, ${project.cover_color || "#8b5cf6"}25, ${project.cover_color || "#8b5cf6"}05)`,
        }}
      >
        {project.cover_emoji && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl">{project.cover_emoji}</div>
        )}
        <div className="absolute right-2 top-2" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Remover
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base leading-tight line-clamp-2">{project.name}</h3>
            {project.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{project.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={status.color}>{status.label}</Badge>
          {project.target_date && daysToTarget !== null && (
            <Badge variant="outline" className={
              daysToTarget < 0 ? "border-red-500/40 text-red-600" :
              daysToTarget < 14 ? "border-amber-500/40 text-amber-600" :
              "border-muted-foreground/30 text-muted-foreground"
            }>
              <Calendar className="h-3 w-3 mr-1" />
              {daysToTarget < 0
                ? `${Math.abs(daysToTarget)}d atrasado`
                : daysToTarget === 0
                ? "Hoje"
                : `em ${daysToTarget}d`}
            </Badge>
          )}
        </div>

        {project.milestones_count ? (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Target className="h-3 w-3" /> Marcos</span>
              <span className="tabular-nums">{project.milestones_done}/{project.milestones_count}</span>
            </div>
            <Progress value={milestoneProgress} className="h-1.5" />
          </div>
        ) : null}

        <div className="grid grid-cols-4 gap-2 pt-2 border-t">
          <Stat icon={Users} label="Stakeh." value={project.stakeholders_count ?? 0} />
          <Stat icon={Calendar} label="Eventos" value={project.events_count ?? 0} />
          <Stat icon={ClipboardList} label="Tarefas" value={project.tasks_count ?? 0} />
          <Stat
            icon={DollarSign}
            label="Orç."
            value={project.budget_planned ? formatCompactBRL(project.budget_planned) : "—"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <div className="text-center">
      <Icon className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-0.5" />
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}

function formatCompactBRL(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return `${v}`;
}
