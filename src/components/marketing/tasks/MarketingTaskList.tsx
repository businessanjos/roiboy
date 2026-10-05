import { MarketingTaskRow } from "./MarketingTaskRow";
import { MarketingTask } from "@/hooks/useMarketingTasks";
import { usePagedList } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";

interface MarketingTaskListProps {
  tasks: MarketingTask[];
  onEditTask: (taskId: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  /** Critérios de busca/filtro/ordenação — ao mudar, volta à página 1. */
  resetKey?: unknown;
}

export function MarketingTaskList({ tasks, onEditTask, onToggleComplete, resetKey }: MarketingTaskListProps) {
  const pgTasks = usePagedList(tasks, { resetKey });

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="border-b last:border-b-0">
      {pgTasks.items.map((task) => (
        <MarketingTaskRow
          key={task.id}
          task={task}
          onEdit={() => onEditTask(task.id)}
          onToggleComplete={(completed) => onToggleComplete(task.id, completed)}
        />
      ))}
      <PagerFor state={pgTasks} itemLabel="tarefas" />
    </div>
  );
}
