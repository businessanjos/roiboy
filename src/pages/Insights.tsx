import { InsightsFiltersProvider } from "@/hooks/useInsightsFilters";
import { InsightsDashboardsProvider } from "@/hooks/useInsightsDashboards";
import { InsightsSidebar, InsightsSidebarProvider } from "@/components/insights/sidebar";
import { InsightsMainContent } from "@/components/insights/InsightsMainContent";

export default function Insights() {
  return (
    <InsightsFiltersProvider>
      <InsightsDashboardsProvider>
        <InsightsSidebarProvider>
          <div className="flex h-[calc(100vh-4rem)]">
            {/* Sidebar */}
            <InsightsSidebar />

            {/* Main Content */}
            <InsightsMainContent />
          </div>
        </InsightsSidebarProvider>
      </InsightsDashboardsProvider>
    </InsightsFiltersProvider>
  );
}
