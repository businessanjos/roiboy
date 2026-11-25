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
import { cn } from "@/lib/utils";
import { MarketingKanbanColumn } from "./MarketingKanbanColumn";
import { MarketingKanbanCard } from "./MarketingKanbanCard";
import { MarketingTask } from "@/hooks/useMarketingTasks";
import { MarketingTaskColumn } from "@/hooks/useMarketingTaskColumns";
import type { TaskSeparator } from "@/lib/marketing/taskPresentation";
import type { TaskSelectionProps } from "./TaskSelection";

interface MarketingTaskKanbanProps extends TaskSelectionProps {
  fullHeight?: boolean;
  tasks: MarketingTask[];
  columns: MarketingTaskColumn[];
  onEditTask: (taskId: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onColumnChange: (taskId: string, column: MarketingTaskColumn) => void;
  onAddTask: (columnId?: string) => void;
  subtaskCounts: Record<string, { total: number; completed: number }>;
  onReorderTasks?: (updates: { id: string; display_order: number }[]) => void;
  separators: TaskSeparator[];
  onAddSeparator: (columnId: string) => void;
  onEditSeparator: (separator: TaskSeparator) => void;
  onMoveSeparator: (input: { id: string; column_id: string; before_task_id: string | null; display_order?: number }) => void;
}

export function MarketingTaskKanban({
  fullHeight = false,
  tasks,
  columns,
  onEditTask,
  onToggleComplete,
  onColumnChange,
  onAddTask,
  subtaskCounts,
  onReorderTasks,
  separators,
  onAddSeparator,
  onEditSeparator,
  onMoveSeparator,
  ...selection
}: MarketingTaskKanbanProps) {
  const [activeTask, setActiveTask] = useState<MarketingTask | null>(null);

  const columnIds = useMemo(() => new Set(columns.map((c) => c.id)), [columns]);
  const firstColumnId = columns[0]?.id;

  const collisionDetectionStrategy: CollisionDetection = useCallback(
    (args) => {
      const pointerCollisions = pointerWithin(args);
      const intersections = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
      const itemHit = intersections.find((c) => !columnIds.has(String(c.id)));
      if (itemHit) return [itemHit];
      const columnHit = intersections.find((c) => columnIds.has(String(c.id)));
      if (columnHit) return [columnHit];
      const first = getFirstCollision(intersections);
      return first ? [{ id: first } as any] : [];
    },
    [columnIds]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, MarketingTask[]> = {};
    columns.forEach((c) => (grouped[c.id] = []));
    // Preserve the order provided by the parent (e.g., due date sorting)
    tasks.forEach((task) => {
      const key = task.column_id && grouped[task.column_id] ? task.column_id : firstColumnId;
      if (key) grouped[key].push(task);
    });
    return grouped;
  }, [tasks, columns, firstColumnId]);

  const handleDragStart = (e: DragStartEvent) => {
    const task = tasks.find((t) => t.id === e.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveTask(null);
    if (selection.selectionMode || selection.selectionDisabled) return;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;
    if (taskId === overId) return;
    const movingSeparator = separators.find((s) => `separator:${s.id}` === taskId);
    const overSeparator = separators.find((s) => `separator:${s.id}` === overId);
    if (movingSeparator) {
      if (columnIds.has(overId)) onMoveSeparator({ id: movingSeparator.id, column_id: overId, before_task_id: null });
      else if (overSeparator) onMoveSeparator({ id: movingSeparator.id, column_id: overSeparator.column_id, before_task_id: overSeparator.before_task_id, display_order: overSeparator.display_order - 0.5 });
      else {
        const target = tasks.find((task) => task.id === overId);
        const columnId = target?.column_id || firstColumnId;
        if (target && columnId) onMoveSeparator({ id: movingSeparator.id, column_id: columnId, before_task_id: target.id });
      }
      return;
    }
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Dropped on a column
    if (columnIds.has(overId)) {
      const target = columns.find((c) => c.id === overId);
      if (target && task.column_id !== target.id) onColumnChange(taskId, target);
      return;
    }

    // Dropped on another task
    const overTask = tasks.find((t) => t.id === (overSeparator?.before_task_id ?? overId));
    if (overSeparator && !overTask) {
      const target = columns.find((column) => column.id === overSeparator.column_id);
      if (target && target.id !== task.column_id) onColumnChange(task.id, target);
      return;
    }
    if (!overTask) return;

    if (task.column_id === overTask.column_id) {
      if (!onReorderTasks) return;
      const key = task.column_id || firstColumnId;
      if (!key) return;
      const list = tasksByColumn[key];
      if (!list) return;
      const oldIdx = list.findIndex((t) => t.id === taskId);
      const newIdx = list.findIndex((t) => t.id === overId);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        const reordered = arrayMove(list, oldIdx, newIdx);
        onReorderTasks(reordered.map((t, i) => ({ id: t.id, display_order: i })));
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
      <div className={cn("gap-4 overflow-x-auto pb-4", fullHeight ? "grid min-h-0 flex-1 auto-cols-[minmax(300px,1fr)] grid-flow-col items-stretch overflow-y-hidden" : "flex")}>
        {columns.map((column) => (
          <MarketingKanbanColumn
            key={column.id}
            fullHeight={fullHeight}
            column={column}
            tasks={tasksByColumn[column.id] || []}
            onEditTask={onEditTask}
            onToggleComplete={onToggleComplete}
            onAddTask={() => onAddTask(column.id)}
            subtaskCounts={subtaskCounts}
            separators={separators.filter((separator) => separator.column_id === column.id)}
            onAddSeparator={() => onAddSeparator(column.id)}
            onEditSeparator={onEditSeparator}
            {...selection}
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
