import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { isHiddenTechnicalPerson } from "@/lib/peopleVisibility";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Search, List, LayoutGrid, Settings2, User, Filter, Circle, PlayCircle, CheckCircle2, ArrowUpDown, CalendarArrowDown, CalendarArrowUp, ListMinus, Maximize2, Minimize2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { MarketingTaskList } from "./MarketingTaskList";
import { MarketingTaskDialog } from "./MarketingTaskDialog";
import { MarketingTaskSection } from "./MarketingTaskSection";
import { MarketingTaskKanban } from "./MarketingTaskKanban";
import { MarketingColumnsManagerDialog } from "./MarketingColumnsManagerDialog";
import { useMarketingTasks, MarketingTask } from "@/hooks/useMarketingTasks";
import { useMarketingTaskSections } from "@/hooks/useMarketingTaskSections";
import { useMarketingTaskColumns, MarketingTaskColumn } from "@/hooks/useMarketingTaskColumns";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersistedFilter } from "@/hooks/usePersistedFilter";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMarketingTeamUsers } from "@/hooks/useMarketingTeamUsers";
import { isPast, isToday, parseISO, startOfDay } from "date-fns";
import { taskLabelCatalog, matchesTaskLabels, deliverySortKey } from "@/lib/marketing/taskDetails";
import { TaskLabelFilter } from "./TaskLabels";
import { useMarketingTaskSeparators } from "@/hooks/useMarketingTaskSeparators";
import { TaskSeparatorDialog } from "./TaskSeparator";
import type { TaskSeparator } from "@/lib/marketing/taskPresentation";

type ViewMode = "list" | "board";

type StatusFilter = "all" | MarketingTask["status"];
type SortFilter = "manual" | "due_date_asc" | "due_date_desc";

const STATUS_OPTIONS: { value: StatusFilter; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "Todas as etapas", icon: <Filter className="h-4 w-4 mr-2 text-muted-foreground" /> },
  { value: "pending", label: "Abertas", icon: <Circle className="h-4 w-4 mr-2 text-muted-foreground" /> },
  { value: "in_progress", label: "Em andamento", icon: <PlayCircle className="h-4 w-4 mr-2 text-muted-foreground" /> },
  { value: "done", label: "Concluídas", icon: <CheckCircle2 className="h-4 w-4 mr-2 text-muted-foreground" /> },
];

