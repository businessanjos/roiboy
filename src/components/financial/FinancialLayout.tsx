import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Building2 } from "lucide-react";
import { FinancialCompanyProvider } from "@/contexts/FinancialCompanyContext";
import { CompanySelector } from "@/components/financial/CompanySelector";
import { FinancialPageSkeleton } from "@/components/financial/_shared/FinancialPageSkeleton";

export function FinancialLayout() {
  return (
    <FinancialCompanyProvider>
      <div className="flex flex-col h-full">
        <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
          <div className="container max-w-7xl flex items-center justify-between gap-3 py-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Empresa
            </span>
            <CompanySelector />
          </div>
        </div>
        <main className="flex-1 overflow-auto">
          {/* Skeleton local — não cobre a sidebar nem o header global */}
          <Suspense fallback={<FinancialPageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </FinancialCompanyProvider>
  );
}

export default FinancialLayout;
