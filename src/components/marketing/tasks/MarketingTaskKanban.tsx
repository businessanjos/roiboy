import { useState, useMemo, useCallback } from "react";
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
  CollisionDetection,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { MarketingKanbanColumn } from "./MarketingKanbanColumn";
import { MarketingKanbanCard } from "./MarketingKanbanCard";
import { MarketingTask } from "@/hooks/useMarketingTasks";
import { MarketingTaskColumn } from "@/hooks/useMarketingTaskColumns";

interface MarketingTaskKanbanProps {
  tasks: MarketingTask[];
  columns: MarketingTaskColumn[];
  onEditTask: (taskId: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onColumnChange: (taskId: string, column: MarketingTaskColumn) => void;
  onAddTask: (columnId?: string) => void;
  subtaskCounts: Record<string, { total: number; completed: number }>;
  onReorderTasks?: (updates: { id: string; display_order: number }[]) => void;
}

export function MarketingTaskKanban({
  tasks,
  columns,
  onEditTask,
  onToggleComplete,
  onColumnChange,
  onAddTask,
  subtaskCounts,
  onReorderTasks,
}: MarketingTaskKanbanProps) {
  const [activeTask, setActiveTask] = useState<MarketingTask | null>(null);

  const columnIds = useMemo(() => new Set(columns.map((c) => c.id)), [columns]);
  const firstColumnId = columns[0]?.id;

  const collisionDetectionStrategy: CollisionDetection = useCallback(
    (args) => {
      const pointerCollisions = pointerWithin(args);
      const intersections = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
      const columnHit = intersections.find((c) => columnIds.has(String(c.id)));
      if (columnHit) return [columnHit];
      const first = getFirstCollision(intersections);
      return first ? [{ id: first } as any] : [];
    },
    [columnIds]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, MarketingTask[]> = {};
    columns.forEach((c) => (grouped[c.id] = []));
    tasks.forEach((task) => {
      const key = task.column_id && grouped[task.column_id] ? task.column_id : firstColumnId;
      if (key) grouped[key].push(task);
    });
    Object.keys(grouped).forEach((k) => grouped[k].sort((a, b) => a.display_order - b.display_order));
    return grouped;
  }, [tasks, columns, firstColumnId]);

  const handleDragStart = (e: DragStartEvent) => {
    const task = tasks.find((t) => t.id === e.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveTask(null);
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Dropped on a column
    if (columnIds.has(overId)) {
      const target = columns.find((c) => c.id === overId);
      if (target && task.column_id !== target.id) onColumnChange(taskId, target);
      return;
    }

    // Dropped on another task
    const overTask = tasks.find((t) => t.id === overId);
    if (!overTask) return;

    if (task.column_id === overTask.column_id) {
      const list = tasksByColumn[task.column_id || firstColumnId];
      const oldIdx = list.findIndex((t) => t.id === taskId);
      const newIdx = list.findIndex((t) => t.id === overId);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        const reordered = arrayMove(list, oldIdx, newIdx);
        onReorderTasks?.(reordered.map((t, i) => ({ id: t.id, display_order: i })));
      }
    } else {
      const target = columns.find((c) => c.id === overTask.column_id);
      if (target) onColumnChange(taskId, target);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <MarketingKanbanColumn
            key={column.id}
            column={column}
            tasks={tasksByColumn[column.id] || []}
            onEditTask={onEditTask}
            onToggleComplete={onToggleComplete}
            onAddTask={() => onAddTask(column.id)}
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
