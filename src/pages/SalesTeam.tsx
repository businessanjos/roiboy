import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesTeamTab } from "@/components/sales/SalesTeamTab";
import { CommissionTab } from "@/components/sales/commission/CommissionTab";
import { Users, DollarSign } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function SalesTeam() {
  const { currentUser } = useCurrentUser();
  const isJonathan = currentUser?.name?.toLowerCase().includes("jonathan");

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
          </TabsList>

          <TabsContent value="team">
            <SalesTeamTab />
          </TabsContent>

          <TabsContent value="commission">
            <CommissionTab />
          </TabsContent>
        </Tabs>
      ) : (
        <SalesTeamTab />
      )}
    </div>
  );
}
