import { Outlet } from "react-router-dom";
import { FinancialCompanyProvider } from "@/contexts/FinancialCompanyContext";
import { CompanySelector } from "@/components/financial/CompanySelector";

export function FinancialLayout() {
  return (
    <FinancialCompanyProvider>
      <div className="flex flex-col h-full">
        <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
          <div className="container max-w-7xl flex items-center justify-between gap-3 py-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Empresa / CNPJ</span>
            <CompanySelector />
          </div>
        </div>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </FinancialCompanyProvider>
  );
}

export default FinancialLayout;
