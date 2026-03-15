import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommissionTab } from "@/components/sales/commission/CommissionTab";
import { CareerPlanTab } from "@/components/sales/commission/CareerPlanTab";
import { SalesTeamWrapper } from "@/components/sales/team/SalesTeamWrapper";
import { Users, DollarSign, GraduationCap } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCommissionPlan } from "@/hooks/useCommissionPlan";

export default function SalesTeam() {
  const { currentUser } = useCurrentUser();
  const isJonathan = currentUser?.name?.toLowerCase().includes("jonathan");
  const { plan, saveSalesLevels } = useCommissionPlan();

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Vendedores</h1>
        <p className="text-muted-foreground text-xs">
          Acompanhe o desempenho individual da equipe comercial
        </p>
      </div>

      {isJonathan ? (
        <Tabs defaultValue="team" className="space-y-4">
          <TabsList>
            <TabsTrigger value="team" className="gap-1.5">
              <Users className="h-4 w-4" />
              Equipe
            </TabsTrigger>
            <TabsTrigger value="commission" className="gap-1.5">
              <DollarSign className="h-4 w-4" />
              Comissionamento
            </TabsTrigger>
            <TabsTrigger value="career" className="gap-1.5">
              <GraduationCap className="h-4 w-4" />
              Plano de Carreira
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team">
            <SalesTeamWrapper showManagement />
          </TabsContent>

          <TabsContent value="commission">
            <CommissionTab />
          </TabsContent>

          <TabsContent value="career">
            <CareerPlanTab plan={plan} onSaveLevels={saveSalesLevels} />
          </TabsContent>
        </Tabs>
      ) : (
        <SalesTeamWrapper />
      )}
    </div>
  );
}
