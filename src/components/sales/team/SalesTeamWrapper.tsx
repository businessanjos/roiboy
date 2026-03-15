import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, GraduationCap, Target } from "lucide-react";
import { SalesTeamTab } from "@/components/sales/SalesTeamTab";
import { TeamCareerTab } from "./TeamCareerTab";
import { TeamGoalsTab } from "./TeamGoalsTab";

interface SalesTeamWrapperProps {
  showManagement?: boolean;
}

export function SalesTeamWrapper({ showManagement = false }: SalesTeamWrapperProps) {
  if (!showManagement) {
    return <SalesTeamTab />;
  }

  return (
    <Tabs defaultValue="performance" className="space-y-4">
      <TabsList>
        <TabsTrigger value="performance" className="gap-1.5 text-xs">
          <BarChart3 className="h-3.5 w-3.5" />
          Performance
        </TabsTrigger>
        <TabsTrigger value="career" className="gap-1.5 text-xs">
          <GraduationCap className="h-3.5 w-3.5" />
          Carreira
        </TabsTrigger>
        <TabsTrigger value="goals" className="gap-1.5 text-xs">
          <Target className="h-3.5 w-3.5" />
          Meta
        </TabsTrigger>
      </TabsList>

      <TabsContent value="performance">
        <SalesTeamTab />
      </TabsContent>

      <TabsContent value="career">
        <TeamCareerTab />
      </TabsContent>

      <TabsContent value="goals">
        <TeamGoalsTab />
      </TabsContent>
    </Tabs>
  );
}
