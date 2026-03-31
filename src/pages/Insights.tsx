import { InsightsFiltersProvider } from "@/hooks/useInsightsFilters";
import { InsightsDashboardsProvider } from "@/hooks/useInsightsDashboards";
import { InsightsSidebar, InsightsSidebarProvider } from "@/components/insights/sidebar";
import { InsightsMainContent } from "@/components/insights/InsightsMainContent";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Insights() {
  const isMobile = useIsMobile();

  return (
    <InsightsFiltersProvider>
      <InsightsDashboardsProvider>
        <InsightsSidebarProvider>
          <div className="flex h-[calc(100vh-4rem)]">
            {/* Sidebar - hidden on mobile */}
            {!isMobile && <InsightsSidebar />}

            {/* Main Content */}
            <InsightsMainContent />
          </div>
        </InsightsSidebarProvider>
      </InsightsDashboardsProvider>
    </InsightsFiltersProvider>
  );
}
