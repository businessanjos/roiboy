import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, GraduationCap, Target, Sparkles, MessageSquareText } from "lucide-react";
import { SalesTeamTab } from "@/components/sales/SalesTeamTab";
import { TeamCareerTab } from "./TeamCareerTab";
import { TeamGoalsTab } from "./TeamGoalsTab";
import { TeamInsightsTab } from "./TeamInsightsTab";
import { TeamConversationAnalysisTab } from "./TeamConversationAnalysisTab";

interface SalesTeamWrapperProps {
  showManagement?: boolean;
}

export function SalesTeamWrapper({ showManagement = false }: SalesTeamWrapperProps) {
  if (!showManagement) {
    return <SalesTeamTab />;
  }

  return (
    <Tabs defaultValue="performance" className="space-y-5">
      <TabsList className="h-11 p-1 bg-muted/60 gap-1 w-full sm:w-auto">
        <TabsTrigger value="performance" className="gap-2 text-sm px-5 h-9 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium">
          <BarChart3 className="h-4 w-4" />
          Performance
        </TabsTrigger>
        <TabsTrigger value="career" className="gap-2 text-sm px-5 h-9 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium">
          <GraduationCap className="h-4 w-4" />
          Carreira
        </TabsTrigger>
        <TabsTrigger value="goals" className="gap-2 text-sm px-5 h-9 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium">
          <Target className="h-4 w-4" />
          Meta
        </TabsTrigger>
        <TabsTrigger value="insights" className="gap-2 text-sm px-5 h-9 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium">
          <Sparkles className="h-4 w-4" />
          Insights
        </TabsTrigger>
        <TabsTrigger value="conversations" className="gap-2 text-sm px-5 h-9 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium">
          <MessageSquareText className="h-4 w-4" />
          Conversas
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

      <TabsContent value="insights">
        <TeamInsightsTab />
      </TabsContent>

      <TabsContent value="conversations">
        <TeamConversationAnalysisTab />
      </TabsContent>
    </Tabs>
  );
}
