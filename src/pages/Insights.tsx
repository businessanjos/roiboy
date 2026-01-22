import { InsightsFiltersProvider } from "@/hooks/useInsightsFilters";
import { InsightsPanelsProvider } from "@/hooks/useInsightsPanels";
import { InsightsSidebar } from "@/components/insights/sidebar";
import { InsightsMainContent } from "@/components/insights/InsightsMainContent";

export default function Insights() {
  return (
    <InsightsFiltersProvider>
      <InsightsPanelsProvider>
        <div className="flex h-[calc(100vh-4rem)]">
          {/* Sidebar */}
          <InsightsSidebar />

          {/* Main Content */}
          <InsightsMainContent />
        </div>
      </InsightsPanelsProvider>
    </InsightsFiltersProvider>
  );
}
