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
import { isManagementUser } from "@/lib/access/managementRoles";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const SECTIONS = [
  { value: "performance", label: "Performance" },
  { value: "insights", label: "Insights" },
  { value: "quotas-incentives", label: "Metas & Incentivos" },
  { value: "career", label: "Carreira" },
];
const PERF_SECTIONS = [
  { value: "overview", label: "Visão Geral" },
  { value: "live", label: "Ao Vivo" },
  { value: "telephony", label: "Telefonia" },
  { value: "conversations", label: "Conversas" },
  { value: "videocall", label: "Vídeo" },
];

export default function SalesTeam() {
  const { currentUser } = useCurrentUser();
  const hasFullAccess = isManagementUser(currentUser);
  const { plan, saveSalesLevels } = useCommissionPlan();
  const [activeTab, setActiveTab] = useState("performance");
  const [perfTab, setPerfTab] = useState("overview");
  const isMobile = useIsMobile();

  if (!hasFullAccess) {
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
    <div className="px-4 py-3 md:p-4 space-y-4 pb-24 md:pb-4">
      <div className="hidden md:block">
        <h1 className="text-xl font-bold">Gestão Comercial</h1>
        <p className="text-muted-foreground text-xs">
          Acompanhe o desempenho individual da equipe comercial
        </p>
      </div>


      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {isMobile ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="sales-team-section" className="text-xs text-muted-foreground">Seção</Label>
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger id="sales-team-section" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{SECTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {activeTab === "performance" && (
              <div className="space-y-1">
                <Label htmlFor="sales-team-perf" className="text-xs text-muted-foreground">Visão</Label>
                <Select value={perfTab} onValueChange={setPerfTab}>
                  <SelectTrigger id="sales-team-perf" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{PERF_SECTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
        ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <TabsList className="h-10 p-1 bg-muted/60 gap-0.5 inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger value="performance" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium whitespace-nowrap">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Performance</span>
              <span className="sm:hidden">Perf.</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium whitespace-nowrap">
              <Sparkles className="h-3.5 w-3.5" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="quotas-incentives" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium whitespace-nowrap">
              <Gift className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Metas & Incentivos</span>
              <span className="sm:hidden">Metas</span>
            </TabsTrigger>
            <TabsTrigger value="career" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-4 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium whitespace-nowrap">
              <GraduationCap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Carreira</span>
              <span className="sm:hidden">Car.</span>
            </TabsTrigger>
          </TabsList>
        </div>
        )}

        <TabsContent value="performance">
          <Tabs value={perfTab} onValueChange={setPerfTab} className="space-y-4">
            {!isMobile && (
            <div className="overflow-x-auto -mx-4 px-4">
              <TabsList className="h-9 p-1 bg-muted/40 gap-0.5 inline-flex w-auto min-w-full sm:min-w-0">
                <TabsTrigger value="overview" className="gap-1.5 text-xs px-2.5 sm:px-3 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Visão Geral
                </TabsTrigger>
                <TabsTrigger value="live" className="gap-1.5 text-xs px-2.5 sm:px-3 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap">
                  <Activity className="h-3.5 w-3.5" />
                  Ao Vivo
                </TabsTrigger>
                <TabsTrigger value="telephony" className="gap-1.5 text-xs px-2.5 sm:px-3 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap">
                  <Phone className="h-3.5 w-3.5" />
                  Telefonia
                </TabsTrigger>
                <TabsTrigger value="conversations" className="gap-1.5 text-xs px-2.5 sm:px-3 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap">
                  <MessageSquareText className="h-3.5 w-3.5" />
                  Conversas
                </TabsTrigger>
                <TabsTrigger value="videocall" className="gap-1.5 text-xs px-2.5 sm:px-3 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap">
                  <Video className="h-3.5 w-3.5" />
                  Vídeo
                </TabsTrigger>
              </TabsList>
            </div>
            )}

            <TabsContent value="overview">
              <SalesTeamTab />
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
            <TabsContent value="videocall">
              <VideoCallTab />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="insights">
          <TeamInsightsTab />
        </TabsContent>

        <TabsContent value="quotas-incentives">
          <QuotasIncentivesTab />
        </TabsContent>


        <TabsContent value="career">
          <CareerPlanTab plan={plan} onSaveLevels={saveSalesLevels} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
