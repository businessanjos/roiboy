import type { MarketingTask } from "@/hooks/useMarketingTasks";
import { readTaskDetails, labelKey } from "@/lib/marketing/taskDetails";
import { TaskLabelBadge } from "./TaskLabels";

export function TaskPeopleAndLabels({ task, showAssignee = true }: { task: MarketingTask; showAssignee?: boolean }) {
  const details = readTaskDetails(task);
  return <div className="mt-2 space-y-1.5">
    {details.labels.length > 0 && <div className="flex flex-wrap gap-1">
      {details.labels.map((label) => <TaskLabelBadge key={labelKey(label.name)} label={label} />)}
    </div>}
    {details.requesterId && <p className="truncate text-xs text-muted-foreground" title={details.requesterName || "Solicitante não disponível"}>
      Solicitante: <span className="text-foreground">{details.requesterName?.trim().split(/\s+/)[0] || "Não disponível"}</span>
    </p>}
    {showAssignee && task.assignee && <p className="truncate text-xs text-muted-foreground" title={task.assignee.name}>
      Responsável: <span className="text-foreground">{task.assignee.name.trim().split(/\s+/)[0]}</span>
    </p>}
  </div>;
}