const SORT_OPTIONS: { value: SortFilter; label: string; icon: React.ReactNode }[] = [
  { value: "manual", label: "Ordem manual", icon: <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" /> },
  { value: "due_date_asc", label: "Vencimento ↑", icon: <CalendarArrowUp className="h-4 w-4 mr-2 text-muted-foreground" /> },
  { value: "due_date_desc", label: "Vencimento ↓", icon: <CalendarArrowDown className="h-4 w-4 mr-2 text-muted-foreground" /> },
];

export function isTaskOverdue(task: MarketingTask): boolean {
  if (!task.due_date || task.is_completed || task.status === "done") return false;
  const due = startOfDay(parseISO(task.due_date));
  return isPast(due) && !isToday(due);
}

export function MarketingTasksTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTask = searchParams.get("task");
  const requestedComment = searchParams.get("comment");
  const [viewMode, setViewMode] = usePersistedFilter<ViewMode>("marketing-tasks", "viewMode", "board");
  const [searchQuery, setSearchQuery] = usePersistedFilter<string>("marketing-tasks", "search", "");
  const [savedAssigneeFilter, setAssigneeFilter] = usePersistedFilter<string>("marketing-tasks", "assignee", "all");
  const assigneeFilter = isHiddenTechnicalPerson({ id: savedAssigneeFilter }) ? "all" : savedAssigneeFilter;
  const [statusFilter, setStatusFilter] = usePersistedFilter<StatusFilter>("marketing-tasks", "status", "all");
  const [sortFilter, setSortFilter] = usePersistedFilter<SortFilter>("marketing-tasks", "sort", "manual");
  const [labelFilter, setLabelFilter] = usePersistedFilter<string[]>("marketing-tasks", "labels", []);
  const [isBoardExpanded, setIsBoardExpanded] = useState(false);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const isFullscreen = isBoardExpanded && viewMode === "board";

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isColumnsManagerOpen, setIsColumnsManagerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [addingToSection, setAddingToSection] = useState<string | null>(null);
  const [defaultColumnId, setDefaultColumnId] = useState<string | undefined>(undefined);
  const [defaultAssigneeId, setDefaultAssigneeId] = useState<string | undefined>(undefined);
  const [separatorDialogOpen, setSeparatorDialogOpen] = useState(false);
  const [editingSeparator, setEditingSeparator] = useState<TaskSeparator | null>(null);
  const [separatorColumn, setSeparatorColumn] = useState<string | undefined>();
  const { separators, error: separatorsError, save: saveSeparator } = useMarketingTaskSeparators();

  const { tasks, error: tasksError, isLoading: tasksLoading, updateTask, toggleComplete, reorderTasks } = useMarketingTasks();
  const openedLink = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedTask || tasksLoading || openedLink.current === `${requestedTask}:${requestedComment}`) return;
    if (!tasks.some((task) => task.id === requestedTask)) return;
    openedLink.current = `${requestedTask}:${requestedComment}`;
    setEditingTask(requestedTask); setIsDialogOpen(true);
  }, [requestedTask, requestedComment, tasks, tasksLoading]);
  const onTaskDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open && requestedTask) {
      openedLink.current = null;
      const next = new URLSearchParams(searchParams); next.delete("task"); next.delete("comment");
      setSearchParams(next, { replace: true });
    }
  };
  const labelCatalog = useMemo(() => taskLabelCatalog(tasks), [tasks]);
  const { sections, isLoading: sectionsLoading, createSection } = useMarketingTaskSections();
  const { columns, isLoading: columnsLoading } = useMarketingTaskColumns();

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || isDialogOpen || isColumnsManagerOpen || separatorDialogOpen) return;
      setIsBoardExpanded(false);
      expandButtonRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen, isDialogOpen, isColumnsManagerOpen, separatorDialogOpen]);

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  const { data: subtaskCounts = {} } = useQuery({
    queryKey: ["marketing-subtask-counts", taskIds],
    queryFn: async () => {
      if (taskIds.length === 0) return {};
      const { data, error } = await supabase
        .from("marketing_task_subtasks")
        .select("task_id, is_completed")
        .in("task_id", taskIds);
      if (error) throw error;
      const counts: Record<string, { total: number; completed: number }> = {};
      (data || []).forEach((s) => {
        if (!counts[s.task_id]) counts[s.task_id] = { total: 0, completed: 0 };
        counts[s.task_id].total += 1;
        if (s.is_completed) counts[s.task_id].completed += 1;
      });
      return counts;
    },
    enabled: taskIds.length > 0,
  });

  const isLoading = tasksLoading || sectionsLoading || columnsLoading;

  const { data: marketingTeam = [] } = useMarketingTeamUsers();

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    marketingTeam.forEach((u) => {
      map.set(u.id, u.name || "Sem nome");
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [marketingTeam]);

  const selectedAssignee = useMemo(
    () => assigneeOptions.find((a) => a.id === assigneeFilter) || null,
    [assigneeOptions, assigneeFilter],
  );

  const baseFilteredForCounts = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesStatus && matchesTaskLabels(t, labelFilter);
    });
  }, [tasks, searchQuery, statusFilter, labelFilter]);

  const assigneeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: baseFilteredForCounts.length, none: 0 };
    assigneeOptions.forEach((a) => {
      counts[a.id] = 0;
    });
    baseFilteredForCounts.forEach((t) => {
      if (t.assignee_id) {
        counts[t.assignee_id] = (counts[t.assignee_id] || 0) + 1;
      } else {
        counts.none += 1;
      }
    });
    return counts;
  }, [baseFilteredForCounts, assigneeOptions]);

  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((t) => {
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAssignee =
        assigneeFilter === "all" ||
        (assigneeFilter === "none" ? !t.assignee_id : t.assignee_id === assigneeFilter);
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesAssignee && matchesStatus && matchesTaskLabels(t, labelFilter);
    });

    if (sortFilter === "manual") {
      return filtered.sort((a, b) => a.display_order - b.display_order);
    }

    return filtered.sort((a, b) => {
      const aDue = deliverySortKey(a);
      const bDue = deliverySortKey(b);
      if (aDue === bDue) return a.display_order - b.display_order;
      if (!aDue) return 1;
      if (!bDue) return -1;
      return sortFilter === "due_date_asc" ? aDue.localeCompare(bDue) : bDue.localeCompare(aDue);
    });
  }, [tasks, searchQuery, assigneeFilter, statusFilter, sortFilter, labelFilter]);


  const isSortManual = sortFilter === "manual";

  const tasksBySection = sections.reduce((acc, section) => {
    acc[section.id] = filteredTasks.filter((t) => t.section_id === section.id);
    return acc;
  }, {} as Record<string, typeof tasks>);

  const uncategorizedTasks = filteredTasks.filter((t) => !t.section_id);

  // Critérios de busca/filtro/ordenação do modo lista — ao mudar, cada seção volta à página 1.
  const listFiltersKey = [searchQuery, assigneeFilter, statusFilter, sortFilter, labelFilter];

  const handleAddTask = (sectionId?: string, columnId?: string, assigneeId?: string) => {
    setAddingToSection(sectionId || null);
    setDefaultColumnId(columnId);
    setDefaultAssigneeId(assigneeId);
    setEditingTask(null);
    setIsDialogOpen(true);
  };

  const handleEditTask = (taskId: string) => {
    setEditingTask(taskId);
    setAddingToSection(null);
    setDefaultColumnId(undefined);
    setDefaultAssigneeId(undefined);
    setIsDialogOpen(true);
  };

  const handleAddSection = async () => {
    await createSection.mutateAsync({ name: "Nova Seção" });
  };
  const openSeparator = (columnId?: string, separator?: TaskSeparator) => {
    setEditingSeparator(separator || null); setSeparatorColumn(columnId); setSeparatorDialogOpen(true);
  };

  const handleColumnChange = async (taskId: string, column: MarketingTaskColumn) => {
    await updateTask.mutateAsync({
      id: taskId,
      column_id: column.id,
      is_completed: column.is_done,
      status: column.is_done ? "done" : "pending",
    });
  };

  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    const task = tasks.find((t) => t.id === taskId);
    const current = columns.find((c) => c.id === (task as any)?.column_id);
    const target = completed
      ? columns.find((c) => c.is_done)
      : current?.is_done
        ? columns.find((c) => !c.is_done)
        : undefined;
    if (target && target.id !== current?.id) {
      await handleColumnChange(taskId, target);
      return;
    }
    toggleComplete.mutate({ id: taskId, isCompleted: completed });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-64" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const expandControl = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={expandButtonRef}
          variant={isFullscreen ? "secondary" : "outline"}
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label={isFullscreen ? "Reduzir quadro" : "Expandir quadro em tela cheia"}
          aria-pressed={isFullscreen}
          onClick={() => setIsBoardExpanded((expanded) => !expanded)}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isFullscreen ? "Reduzir quadro" : "Expandir quadro em tela cheia"}</TooltipContent>
    </Tooltip>
  );

  return (
    <div
      role="region"
      aria-label="Quadro de tarefas de Marketing"
      className={cn("min-w-0 space-y-4", isFullscreen && "fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-background p-3 sm:p-5")}
    >
      {isFullscreen && (
        <div className="flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Tarefas de Marketing</h2>
          {expandControl}
        </div>
      )}
      <div className={cn("flex items-center justify-between gap-4 flex-wrap", isFullscreen && "max-h-[40dvh] shrink-0 overflow-y-auto border-b pb-3")}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button onClick={() => handleAddTask()} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova tarefa
          </Button>
          {viewMode === "board" && <Button variant="outline" onClick={() => openSeparator()}><ListMinus className="h-4 w-4" />Separador</Button>}
          {selectedAssignee && (
            <Button
              variant="secondary"
              onClick={() => handleAddTask(undefined, undefined, selectedAssignee.id)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Nova tarefa para {selectedAssignee.name}
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsColumnsManagerOpen(true)} className="gap-2">
            <Settings2 className="h-4 w-4" />
            Etapas
          </Button>
        </div>

        <div className="flex min-w-0 max-w-full items-center gap-2 flex-wrap">
          <TaskLabelFilter catalog={labelCatalog} selected={labelFilter} onChange={setLabelFilter} />
          <Select value={sortFilter} onValueChange={(value) => setSortFilter(value as SortFilter)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  <div className="flex items-center">
                    {s.icon}
                    {s.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Todas as etapas" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  <div className="flex items-center">
                    {s.icon}
                    {s.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-60">
              <User className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Todas as pessoas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center justify-between w-full">
                  <span>Todas as pessoas</span>
                  <span className="ml-3 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {assigneeCounts.all || 0}
                  </span>
                </div>
              </SelectItem>
              {assigneeOptions.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{a.name}</span>
                    <span className="ml-3 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {assigneeCounts[a.id] || 0}
                    </span>
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="none">
                <div className="flex items-center justify-between w-full">
                  <span>Sem responsável</span>
                  <span className="ml-3 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {assigneeCounts.none || 0}
                  </span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="relative max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64 max-w-full"
            />
          </div>

          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button aria-label="Visualizar lista" title="Visualizar lista" variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => { setIsBoardExpanded(false); setViewMode("list"); }} className="h-11 w-11 rounded-none">
              <List className="h-4 w-4" />
            </Button>
            <Button aria-label="Visualizar quadro" title="Visualizar quadro" variant={viewMode === "board" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("board")} className="h-11 w-11 rounded-none">
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          {viewMode === "board" && !isFullscreen && expandControl}
        </div>
      </div>

      {tasksError && <p role="alert" className="text-sm text-destructive">Não foi possível atualizar as tarefas. Tente novamente.</p>}
      {separatorsError && viewMode === "board" && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os separadores.</p>}
      {!tasksError && tasks.length > 0 && filteredTasks.length === 0 && <div className="flex flex-wrap items-center gap-3 py-3 text-sm text-muted-foreground">
        <span>Nenhuma tarefa encontrada com estes filtros.</span>
        <Button variant="ghost" onClick={() => { setSearchQuery(""); setAssigneeFilter("all"); setStatusFilter("all"); setLabelFilter([]); }}>Limpar filtros</Button>
      </div>}

      {viewMode === "board" && (
        <MarketingTaskKanban
          fullHeight={isFullscreen}
          tasks={filteredTasks}
          columns={columns}
          onEditTask={handleEditTask}
          onToggleComplete={handleToggleComplete}
          onColumnChange={handleColumnChange}
          onAddTask={(columnId) => handleAddTask(undefined, columnId)}
          subtaskCounts={subtaskCounts}
          onReorderTasks={isSortManual ? (updates) => reorderTasks.mutate(updates) : undefined}
          separators={separators}
          onAddSeparator={(columnId) => openSeparator(columnId)}
          onEditSeparator={(separator) => openSeparator(separator.column_id, separator)}
          onMoveSeparator={(input) => saveSeparator.mutate(input)}
        />
      )}

      {viewMode === "list" && (
        <div className="max-w-full overflow-x-auto border rounded-lg bg-card">
          <div className="min-w-[800px]">
          <div className="grid grid-cols-[auto,1fr,140px,120px,100px,100px] gap-2 px-4 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
            <div className="w-6" />
            <div>Tarefa</div>
            <div>Responsável</div>
            <div>Entrega</div>
            <div>Status</div>
            <div>Prioridade</div>
          </div>

          {sections.map((section) => (
            <MarketingTaskSection
              key={section.id}
              section={section}
              tasks={tasksBySection[section.id] || []}
              onAddTask={() => handleAddTask(section.id)}
              onEditTask={handleEditTask}
              onToggleComplete={handleToggleComplete}
              resetKey={listFiltersKey}
            />
          ))}

          {uncategorizedTasks.length > 0 && (
            <MarketingTaskList
              tasks={uncategorizedTasks}
              onEditTask={handleEditTask}
              onToggleComplete={handleToggleComplete}
              resetKey={listFiltersKey}
            />
          )}

          <div className="p-4 border-t">
            <Button variant="ghost" size="sm" onClick={handleAddSection} className="text-muted-foreground hover:text-foreground gap-2">
              <Plus className="h-4 w-4" />
              Nova seção
            </Button>
          </div>
          </div>
        </div>
      )}

      <MarketingTaskDialog
        open={isDialogOpen}
        onOpenChange={onTaskDialogChange}
        taskId={editingTask}
        focusCommentId={requestedTask === editingTask ? requestedComment : null}
        defaultSectionId={addingToSection}
        defaultColumnId={defaultColumnId}
        defaultAssigneeId={defaultAssigneeId}
      />

      <MarketingColumnsManagerDialog open={isColumnsManagerOpen} onOpenChange={setIsColumnsManagerOpen} />
      <TaskSeparatorDialog open={separatorDialogOpen} onOpenChange={setSeparatorDialogOpen} separator={editingSeparator} defaultColumnId={separatorColumn} columns={columns} tasks={tasks} />
    </div>
  );
}
