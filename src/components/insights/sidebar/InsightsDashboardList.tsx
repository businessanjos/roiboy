import { InsightsDashboard } from "@/hooks/useInsightsDashboards";
import { InsightsDashboardItem } from "./InsightsDashboardItem";

interface InsightsDashboardListProps {
  dashboards: InsightsDashboard[];
  activeDashboardId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onRename?: (id: string, name: string) => Promise<void>;
  readOnly?: boolean;
}

export function InsightsDashboardList({
  dashboards,
  activeDashboardId,
  onSelect,
  onDelete,
  onRename,
  readOnly = false,
}: InsightsDashboardListProps) {
  return (
    <div className="space-y-1">
      {dashboards.map((dashboard) => (
        <InsightsDashboardItem
          key={dashboard.id}
          dashboard={dashboard}
          isActive={dashboard.id === activeDashboardId}
          onSelect={() => onSelect(dashboard.id)}
          onDelete={onDelete}
          onRename={onRename}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
