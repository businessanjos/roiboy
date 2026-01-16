import { MarketingTaskRow } from "./MarketingTaskRow";
import { MarketingTask } from "@/hooks/useMarketingTasks";

interface MarketingTaskListProps {
  tasks: MarketingTask[];
  onEditTask: (taskId: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
}

export function MarketingTaskList({ tasks, onEditTask, onToggleComplete }: MarketingTaskListProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="border-b last:border-b-0">
      {tasks.map((task) => (
        <MarketingTaskRow
          key={task.id}
          task={task}
          onEdit={() => onEditTask(task.id)}
          onToggleComplete={(completed) => onToggleComplete(task.id, completed)}
        />
      ))}
    </div>
  );
}
