import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { FinancialPageSkeleton } from "@/components/financial/_shared/FinancialPageSkeleton";
import { CompanySelector } from "@/components/companies/CompanySelector";

export function FinancialLayout() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end px-4 pt-3 empty:hidden">
        <CompanySelector />
      </div>
      <main className="flex-1 overflow-auto">
        {/* Skeleton local — não cobre a sidebar nem o header global */}
        <Suspense fallback={<FinancialPageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

export default FinancialLayout;
