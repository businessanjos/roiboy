import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton padrão para páginas de Finanças.
 * Use como Suspense fallback ou enquanto useQuery está em loading inicial.
 * Não cobre a tela inteira: respeita o layout do FinancialLayout.
 */
export function FinancialPageSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
