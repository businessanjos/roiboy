import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { FinancialPageSkeleton } from "@/components/financial/_shared/FinancialPageSkeleton";

export function FinancialLayout() {
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:h-full">
      <div className="flex-1 lg:overflow-auto">

        {/* Skeleton local — não cobre a sidebar nem o header global */}
        <Suspense fallback={<FinancialPageSkeleton />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}

export default FinancialLayout;
