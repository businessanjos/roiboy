import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Bot, Plus, Edit2, Power, PowerOff, Sparkles, Brain, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { EverAgentDialog } from "./EverAgentDialog";

interface SectorAgent {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  system_prompt: string | null;
  greeting_message: string | null;
  model: string;
  temperature: number | null;
  max_tokens: number | null;
  is_enabled: boolean;
  personality: string | null;
  sector_id: string;
  features: Record<string, unknown> | null;
}

export function EverAgentsTab() {
  const { currentUser } = useCurrentUser();
  const [agents, setAgents] = useState<SectorAgent[]>([]);
  const [sectors, setSectors] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState<SectorAgent | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const accountId = currentUser?.account_id;

  useEffect(() => {
    if (!accountId) return;
    fetchData();
  }, [accountId]);

  async function fetchData() {
    setLoading(true);
    const [agentsRes, sectorsRes] = await Promise.all([
      supabase
        .from("ai_sector_agents")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("zapp_departments")
        .select("id, name")
        .eq("account_id", accountId!),
    ]);

    if (agentsRes.data) setAgents(agentsRes.data as unknown as SectorAgent[]);
    if (sectorsRes.data) setSectors(sectorsRes.data as unknown as { id: string; name: string }[]);
    setLoading(false);
  }

  async function toggleAgent(agent: SectorAgent) {
    const newValue = !agent.is_enabled;
    const { error } = await supabase
      .from("ai_sector_agents")
      .update({ is_enabled: newValue })
      .eq("id", agent.id);

    if (error) {
      toast.error("Erro ao atualizar agente");
      return;
    }

    setAgents((prev) =>
      prev.map((a) => (a.id === agent.id ? { ...a, is_enabled: newValue } : a))
    );
    toast.success(newValue ? "Agente ativado" : "Agente desativado");
  }

  function getSectorName(sectorId: string) {
    return sectors.find((s) => s.id === sectorId)?.name || "—";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Agentes de IA</h2>
          <p className="text-sm text-muted-foreground">
            Configure os agentes que atendem automaticamente em cada setor
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingAgent(null);
            setShowDialog(true);
          }}
          className="bg-violet-600 hover:bg-violet-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Agente
        </Button>
      </div>

      {/* Agent Cards */}
      {agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-violet-500" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Nenhum agente configurado</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Crie um agente de IA para começar a atender conversas automaticamente
            </p>
            <Button
              onClick={() => {
                setEditingAgent(null);
                setShowDialog(true);
              }}
              variant="outline"
              className="border-violet-500/30 text-violet-500 hover:bg-violet-500/10"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro agente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card
              key={agent.id}
              className={`transition-all hover:shadow-md ${
                agent.is_enabled
                  ? "border-violet-500/30 shadow-sm shadow-violet-500/5"
                  : "opacity-60"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        agent.is_enabled
                          ? "bg-gradient-to-br from-violet-500 to-purple-600"
                          : "bg-muted"
                      }`}
                    >
                      <Bot
                        className={`h-5 w-5 ${
                          agent.is_enabled ? "text-white" : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div>
                      <CardTitle className="text-base">{agent.display_name}</CardTitle>
                      <CardDescription className="text-xs">
                        {getSectorName(agent.sector_id)}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={agent.is_enabled}
                    onCheckedChange={() => toggleAgent(agent)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {agent.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {agent.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Brain className="h-3 w-3" />
                    {agent.model}
                  </Badge>
                  {agent.personality && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Sparkles className="h-3 w-3" />
                      {agent.personality}
                    </Badge>
                  )}
                  {agent.greeting_message && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <MessageCircle className="h-3 w-3" />
                      Saudação
                    </Badge>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-violet-500 hover:text-violet-600 hover:bg-violet-500/10"
                  onClick={() => {
                    setEditingAgent(agent);
                    setShowDialog(true);
                  }}
                >
                  <Edit2 className="h-3.5 w-3.5 mr-2" />
                  Configurar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showDialog && (
        <EverAgentDialog
          agent={editingAgent}
          sectors={sectors}
          open={showDialog}
          onOpenChange={setShowDialog}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
