import { lazy } from "react";
import { FileText, BarChart3, DollarSign, Receipt, Building2 } from "lucide-react";
import { FinancialTabsHub } from "@/components/financial/_shared/FinancialTabsHub";

const DREPage = lazy(() => import("./FinancialDREPage"));
const AgingPage = lazy(() => import("./FinancialAgingPage"));
const ProfitabilityPage = lazy(() => import("./FinancialProfitabilityPage"));
const DRFPage = lazy(() => import("./FinancialDRFPage"));
const BalanceSheetPage = lazy(() => import("./FinancialBalanceSheetPage"));

export default function FinancialReportsHubPage() {
  return (
    <FinancialTabsHub
      tabs={[
        { value: "dre", label: "DRE", icon: FileText, Component: DREPage },
        { value: "aging", label: "Aging", icon: BarChart3, Component: AgingPage },
        { value: "rentabilidade", label: "Rentabilidade", icon: DollarSign, Component: ProfitabilityPage },
        { value: "drf", label: "DRF", icon: Receipt, Component: DRFPage },
        { value: "balanco", label: "Balanço", icon: Building2, Component: BalanceSheetPage },
      ]}
    />
  );
}
