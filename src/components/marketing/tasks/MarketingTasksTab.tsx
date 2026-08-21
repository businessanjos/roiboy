import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, List, LayoutGrid, Settings2, User, Filter, Circle, PlayCircle, CheckCircle2, ArrowUpDown, CalendarArrowDown, CalendarArrowUp } from "lucide-react";
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
import { isPast, isToday, parseISO, startOfDay } from "date-fns";

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
  const [viewMode, setViewMode] = usePersistedFilter<ViewMode>("marketing-tasks", "viewMode", "board");
  const [searchQuery, setSearchQuery] = usePersistedFilter<string>("marketing-tasks", "search", "");
  const [assigneeFilter, setAssigneeFilter] = usePersistedFilter<string>("marketing-tasks", "assignee", "all");
  const [statusFilter, setStatusFilter] = usePersistedFilter<StatusFilter>("marketing-tasks", "status", "all");
  const [sortFilter, setSortFilter] = usePersistedFilter<SortFilter>("marketing-tasks", "sort", "manual");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isColumnsManagerOpen, setIsColumnsManagerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [addingToSection, setAddingToSection] = useState<string | null>(null);
  const [defaultColumnId, setDefaultColumnId] = useState<string | undefined>(undefined);
  const [defaultAssigneeId, setDefaultAssigneeId] = useState<string | undefined>(undefined);

  const { tasks, isLoading: tasksLoading, updateTask, toggleComplete, reorderTasks } = useMarketingTasks();
  const { sections, isLoading: sectionsLoading, createSection } = useMarketingTaskSections();
  const { columns, isLoading: columnsLoading } = useMarketingTaskColumns();

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

  const { data: fixedTeamMembers = [] } = useQuery({
    queryKey: ["marketing-task-fixed-team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .in("email", [
          "fernanda@anjosbusiness.com.br",
          "jessicacampos@anjosbususiness.com.br",
          "videomaker@anjosbusiness.com.br",
          "m.quintana@me.com",
        ]);
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
  });

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => {
      if (t.assignee?.id) map.set(t.assignee.id, t.assignee.name || "Sem nome");
    });
    fixedTeamMembers.forEach((u) => {
      if (!map.has(u.id)) map.set(u.id, u.name || "Sem nome");
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [tasks, fixedTeamMembers]);

  const selectedAssignee = useMemo(
    () => assigneeOptions.find((a) => a.id === assigneeFilter) || null,
    [assigneeOptions, assigneeFilter],
  );

  const baseFilteredForCounts = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tasks, searchQuery, statusFilter]);

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
      return matchesSearch && matchesAssignee && matchesStatus;
    });

    if (sortFilter === "manual") {
      return filtered.sort((a, b) => a.display_order - b.display_order);
    }

    return filtered.sort((a, b) => {
      const aNull = !a.due_date;
      const bNull = !b.due_date;
      if (aNull && bNull) return a.display_order - b.display_order;
      if (aNull) return 1; // nulls last
      if (bNull) return -1;

      const aDue = startOfDay(parseISO(a.due_date!)).getTime();
      const bDue = startOfDay(parseISO(b.due_date!)).getTime();
      if (aDue === bDue) return a.display_order - b.display_order;
      return sortFilter === "due_date_asc" ? aDue - bDue : bDue - aDue;
    });
  }, [tasks, searchQuery, assigneeFilter, statusFilter, sortFilter]);


  const isSortManual = sortFilter === "manual";

  const tasksBySection = sections.reduce((acc, section) => {
    acc[section.id] = filteredTasks.filter((t) => t.section_id === section.id);
    return acc;
  }, {} as Record<string, typeof tasks>);

  const uncategorizedTasks = filteredTasks.filter((t) => !t.section_id);

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

  const handleColumnChange = async (taskId: string, column: MarketingTaskColumn) => {
    await updateTask.mutateAsync({
      id: taskId,
      column_id: column.id,
      is_completed: column.is_done,
      status: column.is_done ? "done" : "pending",
    });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button onClick={() => handleAddTask()} className="gap-2">
            <Plus className="h-4 w-4" />
            Add task
          </Button>
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

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={sortFilter} onValueChange={(value) => setSortFilter(value as SortFilter)}>
            <SelectTrigger className="w-44">
              {SORT_OPTIONS.find((s) => s.value === sortFilter)?.icon}
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
              {STATUS_OPTIONS.find((s) => s.value === statusFilter)?.icon}
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

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>

          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")} className="rounded-none">
              <List className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === "board" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("board")} className="rounded-none">
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {viewMode === "board" && (
        <MarketingTaskKanban
          tasks={filteredTasks}
          columns={columns}
          onEditTask={handleEditTask}
          onToggleComplete={(id, completed) => toggleComplete.mutate({ id, isCompleted: completed })}
          onColumnChange={handleColumnChange}
          onAddTask={(columnId) => handleAddTask(undefined, columnId)}
          subtaskCounts={subtaskCounts}
          onReorderTasks={isSortManual ? (updates) => reorderTasks.mutate(updates) : undefined}
        />
      )}

      {viewMode === "list" && (
        <div className="border rounded-lg bg-card">
          <div className="grid grid-cols-[auto,1fr,140px,120px,100px,100px] gap-2 px-4 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
            <div className="w-6" />
            <div>Task name</div>
            <div>Assignee</div>
            <div>Due date</div>
            <div>Status</div>
            <div>Priority</div>
          </div>

          {sections.map((section) => (
            <MarketingTaskSection
              key={section.id}
              section={section}
              tasks={tasksBySection[section.id] || []}
              onAddTask={() => handleAddTask(section.id)}
              onEditTask={handleEditTask}
              onToggleComplete={(id, completed) => toggleComplete.mutate({ id, isCompleted: completed })}
            />
          ))}

          {uncategorizedTasks.length > 0 && (
            <MarketingTaskList
              tasks={uncategorizedTasks}
              onEditTask={handleEditTask}
              onToggleComplete={(id, completed) => toggleComplete.mutate({ id, isCompleted: completed })}
            />
          )}

          <div className="p-4 border-t">
            <Button variant="ghost" size="sm" onClick={handleAddSection} className="text-muted-foreground hover:text-foreground gap-2">
              <Plus className="h-4 w-4" />
              Add section
            </Button>
          </div>
        </div>
      )}

      <MarketingTaskDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        taskId={editingTask}
        defaultSectionId={addingToSection}
        defaultColumnId={defaultColumnId}
        defaultAssigneeId={defaultAssigneeId}
      />

      <MarketingColumnsManagerDialog open={isColumnsManagerOpen} onOpenChange={setIsColumnsManagerOpen} />
    </div>
  );
}
