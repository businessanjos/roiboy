import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Gift } from "lucide-react";
import { QuotasSection } from "./QuotasSection";
import { IncentivePlanSection } from "./IncentivePlanSection";

export function QuotasIncentivesTab() {
  return (
    <Tabs defaultValue="quotas" className="space-y-4">
      <TabsList>
        <TabsTrigger value="quotas" className="gap-1.5">
          <Target className="h-4 w-4" />
          Quotas por Vendedor
        </TabsTrigger>
        <TabsTrigger value="incentives" className="gap-1.5">
          <Gift className="h-4 w-4" />
          Plano de Incentivo
        </TabsTrigger>
      </TabsList>

      <TabsContent value="quotas">
        <QuotasSection />
      </TabsContent>

      <TabsContent value="incentives">
        <IncentivePlanSection />
      </TabsContent>
    </Tabs>
  );
}
