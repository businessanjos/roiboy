import { MarketingTasksTab } from "@/components/marketing/tasks/MarketingTasksTab";

export default function MarketingTasks() {
  return (
    <div className="container mx-auto min-w-0 space-y-3 py-3">
      <h1 className="text-lg font-semibold">Tarefas de Marketing</h1>

      <MarketingTasksTab />
    </div>
  );
}
