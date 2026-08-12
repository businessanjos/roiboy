import { lazy } from "react";
import { TrendingUp, Megaphone } from "lucide-react";
import { MarketingTabsHub, type MarketingHubTab } from "@/components/marketing/_shared/MarketingTabsHub";

const MarketingTrafegoPago = lazy(() => import("@/pages/marketing/MarketingTrafegoPago"));
const MarketingAgencies = lazy(() => import("@/pages/marketing/MarketingAgencies"));

const TABS: MarketingHubTab[] = [
  { value: "trafego", label: "Tráfego Pago", icon: TrendingUp, Component: MarketingTrafegoPago },
  { value: "agencias", label: "Agências", icon: Megaphone, Component: MarketingAgencies },
];

export default function MarketingCampaignsHub() {
  return <MarketingTabsHub tabs={TABS} />;
}
