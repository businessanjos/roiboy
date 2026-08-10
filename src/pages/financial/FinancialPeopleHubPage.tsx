import { lazy } from "react";
import { Users, UsersRound, Truck } from "lucide-react";
import { FinancialTabsHub } from "@/components/financial/_shared/FinancialTabsHub";

const ActiveClientsPage = lazy(() => import("./FinancialActiveClientsPage"));
const PayersPage = lazy(() => import("./FinancialPayersPage"));
const SuppliersPage = lazy(() => import("./FinancialSuppliersPage"));

export default function FinancialPeopleHubPage() {
  return (
    <FinancialTabsHub
      tabs={[
        { value: "clientes", label: "Clientes Ativos", icon: Users, Component: ActiveClientsPage },
        { value: "pagadores", label: "Pagadores", icon: UsersRound, Component: PayersPage },
        { value: "fornecedores", label: "Fornecedores", icon: Truck, Component: SuppliersPage },
      ]}
    />
  );
}
