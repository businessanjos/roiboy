import { ScrollArea } from "@/components/ui/scroll-area";
import { useInsightsDashboards } from "@/hooks/useInsightsDashboards";
import { InsightsSidebarHeader } from "./InsightsSidebarHeader";
import { InsightsDashboardList } from "./InsightsDashboardList";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInsightsSidebar } from "./InsightsSidebarContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function InsightsSidebar() {
  const {
    dashboards,
    activeDashboardId,
    navigateToDashboard,
    deleteDashboard,
    renameDashboard,
    reorderDashboards,
    isLoading,
  } = useInsightsDashboards();

  const { isCollapsed, toggleCollapsed } = useInsightsSidebar();

  return (
    <div 
      className={cn(
        "border-r bg-muted/30 flex flex-col h-full transition-all duration-300 ease-in-out",
        isCollapsed ? "w-14 min-w-14" : "w-64 min-w-64"
      )}
    >
      {/* Toggle Button */}
      <div className={cn(
        "flex items-center border-b",
        isCollapsed ? "justify-center p-2" : "justify-end p-2"
      )}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={toggleCollapsed}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isCollapsed ? "Expandir painel" : "Minimizar painel"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Header - Only show when expanded */}
      {!isCollapsed && <InsightsSidebarHeader />}

      <ScrollArea className="flex-1">
        {/* Section: My Panels */}
        <div className={cn("p-2", isCollapsed && "px-1")}>
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-muted-foreground uppercase px-2 mb-2 tracking-wide">
              Meus Painéis
            </h3>
          )}
          
          {isLoading ? (
            <div className="space-y-2 px-2">
              {isCollapsed ? (
                <>
                  <Skeleton className="h-8 w-8 mx-auto rounded" />
                  <Skeleton className="h-8 w-8 mx-auto rounded" />
                </>
              ) : (
                <>
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </>
              )}
            </div>
          ) : dashboards.length === 0 ? (
            !isCollapsed && (
              <p className="text-xs text-muted-foreground px-2 py-4">
                Nenhum painel criado ainda. Clique em "Criar" para começar.
              </p>
            )
          ) : isCollapsed ? (
            // Collapsed view - show icons only
            <div className="space-y-1">
              {dashboards.map((dashboard) => {
                const isActive = dashboard.id === activeDashboardId;
                return (
                  <Tooltip key={dashboard.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        size="icon"
                        className={cn(
                          "w-10 h-10 mx-auto flex",
                          isActive && "bg-primary/10 text-primary"
                        )}
                        onClick={() => navigateToDashboard(dashboard.id)}
                      >
                        <LayoutDashboard className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {dashboard.name}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ) : (
            <InsightsDashboardList
              dashboards={dashboards}
              activeDashboardId={activeDashboardId}
              onSelect={navigateToDashboard}
              onDelete={deleteDashboard}
              onRename={renameDashboard}
              onReorder={reorderDashboards}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
