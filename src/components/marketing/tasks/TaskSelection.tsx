import { Checkbox } from "@/components/ui/checkbox";
import type { MarketingTask } from "@/hooks/useMarketingTasks";

export interface TaskSelectionProps {
  selectionMode?: boolean;
  selectedTaskIds?: ReadonlySet<string>;
  selectionDisabled?: boolean;
  onSelectTask?: (id: string) => void;
  onSelectTasks?: (ids: string[], selected: boolean) => void;
}

export function TaskGroupSelection({ tasks, label, selectedTaskIds, onSelectTasks, selectionDisabled }: TaskSelectionProps & { tasks: MarketingTask[]; label: string }) {
  const selected = tasks.filter((task) => selectedTaskIds?.has(task.id)).length;
  return <Checkbox aria-label={label} disabled={selectionDisabled || !tasks.length}
    checked={selected > 0 && selected === tasks.length ? true : selected > 0 ? "indeterminate" : false}
    onCheckedChange={(checked) => onSelectTasks?.(tasks.map((task) => task.id), checked === true)} />;
}