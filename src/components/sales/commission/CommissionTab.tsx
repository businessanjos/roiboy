import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings2, BarChart3, Receipt, Target, Phone } from "lucide-react";
import { useCommissionPlan } from "@/hooks/useCommissionPlan";
import { CommissionPlanSetup } from "./CommissionPlanSetup";
import { CommissionDashboard } from "./CommissionDashboard";
import { CommissionDealView } from "./CommissionDealView";

export function CommissionTab() {
  const closerHook = useCommissionPlan("Closer");
  const sdrHook = useCommissionPlan("SDR");

  const loading = closerHook.loading || sdrHook.loading;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Merge periods/entries from both plans without duplicates
  const allPeriods = Array.from(
    new Map([...closerHook.periods, ...sdrHook.periods].map((period) => [period.id, period])).values()
  );

  const allDealEntries = Array.from(
    new Map([...closerHook.dealEntries, ...sdrHook.dealEntries].map((entry) => [entry.id, entry])).values()
  );

  // Use closer plan as the primary for the dashboard (it has both SDR+Closer data now)
  const primaryPlan = closerHook.plan || sdrHook.plan;

  return (
    <Tabs defaultValue="deals" className="space-y-4">
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
        {primaryPlan ? (
          <div className="space-y-4">
            <CommissionDashboard
              plan={primaryPlan}
              periods={allPeriods}
              calculating={closerHook.calculating || sdrHook.calculating}
              onCalculate={async (year, month) => {
                await Promise.all([
                  closerHook.calculateMonthlyCommissions(year, month),
                  sdrHook.calculateMonthlyCommissions(year, month),
                ]);
              }}
              compact
            />
            <CommissionDealView
              dealEntries={[...closerHook.dealEntries, ...sdrHook.dealEntries]}
              onUpdatePayment={closerHook.updateDealEntryPayment}
              onMarkAsPaid={closerHook.markCommissionAsPaid}
            />
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Settings2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhum plano configurado</p>
            <p className="text-sm mt-1">Configure um plano na aba &quot;Configurar Plano&quot;.</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="dashboard">
        {primaryPlan ? (
          <CommissionDashboard
            plan={primaryPlan}
            periods={allPeriods}
            calculating={closerHook.calculating || sdrHook.calculating}
            onCalculate={async (year, month) => {
              await Promise.all([
                closerHook.calculateMonthlyCommissions(year, month),
                sdrHook.calculateMonthlyCommissions(year, month),
              ]);
            }}
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Settings2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhum plano configurado</p>
            <p className="text-sm mt-1">Configure um plano na aba &quot;Configurar Plano&quot;.</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="setup">
        <CommissionSetupTabs
          closerPlan={closerHook.plan}
          sdrPlan={sdrHook.plan}
          onSaveCloser={closerHook.savePlan as any}
          onSaveSDR={sdrHook.savePlan as any}
        />
      </TabsContent>
    </Tabs>
  );
}

function CommissionSetupTabs({
  closerPlan,
  sdrPlan,
  onSaveCloser,
  onSaveSDR,
}: {
  closerPlan: any;
  sdrPlan: any;
  onSaveCloser: any;
  onSaveSDR: any;
}) {
  const [setupTab, setSetupTab] = useState("closer");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setSetupTab("closer")}
          className={`
            flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all
            ${setupTab === "closer"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }
          `}
        >
          <Target className="h-4 w-4" />
          Closer
        </button>
        <button
          onClick={() => setSetupTab("sdr")}
          className={`
            flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all
            ${setupTab === "sdr"
              ? "bg-violet-600 text-white shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }
          `}
        >
          <Phone className="h-4 w-4" />
          SDR
        </button>
      </div>

      {setupTab === "closer" ? (
        <CommissionPlanSetup plan={closerPlan} onSave={onSaveCloser} />
      ) : (
        <CommissionPlanSetup plan={sdrPlan} onSave={onSaveSDR} />
      )}
    </div>
  );
}
