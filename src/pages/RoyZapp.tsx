import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions, PERMISSIONS } from "@/hooks/usePermissions";
import { useZappData, Message, TeamUser } from "@/hooks/useZappData";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ZappConversationPanel,
  ZappChatView,
  Agent,
  ZappTag,
  Department,
  ConversationAssignment,
} from "@/components/royzapp";
import {
  ZappDepartmentDialog,
  ZappAgentDialog,
  ZappTagDialog,
  ZappRoiDialog,
  ZappRiskDialog,
  ZappTransferDialog,
  ZappConversationTagDialog,
  ZappContactPickerDialog,
  ZappQuickRepliesDialog,
  ZappAddClientDialog,
  ZappNewConversationDialog,
} from "@/components/royzapp/dialogs";
import {
  MessageSquare,
  ArrowLeft,
  Loader2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ClientQuickEditSheet } from "@/components/client/ClientQuickEditSheet";

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  triage: { label: "Triagem", color: "text-purple-600", bgColor: "bg-purple-500" },
  pending: { label: "Aguardando", color: "text-amber-600", bgColor: "bg-amber-500" },
  active: { label: "Em atendimento", color: "text-emerald-600", bgColor: "bg-emerald-500" },
  waiting: { label: "Aguardando cliente", color: "text-blue-600", bgColor: "bg-blue-500" },
  closed: { label: "Finalizado", color: "text-muted-foreground", bgColor: "bg-muted-foreground" },
};

