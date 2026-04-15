import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommissionTab } from "@/components/sales/commission/CommissionTab";
import { CareerPlanTab } from "@/components/sales/commission/CareerPlanTab";
import { SalesTeamWrapper } from "@/components/sales/team/SalesTeamWrapper";
import { Users, DollarSign, GraduationCap, Activity, Video, BarChart3, Target, MessageSquareText, Phone, Sparkles, Gift } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCommissionPlan } from "@/hooks/useCommissionPlan";
import { ThreeCPlusMetrics } from "@/components/threecplus/ThreeCPlusMetrics";
import { ThreeCPlusLiveMonitor } from "@/components/threecplus/ThreeCPlusLiveMonitor";
import { VideoCallTab } from "@/components/sales/videocall/VideoCallTab";
import { SalesTeamTab } from "@/components/sales/SalesTeamTab";
import { TeamCareerTab } from "@/components/sales/team/TeamCareerTab";
import { TeamGoalsTab } from "@/components/sales/team/TeamGoalsTab";
import { TeamInsightsTab } from "@/components/sales/team/TeamInsightsTab";
import { TeamConversationAnalysisTab } from "@/components/sales/team/TeamConversationAnalysisTab";
import { QuotasIncentivesTab } from "@/components/sales/quotas/QuotasIncentivesTab";

export default function SalesTeam() {
  const { currentUser } = useCurrentUser();
  const isJonathan = currentUser?.name?.toLowerCase().includes("jonathan");
  const { plan, saveSalesLevels } = useCommissionPlan();
  const [activeTab, setActiveTab] = useState("performance");

  if (!isJonathan) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Gestão Comercial</h1>
          <p className="text-muted-foreground text-xs">
            Acompanhe o desempenho individual da equipe comercial
          </p>
        </div>
        <SalesTeamWrapper />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Gestão Comercial</h1>
        <p className="text-muted-foreground text-xs">
          Acompanhe o desempenho individual da equipe comercial
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="h-10 p-1 bg-muted/60 gap-0.5 inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger value="performance" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium whitespace-nowrap">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Performance</span>
              <span className="sm:hidden">Perf.</span>
            </TabsTrigger>
            <TabsTrigger value="goals" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium whitespace-nowrap">
              <Target className="h-3.5 w-3.5" />
              Meta
            </TabsTrigger>
            <TabsTrigger value="live" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium whitespace-nowrap">
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ao Vivo</span>
              <span className="sm:hidden">Live</span>
            </TabsTrigger>
            <TabsTrigger value="telephony" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium whitespace-nowrap">
              <Phone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Telefonia</span>
              <span className="sm:hidden">Tel.</span>
            </TabsTrigger>
            <TabsTrigger value="conversations" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium whitespace-nowrap">
              <MessageSquareText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Conversas</span>
              <span className="sm:hidden">Conv.</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium whitespace-nowrap">
              <Sparkles className="h-3.5 w-3.5" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="commission" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium whitespace-nowrap">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Comissão</span>
              <span className="sm:hidden">Com.</span>
            </TabsTrigger>
            <TabsTrigger value="videocall" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium whitespace-nowrap">
              <Video className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Vídeo</span>
              <span className="sm:hidden">Víd.</span>
            </TabsTrigger>
            <TabsTrigger value="career" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium whitespace-nowrap">
              <GraduationCap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Carreira</span>
              <span className="sm:hidden">Car.</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="performance">
          <SalesTeamTab />
        </TabsContent>

        <TabsContent value="goals">
          <TeamGoalsTab />
        </TabsContent>

        <TabsContent value="live">
          <ThreeCPlusLiveMonitor />
        </TabsContent>

        <TabsContent value="telephony">
          <ThreeCPlusMetrics />
        </TabsContent>

        <TabsContent value="conversations">
          <TeamConversationAnalysisTab />
        </TabsContent>

        <TabsContent value="insights">
          <TeamInsightsTab />
        </TabsContent>

        <TabsContent value="commission">
          <CommissionTab />
        </TabsContent>

        <TabsContent value="videocall">
          <VideoCallTab />
        </TabsContent>

        <TabsContent value="career">
          <CareerPlanTab plan={plan} onSaveLevels={saveSalesLevels} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
