import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { InsightsDashboard } from "@/hooks/useInsightsDashboards";
import { InsightsDashboardItem } from "./InsightsDashboardItem";

interface InsightsDashboardListProps {
  dashboards: InsightsDashboard[];
  activeDashboardId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onRename?: (id: string, name: string) => Promise<void>;
  onDuplicate?: (id: string) => Promise<void>;
  onReorder?: (orderedIds: string[]) => Promise<void>;
  readOnly?: boolean;
}

export function InsightsDashboardList({
  dashboards,
  activeDashboardId,
  onSelect,
  onDelete,
  onRename,
  onDuplicate,
  onReorder,
  readOnly = false,
}: InsightsDashboardListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    const oldIndex = dashboards.findIndex(d => d.id === active.id);
    const newIndex = dashboards.findIndex(d => d.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...dashboards];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    onReorder(reordered.map(d => d.id));
  }, [dashboards, onReorder]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={dashboards.map(d => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          {dashboards.map((dashboard) => (
            <InsightsDashboardItem
              key={dashboard.id}
              dashboard={dashboard}
              isActive={dashboard.id === activeDashboardId}
              onSelect={() => onSelect(dashboard.id)}
              onDelete={onDelete}
              onRename={onRename}
              readOnly={readOnly}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
