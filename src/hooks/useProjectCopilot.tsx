import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface ProjectCopilotMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls: any | null;
  tool_call_id: string | null;
  tool_name: string | null;
  tool_result: any | null;
  created_at: string;
}

export function useProjectCopilot(projectId: string | null) {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();

  const messagesQuery = useQuery({
    queryKey: ["project-copilot-messages", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_project_copilot_messages")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at");
      if (error) throw error;
      return (data || []) as ProjectCopilotMessage[];
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      if (!projectId || !currentUser?.account_id) throw new Error("Projeto não carregado");
      const { data, error } = await supabase.functions.invoke("marketing-project-copilot", {
        body: { projectId, accountId: currentUser.account_id, message },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["project-copilot-messages", projectId] });
      // refresh project sub-resources if tools were executed
      if (data?.executedTools?.length) {
        qc.invalidateQueries({ queryKey: ["project-milestones", projectId] });
        qc.invalidateQueries({ queryKey: ["project-stakeholders", projectId] });
        qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
        qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
        qc.invalidateQueries({ queryKey: ["marketing-project", projectId] });
        qc.invalidateQueries({ queryKey: ["marketing-projects"] });
      }
    },
    onError: (e: any) => toast.error(e.message || "Falha ao enviar"),
  });

  const clearHistory = useMutation({
    mutationFn: async () => {
      if (!projectId) return;
      const { error } = await supabase
        .from("marketing_project_copilot_messages")
        .delete()
        .eq("project_id", projectId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-copilot-messages", projectId] }),
  });

  return {
    messages: messagesQuery.data || [],
    isLoading: messagesQuery.isLoading,
    sendMessage,
    clearHistory,
  };
}
