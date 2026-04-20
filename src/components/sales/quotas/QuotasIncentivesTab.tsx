import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Crosshair } from "lucide-react";
import { QuotasSection } from "./QuotasSection";
import { IncentivePlanSection } from "./IncentivePlanSection";
import { TeamGoalsTab } from "@/components/sales/team/TeamGoalsTab";

export function QuotasIncentivesTab() {
  return (
    <Tabs defaultValue="goals" className="space-y-4">
      <TabsList>
        <TabsTrigger value="goals" className="gap-1.5">
          <Crosshair className="h-4 w-4" />
          Meta
        </TabsTrigger>
        <TabsTrigger value="incentives" className="gap-1.5">
          <Gift className="h-4 w-4" />
          Plano de Incentivo
        </TabsTrigger>
      </TabsList>

      <TabsContent value="goals" className="space-y-6">
        <TeamGoalsTab />
        <QuotasSection />
      </TabsContent>

      <TabsContent value="incentives">
        <IncentivePlanSection />
      </TabsContent>
    </Tabs>
  );
}
