import type { MarketingTask } from "@/hooks/useMarketingTasks";
import { readTaskDetails, labelKey } from "@/lib/marketing/taskDetails";
import { TaskLabelBadge } from "./TaskLabels";
import { Repeat2 } from "lucide-react";
import { readTaskRecurrence, recurrenceLabel } from "@/lib/marketing/taskRecurrence";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { taskPersonPresentation } from "@/lib/marketing/taskPresentation";

export function TaskPeopleAndLabels({ task, showAssignee = true }: { task: MarketingTask; showAssignee?: boolean }) {
  const { currentUser } = useCurrentUser();
  const details = readTaskDetails(task);
  const recurrence = readTaskRecurrence(task.recurrence_rule);
  return <div className="mt-2 min-w-0 space-y-1.5">
    {details.labels.length > 0 && <div className="flex min-w-0 flex-wrap gap-1.5">
      {details.labels.map((label) => <TaskLabelBadge key={labelKey(label.name)} label={label} />)}
    </div>}
    {details.requesterId && <p className="truncate text-xs text-muted-foreground">
      Solicitante: <span className="text-foreground">{taskPersonPresentation(details.requesterId, details.requesterName, currentUser?.id).name}</span>
    </p>}
    {showAssignee && task.assignee && <p className="truncate text-xs text-muted-foreground">
      Responsável: <span className="text-foreground">{taskPersonPresentation(task.assignee_id, task.assignee.name, currentUser?.id).name}</span>
    </p>}
    {(recurrence || task.recurrence_source_id) && <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><Repeat2 className="h-3 w-3 shrink-0" /><span className="truncate">{recurrence ? recurrenceLabel(recurrence) : "Tarefa recorrente"}</span></p>}
  </div>;
}