export default function RoyZapp() {
  const { currentUser } = useCurrentUser();
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();
  
  // Use centralized data hook
  const {
    departments,
    tags,
    agents,
    teamUsers,
    allClients,
    assignments,
    setAssignments,
    messages,
    loading,
    availableProducts,
    clientProducts,
    currentAgent,
    whatsappConnected,
    whatsappConnecting,
    whatsappInstanceName,
    toggleWhatsAppConnection,
    fetchData,
    fetchMessages,
    setMessages,
  } = useZappData();

  // UI state
  const [activeView, setActiveView] = useState<"inbox" | "team" | "departments" | "tags" | "settings">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterGroups, setFilterGroups] = useState(false);
  const [filterProductId, setFilterProductId] = useState<string>("all");
  const [filterTagId, setFilterTagId] = useState<string>("all");
  const [filterAgentId, setFilterAgentId] = useState<string>("all");
  const [selectedConversation, setSelectedConversation] = useState<ConversationAssignment | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioPreview, setAudioPreview] = useState<{ blob: Blob; url: string; duration: number } | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [showFormatting, setShowFormatting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [inboxTab, setInboxTab] = useState<"mine" | "queue">("mine");
  
  // Distribution settings state (persisted to localStorage)
  const [roundRobinEnabled, setRoundRobinEnabled] = useState(() => {
    const saved = localStorage.getItem("zapp_roundRobin");
    return saved !== null ? saved === "true" : true;
  });
  const [respectLimitEnabled, setRespectLimitEnabled] = useState(() => {
    const saved = localStorage.getItem("zapp_respectLimit");
    return saved !== null ? saved === "true" : true;
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem("zapp_sound");
    return saved !== null ? saved === "true" : true;
  });
  
  // Import conversations state
  const [importingConversations, setImportingConversations] = useState(false);
  const [importLimit, setImportLimit] = useState("50");

  // Department dialog state
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentForm, setDepartmentForm] = useState({
    name: "",
    description: "",
    color: "#25D366",
    auto_distribution: true,
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

  // Transfer dialog
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<{ type: "agent" | "department"; id: string }>({ type: "agent", id: "" });

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
  
  // Conversation tagging dialog
  const [conversationTagDialogOpen, setConversationTagDialogOpen] = useState(false);
  const [taggingAssignmentId, setTaggingAssignmentId] = useState<string | null>(null);
  const [selectedConversationTags, setSelectedConversationTags] = useState<string[]>([]);
  const [savingConversationTags, setSavingConversationTags] = useState(false);
  
  // Client quick edit sheet
  const [clientEditSheetOpen, setClientEditSheetOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  // ROI dialog state
  const [roiDialogOpen, setRoiDialogOpen] = useState(false);
  const [roiType, setRoiType] = useState("tangible");
  const [roiCategory, setRoiCategory] = useState("revenue");
  const [roiEvidence, setRoiEvidence] = useState("");
  const [roiImpact, setRoiImpact] = useState("medium");
  const [uploadingRoi, setUploadingRoi] = useState(false);

  // Risk dialog state
  const [riskDialogOpen, setRiskDialogOpen] = useState(false);
  const [riskLevel, setRiskLevel] = useState("medium");
  const [riskReason, setRiskReason] = useState("");
  const [uploadingRisk, setUploadingRisk] = useState(false);

  // Contact picker dialog state
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [sendingContact, setSendingContact] = useState(false);

  // Quick replies state
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [quickReplies, setQuickReplies] = useState<{ id: string; title: string; content: string }[]>([]);
  const [quickReplyDialogOpen, setQuickReplyDialogOpen] = useState(false);
  const [editingQuickReply, setEditingQuickReply] = useState<{ id: string; title: string; content: string } | null>(null);
  const [quickReplyForm, setQuickReplyForm] = useState({ title: "", content: "" });
  const [savingQuickReply, setSavingQuickReply] = useState(false);

  // Add client from contact state
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);
  const [addClientForm, setAddClientForm] = useState({ full_name: "", phone_e164: "" });
  const [savingNewClient, setSavingNewClient] = useState(false);

  // New conversation with client state
  const [newConversationDialogOpen, setNewConversationDialogOpen] = useState(false);
  const [newConversationSearch, setNewConversationSearch] = useState("");
  const [newConversationClients, setNewConversationClients] = useState<any[]>([]);
  const [creatingConversation, setCreatingConversation] = useState(false);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (selectedConversation?.zapp_conversation_id) {
      fetchMessages(selectedConversation.zapp_conversation_id);
    }
  }, [selectedConversation, fetchMessages]);
  // Department functions
  const openDepartmentDialog = (dept?: Department) => {
    if (dept) {
      setEditingDepartment(dept);
      setDepartmentForm({
        name: dept.name,
        description: dept.description || "",
        color: dept.color,
        auto_distribution: dept.auto_distribution,
      });
    } else {
      setEditingDepartment(null);
      setDepartmentForm({
        name: "",
        description: "",
        color: "#25D366",
        auto_distribution: true,
      });
    }
    setDepartmentDialogOpen(true);
  };

  const saveDepartment = async () => {
    if (!currentUser?.account_id || !departmentForm.name.trim()) {
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
          })
          .eq("id", editingDepartment.id);

        if (error) throw error;
        toast.success("Departamento atualizado!");
      } else {
        const { error } = await supabase.from("zapp_departments").insert({
          account_id: currentUser.account_id,
          name: departmentForm.name.trim(),
          description: departmentForm.description.trim() || null,
          color: departmentForm.color,
          auto_distribution: departmentForm.auto_distribution,
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
  };

  const deleteDepartment = async (id: string) => {
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
  };

  // Agent functions
  const openAgentDialog = (agent?: Agent) => {
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
  };

  const saveAgent = async () => {
    if (!currentUser?.account_id || !agentForm.user_id) {
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
          account_id: currentUser.account_id,
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
  };

  const deleteAgent = async (id: string) => {
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
  };

  const toggleAgentOnline = async (agent: Agent) => {
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
  };

  // Assign conversation to current agent (pull from queue)
  const assignToMe = async (assignmentId: string) => {
    if (!currentAgent) {
      toast.error("Você não está cadastrado como atendente");
      return;
    }

    try {
      const { error } = await supabase
        .from("zapp_conversation_assignments")
        .update({ 
          agent_id: currentAgent.id, 
          status: "active",
          updated_at: new Date().toISOString()
        })
        .eq("id", assignmentId);

      if (error) throw error;
      
      toast.success("Conversa atribuída a você!");
      fetchData();
      
      // Update selected conversation locally
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
  };

  // Release conversation back to queue
  const releaseToQueue = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("zapp_conversation_assignments")
        .update({ 
          agent_id: null, 
          status: "pending",
          updated_at: new Date().toISOString()
        })
        .eq("id", assignmentId);

      if (error) throw error;
      
      toast.success("Conversa devolvida para a fila!");
      fetchData();
      
      // Update selected conversation locally
      if (selectedConversation?.id === assignmentId) {
        setSelectedConversation(prev => prev ? {
          ...prev,
          agent_id: null,
          status: "pending" as const,
          agent: null
        } : null);
      }
    } catch (error: any) {
      console.error("Error releasing conversation:", error);
      toast.error(error.message || "Erro ao devolver conversa");
    }
  };

  // Update conversation status
  const updateConversationStatus = async (assignmentId: string, newStatus: "triage" | "pending" | "active" | "waiting" | "closed") => {
    try {
      const updateData: Record<string, string | null> = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      // If closing, set closed_at timestamp
      if (newStatus === "closed") {
        updateData.closed_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from("zapp_conversation_assignments")
        .update(updateData)
        .eq("id", assignmentId);

      if (error) throw error;
      
      toast.success(`Status alterado para: ${STATUS_CONFIG[newStatus].label}`);
      fetchData();
      
      // Update selected conversation locally
      if (selectedConversation?.id === assignmentId) {
        setSelectedConversation(prev => prev ? {
          ...prev,
          status: newStatus
        } : null);
      }
    } catch (error: any) {
      console.error("Error updating conversation status:", error);
      toast.error(error.message || "Erro ao atualizar status");
    }
  };

  // Add ROI event
  const handleAddRoi = async () => {
    const clientId = selectedConversation?.zapp_conversation?.client_id;
    if (!clientId || !currentUser?.account_id || !roiEvidence.trim()) {
      toast.error("Preencha a evidência do ROI");
      return;
    }

    setUploadingRoi(true);
    try {
      const { error } = await supabase.from("roi_events").insert({
        account_id: currentUser.account_id,
        client_id: clientId,
        source: "manual" as const,
        roi_type: roiType as "tangible" | "intangible",
        category: roiCategory as any,
        evidence_snippet: roiEvidence,
        impact: roiImpact as "low" | "medium" | "high",
        happened_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("ROI adicionado com sucesso!");
      setRoiDialogOpen(false);
      setRoiEvidence("");
    } catch (error) {
      console.error("Error adding ROI:", error);
      toast.error("Erro ao adicionar ROI");
    } finally {
      setUploadingRoi(false);
    }
  };

  // Add Risk event
  const handleAddRisk = async () => {
    const clientId = selectedConversation?.zapp_conversation?.client_id;
    if (!clientId || !currentUser?.account_id || !riskReason.trim()) {
      toast.error("Preencha o motivo do risco");
      return;
    }

    setUploadingRisk(true);
    try {
      const { error } = await supabase.from("risk_events").insert({
        account_id: currentUser.account_id,
        client_id: clientId,
        source: "system" as const,
        risk_level: riskLevel as "low" | "medium" | "high",
        reason: riskReason,
        happened_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Risco adicionado com sucesso!");
      setRiskDialogOpen(false);
      setRiskReason("");
    } catch (error) {
      console.error("Error adding risk:", error);
      toast.error("Erro ao adicionar risco");
    } finally {
      setUploadingRisk(false);
    }
  };

  // Helper to get contact info from assignment (prefers zapp_conversation, falls back to conversation)
  const getContactInfo = useCallback((assignment: ConversationAssignment) => {
    const zc = assignment.zapp_conversation;
    const c = assignment.conversation?.client;
    
    return {
      name: zc?.client?.full_name || zc?.contact_name || c?.full_name || "Contato",
      phone: zc?.phone_e164 || c?.phone_e164 || "",
      avatar: zc?.client?.avatar_url || zc?.avatar_url || c?.avatar_url || null,
      clientId: zc?.client_id || c?.id || null,
      isClient: !!(zc?.client_id || c?.id),
      isGroup: zc?.is_group || false,
      lastMessage: zc?.last_message_preview || null,
      lastMessagePreview: zc?.last_message_preview || "",
      unreadCount: zc?.unread_count || 0,
      lastMessageAt: zc?.last_message_at || assignment.updated_at,
      isPinned: zc?.is_pinned || false,
      isMuted: zc?.is_muted || false,
      isArchived: zc?.is_archived || false,
      isFavorite: zc?.is_favorite || false,
      isBlocked: zc?.is_blocked || false,
    };
  }, []);

  // Conversation management functions
  const updateConversationFlag = async (
    conversationId: string, 
    field: "is_archived" | "is_muted" | "is_pinned" | "is_favorite" | "is_blocked",
    value: boolean
  ) => {
    try {
      const updateData: Record<string, any> = { [field]: value };
      
      // Add timestamp for pinned
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
  };

  const markAsRead = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from("zapp_conversations")
        .update({ unread_count: 0 })
        .eq("id", conversationId);

      if (error) throw error;
      
      // Update local state
      setAssignments(prev => prev.map(a => 
        a.zapp_conversation?.id === conversationId 
          ? { ...a, zapp_conversation: { ...a.zapp_conversation!, unread_count: 0 } }
          : a
      ));
    } catch (error: any) {
      console.error("Error marking as read:", error);
    }
  };

  const markAsUnread = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from("zapp_conversations")
        .update({ unread_count: 1 })
        .eq("id", conversationId);

      if (error) throw error;
      toast.success("Marcada como não lida!");
      
      // Update local state instead of refetching
      setAssignments(prev => prev.map(a => 
        a.zapp_conversation?.id === conversationId 
          ? { ...a, zapp_conversation: { ...a.zapp_conversation!, unread_count: 1 } }
          : a
      ));
    } catch (error: any) {
      console.error("Error marking as unread:", error);
      toast.error("Erro ao marcar como não lida");
    }
  };

  const deleteConversation = async (assignmentId: string) => {
    try {
      // Close the assignment (soft delete)
      const { error } = await supabase
        .from("zapp_conversation_assignments")
        .update({ status: "closed", closed_at: new Date().toISOString() })
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
  };

  // Send message via UAZAPI
  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || sendingMessage) return;
    
    const contactInfo = getContactInfo(selectedConversation);
    const phone = contactInfo.phone;
    const isGroup = contactInfo.isGroup;
    const groupJid = selectedConversation.zapp_conversation?.group_jid;
    
    if (!phone && !groupJid) {
      toast.error("Número de telefone não encontrado");
      return;
    }
    
    const messageContent = messageInput.trim();
    const tempMessageId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    
    // Optimistic update - add message to UI immediately
    const optimisticMessage: Message = {
      id: tempMessageId,
      content: messageContent,
      is_from_client: false,
      created_at: now,
      message_type: "text",
      media_url: null,
      media_type: null,
      media_mimetype: null,
      media_filename: null,
      audio_duration_sec: null,
      sender_name: null,
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setMessageInput("");
    setSendingMessage(true);
    
    try {
      // Call UAZAPI to send message
      const action = isGroup && groupJid ? "send_to_group" : "send_text";
      const payload: Record<string, string> = {
        action,
        message: messageContent,
      };
      
      if (isGroup && groupJid) {
        payload.group_id = groupJid;
      } else {
        payload.phone = phone;
      }
      
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: payload,
      });
      
      if (error) throw error;
      
      // Save message to zapp_messages
      if (selectedConversation.zapp_conversation_id) {
        const { data: insertedMessage } = await supabase.from("zapp_messages").insert({
          account_id: currentUser!.account_id,
          zapp_conversation_id: selectedConversation.zapp_conversation_id,
          direction: "outbound",
          content: messageContent,
          message_type: "text",
          sent_at: now,
        }).select("id").single();
        
        // Replace temp message with real one
        if (insertedMessage) {
          setMessages(prev => prev.map(m => 
            m.id === tempMessageId ? { ...m, id: insertedMessage.id } : m
          ));
        }
        
        // Update conversation last message
        await supabase.from("zapp_conversations").update({
          last_message_at: now,
          last_message_preview: messageContent.substring(0, 100),
          unread_count: 0,
        }).eq("id", selectedConversation.zapp_conversation_id);
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessageId));
      setMessageInput(messageContent); // Restore input
      toast.error(error.message || "Erro ao enviar mensagem");
    } finally {
      setSendingMessage(false);
    }
  };

  // Send media message (image/document)
  const sendMediaMessage = async (file: File, mediaType: "image" | "document") => {
    if (!selectedConversation || uploadingMedia) return;
    
    const contactInfo = getContactInfo(selectedConversation);
    const phone = contactInfo.phone;
    const isGroup = contactInfo.isGroup;
    const groupJid = selectedConversation.zapp_conversation?.group_jid;
    
    if (!phone && !groupJid) {
      toast.error("Número de telefone não encontrado");
      return;
    }

    setUploadingMedia(true);
    const tempMessageId = `temp-media-${Date.now()}`;
    const now = new Date().toISOString();
    
    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempMessageId,
      content: mediaType === "image" ? "[Imagem]" : `[Arquivo] ${file.name}`,
      is_from_client: false,
      created_at: now,
      message_type: mediaType,
      media_url: URL.createObjectURL(file), // Temporary URL for preview
      media_type: mediaType,
      media_mimetype: file.type,
      media_filename: file.name,
      audio_duration_sec: null,
      sender_name: null,
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    
    try {
      // Upload file to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser!.account_id}/${Date.now()}.${fileExt}`;
      const bucket = mediaType === "image" ? "avatars" : "client-followups";
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      const mediaUrl = urlData.publicUrl;
      
      // Call UAZAPI to send media
      const action = isGroup && groupJid ? "send_media_to_group" : "send_media";
      const payload: Record<string, string> = {
        action,
        media_url: mediaUrl,
        media_type: mediaType,
        caption: "",
        file_name: file.name,
      };
      
      if (isGroup && groupJid) {
        payload.group_id = groupJid;
      } else {
        payload.phone = phone;
      }
      
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: payload,
      });
      
      if (error) throw error;
      
      if (data && !data.success) {
        throw new Error(data.message || "Falha ao enviar mídia");
      }
      
      // Save message to zapp_messages
      if (selectedConversation.zapp_conversation_id) {
        const { data: insertedMessage } = await supabase.from("zapp_messages").insert({
          account_id: currentUser!.account_id,
          zapp_conversation_id: selectedConversation.zapp_conversation_id,
          direction: "outbound",
          content: mediaType === "image" ? "[Imagem]" : `[Arquivo] ${file.name}`,
          message_type: mediaType,
          media_url: mediaUrl,
          media_type: mediaType,
          media_mimetype: file.type,
          media_filename: file.name,
          sent_at: now,
        }).select("id").single();
        
        // Replace temp message with real one
        if (insertedMessage) {
          setMessages(prev => prev.map(m => 
            m.id === tempMessageId ? { ...m, id: insertedMessage.id, media_url: mediaUrl } : m
          ));
        }
        
        // Update conversation last message
        await supabase.from("zapp_conversations").update({
          last_message_at: now,
          last_message_preview: mediaType === "image" ? "📷 Imagem" : `📎 ${file.name}`,
          unread_count: 0,
        }).eq("id", selectedConversation.zapp_conversation_id);
      }
      
      toast.success(mediaType === "image" ? "Imagem enviada!" : "Arquivo enviado!");
    } catch (error: any) {
      console.error("Error sending media:", error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessageId));
      toast.error(error.message || "Erro ao enviar mídia");
    } finally {
      setUploadingMedia(false);
    }
  };

  // Handle file input change
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, mediaType: "image" | "document") => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo 50MB.");
        return;
      }
      sendMediaMessage(file, mediaType);
    }
    // Reset input
    e.target.value = "";
  };

  // Start audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          // Set preview instead of sending immediately
          setAudioPreview({ 
            blob: audioBlob, 
            url: audioUrl, 
            duration: recordingDuration 
          });
        }
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      toast.success("Gravando áudio...");
    } catch (error: any) {
      console.error("Error starting recording:", error);
      toast.error("Erro ao acessar microfone. Verifique as permissões.");
    }
  };

  // Stop audio recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingDuration(0);
    }
  };

  // Cancel audio recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Stop without triggering onstop handler
      const stream = mediaRecorderRef.current.stream;
      stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingDuration(0);
      toast.info("Gravação cancelada");
    }
  };

  // Discard audio preview
  const discardAudioPreview = () => {
    if (audioPreview) {
      URL.revokeObjectURL(audioPreview.url);
      setAudioPreview(null);
    }
  };

  // Confirm and send audio preview
  const confirmAudioSend = async () => {
    if (audioPreview) {
      await sendAudioMessage(audioPreview.blob, audioPreview.duration);
      URL.revokeObjectURL(audioPreview.url);
      setAudioPreview(null);
    }
  };

  // Send audio message
  const sendAudioMessage = async (audioBlob: Blob, duration?: number) => {
    if (!selectedConversation || uploadingMedia) return;
    
    const contactInfo = getContactInfo(selectedConversation);
    const phone = contactInfo.phone;
    const isGroup = contactInfo.isGroup;
    const groupJid = selectedConversation.zapp_conversation?.group_jid;
    
    if (!phone && !groupJid) {
      toast.error("Número de telefone não encontrado");
      return;
    }

    setUploadingMedia(true);
    const tempMessageId = `temp-audio-${Date.now()}`;
    const now = new Date().toISOString();
    
    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempMessageId,
      content: "[Áudio]",
      is_from_client: false,
      created_at: now,
      message_type: "audio",
      media_url: URL.createObjectURL(audioBlob),
      media_type: "audio",
      media_mimetype: audioBlob.type,
      media_filename: `audio_${Date.now()}.webm`,
      audio_duration_sec: duration || null,
      sender_name: null,
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    
    try {
      // Upload audio to Supabase storage
      const fileName = `${currentUser!.account_id}/audio_${Date.now()}.webm`;
      const bucket = "client-followups";
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, audioBlob, {
          contentType: audioBlob.type,
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      const mediaUrl = urlData.publicUrl;
      
      // Call UAZAPI to send audio
      const action = isGroup && groupJid ? "send_media_to_group" : "send_media";
      const payload: Record<string, string> = {
        action,
        media_url: mediaUrl,
        media_type: "audio",
        caption: "",
        file_name: `audio_${Date.now()}.webm`,
      };
      
      if (isGroup && groupJid) {
        payload.group_id = groupJid;
      } else {
        payload.phone = phone;
      }
      
      const { data, error } = await supabase.functions.invoke("uazapi-manager", {
        body: payload,
      });
      
      if (error) throw error;
      
      if (data && !data.success) {
        throw new Error(data.message || "Falha ao enviar áudio");
      }
      
      // Save message to zapp_messages
      if (selectedConversation.zapp_conversation_id) {
        const { data: insertedMessage } = await supabase.from("zapp_messages").insert({
          account_id: currentUser!.account_id,
          zapp_conversation_id: selectedConversation.zapp_conversation_id,
          direction: "outbound",
          content: "[Áudio]",
          message_type: "audio",
          media_url: mediaUrl,
          media_type: "audio",
          media_mimetype: audioBlob.type,
          media_filename: `audio_${Date.now()}.webm`,
          audio_duration_sec: recordingDuration || null,
          sent_at: now,
        }).select("id").single();
        
        // Replace temp message with real one
        if (insertedMessage) {
          setMessages(prev => prev.map(m => 
            m.id === tempMessageId ? { ...m, id: insertedMessage.id, media_url: mediaUrl } : m
          ));
        }
        
        // Update conversation last message
        await supabase.from("zapp_conversations").update({
          last_message_at: now,
          last_message_preview: "🎤 Áudio",
          unread_count: 0,
        }).eq("id", selectedConversation.zapp_conversation_id);
      }
      
      toast.success("Áudio enviado!");
    } catch (error: any) {
      console.error("Error sending audio:", error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessageId));
      toast.error(error.message || "Erro ao enviar áudio");
    } finally {
      setUploadingMedia(false);
    }
  };

  // Format duration for display
  const formatRecordingDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle key press in input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Send contact to conversation
  const sendContact = async (client: { id: string; full_name: string; phone_e164: string }) => {
    if (!selectedConversation || sendingContact) return;
    
    const contactInfo = getContactInfo(selectedConversation);
    const phone = contactInfo.phone;
    const isGroup = contactInfo.isGroup;
    const groupJid = selectedConversation.zapp_conversation?.group_jid;
    
    if (!phone && !groupJid) {
      toast.error("Número de telefone não encontrado");
      return;
    }

    setSendingContact(true);
    
    // Format contact as vCard text message for now (UAZAPI contact sending)
    const contactMessage = `📇 *Contato*\n*Nome:* ${client.full_name}\n*Telefone:* ${client.phone_e164}`;
    
    const tempMessageId = `temp-contact-${Date.now()}`;
    const now = new Date().toISOString();
    
    const optimisticMessage: Message = {
      id: tempMessageId,
      content: contactMessage,
      is_from_client: false,
      created_at: now,
      message_type: "text",
      media_url: null,
      media_type: null,
      media_mimetype: null,
      media_filename: null,
      audio_duration_sec: null,
      sender_name: null,
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setContactPickerOpen(false);
    
    try {
      const action = isGroup && groupJid ? "send_to_group" : "send_text";
      const payload: Record<string, string> = {
        action,
        message: contactMessage,
      };
      
      if (isGroup && groupJid) {
        payload.group_id = groupJid;
      } else {
        payload.phone = phone;
      }
      
      const { error } = await supabase.functions.invoke("uazapi-manager", {
        body: payload,
      });
      
      if (error) throw error;
      
      // Save message to zapp_messages
      if (selectedConversation.zapp_conversation_id) {
        const { data: insertedMessage } = await supabase.from("zapp_messages").insert({
          account_id: currentUser!.account_id,
          zapp_conversation_id: selectedConversation.zapp_conversation_id,
          direction: "outbound",
          content: contactMessage,
          message_type: "text",
          sent_at: now,
        }).select("id").single();
        
        if (insertedMessage) {
          setMessages(prev => prev.map(m => 
            m.id === tempMessageId ? { ...m, id: insertedMessage.id } : m
          ));
        }
        
        await supabase.from("zapp_conversations").update({
          last_message_at: now,
          last_message_preview: `📇 ${client.full_name}`,
          unread_count: 0,
        }).eq("id", selectedConversation.zapp_conversation_id);
      }
      
      toast.success("Contato enviado!");
    } catch (error: any) {
      console.error("Error sending contact:", error);
      setMessages(prev => prev.filter(m => m.id !== tempMessageId));
      toast.error(error.message || "Erro ao enviar contato");
    } finally {
      setSendingContact(false);
    }
  };

  // Use quick reply
  const useQuickReply = (reply: { title: string; content: string }) => {
    setMessageInput(reply.content);
    setQuickRepliesOpen(false);
    messageInputRef.current?.focus();
  };

  // Load quick replies from localStorage (for simplicity, can move to DB later)
  useEffect(() => {
    const saved = localStorage.getItem(`zapp_quick_replies_${currentUser?.account_id}`);
    if (saved) {
      try {
        setQuickReplies(JSON.parse(saved));
      } catch {
        setQuickReplies([]);
      }
    }
  }, [currentUser?.account_id]);

  // Save quick reply
  const saveQuickReply = () => {
    if (!quickReplyForm.title.trim() || !quickReplyForm.content.trim()) {
      toast.error("Preencha título e conteúdo");
      return;
    }
    
    setSavingQuickReply(true);
    
    let updated: { id: string; title: string; content: string }[];
    if (editingQuickReply) {
      updated = quickReplies.map(r => 
        r.id === editingQuickReply.id 
          ? { ...r, title: quickReplyForm.title, content: quickReplyForm.content }
          : r
      );
    } else {
      updated = [...quickReplies, {
        id: `qr-${Date.now()}`,
        title: quickReplyForm.title,
        content: quickReplyForm.content,
      }];
    }
    
    setQuickReplies(updated);
    localStorage.setItem(`zapp_quick_replies_${currentUser?.account_id}`, JSON.stringify(updated));
    
    setQuickReplyDialogOpen(false);
    setEditingQuickReply(null);
    setQuickReplyForm({ title: "", content: "" });
    setSavingQuickReply(false);
    toast.success(editingQuickReply ? "Resposta atualizada!" : "Resposta rápida criada!");
  };

  // Delete quick reply
  const deleteQuickReply = (id: string) => {
    const updated = quickReplies.filter(r => r.id !== id);
    setQuickReplies(updated);
    localStorage.setItem(`zapp_quick_replies_${currentUser?.account_id}`, JSON.stringify(updated));
    toast.success("Resposta removida!");
  };

  // Filter clients for contact picker
  const filteredContactClients = useMemo(() => {
    if (!contactSearch.trim()) return [];
    const search = contactSearch.toLowerCase();
    return allClients
      .filter(c => 
        c.full_name.toLowerCase().includes(search) || 
        c.phone_e164.includes(search)
      )
      .slice(0, 10);
  }, [allClients, contactSearch]);

  // Insert formatting
  const insertFormatting = useCallback((formatType: 'bold' | 'italic' | 'strikethrough' | 'monospace') => {
    const input = messageInputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const selectedText = messageInput.substring(start, end);
    
    let prefix = '';
    let suffix = '';
    
    switch (formatType) {
      case 'bold': prefix = '*'; suffix = '*'; break;
      case 'italic': prefix = '_'; suffix = '_'; break;
      case 'strikethrough': prefix = '~'; suffix = '~'; break;
      case 'monospace': prefix = '```'; suffix = '```'; break;
    }
    
    const newText = messageInput.substring(0, start) + prefix + selectedText + suffix + messageInput.substring(end);
    setMessageInput(newText);
    
    setTimeout(() => {
      input.focus();
      const newCursorPos = selectedText ? start + prefix.length + selectedText.length + suffix.length : start + prefix.length;
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [messageInput]);

  // Filter users not already agents
  const availableUsers = teamUsers.filter(
    (user) => !agents.some((agent) => agent.user_id === user.id) || editingAgent?.user_id === user.id
  );

  // currentAgent is now provided by useZappData hook

  // Import recent conversations from WhatsApp
  const importRecentConversations = async () => {
    if (!currentUser?.account_id) return;
    
    setImportingConversations(true);
    try {
      const limit = parseInt(importLimit) || 50;
      
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { 
          action: "import-conversations",
          limit: limit
        },
      });

      if (response.error) throw new Error(response.error.message);
      
      const result = response.data;
      const imported = result?.imported || 0;
      const skipped = result?.skipped || 0;
      
      toast.success(`Importadas ${imported} conversas (${skipped} já existiam)`);
      fetchData();
    } catch (error: any) {
      console.error("Error importing conversations:", error);
      toast.error(error.message || "Erro ao importar conversas");
    } finally {
      setImportingConversations(false);
    }
  };

  // Create client from contact
  const openAddClientDialog = () => {
    if (!selectedConversation?.zapp_conversation) return;
    const contactInfo = getContactInfo(selectedConversation);
    setAddClientForm({
      full_name: contactInfo.name || "",
      phone_e164: contactInfo.phone || "",
    });
    setAddClientDialogOpen(true);
  };

  const saveNewClient = async () => {
    if (!currentUser?.account_id || !selectedConversation?.zapp_conversation) return;
    if (!addClientForm.full_name.trim() || !addClientForm.phone_e164.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }

    setSavingNewClient(true);
    try {
      // Create the client
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          account_id: currentUser.account_id,
          full_name: addClientForm.full_name.trim(),
          phone_e164: addClientForm.phone_e164.trim(),
          status: "active",
        })
        .select("id")
        .single();

      if (clientError) throw clientError;

      // Link the zapp_conversation to the new client
      const { error: linkError } = await supabase
        .from("zapp_conversations")
        .update({ client_id: newClient.id })
        .eq("id", selectedConversation.zapp_conversation.id);

      if (linkError) throw linkError;

      toast.success("Cliente cadastrado com sucesso!");
      setAddClientDialogOpen(false);
      
      // Refresh data
      fetchData();
    } catch (error: any) {
      console.error("Error creating client:", error);
      if (error.code === "23505") {
        toast.error("Já existe um cliente com este telefone");
      } else {
        toast.error(error.message || "Erro ao cadastrar cliente");
      }
    } finally {
      setSavingNewClient(false);
    }
  };

  // Open new conversation dialog
  const openNewConversationDialog = async () => {
    if (!currentUser?.account_id) return;
    setNewConversationSearch("");
    setNewConversationDialogOpen(true);
    
    // Fetch clients
    const { data } = await supabase
      .from("clients")
      .select("id, full_name, phone_e164, avatar_url")
      .eq("account_id", currentUser.account_id)
      .eq("status", "active")
      .order("full_name")
      .limit(100);
    
    setNewConversationClients(data || []);
  };

  // Create new conversation with client
  const createConversationWithClient = async (client: any) => {
    if (!currentUser?.account_id || !currentAgent) return;
    
    setCreatingConversation(true);
    try {
      // Check if conversation already exists for this client
      const { data: existingConv } = await supabase
        .from("zapp_conversations")
        .select("id")
        .eq("account_id", currentUser.account_id)
        .eq("client_id", client.id)
        .maybeSingle();
      
      let zappConvId: string;
      
      if (existingConv) {
        zappConvId = existingConv.id;
        
        // Check if assignment exists
        const { data: existingAssignment } = await supabase
          .from("zapp_conversation_assignments")
          .select("id")
          .eq("zapp_conversation_id", zappConvId)
          .neq("status", "closed")
          .maybeSingle();
        
        if (existingAssignment) {
          // Just select the existing conversation
          const assignment = assignments.find(a => a.zapp_conversation_id === zappConvId);
          if (assignment) {
            setSelectedConversation(assignment);
          }
          toast.info("Conversa já existe");
          setNewConversationDialogOpen(false);
          setCreatingConversation(false);
          return;
        }
      } else {
        // Create new zapp_conversation
        const { data: newConv, error: convError } = await supabase
          .from("zapp_conversations")
          .insert({
            account_id: currentUser.account_id,
            phone_e164: client.phone_e164,
            contact_name: client.full_name,
            client_id: client.id,
            avatar_url: client.avatar_url,
          })
          .select("id")
          .single();
        
        if (convError) throw convError;
        zappConvId = newConv.id;
      }
      
      // Create assignment for current agent
      const { error: assignError } = await supabase
        .from("zapp_conversation_assignments")
        .insert({
          account_id: currentUser.account_id,
          zapp_conversation_id: zappConvId,
          agent_id: currentAgent.id,
          status: "active",
        });
      
      if (assignError) throw assignError;
      
      toast.success("Conversa criada!");
      setNewConversationDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      toast.error(error.message || "Erro ao criar conversa");
    } finally {
      setCreatingConversation(false);
    }
  };

  // Filter clients for new conversation dialog
  const filteredNewConversationClients = useMemo(() => {
    if (!newConversationSearch.trim()) return newConversationClients;
    const search = newConversationSearch.toLowerCase();
    return newConversationClients.filter(c => 
      c.full_name?.toLowerCase().includes(search) || 
      c.phone_e164?.includes(search)
    );
  }, [newConversationClients, newConversationSearch]);


  // Filtered conversations based on tab (mine vs queue)
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      // Hide archived conversations from main inbox
      const isArchived = a.zapp_conversation?.is_archived || false;
      if (isArchived) return false;
      
      // Tab filter: "mine" = assigned to current agent, "queue" = ALL conversations
      const matchesTab = inboxTab === "mine" 
        ? a.agent_id === currentAgent?.id
        : true; // Queue shows ALL conversations
      
      const contact = getContactInfo(a);
      const matchesSearch = searchQuery === "" ||
        contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone?.includes(searchQuery);
      // Status filter: "triage" means no agent assigned (in queue)
      const matchesStatus = filterStatus === "all" || 
        (filterStatus === "triage" ? a.agent_id === null : a.status === filterStatus);
      
      // Unread filter
      const matchesUnread = !filterUnread || (contact.unreadCount > 0);
      
      // Groups filter: use is_group from zapp_conversation
      const isGroup = contact.isGroup;
      const matchesGroups = !filterGroups || isGroup;
      
      // Product filter
      const clientId = a.zapp_conversation?.client_id || a.conversation?.client?.id;
      const clientProds = clientId ? clientProducts[clientId] : undefined;
      const matchesProduct = filterProductId === "all" || 
        (clientProds && clientProds.some(p => p.id === filterProductId));
      
      // Tag filter - for now just pass if 'all', tags feature to be implemented on conversations
      const matchesTag = filterTagId === "all";
      
      // Agent filter
      const matchesAgent = filterAgentId === "all" || a.agent_id === filterAgentId;
      
      return matchesTab && matchesSearch && matchesStatus && matchesUnread && matchesGroups && matchesProduct && matchesTag && matchesAgent;
    });
  }, [assignments, searchQuery, filterStatus, filterUnread, filterGroups, inboxTab, currentAgent?.id, filterProductId, filterTagId, filterAgentId, clientProducts]);

  // Helper to get agent name by id
  const getAgentName = (agentId: string | null) => {
    if (!agentId) return null;
    const agent = agents.find(a => a.id === agentId);
    return agent?.user?.name || null;
  };

  // Memoized stats to avoid recalculating on every render
  const stats = useMemo(() => {
    const onlineAgents = agents.filter((a) => a.is_online && a.is_active).length;
    const totalQueueConversations = assignments.filter((a) => a.status !== "closed").length;
    const myConversations = assignments.filter((a) => a.agent_id === currentAgent?.id && a.status !== "closed").length;
    const activeConversations = assignments.filter((a) => a.status === "active").length;
    const assignedToOthers = assignments.filter((a) => a.agent_id && a.agent_id !== currentAgent?.id && a.status !== "closed").length;
    
    const myUnreadCount = assignments.filter((a) => 
      a.agent_id === currentAgent?.id && 
      a.status !== "closed" && 
      (a.zapp_conversation?.unread_count || 0) > 0
    ).length;
    const queueUnreadCount = assignments.filter((a) => 
      a.status !== "closed" && 
      (a.zapp_conversation?.unread_count || 0) > 0
    ).length;
    
    return { onlineAgents, totalQueueConversations, myConversations, activeConversations, assignedToOthers, myUnreadCount, queueUnreadCount };
  }, [agents, assignments, currentAgent?.id]);
  
  const { onlineAgents, totalQueueConversations, myConversations, activeConversations, assignedToOthers, myUnreadCount, queueUnreadCount } = stats;

  // Memoized helper functions to avoid recreating on every render
  const getInitials = useCallback((name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2), []);

  const formatTime = useCallback((date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return format(d, "HH:mm");
    } else if (diffDays === 1) {
      return "Ontem";
    } else if (diffDays < 7) {
      return format(d, "EEEE", { locale: ptBR });
    } else {
      return format(d, "dd/MM/yyyy");
    }
  }, []);

  // Get contact info for selected conversation
  const selectedContactInfo = useMemo(() => {
    if (!selectedConversation) return null;
    return getContactInfo(selectedConversation);
  }, [selectedConversation, getContactInfo]);

  // Get client products for selected conversation
  const selectedClientProducts = useMemo(() => {
    if (!selectedConversation) return [];
    const clientId = selectedConversation.zapp_conversation?.client_id || selectedConversation.conversation?.client?.id;
    return clientId ? clientProducts[clientId] || [] : [];
  }, [selectedConversation, clientProducts]);

  // Check access permission
  const hasZappAccess = isAdmin || hasPermission(PERMISSIONS.ROYZAPP_ACCESS);

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full bg-zapp-bg">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-zapp-accent flex items-center justify-center">
            <MessageSquare className="h-8 w-8 text-white" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-zapp-accent mx-auto" />
          <p className="text-zapp-text-muted">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!hasZappAccess) {
    return (
      <div className="flex items-center justify-center h-full bg-zapp-bg">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <X className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="text-zapp-text text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-zapp-text-muted">
            Você não tem permissão para acessar o ROY zAPP. Entre em contato com um administrador para solicitar acesso.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard")}
            className="border-zapp-border text-zapp-text hover:bg-zapp-hover"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Tag functions
  const openTagDialog = (tag?: ZappTag) => {
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
  };

  const saveTag = async () => {
    if (!currentUser?.account_id || !tagForm.name.trim()) {
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
          account_id: currentUser.account_id,
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
  };

  const deleteTag = async (id: string) => {
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
  };

  // Open conversation tagging dialog
  const openConversationTagDialog = async (assignmentId: string) => {
    setTaggingAssignmentId(assignmentId);
    
    // Fetch existing tags for this conversation
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
  };

  // Toggle tag for conversation
  const toggleConversationTag = (tagId: string) => {
    setSelectedConversationTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  // Save conversation tags
  const saveConversationTags = async () => {
    if (!taggingAssignmentId || !currentUser?.account_id) return;
    
    setSavingConversationTags(true);
    try {
      // Delete existing tags for this conversation
      await supabase
        .from("zapp_conversation_tags")
        .delete()
        .eq("assignment_id", taggingAssignmentId);
      
      // Insert new tags
      if (selectedConversationTags.length > 0) {
        const { error } = await supabase
          .from("zapp_conversation_tags")
          .insert(
            selectedConversationTags.map(tagId => ({
              account_id: currentUser.account_id,
              assignment_id: taggingAssignmentId,
              tag_id: tagId,
              created_by: currentUser.id,
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
  };


  return (
    <div className="flex flex-row flex-1 min-h-0 w-full overflow-hidden bg-zapp-bg">
      {/* Left panel - Conversation list */}
      <div 
        className={cn(
          "w-[440px] min-w-[440px] max-w-[440px] flex flex-col overflow-hidden border-r border-zapp-border",
          selectedConversation ? "hidden lg:flex" : "flex"
        )}
      >
        <ZappConversationPanel
          currentUser={currentUser}
          activeView={activeView}
          setActiveView={setActiveView}
          inboxTab={inboxTab}
          setInboxTab={setInboxTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterUnread={filterUnread}
          setFilterUnread={setFilterUnread}
          filterGroups={filterGroups}
          setFilterGroups={setFilterGroups}
          filterProductId={filterProductId}
          setFilterProductId={setFilterProductId}
          filterTagId={filterTagId}
          setFilterTagId={setFilterTagId}
          filterAgentId={filterAgentId}
          setFilterAgentId={setFilterAgentId}
          filteredAssignments={filteredAssignments}
          agents={agents}
          tags={tags}
          departments={departments}
          teamUsers={teamUsers}
          availableProducts={availableProducts}
          availableUsersCount={availableUsers.length}
          clientProducts={clientProducts}
          activeConversations={activeConversations}
          myConversations={myConversations}
          myUnreadCount={myUnreadCount}
          totalQueueConversations={totalQueueConversations}
          queueUnreadCount={queueUnreadCount}
          onlineAgents={onlineAgents}
          selectedConversation={selectedConversation}
          currentAgentId={currentAgent?.id || null}
          whatsappConnected={whatsappConnected}
          whatsappConnecting={whatsappConnecting}
          whatsappInstanceName={whatsappInstanceName}
          roundRobinEnabled={roundRobinEnabled}
          respectLimitEnabled={respectLimitEnabled}
          soundEnabled={soundEnabled}
          importLimit={importLimit}
          importingConversations={importingConversations}
          onSelectConversation={(a) => {
            setSelectedConversation(a);
            const zappConvId = a.zapp_conversation?.id;
            if (zappConvId && (a.zapp_conversation?.unread_count || 0) > 0) {
              markAsRead(zappConvId);
            }
          }}
          onOpenNewConversationDialog={openNewConversationDialog}
          onOpenAgentDialog={openAgentDialog}
          onToggleAgentOnline={toggleAgentOnline}
          onDeleteAgent={setDeletingAgentId}
          onOpenDepartmentDialog={openDepartmentDialog}
          onDeleteDepartment={setDeletingDepartmentId}
          onOpenTagDialog={openTagDialog}
          onDeleteTag={setDeletingTagId}
          onMarkAsRead={markAsRead}
          onMarkAsUnread={markAsUnread}
          onUpdateFlag={updateConversationFlag}
          onOpenTagConversationDialog={openConversationTagDialog}
          onDeleteConversation={deleteConversation}
          onToggleWhatsAppConnection={toggleWhatsAppConnection}
          onRoundRobinChange={(checked) => {
            setRoundRobinEnabled(checked);
            localStorage.setItem("zapp_roundRobin", String(checked));
          }}
          onRespectLimitChange={(checked) => {
            setRespectLimitEnabled(checked);
            localStorage.setItem("zapp_respectLimit", String(checked));
          }}
          onSoundChange={(checked) => {
            setSoundEnabled(checked);
            localStorage.setItem("zapp_sound", String(checked));
          }}
          onImportLimitChange={setImportLimit}
          onImportConversations={importRecentConversations}
          getAgentName={getAgentName}
        />
      </div>

      {/* Right panel - Chat view */}
      <div 
        className={cn(
          "flex-1 min-w-0 flex flex-col overflow-hidden",
          !selectedConversation ? "hidden lg:flex" : "flex"
        )}
      >
        <ZappChatView
          selectedConversation={selectedConversation}
          messages={messages}
          contactInfo={selectedContactInfo || { name: "", phone: "", avatar: null, clientId: null, isClient: false, isGroup: false, lastMessage: null, lastMessagePreview: "", unreadCount: 0, lastMessageAt: "", isPinned: false, isMuted: false, isArchived: false, isFavorite: false, isBlocked: false }}
          clientProducts={selectedClientProducts}
          currentAgentId={currentAgent?.id || null}
          messageInput={messageInput}
          sendingMessage={sendingMessage}
          uploadingMedia={uploadingMedia}
          isRecording={isRecording}
          recordingDuration={recordingDuration}
          audioPreview={audioPreview}
          showFormatting={showFormatting}
          messageInputRef={messageInputRef}
          imageInputRef={imageInputRef}
          fileInputRef={fileInputRef}
          onlineAgents={onlineAgents}
          totalQueueConversations={totalQueueConversations}
          activeConversations={activeConversations}
          onBack={() => setSelectedConversation(null)}
          onOpenClientEdit={(id) => {
            setEditingClientId(id);
            setClientEditSheetOpen(true);
          }}
          onAssignToMe={assignToMe}
          onReleaseToQueue={releaseToQueue}
          onUpdateStatus={updateConversationStatus}
          onOpenTransfer={() => setTransferDialogOpen(true)}
          onOpenRoiDialog={() => setRoiDialogOpen(true)}
          onOpenRiskDialog={() => setRiskDialogOpen(true)}
          onOpenAddClient={openAddClientDialog}
          onMessageChange={setMessageInput}
          onSendMessage={sendMessage}
          onKeyPress={handleKeyPress}
          onToggleFormatting={() => setShowFormatting(!showFormatting)}
          onInsertFormatting={insertFormatting}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onCancelRecording={cancelRecording}
          onDiscardAudioPreview={discardAudioPreview}
          onConfirmAudioSend={confirmAudioSend}
          onFileSelect={handleFileSelect}
          onOpenContactPicker={() => setContactPickerOpen(true)}
          onOpenQuickReplies={() => setQuickRepliesOpen(true)}
        />
      </div>

      {/* Department Dialog */}
      <ZappDepartmentDialog
        open={departmentDialogOpen}
        onOpenChange={setDepartmentDialogOpen}
        editingDepartment={editingDepartment}
        form={departmentForm}
        onFormChange={setDepartmentForm}
        onSave={saveDepartment}
        saving={savingDepartment}
        deletingId={deletingDepartmentId}
        onDeleteConfirm={deleteDepartment}
        onDeleteCancel={() => setDeletingDepartmentId(null)}
      />

      {/* Agent Dialog */}
      <ZappAgentDialog
        open={agentDialogOpen}
        onOpenChange={setAgentDialogOpen}
        editingAgent={editingAgent}
        form={agentForm}
        onFormChange={setAgentForm}
        onSave={saveAgent}
        saving={savingAgent}
        availableUsers={availableUsers}
        departments={departments}
        deletingId={deletingAgentId}
        onDeleteConfirm={deleteAgent}
        onDeleteCancel={() => setDeletingAgentId(null)}
      />

      {/* ROI Dialog */}
      <ZappRoiDialog
        open={roiDialogOpen}
        onOpenChange={setRoiDialogOpen}
        roiType={roiType}
        roiCategory={roiCategory}
        roiImpact={roiImpact}
        roiEvidence={roiEvidence}
        uploading={uploadingRoi}
        onTypeChange={setRoiType}
        onCategoryChange={setRoiCategory}
        onImpactChange={setRoiImpact}
        onEvidenceChange={setRoiEvidence}
        onSave={handleAddRoi}
      />

      {/* Risk Dialog */}
      <ZappRiskDialog
        open={riskDialogOpen}
        onOpenChange={setRiskDialogOpen}
        riskLevel={riskLevel}
        riskReason={riskReason}
        uploading={uploadingRisk}
        onLevelChange={setRiskLevel}
        onReasonChange={setRiskReason}
        onSave={handleAddRisk}
      />

      {/* Transfer Dialog */}
      <ZappTransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        transferTarget={transferTarget}
        onTransferTargetChange={setTransferTarget}
        agents={agents}
        departments={departments}
        currentAgentId={selectedConversation?.agent_id}
        onTransfer={() => {
          // TODO: Implement transfer logic
          setTransferDialogOpen(false);
        }}
      />

      {/* Tag Dialog */}
      <ZappTagDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        editingTag={editingTag}
        form={tagForm}
        onFormChange={setTagForm}
        onSave={saveTag}
        saving={savingTag}
        deletingId={deletingTagId}
        onDeleteConfirm={deleteTag}
        onDeleteCancel={() => setDeletingTagId(null)}
      />

      {/* Conversation Tagging Dialog */}
      <ZappConversationTagDialog
        open={conversationTagDialogOpen}
        onOpenChange={setConversationTagDialogOpen}
        tags={tags}
        selectedTags={selectedConversationTags}
        onToggleTag={toggleConversationTag}
        onSave={saveConversationTags}
        saving={savingConversationTags}
        onNavigateToTags={() => setActiveView("tags")}
      />

      {/* Client Quick Edit Sheet */}
      <ClientQuickEditSheet
        clientId={editingClientId}
        open={clientEditSheetOpen}
        onOpenChange={setClientEditSheetOpen}
        onClientUpdated={() => fetchData()}
      />

      {/* Contact Picker Dialog */}
      <ZappContactPickerDialog
        open={contactPickerOpen}
        onOpenChange={setContactPickerOpen}
        searchQuery={contactSearch}
        onSearchChange={setContactSearch}
        filteredClients={filteredContactClients}
        onSelectContact={sendContact}
        sending={sendingContact}
      />

      {/* Quick Replies Dialog */}
      <ZappQuickRepliesDialog
        open={quickRepliesOpen}
        onOpenChange={setQuickRepliesOpen}
        quickReplies={quickReplies}
        onUseReply={useQuickReply}
        onEditReply={(reply) => {
          setEditingQuickReply(reply);
          setQuickReplyForm({ title: reply.title, content: reply.content });
          setQuickReplyDialogOpen(true);
        }}
        onDeleteReply={deleteQuickReply}
        onCreateNew={() => {
          setEditingQuickReply(null);
          setQuickReplyForm({ title: "", content: "" });
          setQuickReplyDialogOpen(true);
        }}
        editDialogOpen={quickReplyDialogOpen}
        onEditDialogChange={setQuickReplyDialogOpen}
        editingReply={editingQuickReply}
        form={quickReplyForm}
        onFormChange={setQuickReplyForm}
        onSave={saveQuickReply}
        saving={savingQuickReply}
      />

      {/* Add Client Dialog */}
      <ZappAddClientDialog
        open={addClientDialogOpen}
        onOpenChange={setAddClientDialogOpen}
        form={addClientForm}
        onFormChange={setAddClientForm}
        onSave={saveNewClient}
        saving={savingNewClient}
      />

      {/* New Conversation Dialog */}
      <ZappNewConversationDialog
        open={newConversationDialogOpen}
        onOpenChange={setNewConversationDialogOpen}
        searchQuery={newConversationSearch}
        onSearchChange={setNewConversationSearch}
        clients={filteredNewConversationClients}
        onSelectClient={createConversationWithClient}
        creating={creatingConversation}
      />
    </div>
  );
}
