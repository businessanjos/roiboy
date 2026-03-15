import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings2, BarChart3, Receipt } from "lucide-react";
import { useCommissionPlan } from "@/hooks/useCommissionPlan";
import { CommissionPlanSetup } from "./CommissionPlanSetup";
import { CommissionDashboard } from "./CommissionDashboard";
import { CommissionDealView } from "./CommissionDealView";

export function CommissionTab() {
  const {
    plan,
    periods,
    dealEntries,
    loading,
    calculating,
    savePlan,
    calculateWeeklyCommissions,
    updateDealEntryPayment,
    markCommissionAsPaid,
  } = useCommissionPlan();

  const [activeTab, setActiveTab] = useState(plan ? "deals" : "setup");

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
        <TabsTrigger value="deals" className="gap-1.5">
          <Receipt className="h-4 w-4" />
          Por Negócio
        </TabsTrigger>
        <TabsTrigger value="dashboard" className="gap-1.5">
          <BarChart3 className="h-4 w-4" />
          Resumo Mensal
        </TabsTrigger>
        <TabsTrigger value="setup" className="gap-1.5">
          <Settings2 className="h-4 w-4" />
          Configurar Plano
        </TabsTrigger>
      </TabsList>

      <TabsContent value="deals">
        {plan ? (
          <div className="space-y-4">
            <CommissionDashboard
              plan={plan}
              periods={periods}
              calculating={calculating}
              onCalculate={calculateWeeklyCommissions}
              compact
            />
            <CommissionDealView
              dealEntries={dealEntries}
              onUpdatePayment={updateDealEntryPayment}
              onMarkAsPaid={markCommissionAsPaid}
            />
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Settings2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhum plano configurado</p>
            <p className="text-sm mt-1">Configure um plano na aba "Configurar Plano".</p>
          </div>
        )}
      </TabsContent>

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
            <p className="text-sm mt-1">Configure um plano na aba "Configurar Plano".</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="setup">
        <CommissionPlanSetup plan={plan} onSave={savePlan as any} />
      </TabsContent>
    </Tabs>
  );
}
