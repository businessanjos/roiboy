import { MarketingTasksTab } from "@/components/marketing/tasks/MarketingTasksTab";

export default function MarketingTasks() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tarefas de Marketing</h1>
        <p className="text-muted-foreground">
          Gerencie as tarefas e projetos da equipe de marketing
        </p>
      </div>

      <MarketingTasksTab />
    </div>
  );
}
