import { useState } from "react";
import { Bot, MessageSquareText, BarChart3, Settings2, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EverAgentsTab } from "@/components/ever-ia/EverAgentsTab";
import { EverConversationsTab } from "@/components/ever-ia/EverConversationsTab";
import { EverDashboardTab } from "@/components/ever-ia/EverDashboardTab";

export default function EverIA() {
  const [activeTab, setActiveTab] = useState("agents");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              Ever IA
              <Zap className="h-4 w-4 text-violet-500" />
            </h1>
            <p className="text-sm text-muted-foreground">
              Inteligência artificial para atendimento automatizado
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-border px-6">
          <TabsList className="bg-transparent h-12 gap-2 p-0">
            <TabsTrigger
              value="agents"
              className="data-[state=active]:bg-violet-500/10 data-[state=active]:text-violet-500 data-[state=active]:border-b-2 data-[state=active]:border-violet-500 rounded-none px-4"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Agentes
            </TabsTrigger>
            <TabsTrigger
              value="conversations"
              className="data-[state=active]:bg-violet-500/10 data-[state=active]:text-violet-500 data-[state=active]:border-b-2 data-[state=active]:border-violet-500 rounded-none px-4"
            >
              <MessageSquareText className="h-4 w-4 mr-2" />
              Conversas
            </TabsTrigger>
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-violet-500/10 data-[state=active]:text-violet-500 data-[state=active]:border-b-2 data-[state=active]:border-violet-500 rounded-none px-4"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="agents" className="flex-1 m-0 overflow-auto">
          <EverAgentsTab />
        </TabsContent>

        <TabsContent value="conversations" className="flex-1 m-0 overflow-auto">
          <EverConversationsTab />
        </TabsContent>

        <TabsContent value="dashboard" className="flex-1 m-0 overflow-auto">
          <EverDashboardTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
