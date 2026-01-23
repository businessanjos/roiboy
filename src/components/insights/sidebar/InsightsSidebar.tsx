import { ScrollArea } from "@/components/ui/scroll-area";
import { useInsightsDashboards } from "@/hooks/useInsightsDashboards";
import { InsightsSidebarHeader } from "./InsightsSidebarHeader";
import { InsightsDashboardList } from "./InsightsDashboardList";
import { Skeleton } from "@/components/ui/skeleton";

export function InsightsSidebar() {
  const {
    dashboards,
    activeDashboardId,
    navigateToDashboard,
    deleteDashboard,
    renameDashboard,
    isLoading,
  } = useInsightsDashboards();

  return (
    <div className="w-64 min-w-64 border-r bg-muted/30 flex flex-col h-full">
      <InsightsSidebarHeader />

      <ScrollArea className="flex-1">
        {/* Section: My Panels */}
        <div className="p-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase px-2 mb-2 tracking-wide">
            Meus Painéis
          </h3>
          {isLoading ? (
            <div className="space-y-2 px-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : dashboards.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-4">
              Nenhum painel criado ainda. Clique em "Criar" para começar.
            </p>
          ) : (
            <InsightsDashboardList
              dashboards={dashboards}
              activeDashboardId={activeDashboardId}
              onSelect={navigateToDashboard}
              onDelete={deleteDashboard}
              onRename={renameDashboard}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
