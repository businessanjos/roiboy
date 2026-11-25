import type { MarketingTask } from "@/hooks/useMarketingTasks";
import { readTaskDetails, labelKey } from "@/lib/marketing/taskDetails";
import { TaskLabelBadge } from "./TaskLabels";
import { Repeat2 } from "lucide-react";
import { readTaskRecurrence, recurrenceLabel } from "@/lib/marketing/taskRecurrence";

export function TaskPeopleAndLabels({ task, showAssignee = true }: { task: MarketingTask; showAssignee?: boolean }) {
  const details = readTaskDetails(task);
  const recurrence = readTaskRecurrence(task.recurrence_rule);
  return <div className="mt-2 min-w-0 space-y-1.5">
    {details.labels.length > 0 && <div className="flex min-w-0 flex-wrap gap-1.5">
      {details.labels.map((label) => <TaskLabelBadge key={labelKey(label.name)} label={label} />)}
    </div>}
    {details.requesterId && <p className="truncate text-xs text-muted-foreground">
      Solicitante: <span className="text-foreground">{details.requesterName?.trim().split(/\s+/)[0] || "Não disponível"}</span>
    </p>}
    {showAssignee && task.assignee && <p className="truncate text-xs text-muted-foreground">
      Responsável: <span className="text-foreground">{task.assignee.name.trim().split(/\s+/)[0]}</span>
    </p>}
    {(recurrence || task.recurrence_source_id) && <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><Repeat2 className="h-3 w-3 shrink-0" /><span className="truncate">{recurrence ? recurrenceLabel(recurrence) : "Tarefa recorrente"}</span></p>}
  </div>;
}