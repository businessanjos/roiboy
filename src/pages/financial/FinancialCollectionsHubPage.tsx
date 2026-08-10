import { lazy } from "react";
import { LayoutGrid, Bell, Ruler } from "lucide-react";
import { FinancialTabsHub } from "@/components/financial/_shared/FinancialTabsHub";

const DunningKanbanPage = lazy(() => import("./FinancialDunningKanbanPage"));
const AlertsPage = lazy(() => import("./FinancialAlertsPage"));
const CollectionsRulerPage = lazy(() => import("./FinancialCollectionsRulerPage"));

export default function FinancialCollectionsHubPage() {
  return (
    <FinancialTabsHub
      tabs={[
        { value: "kanban", label: "CRM de Cobrança", icon: LayoutGrid, Component: DunningKanbanPage },
        { value: "alertas", label: "Alertas", icon: Bell, Component: AlertsPage },
        { value: "regua", label: "Régua", icon: Ruler, Component: CollectionsRulerPage },
      ]}
    />
  );
}
