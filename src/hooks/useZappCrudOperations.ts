import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Agent, ZappTag, Department } from "@/components/royzapp";

interface UseZappCrudOperationsProps {
  userId: string | undefined;
  accountId: string | undefined;
  departments: Department[];
  tags: ZappTag[];
  fetchData: () => void;
}

export function useZappCrudOperations({
  userId,
  accountId,
  departments,
  tags,
  fetchData,
}: UseZappCrudOperationsProps) {
  // Department dialog state
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentForm, setDepartmentForm] = useState({
    name: "",
    description: "",
    color: "#25D366",
    auto_distribution: true,
    sector_id: "" as string,
  });
  const [savingDepartment, setSavingDepartment] = useState(false);
  const [deletingDepartmentId, setDeletingDepartmentId] = useState<string | null>(null);

  // Agent dialog state
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentForm, setAgentForm] = useState({
    user_id: "",
    department_id: "",
    max_concurrent_chats: 5,
  });
  const [savingAgent, setSavingAgent] = useState(false);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);

  // Tag dialog state
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<ZappTag | null>(null);
  const [tagForm, setTagForm] = useState({
    name: "",
    description: "",
    color: "#6b7c85",
  });
  const [savingTag, setSavingTag] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  // Conversation tagging state
  const [conversationTagDialogOpen, setConversationTagDialogOpen] = useState(false);
  const [taggingAssignmentId, setTaggingAssignmentId] = useState<string | null>(null);
  const [selectedConversationTags, setSelectedConversationTags] = useState<string[]>([]);
  const [savingConversationTags, setSavingConversationTags] = useState(false);

  // Department functions
  const openDepartmentDialog = useCallback((dept?: Department) => {
    if (dept) {
      setEditingDepartment(dept);
      setDepartmentForm({
        name: dept.name,
        description: dept.description || "",
        color: dept.color,
        auto_distribution: dept.auto_distribution,
        sector_id: (dept as any).sector_id || "",
      });
    } else {
      setEditingDepartment(null);
      setDepartmentForm({
        name: "",
        description: "",
        color: "#25D366",
        auto_distribution: true,
        sector_id: "",
      });
    }
    setDepartmentDialogOpen(true);
  }, []);

  const saveDepartment = useCallback(async () => {
    if (!accountId || !departmentForm.name.trim()) {
      toast.error("Nome do departamento é obrigatório");
      return;
    }

    setSavingDepartment(true);
    try {
      if (editingDepartment) {
        const { error } = await supabase
          .from("zapp_departments")
          .update({
            name: departmentForm.name.trim(),
            description: departmentForm.description.trim() || null,
            color: departmentForm.color,
            auto_distribution: departmentForm.auto_distribution,
            sector_id: departmentForm.sector_id || null,
          })
          .eq("id", editingDepartment.id);

        if (error) throw error;
        toast.success("Departamento atualizado!");
      } else {
        const { error } = await supabase.from("zapp_departments").insert({
          account_id: accountId,
          name: departmentForm.name.trim(),
          description: departmentForm.description.trim() || null,
          color: departmentForm.color,
          auto_distribution: departmentForm.auto_distribution,
          sector_id: departmentForm.sector_id || null,
          display_order: departments.length,
        });

        if (error) throw error;
        toast.success("Departamento criado!");
      }

      setDepartmentDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving department:", error);
      toast.error(error.message || "Erro ao salvar departamento");
    } finally {
      setSavingDepartment(false);
    }
  }, [accountId, departmentForm, editingDepartment, departments.length, fetchData]);

  const deleteDepartment = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("zapp_departments").delete().eq("id", id);
      if (error) throw error;
      toast.success("Departamento excluído!");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting department:", error);
      toast.error(error.message || "Erro ao excluir departamento");
    } finally {
      setDeletingDepartmentId(null);
    }
  }, [fetchData]);

  // Agent functions
  const openAgentDialog = useCallback((agent?: Agent) => {
    if (agent) {
      setEditingAgent(agent);
      setAgentForm({
        user_id: agent.user_id,
        department_id: agent.department_id || "",
        max_concurrent_chats: agent.max_concurrent_chats,
      });
    } else {
      setEditingAgent(null);
      setAgentForm({
        user_id: "",
        department_id: "",
        max_concurrent_chats: 5,
      });
    }
    setAgentDialogOpen(true);
  }, []);

  const saveAgent = useCallback(async () => {
    if (!accountId || !agentForm.user_id) {
      toast.error("Selecione um usuário");
      return;
    }

    setSavingAgent(true);
    try {
      if (editingAgent) {
        const { error } = await supabase
          .from("zapp_agents")
          .update({
            department_id: agentForm.department_id || null,
            max_concurrent_chats: agentForm.max_concurrent_chats,
          })
          .eq("id", editingAgent.id);

        if (error) throw error;
        toast.success("Atendente atualizado!");
      } else {
        const { error } = await supabase.from("zapp_agents").insert({
          account_id: accountId,
          user_id: agentForm.user_id,
          department_id: agentForm.department_id || null,
          max_concurrent_chats: agentForm.max_concurrent_chats,
        });

        if (error) throw error;
        toast.success("Atendente adicionado!");
      }

      setAgentDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving agent:", error);
      toast.error(error.message || "Erro ao salvar atendente");
    } finally {
      setSavingAgent(false);
    }
  }, [accountId, agentForm, editingAgent, fetchData]);

  const deleteAgent = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("zapp_agents").delete().eq("id", id);
      if (error) throw error;
      toast.success("Atendente removido!");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting agent:", error);
      toast.error(error.message || "Erro ao remover atendente");
    } finally {
      setDeletingAgentId(null);
    }
  }, [fetchData]);

  const toggleAgentOnline = useCallback(async (agent: Agent) => {
    try {
      const { error } = await supabase
        .from("zapp_agents")
        .update({ is_online: !agent.is_online, last_activity_at: new Date().toISOString() })
        .eq("id", agent.id);

      if (error) throw error;
      fetchData();
    } catch (error: any) {
      console.error("Error toggling agent status:", error);
      toast.error("Erro ao alterar status");
    }
  }, [fetchData]);

  const toggleAgentGlobalAccess = useCallback(async (agent: Agent) => {
    try {
      const next = !agent.has_global_access;
      const { error } = await supabase
        .from("zapp_agents")
        .update({ has_global_access: next } as any)
        .eq("id", agent.id);

      if (error) throw error;
      toast.success(next ? "Acesso global ativado" : "Acesso global removido");
      fetchData();
    } catch (error: any) {
      console.error("Error toggling agent global access:", error);
      toast.error("Erro ao alterar acesso global");
    }
  }, [fetchData]);

  // Tag functions
  const openTagDialog = useCallback((tag?: ZappTag) => {
    if (tag) {
      setEditingTag(tag);
      setTagForm({
        name: tag.name,
        description: tag.description || "",
        color: tag.color,
      });
    } else {
      setEditingTag(null);
      setTagForm({
        name: "",
        description: "",
        color: "#6b7c85",
      });
    }
    setTagDialogOpen(true);
  }, []);

  const saveTag = useCallback(async () => {
    if (!accountId || !tagForm.name.trim()) {
      toast.error("Nome da tag é obrigatório");
      return;
    }

    setSavingTag(true);
    try {
      if (editingTag) {
        const { error } = await supabase
          .from("zapp_tags")
          .update({
            name: tagForm.name.trim(),
            description: tagForm.description.trim() || null,
            color: tagForm.color,
          })
          .eq("id", editingTag.id);

        if (error) throw error;
        toast.success("Tag atualizada!");
      } else {
        const { error } = await supabase.from("zapp_tags").insert({
          account_id: accountId,
          name: tagForm.name.trim(),
          description: tagForm.description.trim() || null,
          color: tagForm.color,
          display_order: tags.length,
        });

        if (error) throw error;
        toast.success("Tag criada!");
      }

      setTagDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving tag:", error);
      toast.error(error.message || "Erro ao salvar tag");
    } finally {
      setSavingTag(false);
    }
  }, [accountId, tagForm, editingTag, tags.length, fetchData]);

  const deleteTag = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("zapp_tags").delete().eq("id", id);
      if (error) throw error;
      toast.success("Tag excluída!");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting tag:", error);
      toast.error(error.message || "Erro ao excluir tag");
    } finally {
      setDeletingTagId(null);
    }
  }, [fetchData]);

  // Conversation tagging
  const openConversationTagDialog = useCallback(async (assignmentId: string) => {
    setTaggingAssignmentId(assignmentId);
    
    try {
      const { data, error } = await supabase
        .from("zapp_conversation_tags")
        .select("tag_id")
        .eq("assignment_id", assignmentId);
      
      if (error) throw error;
      setSelectedConversationTags(data?.map(t => t.tag_id) || []);
    } catch (error) {
      console.error("Error fetching conversation tags:", error);
      setSelectedConversationTags([]);
    }
    
    setConversationTagDialogOpen(true);
  }, []);

  const toggleConversationTag = useCallback((tagId: string) => {
    setSelectedConversationTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  }, []);

  const saveConversationTags = useCallback(async () => {
    if (!taggingAssignmentId || !accountId) return;
    
    setSavingConversationTags(true);
    try {
      await supabase
        .from("zapp_conversation_tags")
        .delete()
        .eq("assignment_id", taggingAssignmentId);
      
      if (selectedConversationTags.length > 0) {
        const { error } = await supabase
          .from("zapp_conversation_tags")
          .insert(
            selectedConversationTags.map(tagId => ({
              account_id: accountId,
              assignment_id: taggingAssignmentId,
              tag_id: tagId,
              created_by: userId || null,
            }))
          );
        
        if (error) throw error;
      }
      
      toast.success("Tags atualizadas!");
      setConversationTagDialogOpen(false);
    } catch (error: any) {
      console.error("Error saving conversation tags:", error);
      toast.error(error.message || "Erro ao salvar tags");
    } finally {
      setSavingConversationTags(false);
    }
  }, [taggingAssignmentId, accountId, selectedConversationTags]);

  return {
    // Department
    departmentDialogOpen,
    setDepartmentDialogOpen,
    editingDepartment,
    departmentForm,
    setDepartmentForm,
    savingDepartment,
    deletingDepartmentId,
    setDeletingDepartmentId,
    openDepartmentDialog,
    saveDepartment,
    deleteDepartment,

    // Agent
    agentDialogOpen,
    setAgentDialogOpen,
    editingAgent,
    agentForm,
    setAgentForm,
    savingAgent,
    deletingAgentId,
    setDeletingAgentId,
    openAgentDialog,
    saveAgent,
    deleteAgent,
    toggleAgentOnline,

    // Tag
    tagDialogOpen,
    setTagDialogOpen,
    editingTag,
    tagForm,
    setTagForm,
    savingTag,
    deletingTagId,
    setDeletingTagId,
    openTagDialog,
    saveTag,
    deleteTag,

    // Conversation tags
    conversationTagDialogOpen,
    setConversationTagDialogOpen,
    selectedConversationTags,
    savingConversationTags,
    openConversationTagDialog,
    toggleConversationTag,
    saveConversationTags,
  };
}
