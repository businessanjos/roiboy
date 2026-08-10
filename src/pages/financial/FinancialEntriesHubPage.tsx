import { lazy } from "react";
import { Receipt, Repeat } from "lucide-react";
import { FinancialTabsHub } from "@/components/financial/_shared/FinancialTabsHub";

const EntriesPage = lazy(() => import("./FinancialEntriesPage"));
const RecurringPage = lazy(() => import("./FinancialRecurringPage"));

export default function FinancialEntriesHubPage() {
  return (
    <FinancialTabsHub
      tabs={[
        { value: "lancamentos", label: "Lançamentos", icon: Receipt, Component: EntriesPage },
        { value: "recorrentes", label: "Recorrentes", icon: Repeat, Component: RecurringPage },
      ]}
    />
  );
}
