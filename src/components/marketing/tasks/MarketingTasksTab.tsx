import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, List, LayoutGrid, ChevronDown } from "lucide-react";
import { MarketingTaskList } from "./MarketingTaskList";
import { MarketingTaskDialog } from "./MarketingTaskDialog";
import { MarketingTaskSection } from "./MarketingTaskSection";
import { useMarketingTasks } from "@/hooks/useMarketingTasks";
import { useMarketingTaskSections } from "@/hooks/useMarketingTaskSections";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ViewMode = "list" | "board";
type GroupBy = "section" | "status" | "assignee" | "none";

export function MarketingTasksTab() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [groupBy, setGroupBy] = useState<GroupBy>("section");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [addingToSection, setAddingToSection] = useState<string | null>(null);

  const { tasks, isLoading: tasksLoading, createTask, toggleComplete } = useMarketingTasks();
  const { sections, isLoading: sectionsLoading, createSection } = useMarketingTaskSections();

  const isLoading = tasksLoading || sectionsLoading;

  // Filter tasks by search
  const filteredTasks = tasks.filter((task) =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group tasks by section
  const tasksBySection = sections.reduce((acc, section) => {
    acc[section.id] = filteredTasks.filter((t) => t.section_id === section.id);
    return acc;
  }, {} as Record<string, typeof tasks>);

  // Tasks without section (uncategorized)
  const uncategorizedTasks = filteredTasks.filter((t) => !t.section_id);

  const handleAddTask = (sectionId?: string) => {
    setAddingToSection(sectionId || null);
    setEditingTask(null);
    setIsDialogOpen(true);
  };

  const handleEditTask = (taskId: string) => {
    setEditingTask(taskId);
    setAddingToSection(null);
    setIsDialogOpen(true);
  };

  const handleAddSection = async () => {
    await createSection.mutateAsync({ name: "Nova Seção" });
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
      {/* Header Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button onClick={() => handleAddTask()} className="gap-2">
            <Plus className="h-4 w-4" />
            Add task
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Group by
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setGroupBy("section")}>
                Seção
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("status")}>
                Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("assignee")}>
                Responsável
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("none")}>
                Nenhum
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-none"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "board" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("board")}
              className="rounded-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="border rounded-lg bg-card">
        {/* Column Headers */}
        <div className="grid grid-cols-[auto,1fr,140px,120px,100px,100px] gap-2 px-4 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
          <div className="w-6" />
          <div>Task name</div>
          <div>Assignee</div>
          <div>Due date</div>
          <div>Status</div>
          <div>Priority</div>
        </div>

        {/* Sections */}
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

        {/* Uncategorized Tasks */}
        {uncategorizedTasks.length > 0 && (
          <MarketingTaskList
            tasks={uncategorizedTasks}
            onEditTask={handleEditTask}
            onToggleComplete={(id, completed) => toggleComplete.mutate({ id, isCompleted: completed })}
          />
        )}

        {/* Add Section Button */}
        <div className="p-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddSection}
            className="text-muted-foreground hover:text-foreground gap-2"
          >
            <Plus className="h-4 w-4" />
            Add section
          </Button>
        </div>
      </div>

      {/* Task Dialog */}
      <MarketingTaskDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        taskId={editingTask}
        defaultSectionId={addingToSection}
      />
    </div>
  );
}
