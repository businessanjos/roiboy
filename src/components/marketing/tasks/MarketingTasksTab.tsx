import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, List, LayoutGrid, Settings2 } from "lucide-react";
import { MarketingTaskList } from "./MarketingTaskList";
import { MarketingTaskDialog } from "./MarketingTaskDialog";
import { MarketingTaskSection } from "./MarketingTaskSection";
import { MarketingTaskKanban } from "./MarketingTaskKanban";
import { MarketingColumnsManagerDialog } from "./MarketingColumnsManagerDialog";
import { useMarketingTasks } from "@/hooks/useMarketingTasks";
import { useMarketingTaskSections } from "@/hooks/useMarketingTaskSections";
import { useMarketingTaskColumns, MarketingTaskColumn } from "@/hooks/useMarketingTaskColumns";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

type ViewMode = "list" | "board";

export function MarketingTasksTab() {
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isColumnsManagerOpen, setIsColumnsManagerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [addingToSection, setAddingToSection] = useState<string | null>(null);
  const [defaultColumnId, setDefaultColumnId] = useState<string | undefined>(undefined);

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

  const filteredTasks = tasks.filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const tasksBySection = sections.reduce((acc, section) => {
    acc[section.id] = filteredTasks.filter((t) => t.section_id === section.id);
    return acc;
  }, {} as Record<string, typeof tasks>);

  const uncategorizedTasks = filteredTasks.filter((t) => !t.section_id);

  const handleAddTask = (sectionId?: string, columnId?: string) => {
    setAddingToSection(sectionId || null);
    setDefaultColumnId(columnId);
    setEditingTask(null);
    setIsDialogOpen(true);
  };

  const handleEditTask = (taskId: string) => {
    setEditingTask(taskId);
    setAddingToSection(null);
    setDefaultColumnId(undefined);
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
          <Button variant="outline" onClick={() => setIsColumnsManagerOpen(true)} className="gap-2">
            <Settings2 className="h-4 w-4" />
            Etapas
          </Button>
        </div>

        <div className="flex items-center gap-2">
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
          onReorderTasks={(updates) => reorderTasks.mutate(updates)}
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
      />

      <MarketingColumnsManagerDialog open={isColumnsManagerOpen} onOpenChange={setIsColumnsManagerOpen} />
    </div>
  );
}
