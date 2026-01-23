import { InsightsFiltersProvider } from "@/hooks/useInsightsFilters";
import { InsightsDashboardsProvider } from "@/hooks/useInsightsDashboards";
import { InsightsSidebar } from "@/components/insights/sidebar";
import { InsightsMainContent } from "@/components/insights/InsightsMainContent";

export default function Insights() {
  return (
    <InsightsFiltersProvider>
      <InsightsDashboardsProvider>
        <div className="flex h-[calc(100vh-4rem)]">
          {/* Sidebar */}
          <InsightsSidebar />

          {/* Main Content */}
          <InsightsMainContent />
        </div>
      </InsightsDashboardsProvider>
    </InsightsFiltersProvider>
  );
}
