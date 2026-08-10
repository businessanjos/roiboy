import { lazy } from "react";
import { Receipt, Settings2 } from "lucide-react";
import { FinancialTabsHub } from "@/components/financial/_shared/FinancialTabsHub";

const NotasFiscaisPage = lazy(() => import("./FinancialNotasFiscaisPage"));
const FiscalSettingsPage = lazy(() => import("./FinancialFiscalSettingsPage"));

export default function FinancialFiscalHubPage() {
  return (
    <FinancialTabsHub
      tabs={[
        { value: "notas", label: "Notas Fiscais", icon: Receipt, Component: NotasFiscaisPage },
        { value: "configuracoes", label: "Configurações (NFS-e)", icon: Settings2, Component: FiscalSettingsPage },
      ]}
    />
  );
}
