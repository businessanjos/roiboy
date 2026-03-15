import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings2, BarChart3 } from "lucide-react";
import { useCommissionPlan } from "@/hooks/useCommissionPlan";
import { CommissionPlanSetup } from "./CommissionPlanSetup";
import { CommissionDashboard } from "./CommissionDashboard";

export function CommissionTab() {
  const {
    plan,
    periods,
    loading,
    calculating,
    savePlan,
    calculateWeeklyCommissions,
  } = useCommissionPlan();

  const [activeTab, setActiveTab] = useState(plan ? "dashboard" : "setup");

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="dashboard" className="gap-1.5">
          <BarChart3 className="h-4 w-4" />
          Acompanhamento
        </TabsTrigger>
        <TabsTrigger value="setup" className="gap-1.5">
          <Settings2 className="h-4 w-4" />
          Configurar Plano
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard">
        {plan ? (
          <CommissionDashboard
            plan={plan}
            periods={periods}
            calculating={calculating}
            onCalculate={calculateWeeklyCommissions}
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Settings2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhum plano configurado</p>
            <p className="text-sm mt-1">Configure um plano de comissão na aba "Configurar Plano".</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="setup">
        <CommissionPlanSetup plan={plan} onSave={savePlan} />
      </TabsContent>
    </Tabs>
  );
}
