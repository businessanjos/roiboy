import { lazy } from "react";
import { BarChart3, Telescope } from "lucide-react";
import { MarketingTabsHub, type MarketingHubTab } from "@/components/marketing/_shared/MarketingTabsHub";

const MarketingInsights = lazy(() => import("@/pages/MarketingInsights"));
const MarketingIntelligence = lazy(() => import("@/pages/marketing/MarketingIntelligence"));

const TABS: MarketingHubTab[] = [
  { value: "insights", label: "Insights", icon: BarChart3, Component: MarketingInsights },
  { value: "market-intelligence", label: "Market Intelligence", icon: Telescope, Component: MarketingIntelligence },
];

export default function MarketingIntelligenceHub() {
  return <MarketingTabsHub tabs={TABS} />;
}
