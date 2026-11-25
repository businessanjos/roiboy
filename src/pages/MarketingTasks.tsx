import { MarketingTasksTab } from "@/components/marketing/tasks/MarketingTasksTab";
import { ListTodo } from "lucide-react";

export default function MarketingTasks() {
  return (
    <div className="container mx-auto min-w-0 space-y-3 py-3">
      <header className="flex min-w-0 items-center gap-3 pb-1">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
          <ListTodo className="h-5 w-5" />
        </span>
        <h1 className="min-w-0 break-words text-xl font-bold leading-7 text-foreground">Tarefas de Marketing</h1>
      </header>

      <MarketingTasksTab />
    </div>
  );
}
