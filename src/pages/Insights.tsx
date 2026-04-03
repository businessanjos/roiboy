import { InsightsFiltersProvider } from "@/hooks/useInsightsFilters";
import { InsightsDashboardsProvider } from "@/hooks/useInsightsDashboards";
import { InsightsMainContent } from "@/components/insights/InsightsMainContent";
import { InsightsDashboardTabs } from "@/components/insights/InsightsDashboardTabs";

export default function Insights() {
  return (
    <InsightsFiltersProvider>
      <InsightsDashboardsProvider>
        <div className="flex flex-col h-[calc(100vh-4rem)]">
          {/* Dashboard tabs - replaces sidebar */}
          <InsightsDashboardTabs />

          {/* Main Content */}
          <InsightsMainContent />
        </div>
      </InsightsDashboardsProvider>
    </InsightsFiltersProvider>
  );
}
