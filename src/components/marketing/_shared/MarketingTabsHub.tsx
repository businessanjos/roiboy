import { Suspense, type ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export interface MarketingHubTab {
  value: string;
  label: string;
  icon?: LucideIcon;
  Component: ComponentType;
}

interface MarketingTabsHubProps {
  tabs: MarketingHubTab[];
}

function HubSkeleton() {
  return (
    <div className="container mx-auto space-y-4 py-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

/**
 * Casca de abas para as áreas consolidadas do Marketing.
 * A aba ativa vive em `?tab=` para permitir links diretos e redirects
 * das rotas antigas. Só a aba ativa é montada (evita fetch desnecessário).
 */
export function MarketingTabsHub({ tabs }: MarketingTabsHubProps) {
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

      <Suspense fallback={<HubSkeleton />}>
        <ActiveComponent key={active} />
      </Suspense>
    </div>
  );
}
