import { lazy } from "react";
import { Landmark, FileSignature, ArrowLeftRight } from "lucide-react";
import { FinancialTabsHub } from "@/components/financial/_shared/FinancialTabsHub";

const ReconciliationPage = lazy(() => import("./FinancialReconciliationPage"));
const SalesReconciliationPage = lazy(() => import("./FinancialSalesReconciliationPage"));
const ImportPage = lazy(() => import("./FinancialImportPage"));

export default function FinancialReconciliationHubPage() {
  return (
    <FinancialTabsHub
      tabs={[
        { value: "bancaria", label: "Bancária", icon: Landmark, Component: ReconciliationPage },
        { value: "vendas", label: "Vendas", icon: FileSignature, Component: SalesReconciliationPage },
        { value: "importacoes", label: "Importações", icon: ArrowLeftRight, Component: ImportPage },
      ]}
    />
  );
}
