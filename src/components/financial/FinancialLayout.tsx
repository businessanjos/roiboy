import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { FinancialPageSkeleton } from "@/components/financial/_shared/FinancialPageSkeleton";

export function FinancialLayout() {
  return (
    <div className="flex flex-col h-full">
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
