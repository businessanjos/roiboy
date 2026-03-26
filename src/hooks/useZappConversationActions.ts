import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConversationAssignment, Agent } from "@/components/royzapp";

const STATUS_CONFIG: Record<string, { label: string }> = {
  triage: { label: "Triagem" },
  pending: { label: "Aguardando" },
  active: { label: "Em atendimento" },
  waiting: { label: "Aguardando cliente" },
  closed: { label: "Finalizado" },
};

interface UseZappConversationActionsProps {
  currentAgent: Agent | null;
  assignments: ConversationAssignment[];
  selectedConversation: ConversationAssignment | null;
  filterStatus: string;
  isAdmin: boolean;
  agents: Agent[];
  setAssignments: React.Dispatch<React.SetStateAction<ConversationAssignment[]>>;
  setSelectedConversation: React.Dispatch<React.SetStateAction<ConversationAssignment | null>>;
  setInboxTab: React.Dispatch<React.SetStateAction<"mine" | "queue">>;
  setFilterStatus: React.Dispatch<React.SetStateAction<string>>;
  fetchData: () => void;
  markAsRead: (conversationId: string) => void;
  getAgentName: (agentId: string | null) => string | null;
}

export function useZappConversationActions({
  currentAgent,
  assignments,
  selectedConversation,
  filterStatus,
  isAdmin,
  agents,
  setAssignments,
  setSelectedConversation,
  setInboxTab,
  setFilterStatus,
  fetchData,
  markAsRead,
  getAgentName,
}: UseZappConversationActionsProps) {

  // Assign conversation to current agent (pull from queue)
  const assignToMe = useCallback(async (assignmentId: string) => {
    if (!currentAgent) {
      toast.error("Você não está cadastrado como atendente");
      return;
    }

    const assignment = assignments.find(a => a.id === assignmentId);
    if (assignment?.agent_id && assignment.agent_id !== currentAgent.id) {
      const agentName = getAgentName(assignment.agent_id) || "outro atendente";
      toast.warning(`Este contato já está em atendimento por ${agentName}`);
      return;
    }

    try {
      const { error } = await supabase
        .from("zapp_conversation_assignments")
        .update({ 
          agent_id: currentAgent.id, 
          status: "active",
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", assignmentId);

      if (error) throw error;
      
      toast.success("Conversa atribuída a você!");
      fetchData();
      
      if (selectedConversation?.id === assignmentId) {
        setSelectedConversation(prev => prev ? {
          ...prev,
          agent_id: currentAgent.id,
          status: "active" as const,
          agent: { ...currentAgent }
        } : null);
      }
    } catch (error: any) {
      console.error("Error assigning conversation:", error);
      toast.error(error.message || "Erro ao atribuir conversa");
    }
  }, [currentAgent, assignments, selectedConversation, getAgentName, fetchData, setSelectedConversation]);

  // Pull next available conversation from queue
  const pullFromQueue = useCallback(async () => {
    if (!currentAgent) {
      toast.error("Você não está cadastrado como atendente");
      return;
    }

    const unassignedConversations = assignments.filter(a => 
      a.agent_id === null && 
      a.status !== "closed" && 
      !a.zapp_conversation?.is_archived
    ).sort((a, b) => {
      const dateA = new Date(a.zapp_conversation?.last_message_at || a.created_at).getTime();
      const dateB = new Date(b.zapp_conversation?.last_message_at || b.created_at).getTime();
      return dateA - dateB;
    });

    if (unassignedConversations.length === 0) {
      toast.info("Não há conversas na fila");
      return;
    }

    const nextConversation = unassignedConversations[0];
    
    try {
      const { error } = await supabase
        .from("zapp_conversation_assignments")
        .update({ 
          agent_id: currentAgent.id, 
          status: "active",
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", nextConversation.id);

      if (error) throw error;
      
      toast.success("Conversa puxada da fila!");
      fetchData();
      
      setInboxTab("mine");
      setSelectedConversation({
        ...nextConversation,
        agent_id: currentAgent.id,
        status: "active" as const,
        agent: { ...currentAgent }
      });
      
      const zappConvId = nextConversation.zapp_conversation?.id;
      if (zappConvId && (nextConversation.zapp_conversation?.unread_count || 0) > 0) {
        markAsRead(zappConvId);
      }
    } catch (error: any) {
      console.error("Error pulling from queue:", error);
      toast.error(error.message || "Erro ao puxar da fila");
    }
  }, [currentAgent, assignments, fetchData, setInboxTab, setSelectedConversation, markAsRead]);

  // Release conversation back to queue
  const releaseToQueue = useCallback(async (assignmentId: string) => {
    try {
      const releasedAt = new Date().toISOString();

      const { error } = await supabase
        .from("zapp_conversation_assignments")
        .update({ 
          agent_id: null, 
          status: "pending",
          assigned_at: null,
          closed_at: null,
          updated_at: releasedAt
        })
        .eq("id", assignmentId);

      if (error) throw error;
      
      toast.success("Conversa devolvida para a fila!");

      if (filterStatus === "closed") {
        setFilterStatus("all");
      }
      setInboxTab("queue");

      setAssignments(prev => prev.map(a => 
        a.id === assignmentId
          ? {
              ...a,
              agent_id: null,
              assigned_at: null,
              closed_at: null,
              updated_at: releasedAt,
              status: "pending" as const,
              agent: null,
            }
          : a
      ));
      
      if (selectedConversation?.id === assignmentId) {
        setSelectedConversation(prev => prev ? {
          ...prev,
          agent_id: null,
          assigned_at: null,
          closed_at: null,
          status: "pending" as const,
          updated_at: releasedAt,
          agent: null
        } : null);
      }

      fetchData();
    } catch (error: any) {
      console.error("Error releasing conversation:", error);
      toast.error(error.message || "Erro ao devolver conversa");
    }
  }, [selectedConversation, filterStatus, setFilterStatus, setInboxTab, setAssignments, setSelectedConversation, fetchData]);

  // Update conversation status
  const updateConversationStatus = useCallback(async (assignmentId: string, newStatus: "triage" | "pending" | "active" | "waiting" | "closed") => {
    try {
      const updateData: Record<string, string | null> = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      if (newStatus === "closed") {
        updateData.closed_at = new Date().toISOString();
        updateData.agent_id = null;
        updateData.assigned_at = null;
      } else {
        updateData.closed_at = null;
      }
      
      const { error } = await supabase
        .from("zapp_conversation_assignments")
        .update(updateData)
        .eq("id", assignmentId);

      if (error) throw error;
      
      toast.success(`Status alterado para: ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      fetchData();
      
      if (newStatus === "closed" && selectedConversation?.id === assignmentId) {
        setSelectedConversation(null);
      } else if (selectedConversation?.id === assignmentId) {
        setSelectedConversation(prev => prev ? {
          ...prev,
          status: newStatus
        } : null);
      }
    } catch (error: any) {
      console.error("Error updating conversation status:", error);
      toast.error(error.message || "Erro ao atualizar status");
    }
  }, [selectedConversation, fetchData, setSelectedConversation]);

  // Delete conversation (soft - close assignment)
  const deleteConversation = useCallback(async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("zapp_conversation_assignments")
        .update({ status: "closed", closed_at: new Date().toISOString(), agent_id: null, assigned_at: null })
        .eq("id", assignmentId);

      if (error) throw error;
      
      toast.success("Conversa apagada!");
      if (selectedConversation?.id === assignmentId) {
        setSelectedConversation(null);
      }
      fetchData();
    } catch (error: any) {
      console.error("Error deleting conversation:", error);
      toast.error("Erro ao apagar conversa");
    }
  }, [selectedConversation, fetchData, setSelectedConversation]);

  // Permanent delete conversation
  const permanentlyDeleteConversation = useCallback(async () => {
    if (!selectedConversation?.zapp_conversation_id && !selectedConversation?.zapp_conversation?.id) {
      toast.error("Conversa não encontrada");
      return;
    }
    
    const conversationId = selectedConversation.zapp_conversation_id || selectedConversation.zapp_conversation?.id;
    
    try {
      const { error } = await supabase
        .from("zapp_conversations")
        .delete()
        .eq("id", conversationId);

      if (error) throw error;
      
      toast.success("Conversa excluída permanentemente!");
      setSelectedConversation(null);
      fetchData();
    } catch (error: any) {
      console.error("Error permanently deleting conversation:", error);
      toast.error("Erro ao excluir conversa");
    }
  }, [selectedConversation, fetchData, setSelectedConversation]);

  // Dismiss group conversation
  const dismissGroupConversation = useCallback(async () => {
    if (!selectedConversation) return;
    
    try {
      const { error } = await supabase
        .from("zapp_conversation_assignments")
        .update({ 
          status: "closed", 
          closed_at: new Date().toISOString(),
          agent_id: null,
          assigned_at: null,
        })
        .eq("id", selectedConversation.id);
      
      if (error) throw error;
      
      toast.success("Grupo dispensado!");
      setSelectedConversation(null);
      setAssignments(prev => prev.filter(a => a.id !== selectedConversation.id));
    } catch (error) {
      console.error("Error dismissing group:", error);
      toast.error("Erro ao dispensar grupo");
    }
  }, [selectedConversation, setSelectedConversation, setAssignments]);

  // Dismiss by assignment ID (for sidebar)
  const dismissByAssignmentId = useCallback(async (assignmentId: string) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    
    try {
      const { error } = await supabase
        .from("zapp_conversation_assignments")
        .update({ 
          status: "closed", 
          closed_at: new Date().toISOString() 
        })
        .eq("id", assignmentId);
      
      if (error) throw error;
      
      toast.success("Grupo dispensado!");
      
      if (selectedConversation?.id === assignmentId) {
        setSelectedConversation(null);
      }
      
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    } catch (error) {
      console.error("Error dismissing group:", error);
      toast.error("Erro ao dispensar grupo");
    }
  }, [assignments, selectedConversation, setSelectedConversation, setAssignments]);

  // Transfer conversation
  const transferConversation = useCallback(async (transferTarget: { type: "agent" | "department"; id: string }) => {
    if (!selectedConversation || !transferTarget.id) return;
    
    try {
      if (transferTarget.type === "agent") {
        const { error } = await supabase
          .from('zapp_conversation_assignments')
          .update({ 
            agent_id: transferTarget.id,
            status: 'active' as const,
            assigned_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedConversation.id);
        
        if (error) throw error;
        
        const targetAgent = agents.find(a => a.id === transferTarget.id);
        toast.success(`Conversa transferida para ${targetAgent?.user?.name || 'atendente'}`);
      } else {
        const { error } = await supabase
          .from('zapp_conversation_assignments')
          .update({ 
            agent_id: null,
            department_id: transferTarget.id,
            status: 'pending' as const,
            assigned_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedConversation.id);
        
        if (error) throw error;
        
        toast.success(`Conversa transferida para fila`);
      }
      
      setSelectedConversation(null);
      fetchData();
    } catch (error) {
      console.error("[RoyZapp] Error transferring conversation:", error);
      toast.error("Erro ao transferir conversa");
    }
  }, [selectedConversation, agents, fetchData, setSelectedConversation]);

  // Conversation flag management
  const updateConversationFlag = useCallback(async (
    conversationId: string, 
    field: "is_archived" | "is_muted" | "is_pinned" | "is_favorite" | "is_blocked",
    value: boolean
  ) => {
    try {
      const updateData: Record<string, any> = { [field]: value };
      
      if (field === "is_pinned") {
        updateData.pinned_at = value ? new Date().toISOString() : null;
      }
      if (field === "is_archived") {
        updateData.archived_at = value ? new Date().toISOString() : null;
      }
      
      const { error } = await supabase
        .from("zapp_conversations")
        .update(updateData)
        .eq("id", conversationId);

      if (error) throw error;
      
      const messages: Record<string, { on: string; off: string }> = {
        is_archived: { on: "Conversa arquivada!", off: "Conversa desarquivada!" },
        is_muted: { on: "Notificações silenciadas!", off: "Notificações reativadas!" },
        is_pinned: { on: "Conversa fixada!", off: "Conversa desafixada!" },
        is_favorite: { on: "Adicionado aos favoritos!", off: "Removido dos favoritos!" },
        is_blocked: { on: "Contato bloqueado!", off: "Contato desbloqueado!" },
      };
      
      toast.success(value ? messages[field].on : messages[field].off);
      fetchData();
    } catch (error: any) {
      console.error(`Error updating ${field}:`, error);
      toast.error("Erro ao atualizar conversa");
    }
  }, [fetchData]);

  // Mark as read/unread
  const markAsReadAction = useCallback(async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from("zapp_conversations")
        .update({ unread_count: 0 })
        .eq("id", conversationId);

      if (error) throw error;
      
      setAssignments(prev => prev.map(a => 
        a.zapp_conversation?.id === conversationId 
          ? { ...a, zapp_conversation: { ...a.zapp_conversation!, unread_count: 0 } }
          : a
      ));
    } catch (error: any) {
      console.error("Error marking as read:", error);
    }
  }, [setAssignments]);

  const markAsUnread = useCallback(async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from("zapp_conversations")
        .update({ unread_count: 1 })
        .eq("id", conversationId);

      if (error) throw error;
      toast.success("Marcada como não lida!");
      
      setAssignments(prev => prev.map(a => 
        a.zapp_conversation?.id === conversationId 
          ? { ...a, zapp_conversation: { ...a.zapp_conversation!, unread_count: 1 } }
          : a
      ));
    } catch (error: any) {
      console.error("Error marking as unread:", error);
      toast.error("Erro ao marcar como não lida");
    }
  }, [setAssignments]);

  return {
    assignToMe,
    pullFromQueue,
    releaseToQueue,
    updateConversationStatus,
    deleteConversation,
    permanentlyDeleteConversation,
    dismissGroupConversation,
    dismissByAssignmentId,
    transferConversation,
    updateConversationFlag,
    markAsRead: markAsReadAction,
    markAsUnread,
  };
}
