import { Outlet } from "react-router-dom";

export function FinancialLayout() {
  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
