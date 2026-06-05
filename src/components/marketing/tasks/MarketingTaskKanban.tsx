import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  CollisionDetection,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useCallback } from "react";
import { MarketingKanbanColumn } from "./MarketingKanbanColumn";
import { MarketingKanbanCard } from "./MarketingKanbanCard";
import { MarketingTask, MarketingTaskStatus } from "@/hooks/useMarketingTasks";

interface MarketingTaskKanbanProps {
  tasks: MarketingTask[];
  onEditTask: (taskId: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onStatusChange: (taskId: string, newStatus: MarketingTaskStatus) => void;
  onAddTask: (status?: MarketingTaskStatus) => void;
  subtaskCounts: Record<string, { total: number; completed: number }>;
  onReorderTasks?: (updates: { id: string; display_order: number }[]) => void;
}

const columns: { status: MarketingTaskStatus; title: string }[] = [
  { status: "pending", title: "A Fazer" },
  { status: "in_progress", title: "Fazendo" },
  { status: "done", title: "Concluído" },
];

export function MarketingTaskKanban({
  tasks,
  onEditTask,
  onToggleComplete,
  onStatusChange,
  onAddTask,
  subtaskCounts,
  onReorderTasks,
}: MarketingTaskKanbanProps) {
  const [activeTask, setActiveTask] = useState<MarketingTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<MarketingTaskStatus, MarketingTask[]> = {
      pending: [],
      in_progress: [],
      done: [],
    };

    tasks.forEach((task) => {
      const status = task.status as MarketingTaskStatus;
      if (grouped[status]) {
        grouped[status].push(task);
      } else {
        grouped.pending.push(task);
      }
    });

    // Sort by display_order within each status
    Object.keys(grouped).forEach((status) => {
      grouped[status as MarketingTaskStatus].sort((a, b) => a.display_order - b.display_order);
    });

    return grouped;
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;
    const task = tasks.find((t) => t.id === taskId);

    if (!task) return;

    // Check if dropped on a column
    if (columns.some((col) => col.status === overId)) {
      const newStatus = overId as MarketingTaskStatus;
      if (task.status !== newStatus) {
        onStatusChange(taskId, newStatus);
      }
      return;
    }

    // Check if dropped on another task
    const overTask = tasks.find((t) => t.id === overId);
    if (!overTask) return;

    if (task.status === overTask.status) {
      // REORDER within same column
      const columnTasks = tasksByStatus[task.status];
      const oldIndex = columnTasks.findIndex((t) => t.id === taskId);
      const newIndex = columnTasks.findIndex((t) => t.id === overId);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(columnTasks, oldIndex, newIndex);
        const updates = reordered.map((t, index) => ({
          id: t.id,
          display_order: index,
        }));
        onReorderTasks?.(updates);
      }
    } else {
      // Move to different column
      onStatusChange(taskId, overTask.status);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the active task
    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Check if we're over a column
    const overColumn = columns.find((col) => col.status === overId);
    if (overColumn) {
      return; // Will be handled in dragEnd
    }

    // Check if we're over another task
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask && activeTask.status !== overTask.status) {
      // Crossing to a different column
      return; // Will be handled in dragEnd
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <MarketingKanbanColumn
            key={column.status}
            status={column.status}
            title={column.title}
            tasks={tasksByStatus[column.status]}
            onEditTask={onEditTask}
            onToggleComplete={onToggleComplete}
            onAddTask={() => onAddTask(column.status)}
            subtaskCounts={subtaskCounts}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="rotate-3 opacity-90">
            <MarketingKanbanCard
              task={activeTask}
              onEdit={() => {}}
              onToggleComplete={() => {}}
              subtaskInfo={subtaskCounts[activeTask.id]}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
