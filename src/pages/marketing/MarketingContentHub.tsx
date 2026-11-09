import { lazy } from "react";
import { Crown, Share2, ListChecks, ClipboardEdit } from "lucide-react";
import { MarketingTabsHub, type MarketingHubTab } from "@/components/marketing/_shared/MarketingTabsHub";

const ContentHQ = lazy(() => import("@/pages/marketing/ContentHQ"));
const SocialNetworksTab = lazy(() => import("@/components/marketing/SocialNetworksTab"));

const ChecklistView = lazy(async () => {
  const { ContentChecklistTab } = await import("@/components/marketing/ContentChecklistTab");
  const View = () => (
    <div className="container mx-auto py-6">
      <ContentChecklistTab />
    </div>
  );
  return { default: View };
});

const MetricsView = lazy(async () => {
  const { ManualMetricsTab } = await import("@/components/marketing/ManualMetricsTab");
  const View = () => (
    <div className="container mx-auto py-6">
      <ManualMetricsTab />
    </div>
  );
  return { default: View };
});

const TABS: MarketingHubTab[] = [
  { value: "producao", label: "Produção", icon: Crown, Component: ContentHQ },
  { value: "redes", label: "Redes", icon: Share2, Component: SocialNetworksTab },
  { value: "checklist", label: "Checklist", icon: ListChecks, Component: ChecklistView },
  { value: "metricas", label: "Eternum RECORDES", icon: ClipboardEdit, Component: MetricsView },
];

export default function MarketingContentHub() {
  return <MarketingTabsHub tabs={TABS} />;
}
