import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Crosshair, Dice5, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { QuotasSection } from "./QuotasSection";
import { IncentivePlanSection } from "./IncentivePlanSection";
import { TeamGoalsTab } from "@/components/sales/team/TeamGoalsTab";
import { RoulettePoolsManager } from "./RoulettePoolsManager";

export function QuotasIncentivesTab() {
  const navigate = useNavigate();
  return (
    <Tabs defaultValue="goals" className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
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
        <Button
          size="sm"
          onClick={() =>
            window.open(
              "/sales-team/incentive-slideshow",
              "_blank",
              "noopener,noreferrer",
            )
          }
          className="gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-semibold"
        >
          <Presentation className="h-4 w-4" />
          Apresentar plano
        </Button>
      </div>

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
