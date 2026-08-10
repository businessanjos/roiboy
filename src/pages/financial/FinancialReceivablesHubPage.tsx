import { lazy } from "react";
import { CreditCard, Receipt, FileText } from "lucide-react";
import { FinancialTabsHub } from "@/components/financial/_shared/FinancialTabsHub";

const InvoicesPage = lazy(() => import("./FinancialInvoicesPage"));
const InstallmentsPage = lazy(() => import("./FinancialInstallmentsPage"));
const BoletosPage = lazy(() => import("./FinancialBoletosPage"));

export default function FinancialReceivablesHubPage() {
  return (
    <FinancialTabsHub
      tabs={[
        { value: "faturas", label: "Faturas", icon: CreditCard, Component: InvoicesPage },
        { value: "parcelas", label: "Parcelas", icon: Receipt, Component: InstallmentsPage },
        { value: "boletos", label: "Boletos", icon: FileText, Component: BoletosPage },
      ]}
    />
  );
}
