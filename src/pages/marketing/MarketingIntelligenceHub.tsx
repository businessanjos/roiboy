import { lazy, useMemo } from "react";
import { BarChart3, Telescope } from "lucide-react";
import { MarketingTabsHub, type MarketingHubTab } from "@/components/marketing/_shared/MarketingTabsHub";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const MarketingInsights = lazy(() => import("@/pages/MarketingInsights"));
const MarketingIntelligence = lazy(() => import("@/pages/marketing/MarketingIntelligence"));

/** Market Intelligence segue restrito ao mesmo usuário que tinha acesso ao menu antigo. */
const MARKET_INTELLIGENCE_VIEWERS = ["m.quintana@me.com"];

export default function MarketingIntelligenceHub() {
  const { currentUser } = useCurrentUser();

  const tabs = useMemo<MarketingHubTab[]>(() => {
    const base: MarketingHubTab[] = [
      { value: "insights", label: "Insights", icon: BarChart3, Component: MarketingInsights },
    ];
    const email = (currentUser?.email ?? "").toLowerCase();
    if (MARKET_INTELLIGENCE_VIEWERS.includes(email)) {
      base.push({
        value: "market-intelligence",
        label: "Market Intelligence",
        icon: Telescope,
        Component: MarketingIntelligence,
      });
    }
    return base;
  }, [currentUser?.email]);

  return <MarketingTabsHub tabs={tabs} />;
}
