import { InsightsPanel } from "@/hooks/useInsightsPanels";
import { InsightsPanelItem } from "./InsightsPanelItem";

interface InsightsPanelListProps {
  panels: InsightsPanel[];
  activePanelId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onRename?: (id: string, name: string) => Promise<void>;
  readOnly?: boolean;
}

export function InsightsPanelList({
  panels,
  activePanelId,
  onSelect,
  onDelete,
  onRename,
  readOnly = false,
}: InsightsPanelListProps) {
  return (
    <div className="space-y-1">
      {panels.map((panel) => (
        <InsightsPanelItem
          key={panel.id}
          panel={panel}
          isActive={panel.id === activePanelId}
          onSelect={() => onSelect(panel.id)}
          onDelete={onDelete}
          onRename={onRename}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
