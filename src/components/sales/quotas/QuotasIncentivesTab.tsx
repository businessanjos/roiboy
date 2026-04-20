import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Crosshair, Dice5 } from "lucide-react";
import { QuotasSection } from "./QuotasSection";
import { IncentivePlanSection } from "./IncentivePlanSection";
import { TeamGoalsTab } from "@/components/sales/team/TeamGoalsTab";
import { RoulettePoolsManager } from "./RoulettePoolsManager";

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
        <TabsTrigger value="roulette" className="gap-1.5">
          <Dice5 className="h-4 w-4" />
          Roletas
        </TabsTrigger>
      </TabsList>

      <TabsContent value="goals" className="space-y-6">
        <TeamGoalsTab />
        <QuotasSection />
      </TabsContent>

      <TabsContent value="incentives">
        <IncentivePlanSection />
      </TabsContent>

      <TabsContent value="roulette">
        <RoulettePoolsManager />
      </TabsContent>
    </Tabs>
  );
}
