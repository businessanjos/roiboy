import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SectorAgentChat } from "./SectorAgentChat";

interface SectorAgent {
  id: string;
  sector_id: string;
  name: string;
  display_name: string;
  avatar_url: string | null;
  greeting_message: string | null;
  is_enabled: boolean;
}

const sectorColors: Record<string, string> = {
  operacoes: "blue",
  financas: "emerald",
  vendas: "purple",
};

export function GlobalAgentChat() {
  const { data: agents = [] } = useQuery({
    queryKey: ["all-sector-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_sector_agents")
        .select("id, sector_id, name, display_name, avatar_url, greeting_message, is_enabled")
        .eq("is_enabled", true)
        .order("name");

      if (error) throw error;
      return data as SectorAgent[];
    },
  });

  if (agents.length === 0) return null;

  const agentOptions = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    displayName: agent.display_name,
    avatar: agent.avatar_url,
    greetingMessage: agent.greeting_message,
    color: sectorColors[agent.sector_id] || "blue",
  }));

  return <SectorAgentChat agents={agentOptions} />;
}
