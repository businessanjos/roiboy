import { Suspense, type ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialPageSkeleton } from "@/components/financial/_shared/FinancialPageSkeleton";

export interface FinancialHubTab {
  value: string;
  label: string;
  icon?: LucideIcon;
  Component: ComponentType;
}

interface FinancialTabsHubProps {
  tabs: FinancialHubTab[];
}

/**
 * Casca de abas para as áreas consolidadas do Financeiro.
 * A aba ativa vive em `?tab=` para permitir links diretos e redirects
 * das rotas antigas. Só a aba ativa é montada (evita fetch desnecessário).
 */
export function FinancialTabsHub({ tabs }: FinancialTabsHubProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const requested = searchParams.get("tab");
  const active = tabs.some((t) => t.value === requested) ? requested! : tabs[0].value;
  const ActiveComponent = tabs.find((t) => t.value === active)!.Component;

  const handleChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-6 pt-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Tabs value={active} onValueChange={handleChange}>
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="gap-2 rounded-t-md rounded-b-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-muted/50 data-[state=active]:shadow-none"
              >
                {tab.icon && <tab.icon className="h-4 w-4" />}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Suspense fallback={<FinancialPageSkeleton />}>
        <ActiveComponent key={active} />
      </Suspense>
    </div>
  );
}

export default FinancialTabsHub;
