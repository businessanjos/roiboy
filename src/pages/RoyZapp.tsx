import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions, PERMISSIONS } from "@/hooks/usePermissions";
import { useZappData, Message, TeamUser, InboundMessageData } from "@/hooks/useZappData";
import { useZappMessaging } from "@/hooks/useZappMessaging";
import { useZappNotifications } from "@/hooks/useZappNotifications";
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
import { normalizeSearchText, normalizePhone, matchesSearchQuery } from "@/components/royzapp/types";
import { ZappSectorSelector } from "@/components/royzapp/ZappSectorSelector";

import {
  ZappDepartmentDialog,
  ZappAgentDialog,
  ZappTagDialog,
  
  
  ZappTransferDialog,
  ZappConversationTagDialog,
  ZappContactPickerDialog,
  ZappQuickRepliesDialog,
  ZappAddContactDialog,
  ZappNewConversationDialog,
  ZappCloseTicketDialog,
  ZappLinkClientDialog,
  ZappEditGroupDialog,
} from "@/components/royzapp/dialogs";
import { useSectorAccess } from "@/hooks/useSectorAccess";
import { SectorId, sectors } from "@/config/sectors";
import {
  MessageSquare,
  ArrowLeft,
  Loader2,
  X,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClientZappSheet } from "@/components/client/ClientZappSheet";
import { PlaybookDialog } from "@/components/sales/PlaybookDialog";
import { usePlaybook, PlaybookItem } from "@/hooks/usePlaybook";
import { extractPlaybookVariables } from "@/lib/playbook-variables";

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
  const { hasVendasAccess, hasSectorAccess } = useSectorAccess();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get sector and integrationId from URL if provided
  const sectorFromUrl = searchParams.get('sector') as SectorId | null;
  const integrationFromUrl = searchParams.get('integrationId');
  
  // Sector selection state - initialize from URL if provided
  const [selectedSectorId, setSelectedSectorId] = useState<SectorId | null>(sectorFromUrl);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | undefined>(integrationFromUrl || undefined);
  
  // Auto-fetch user's preferred instance when sector is selected but integrationId is missing
  useEffect(() => {
    if (!selectedSectorId || selectedIntegrationId || !currentUser?.auth_user_id || !currentUser?.account_id) return;
    
    const fetchInstancePreference = async () => {
      try {
        // First, check if user has a saved preference for this sector
        const { data: preference } = await supabase
          .from("user_instance_preferences")
          .select("integration_id")
          .eq("user_id", currentUser.auth_user_id)
          .eq("sector_id", selectedSectorId)
          .maybeSingle();
        
        if (preference?.integration_id) {
          console.log(`[RoyZapp] Auto-selecting preferred instance: ${preference.integration_id}`);
          setSelectedIntegrationId(preference.integration_id);
          setSearchParams(prev => {
            prev.set('integrationId', preference.integration_id);
            return prev;
          }, { replace: true });
          return;
        }
        
        // No preference saved - fallback to first connected integration for this sector
        const { data: integrations } = await supabase
          .from("integrations")
          .select("id, display_name")
          .eq("account_id", currentUser.account_id)
          .eq("sector_id", selectedSectorId)
          .eq("status", "connected")
          .order("created_at", { ascending: true })
          .limit(1);
        
        if (integrations && integrations.length > 0) {
          console.log(`[RoyZapp] Auto-selecting first integration: ${integrations[0].id}`);
          setSelectedIntegrationId(integrations[0].id);
          setSearchParams(prev => {
            prev.set('integrationId', integrations[0].id);
            return prev;
          }, { replace: true });
        } else {
          console.log(`[RoyZapp] No integrations found for sector ${selectedSectorId}`);
        }
      } catch (error) {
        console.error("[RoyZapp] Error fetching instance preference:", error);
      }
    };
    
    fetchInstancePreference();
  }, [selectedSectorId, selectedIntegrationId, currentUser?.auth_user_id, currentUser?.account_id, setSearchParams]);
  
  // Use centralized data hook with sector filtering
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
    leadDealStages,
    currentAgent,
    whatsappConnected,
    whatsappConnecting,
    whatsappInstanceName,
    toggleWhatsAppConnection,
    checkWhatsAppStatus,
    fetchData,
    fetchMessages,
    setMessages,
  } = useZappData({ sectorId: selectedSectorId || undefined, integrationId: selectedIntegrationId });

  // Messaging hook is initialized below after state declarations

  // Check WhatsApp status when sector changes
  useEffect(() => {
    if (selectedSectorId) {
      checkWhatsAppStatus();
    }
  }, [selectedSectorId, checkWhatsAppStatus]);

  // Get current sector info
  const currentSector = useMemo(() => {
    if (!selectedSectorId) return null;
    return sectors.find(s => s.id === selectedSectorId);
  }, [selectedSectorId]);

  // Get the department for the current sector (for creating new assignments)
  // CRITICAL FIX: Must match by sector_id to prevent cross-sector leakage
  const currentSectorDepartmentId = useMemo(() => {
    if (!departments || departments.length === 0 || !selectedSectorId) return null;
    // Find the specific department that belongs to this sector
    const sectorDept = departments.find(d => d.sector_id === selectedSectorId);
    return sectorDept?.id || null;
  }, [departments, selectedSectorId]);

  // UI state
  const [activeView, setActiveView] = useState<"inbox" | "team" | "departments" | "tags" | "settings" | "playbook" | "marketing" | "sector" | "meetings">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterConversationType, setFilterConversationType] = useState<"all" | "individual" | "group">("all");
  const [filterArchived, setFilterArchived] = useState(false);
  const [filterProductId, setFilterProductId] = useState<string>("all");
  const [filterTagId, setFilterTagId] = useState<string>("all");
  const [filterAgentId, setFilterAgentId] = useState<string>("all");
  const [selectedConversation, setSelectedConversation] = useState<ConversationAssignment | null>(null);
  
  // Keep the open chat synced with the latest assignment object from the list
  useEffect(() => {
    if (!selectedConversation) return;

    const updatedAssignment = assignments.find((a) => a.id === selectedConversation.id);
    if (!updatedAssignment) return;

    if (updatedAssignment !== selectedConversation) {
      setSelectedConversation(updatedAssignment);
    }
  }, [assignments, selectedConversation]);

  // Detect when selected conversation is not in current assignments list
  // For MULTI-INSTANCE architecture: each instance has its own conversation with the same contact
  // GROUPS: handled differently - they persist until user clicks "Dispensar"
  useEffect(() => {
    if (!selectedConversation || !currentUser?.account_id) return;
    
    // Check if conversation exists in current assignments list
    const existsInCurrentList = assignments.some(
      a => a.id === selectedConversation.id
    );
    
    if (existsInCurrentList) return; // Already in list, nothing to do
    
    // For groups, don't auto-clear (multi-sector support)
    const isGroup = selectedConversation.zapp_conversation?.is_group;
    if (isGroup) return;
    
    // For individual contacts, check if it belongs to the CURRENT INTEGRATION
    // Each instance can have its own conversation with the same contact
    const conversationIntegrationId = (selectedConversation.zapp_conversation as any)?.integration_id;
    
    if (conversationIntegrationId === selectedIntegrationId) {
      // Same integration - this is our conversation, allow it
      console.log("[RoyZapp] Individual conversation from current integration - allowing");
      return;
    }
    
    // Different integration - this shouldn't happen normally since we filter by integration
    // But if it does, just log it without blocking (createConversationWithContact will handle it)
    console.log("[RoyZapp] Individual conversation from different integration - allowing creation", {
      selectedId: selectedConversation.id,
      conversationIntegrationId,
      selectedIntegrationId,
    });
    // Don't clear selection - let createConversationWithContact create the correct one
  }, [selectedConversation, assignments, selectedIntegrationId, currentUser?.account_id]);
  
  // Function to dismiss group conversation (close assignment)
  const dismissGroupConversation = async () => {
    if (!selectedConversation) return;
    
    try {
      // Close this assignment (removes from current sector's list)
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
      
      // Remove from local state immediately
      setAssignments(prev => prev.filter(a => a.id !== selectedConversation.id));
    } catch (error) {
      console.error("Error dismissing group:", error);
      toast.error("Erro ao dispensar grupo");
    }
  };

  // Handle URL parameters for auto-selecting or creating conversations
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);
  
  useEffect(() => {
    if (urlParamsProcessed || loading || !currentUser?.account_id) return;
    
    const conversationId = searchParams.get('conversation');
    const newPhone = searchParams.get('newPhone');
    const newName = searchParams.get('newName');
    const leadId = searchParams.get('leadId');
    const clientId = searchParams.get('clientId');
    
    // If conversation ID is provided, select it
    if (conversationId && assignments.length > 0) {
      const assignment = assignments.find(a => a.zapp_conversation_id === conversationId);
      if (assignment) {
        setSelectedConversation(assignment);
        setUrlParamsProcessed(true);
        return;
      }
    }
    
    // If newPhone is provided and no agent yet (wait for agent to load)
    if (newPhone && currentAgent && !conversationId) {
      setUrlParamsProcessed(true);
      
      // Create conversation with the lead/client
      const contact = {
        id: leadId || clientId || '',
        full_name: decodeURIComponent(newName || ''),
        phone_e164: `+${newPhone}`,
        avatar_url: null,
      };
      
      if (leadId || clientId) {
        createConversationFromUrl(contact, !!leadId);
      }
    }
  }, [assignments, loading, currentUser?.account_id, currentAgent, searchParams, urlParamsProcessed]);

  // Helper function to create conversation from URL params
  const createConversationFromUrl = async (contact: { id: string; full_name: string; phone_e164: string; avatar_url: null }, isLead: boolean) => {
    if (!currentUser?.account_id || !currentAgent) return;
    
    setCreatingConversation(true);
    try {
      const idField = isLead ? "lead_id" : "client_id";
      
      // Normalizar telefone para busca consistente
      const normalizedPhone = contact.phone_e164.startsWith('+') 
        ? contact.phone_e164 
        : `+${contact.phone_e164}`;
      
      let zappConvId: string | null = null;
      
      // PRIORIZAR busca por telefone + integration_id (cada instância tem sua própria conversa)
      let convByPhone = await supabase
        .from("zapp_conversations")
        .select("id, lead_id, client_id, integration_id")
        .eq("account_id", currentUser.account_id)
        .eq("phone_e164", normalizedPhone)
        .eq("integration_id", selectedIntegrationId)
        .eq("is_group", false)
        .maybeSingle();
      
      // FALLBACK: Buscar conversa LEGADA (mesmo telefone, mesmo setor, sem integration_id)
      // Isso resolve duplicação de conversas criadas antes do sistema multi-instância
      if (!convByPhone?.data && selectedSectorId) {
        const { data: legacyConv } = await supabase
          .from("zapp_conversations")
          .select("id, lead_id, client_id, integration_id")
          .eq("account_id", currentUser.account_id)
          .eq("phone_e164", normalizedPhone)
          .eq("sector_id", selectedSectorId)
          .is("integration_id", null)
          .eq("is_group", false)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (legacyConv) {
          // Migrar conversa legada para o novo formato com integration_id
          console.log("[RoyZapp] Conversa legada encontrada e migrada:", legacyConv.id);
          await supabase
            .from("zapp_conversations")
            .update({ integration_id: selectedIntegrationId })
            .eq("id", legacyConv.id);
          
          convByPhone = { data: legacyConv, error: null, count: null, status: 200, statusText: "OK" };
        }
      }
      
      if (convByPhone?.data) {
        zappConvId = convByPhone.data.id;
        
        // Atualizar lead_id/client_id se não estiver vinculado
        if (isLead && !convByPhone.data.lead_id && contact.id) {
          await supabase
            .from("zapp_conversations")
            .update({ lead_id: contact.id, contact_name: contact.full_name })
            .eq("id", convByPhone.data.id);
        } else if (!isLead && !convByPhone.data.client_id && contact.id) {
          await supabase
            .from("zapp_conversations")
            .update({ client_id: contact.id, contact_name: contact.full_name })
            .eq("id", convByPhone.data.id);
        }
      } else {
        // Não fazer fallback por lead_id/client_id — se o telefone é diferente,
        // devemos criar uma nova conversa para esse telefone específico.
        // zappConvId permanece null para forçar criação de nova conversa.
      }
      
      if (zappConvId) {
        // Buscar TODOS os assignments para esta conversa e departamento (incluindo closed)
        const { data: existingAssignments } = await supabase
          .from("zapp_conversation_assignments")
          .select("id, agent_id, status, department_id")
          .eq("zapp_conversation_id", zappConvId)
          .eq("department_id", currentSectorDepartmentId)
          .order("created_at", { ascending: false });
        
        const activeAssignment = existingAssignments?.find(a => a.status !== 'closed');
        const closedAssignment = existingAssignments?.find(a => a.status === 'closed');
        
        if (activeAssignment) {
          // VERIFICAÇÃO DE ISOLAMENTO: Checar se já está atribuída a outro agente
          const isManager = currentUser?.team_role_name === "Gestor";
          const hasFullVisibility = isAdmin || isManager;
          
          if (activeAssignment.agent_id && activeAssignment.agent_id !== currentAgent?.id && !hasFullVisibility) {
            // Buscar nome do agente responsável
            const responsibleAgent = agents.find(ag => ag.id === activeAssignment.agent_id);
            const agentName = responsibleAgent?.user?.name || "outro atendente";
            toast.warning(`Este contato já está em atendimento por ${agentName}`);
            setCreatingConversation(false);
            return;
          }
          
          // Apenas abrir a conversa existente (sem mudar o responsável)
          const { data: assignmentData } = await supabase
            .from("zapp_conversation_assignments")
            .select(`
              *,
              zapp_conversation:zapp_conversations(*),
              agent:zapp_agents(*)
            `)
            .eq("id", activeAssignment.id)
            .single();
          
          if (assignmentData) {
            setSelectedConversation(assignmentData);
            // CRITICAL FIX: Add immediately to local list to prevent race condition
            setAssignments(prev => {
              const exists = prev.some(a => a.id === assignmentData.id);
              if (exists) return prev.map(a => a.id === assignmentData.id ? assignmentData : a);
              return [assignmentData, ...prev];
            });
          }
          // CRITICAL FIX: Delay fetchData to prevent overwriting local state
          setTimeout(() => fetchData(), 2000);
          toast.info("Abrindo conversa existente");
          setCreatingConversation(false);
          return;
        } else if (closedAssignment) {
          // REABRIR: Atualizar status do assignment existente em vez de criar novo
          const { error: reopenError } = await supabase
            .from("zapp_conversation_assignments")
            .update({ 
              status: "triage", 
              agent_id: null,
              updated_at: new Date().toISOString() 
            })
            .eq("id", closedAssignment.id);
          
          if (reopenError) throw reopenError;
          
          toast.success("Conversa reaberta na Fila!");
          setInboxTab("queue");
          
          // Fetch the reopened assignment
          const { data: reopenedData } = await supabase
            .from("zapp_conversation_assignments")
            .select(`
              *,
              zapp_conversation:zapp_conversations(*),
              agent:zapp_agents(*)
            `)
            .eq("id", closedAssignment.id)
            .single();
          
          if (reopenedData) {
            setSelectedConversation(reopenedData);
            // CRITICAL FIX: Add immediately to local list to prevent race condition
            setAssignments(prev => {
              const exists = prev.some(a => a.id === reopenedData.id);
              if (exists) return prev.map(a => a.id === reopenedData.id ? reopenedData : a);
              return [reopenedData, ...prev];
            });
          }
          // CRITICAL FIX: Delay fetchData to prevent overwriting local state
          setTimeout(() => fetchData(), 2000);
          setCreatingConversation(false);
          return;
        }
        // Se não tem nenhum assignment para este departamento, continua para criar um abaixo
      } else {
        // Criar nova zapp_conversation
        const baseData = {
          account_id: currentUser.account_id,
          phone_e164: normalizedPhone,
          contact_name: contact.full_name,
          avatar_url: contact.avatar_url,
          sector_id: selectedSectorId,
          integration_id: selectedIntegrationId,
        };
        
        const insertData = isLead 
          ? { ...baseData, lead_id: contact.id }
          : { ...baseData, client_id: contact.id };
        
        const { data: newConv, error: convError } = await supabase
          .from("zapp_conversations")
          .insert(insertData)
          .select("id")
          .single();
        
        if (convError) throw convError;
        zappConvId = newConv.id;
      }
      
      // Create assignment in queue (triage) - agent must pull from queue
      const { error: assignError } = await supabase
        .from("zapp_conversation_assignments")
        .insert({
          account_id: currentUser.account_id,
          zapp_conversation_id: zappConvId,
          agent_id: null, // No agent assigned - goes to queue
          status: "triage", // Triage status for queue
          department_id: currentSectorDepartmentId,
        });
      
      if (assignError) throw assignError;
      
      toast.success("Conversa criada na Fila! Puxe-a para iniciar o atendimento.");
      setInboxTab("queue"); // Switch to queue tab
      
      // Fetch the new assignment directly to avoid stale closure
      const { data: newAssignmentData } = await supabase
        .from("zapp_conversation_assignments")
        .select(`
          *,
          zapp_conversation:zapp_conversations(*),
          agent:zapp_agents(*)
        `)
        .eq("zapp_conversation_id", zappConvId)
        .is("agent_id", null)
        .neq("status", "closed")
        .single();
      
      if (newAssignmentData) {
        setSelectedConversation(newAssignmentData);
        // CRITICAL FIX: Add immediately to local list to prevent race condition
        setAssignments(prev => {
          const exists = prev.some(a => a.id === newAssignmentData.id);
          if (exists) return prev;
          return [newAssignmentData, ...prev];
        });
      }
      
      // CRITICAL FIX: Delay fetchData to prevent overwriting local state
      setTimeout(() => fetchData(), 2000);
    } catch (error) {
      console.error("Error creating conversation from URL:", error);
      toast.error("Erro ao criar conversa");
    } finally {
      setCreatingConversation(false);
    }
  };
  
  // Messaging state is now managed by useZappMessaging hook (messaging.*)
  const [inboxTab, setInboxTab] = useState<"mine" | "queue">("mine");
  
  // User signature state (persisted to database)
  const [userSignature, setUserSignature] = useState("");
  const [signatureEnabled, setSignatureEnabled] = useState(false);
  
  // Sync signature state from currentUser when it loads
  useEffect(() => {
    if (currentUser) {
      setUserSignature(currentUser.zapp_signature || "");
      setSignatureEnabled(currentUser.zapp_signature_enabled || false);
      
      // Migrate from localStorage if exists and database is empty
      const localSignature = localStorage.getItem("zapp_signature");
      const localEnabled = localStorage.getItem("zapp_signatureEnabled");
      
      if (localSignature && !currentUser.zapp_signature) {
        // Migrate to database
        supabase
          .from("users")
          .update({ 
            zapp_signature: localSignature, 
            zapp_signature_enabled: localEnabled === "true" 
          })
          .eq("id", currentUser.id)
          .then(() => {
            setUserSignature(localSignature);
            setSignatureEnabled(localEnabled === "true");
            // Clear localStorage after migration
            localStorage.removeItem("zapp_signature");
            localStorage.removeItem("zapp_signatureEnabled");
          });
      }
    }
  }, [currentUser]);
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
  
  // AI Assistant settings (persisted to localStorage)
  const [spellingEnabled, setSpellingEnabled] = useState(() => {
    const saved = localStorage.getItem("zapp_spelling_enabled");
    return saved !== null ? saved === "true" : true;
  });
  
  // Callback to update local assignment state when a message is sent
  const handleConversationUpdated = useCallback((conversationId: string, lastMessageAt: string, lastMessagePreview: string) => {
    setAssignments(prev => prev.map(a => {
      if (a.zapp_conversation_id === conversationId || a.zapp_conversation?.id === conversationId) {
        return {
          ...a,
          zapp_conversation: a.zapp_conversation ? {
            ...a.zapp_conversation,
            last_message_at: lastMessageAt,
            last_message_preview: lastMessagePreview,
            unread_count: 0,
          } : a.zapp_conversation,
        };
      }
      return a;
    }));

    setSelectedConversation(prev => {
      if (!prev) return prev;

      const isSameConversation = prev.zapp_conversation_id === conversationId || prev.zapp_conversation?.id === conversationId;
      if (!isSameConversation) return prev;

      return {
        ...prev,
        zapp_conversation: prev.zapp_conversation ? {
          ...prev.zapp_conversation,
          last_message_at: lastMessageAt,
          last_message_preview: lastMessagePreview,
          unread_count: 0,
        } : prev.zapp_conversation,
      };
    });
  }, [setAssignments]);

  // Messaging hook - handles send, recording, media, quick replies, etc.
  const messaging = useZappMessaging({
    selectedConversation,
    currentUser,
    selectedSectorId,
    selectedIntegrationId,
    messages,
    setMessages,
    fetchMessages,
    userSignature,
    signatureEnabled,
    navigate,
    onConversationUpdated: handleConversationUpdated,
  });
  
  // Notification system - handle view chat callback
  const handleNotificationViewChat = useCallback((conversationId: string) => {
    const assignment = assignments.find(
      a => a.zapp_conversation_id === conversationId || a.zapp_conversation?.id === conversationId
    );
    if (assignment) {
      setSelectedConversation(assignment);
      setInboxTab(assignment.agent_id === currentAgent?.id ? "mine" : "queue");
    }
  }, [assignments, currentAgent?.id]);

  // Notification hook
  const { 
    notifyNewMessage, 
    notificationPermission, 
    requestNotificationPermission 
  } = useZappNotifications({
    soundEnabled,
    currentAgentId: currentAgent?.id,
    selectedConversationId: selectedConversation?.zapp_conversation_id || selectedConversation?.zapp_conversation?.id,
    onViewChat: handleNotificationViewChat,
  });

  // Realtime subscription for notifications (all inbound messages in sector)
  useEffect(() => {
    if (!currentUser?.account_id || !selectedSectorId) return;

    const notificationChannel = supabase
      .channel(`zapp-notifications-${selectedSectorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'zapp_messages',
          filter: `account_id=eq.${currentUser.account_id}`
        },
        (payload) => {
          const newMsg = payload.new as any;
          
          // Only notify for inbound messages
          if (newMsg?.direction !== 'inbound') return;
          
          // Find the conversation in assignments
          const conversationId = newMsg.zapp_conversation_id;
          const assignment = assignments.find(
            a => a.zapp_conversation_id === conversationId || a.zapp_conversation?.id === conversationId
          );
          
          if (assignment) {
            const contactName = assignment.zapp_conversation?.contact_name 
              || assignment.zapp_conversation?.client?.full_name 
              || assignment.zapp_conversation?.lead?.full_name 
              || assignment.zapp_conversation?.phone_e164 
              || "Contato";
            
            const messagePreview = newMsg.content 
              || (newMsg.message_type === 'audio' ? '🎤 Áudio' : '')
              || (newMsg.message_type === 'image' ? '📷 Imagem' : '')
              || (newMsg.message_type === 'video' ? '🎥 Vídeo' : '')
              || (newMsg.message_type === 'document' ? '📄 Documento' : '')
              || 'Nova mensagem';
            
            notifyNewMessage({
              conversationId,
              contactName,
              messagePreview,
              avatarUrl: assignment.zapp_conversation?.avatar_url,
              agentId: assignment.agent_id,
              isGroup: assignment.zapp_conversation?.is_group || false,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
    };
  }, [currentUser?.account_id, selectedSectorId, assignments, notifyNewMessage]);

  // Import conversations state
  const [importingConversations, setImportingConversations] = useState(false);
  const [importLimit, setImportLimit] = useState("50");
  
  // Refresh messages state
  const [isRefreshingMessages, setIsRefreshingMessages] = useState(false);

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


  // Contact picker and quick replies state are now in useZappMessaging hook (messaging.*)

  // Add client/lead from contact state
  const [addContactDialogOpen, setAddContactDialogOpen] = useState(false);
  const [addContactPhone, setAddContactPhone] = useState("");
  const [addContactName, setAddContactName] = useState("");
  const [savingNewClient, setSavingNewClient] = useState(false);
  const [savingNewLead, setSavingNewLead] = useState(false);

  // New conversation with client state
  const [newConversationDialogOpen, setNewConversationDialogOpen] = useState(false);
  const [newConversationSearch, setNewConversationSearch] = useState("");
  const [newConversationClients, setNewConversationClients] = useState<any[]>([]);
  const [creatingConversation, setCreatingConversation] = useState(false);

  // Playbook dialog state for chat
  const [playbookDialogOpen, setPlaybookDialogOpen] = useState(false);
  
  // Close ticket dialog state
  const [closeTicketDialogOpen, setCloseTicketDialogOpen] = useState(false);
  
  // Link client dialog state
  const [linkClientDialogOpen, setLinkClientDialogOpen] = useState(false);
  
  // Edit group dialog state
  const [editGroupDialogOpen, setEditGroupDialogOpen] = useState(false);
  
  // Permanent delete conversation dialog state
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);

  // Message fetching and realtime are now handled by useZappMessaging hook

  // Department functions
  const openDepartmentDialog = (dept?: Department) => {
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
            sector_id: departmentForm.sector_id || null,
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

    // VERIFICAÇÃO DE ISOLAMENTO: Checar se já está atribuída a outro agente
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

  // Pull next available conversation from queue
  const pullFromQueue = async () => {
    if (!currentAgent) {
      toast.error("Você não está cadastrado como atendente");
      return;
    }

    // Find the oldest unassigned conversation
    const unassignedConversations = assignments.filter(a => 
      a.agent_id === null && 
      a.status !== "closed" && 
      !a.zapp_conversation?.is_archived
    ).sort((a, b) => {
      // Sort by last_message_at ascending (oldest first)
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
      
      // Switch to "mine" tab and select the conversation
      setInboxTab("mine");
      setSelectedConversation({
        ...nextConversation,
        agent_id: currentAgent.id,
        status: "active" as const,
        agent: { ...currentAgent }
      });
      
      // Mark as read
      const zappConvId = nextConversation.zapp_conversation?.id;
      if (zappConvId && (nextConversation.zapp_conversation?.unread_count || 0) > 0) {
        markAsRead(zappConvId);
      }
    } catch (error: any) {
      console.error("Error pulling from queue:", error);
      toast.error(error.message || "Erro ao puxar da fila");
    }
  };

  // Release conversation back to queue
  const releaseToQueue = async (assignmentId: string) => {
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

      // If user was viewing finalized conversations, switch back so the returned ticket is visible
      if (filterStatus === "closed") {
        setFilterStatus("all");
      }
      setInboxTab("queue");

      // Update local list immediately so it appears in queue without waiting for refetch
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
      
      // Update selected conversation locally
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
  };

  // Update conversation status
  const updateConversationStatus = async (assignmentId: string, newStatus: "triage" | "pending" | "active" | "waiting" | "closed") => {
    try {
      const updateData: Record<string, string | null> = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      // If closing, set closed_at timestamp and clear agent to prevent ghost reappearance
      if (newStatus === "closed") {
        updateData.closed_at = new Date().toISOString();
        updateData.agent_id = null;
        updateData.assigned_at = null;
      }
      
      const { error } = await supabase
        .from("zapp_conversation_assignments")
        .update(updateData)
        .eq("id", assignmentId);

      if (error) throw error;
      
      toast.success(`Status alterado para: ${STATUS_CONFIG[newStatus].label}`);
      fetchData();
      
      // When closing, clear selection so conversation disappears from view
      if (newStatus === "closed" && selectedConversation?.id === assignmentId) {
        setSelectedConversation(null);
      } else if (selectedConversation?.id === assignmentId) {
        // For other status changes, just update locally
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

  // Helper to get contact info from assignment (prefers zapp_conversation, falls back to conversation)
  const getContactInfo = useCallback((assignment: ConversationAssignment) => {
    const zc = assignment.zapp_conversation;
    const c = assignment.conversation?.client;
    
    // IMPORTANTE: Para GRUPOS, sempre usar contact_name (nome do grupo no WhatsApp)
    // Para conversas individuais, priorizar cliente/lead vinculado
    // Isso mantém consistência entre sidebar e header
    const name = zc?.is_group 
      ? (zc?.contact_name || "Grupo sem nome")
      : (zc?.client?.full_name || zc?.lead?.full_name || zc?.contact_name || c?.full_name || zc?.phone_e164 || "Desconhecido");
    const phone = zc?.phone_e164 || c?.phone_e164 || "";
    
    // Build searchable text with all relevant fields
    const searchableText = normalizeSearchText([
      zc?.client?.full_name,
      zc?.lead?.full_name,
      zc?.contact_name,
      c?.full_name,
      phone,
      zc?.last_message_preview,
    ].filter(Boolean).join(" "));
    
    return {
      name,
      phone,
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
      searchableText,
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
  };

  // Permanent delete conversation (removes from database entirely)
  const permanentlyDeleteConversation = async () => {
    if (!selectedConversation?.zapp_conversation_id && !selectedConversation?.zapp_conversation?.id) {
      toast.error("Conversa não encontrada");
      return;
    }
    
    const conversationId = selectedConversation.zapp_conversation_id || selectedConversation.zapp_conversation?.id;
    
    try {
      // Delete the zapp_conversation - cascade will handle:
      // - zapp_messages (ON DELETE CASCADE)
      // - zapp_conversation_assignments (ON DELETE CASCADE)
      // - zapp_client_suggestions (ON DELETE CASCADE)
      // Note: lead_id and client_id in other tables have ON DELETE SET NULL,
      // so leads and clients are preserved
      
      const { error } = await supabase
        .from("zapp_conversations")
        .delete()
        .eq("id", conversationId);

      if (error) throw error;
      
      toast.success("Conversa excluída permanentemente!");
      setSelectedConversation(null);
      setPermanentDeleteDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error permanently deleting conversation:", error);
      toast.error("Erro ao excluir conversa");
    }
  };

  // All messaging functions (send, media, audio, delete, edit, contact, quick replies, formatting)
  // are now handled by the useZappMessaging hook (messaging.*)
  // Filter users not already agents — only commercial team members
  const COMMERCIAL_NAMES = ["jonathan", "darlan", "george", "vanessa"];
  const availableUsers = teamUsers.filter(
    (user) => {
      const isCommercial = COMMERCIAL_NAMES.some(name => user.name.toLowerCase().includes(name));
      const isNotAlreadyAgent = !agents.some((agent) => agent.user_id === user.id) || editingAgent?.user_id === user.id;
      return isCommercial && isNotAlreadyAgent;
    }
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
          limit: limit,
          sector_id: selectedSectorId, // Import for current sector
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

  // Refresh messages from WhatsApp (sync-chat-history)
  const refreshMessages = useCallback(async () => {
    if (!selectedIntegrationId) {
      toast.error("Nenhuma instância WhatsApp selecionada");
      return;
    }
    
    setIsRefreshingMessages(true);
    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { 
          action: "sync-chat-history", 
          integration_id: selectedIntegrationId,
          days: 3, // Buscar últimos 3 dias (período recente)
        },
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const result = response.data?.data;
      if (result) {
        if (result.synced > 0) {
          toast.success(
            `${result.synced} mensagens sincronizadas!`,
            { description: `${result.skipped} já existiam no sistema.` }
          );
          // Recarregar mensagens da conversa ativa se houver
          fetchData();
        } else {
          toast.info("Nenhuma mensagem nova encontrada", {
            description: `${result.skipped} mensagens já estavam sincronizadas.`
          });
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar mensagens:", error);
      toast.error("Erro ao buscar mensagens do WhatsApp");
    } finally {
      setIsRefreshingMessages(false);
    }
  }, [selectedIntegrationId, fetchData]);

  // Create client/lead from contact
  const openAddContactDialog = () => {
    if (!selectedConversation?.zapp_conversation) return;
    const contactInfo = getContactInfo(selectedConversation);
    setAddContactName(contactInfo.name || "");
    setAddContactPhone(contactInfo.phone || "");
    setAddContactDialogOpen(true);
  };

  const saveNewClient = async (data: { full_name: string; phone_e164: string }) => {
    if (!currentUser?.account_id || !selectedConversation?.zapp_conversation) return;
    if (!data.full_name.trim() || !data.phone_e164.trim()) {
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
          full_name: data.full_name.trim(),
          phone_e164: data.phone_e164.trim(),
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
      setAddContactDialogOpen(false);
      
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

  const saveNewLead = async (data: {
    full_name: string;
    phone: string;
    email?: string;
    source?: string;
    notes?: string;
    cpf?: string;
    rg?: string;
    birth_date?: string;
    cnpj?: string;
    company_name?: string;
    business_segment?: string;
    business_niche?: string;
    street?: string;
    street_number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    business_street?: string;
    business_street_number?: string;
    business_complement?: string;
    business_neighborhood?: string;
    business_city?: string;
    business_state?: string;
    business_zip_code?: string;
    bank_code?: string;
    bank_name?: string;
    bank_agency?: string;
    bank_account?: string;
    bank_account_type?: string;
    pix_key?: string;
    pix_key_type?: string;
    instagram?: string;
  }) => {
    if (!currentUser?.account_id || !selectedConversation?.zapp_conversation) return;
    if (!data.full_name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSavingNewLead(true);
    try {
      // Create the lead with all fields
      const { data: newLead, error: leadError } = await supabase
        .from("leads")
        .insert({
          account_id: currentUser.account_id,
          full_name: data.full_name.trim(),
          phone: data.phone.trim() || null,
          email: data.email?.trim() || null,
          source: data.source || "whatsapp",
          notes: data.notes?.trim() || null,
          status: "new",
          responsible_user_id: currentUser.id,
          // Dados pessoais
          cpf: data.cpf?.trim() || null,
          rg: data.rg?.trim() || null,
          birth_date: data.birth_date || null,
          // Dados empresa
          cnpj: data.cnpj?.trim() || null,
          company_name: data.company_name?.trim() || null,
          business_segment: data.business_segment?.trim() || null,
          business_niche: data.business_niche?.trim() || null,
          // Endereço residencial
          street: data.street?.trim() || null,
          street_number: data.street_number?.trim() || null,
          complement: data.complement?.trim() || null,
          neighborhood: data.neighborhood?.trim() || null,
          city: data.city?.trim() || null,
          state: data.state || null,
          zip_code: data.zip_code?.trim() || null,
          // Endereço comercial
          business_street: data.business_street?.trim() || null,
          business_street_number: data.business_street_number?.trim() || null,
          business_complement: data.business_complement?.trim() || null,
          business_neighborhood: data.business_neighborhood?.trim() || null,
          business_city: data.business_city?.trim() || null,
          business_state: data.business_state || null,
          business_zip_code: data.business_zip_code?.trim() || null,
          // Dados bancários
          bank_code: data.bank_code?.trim() || null,
          bank_name: data.bank_name?.trim() || null,
          bank_agency: data.bank_agency?.trim() || null,
          bank_account: data.bank_account?.trim() || null,
          bank_account_type: data.bank_account_type || "checking",
          pix_key: data.pix_key?.trim() || null,
          pix_key_type: data.pix_key_type || null,
          instagram: data.instagram?.trim() || null,
          emails: data.email ? [data.email.trim()] : [],
        })
        .select("id")
        .single();

      if (leadError) throw leadError;

      // Link the zapp_conversation to the new lead and update contact_name
      const { error: linkError } = await supabase
        .from("zapp_conversations")
        .update({ 
          lead_id: newLead.id,
          contact_name: data.full_name.trim()
        })
        .eq("id", selectedConversation.zapp_conversation.id);

      if (linkError) throw linkError;

      toast.success("Lead cadastrado com sucesso!");
      setAddContactDialogOpen(false);
      
      // Update selectedConversation with new lead data
      setSelectedConversation(prev => {
        if (!prev || !prev.zapp_conversation) return prev;
        return {
          ...prev,
          zapp_conversation: {
            ...prev.zapp_conversation,
            lead_id: newLead.id,
            lead: {
              id: newLead.id,
              full_name: data.full_name.trim(),
              phone: data.phone.trim() || null,
              email: data.email?.trim() || null,
              status: "new",
            } as any,
          },
        };
      });
      
      // Update the assignment in the assignments list
      setAssignments(prev => prev.map(a => {
        if (a.id !== selectedConversation.id) return a;
        return {
          ...a,
          zapp_conversation: a.zapp_conversation ? {
            ...a.zapp_conversation,
            lead_id: newLead.id,
            lead: {
              id: newLead.id,
              full_name: data.full_name.trim(),
              phone: data.phone.trim() || null,
              email: data.email?.trim() || null,
              status: "new",
            } as any,
          } : a.zapp_conversation,
        };
      }));
      
      // Refresh data in background
      fetchData();
    } catch (error: any) {
      console.error("Error creating lead:", error);
      toast.error(error.message || "Erro ao cadastrar lead");
    } finally {
      setSavingNewLead(false);
    }
  };

  // Open new conversation dialog
  const openNewConversationDialog = () => {
    if (!currentUser?.account_id) return;
    setNewConversationSearch("");
    setNewConversationClients([]);
    setNewConversationDialogOpen(true);
  };

  // Dynamic search for all contacts (clients, leads, conversations)
  const searchContacts = useCallback(async (searchTerm: string) => {
    if (!currentUser?.account_id || !searchTerm.trim()) {
      setNewConversationClients([]);
      return;
    }

    const trimmedSearch = searchTerm.trim();
    const normalizedPhone = trimmedSearch.replace(/\D/g, '');
    // Remove diacritics/accents for accent-insensitive search (e.g., "Letícia" → "Leticia")
    const textSearch = trimmedSearch
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    
    const isPhoneSearch = trimmedSearch.startsWith('+') || 
      (normalizedPhone.length >= 4 && normalizedPhone.length >= trimmedSearch.replace(/[\s\-\(\)]/g, '').length * 0.7);

    // Search in parallel across all sources
    const [clientsResult, leadsResult, conversationsResult, groupsResult] = await Promise.all([
      // 1. Search clients (include all relevant statuses, not just active)
      supabase
        .from("clients")
        .select("id, full_name, phone_e164, avatar_url, status, additional_phones")
        .eq("account_id", currentUser.account_id)
        .in("status", ["active", "churn_risk", "churned", "no_contract", "paused"])
        .or(isPhoneSearch && normalizedPhone.length >= 4 
          ? `phone_e164.ilike.%${normalizedPhone}%`
          : `full_name.ilike.%${textSearch}%,phone_e164.ilike.%${textSearch}%`)
        .order("full_name")
        .limit(15),
      
      // 2. Search unconverted leads (include additional_phones)
      supabase
        .from("leads")
        .select("id, full_name, phone, avatar_url, additional_phones")
        .eq("account_id", currentUser.account_id)
        .is("converted_to_client_id", null)
        .or(isPhoneSearch && normalizedPhone.length >= 4
          ? `phone.ilike.%${normalizedPhone}%`
          : `full_name.ilike.%${textSearch}%,phone.ilike.%${textSearch}%`)
        .order("full_name")
        .limit(20),
      
      // 3. Search existing conversations (WhatsApp contacts)
      supabase
        .from("zapp_conversations")
        .select("id, contact_name, phone_e164, avatar_url, client_id, lead_id")
        .eq("account_id", currentUser.account_id)
        .is("is_group", false)
        .neq("phone_e164", "")
        .or(isPhoneSearch && normalizedPhone.length >= 4
          ? `phone_e164.ilike.%${normalizedPhone}%`
          : `contact_name.ilike.%${textSearch}%,phone_e164.ilike.%${textSearch}%`)
        .order("last_message_at", { ascending: false })
        .limit(10),
      
      // 4. Search groups by name - NO sector/integration filter
      // Groups support multi-sector access: any user can find any group in the account.
      // Sector isolation is enforced when opening/creating the assignment, not at search time.
      supabase
        .from("zapp_conversations")
        .select("id, contact_name, avatar_url, group_jid, sector_id, integration_id")
        .eq("account_id", currentUser.account_id)
        .eq("is_group", true)
        .ilike("contact_name", `%${textSearch}%`)
        .order("last_message_at", { ascending: false })
        .limit(25),
    ]);

    // Debug logging for cross-sector group search
    console.log("[SearchContacts] Query term:", textSearch);
    console.log("[SearchContacts] Groups result:", {
      count: groupsResult.data?.length || 0,
      error: groupsResult.error,
      data: groupsResult.data?.slice(0, 5).map(g => ({ id: g.id, name: g.contact_name, sector: g.sector_id }))
    });

    if (groupsResult.error) {
      console.error("[SearchContacts] Groups query error:", groupsResult.error);
      toast.error("Erro ao buscar grupos");
    }

    // Map results with type indicator
    const clients: Array<{ id: string; full_name: string; phone_e164: string; avatar_url: string | null; type: 'client' }> = [];
    for (const c of (clientsResult.data || [])) {
      const getClientAdditionalPhones = (): Array<{ phone: string; label?: string }> => {
        if (!Array.isArray(c.additional_phones)) return [];
        return (c.additional_phones as any[]).map((ap: any) => {
          if (typeof ap === 'string') return { phone: ap };
          if (typeof ap === 'object' && ap !== null && ap.number) return { phone: ap.number, label: ap.label };
          return null;
        }).filter(Boolean) as Array<{ phone: string; label?: string }>;
      };

      const clientAdditionalPhones = getClientAdditionalPhones();

      if (isPhoneSearch && normalizedPhone.length >= 4) {
        const primaryMatches = (c.phone_e164 || '').replace(/\D/g, '').includes(normalizedPhone);
        if (primaryMatches) {
          clients.push({ id: c.id, full_name: c.full_name, phone_e164: c.phone_e164, avatar_url: c.avatar_url, type: 'client' });
        }
        clientAdditionalPhones.forEach((ap, idx) => {
          if (ap.phone.replace(/\D/g, '').includes(normalizedPhone)) {
            clients.push({ id: `${c.id}-alt-${idx}`, full_name: c.full_name, phone_e164: ap.phone, avatar_url: c.avatar_url, type: 'client' });
          }
        });
      } else {
        clients.push({ id: c.id, full_name: c.full_name, phone_e164: c.phone_e164, avatar_url: c.avatar_url, type: 'client' });
        clientAdditionalPhones.forEach((ap, idx) => {
          clients.push({ id: `${c.id}-alt-${idx}`, full_name: c.full_name, phone_e164: ap.phone, avatar_url: c.avatar_url, type: 'client' });
        });
      }
    }

    const leads: Array<{ id: string; full_name: string; phone_e164: string; avatar_url: string | null; type: 'lead' }> = [];
    for (const l of (leadsResult.data || [])) {
      // Helper to extract phone from additional_phones entries (can be string or {number, label})
      const getAdditionalPhones = (): Array<{ phone: string; label?: string }> => {
        if (!Array.isArray(l.additional_phones)) return [];
        return (l.additional_phones as any[]).map((ap: any) => {
          if (typeof ap === 'string') return { phone: ap };
          if (typeof ap === 'object' && ap !== null && ap.number) return { phone: ap.number, label: ap.label };
          return null;
        }).filter(Boolean) as Array<{ phone: string; label?: string }>;
      };

      const additionalPhones = getAdditionalPhones();

      if (isPhoneSearch && normalizedPhone.length >= 4) {
        // Phone search: only include numbers that match
        const primaryMatches = (l.phone || '').replace(/\D/g, '').includes(normalizedPhone);
        if (primaryMatches) {
          leads.push({ id: l.id, full_name: l.full_name, phone_e164: l.phone || "", avatar_url: l.avatar_url, type: 'lead' });
        }
        additionalPhones.forEach((ap, idx) => {
          if (ap.phone.replace(/\D/g, '').includes(normalizedPhone)) {
            leads.push({ id: `${l.id}-alt-${idx}`, full_name: l.full_name, phone_e164: ap.phone, avatar_url: l.avatar_url, type: 'lead' });
          }
        });
      } else {
        // Name search: show primary phone entry
        leads.push({ id: l.id, full_name: l.full_name, phone_e164: l.phone || "", avatar_url: l.avatar_url, type: 'lead' });
        // Also show separate entries for each additional phone
        additionalPhones.forEach((ap, idx) => {
          leads.push({ id: `${l.id}-alt-${idx}`, full_name: l.full_name, phone_e164: ap.phone, avatar_url: l.avatar_url, type: 'lead' });
        });
      }
    }

    // Conversations not linked to client or lead
    const conversations = (conversationsResult.data || [])
      .filter(conv => !conv.client_id && !conv.lead_id)
      .map(conv => ({
        id: conv.id,
        full_name: conv.contact_name || "Desconhecido",
        phone_e164: conv.phone_e164,
        avatar_url: conv.avatar_url,
        type: 'conversation' as const,
      }));

    // Map groups
    const groups = (groupsResult.data || []).map(g => ({
      id: g.id,
      full_name: g.contact_name || "Grupo",
      phone_e164: "",
      avatar_url: g.avatar_url,
      type: 'group' as const,
      group_jid: g.group_jid,
    }));

    // Combine results removing phone duplicates - PRIORITIZE clients over leads
    // Order: clients first (any status), then leads, then conversations
    // This ensures if same phone exists as both client and lead, client wins
    const phonesSeen = new Set<string>();
    const combined = [...clients, ...leads, ...conversations].filter(contact => {
      const phone = contact.phone_e164?.replace(/\D/g, '');
      if (!phone || phonesSeen.has(phone)) return false;
      phonesSeen.add(phone);
      return true;
    });

    // Add groups (no phone deduplication needed)
    const finalCombined = [...combined, ...groups];

    // Se não encontrou nenhum contato e a busca parece um telefone válido,
    // oferecer opção de iniciar conversa com esse número
    if (combined.length === 0 && groups.length === 0) {
      const phoneDigits = trimmedSearch.replace(/\D/g, '');
      if (phoneDigits.length >= 10) {
        const formattedPhone = trimmedSearch.startsWith('+') 
          ? trimmedSearch 
          : `+${phoneDigits}`;
        finalCombined.push({
          id: `new-phone-${phoneDigits}`,
          full_name: formattedPhone,
          phone_e164: formattedPhone,
          avatar_url: null,
          type: 'conversation' as const,
        });
      }
    }

    // Fetch common groups for the found contacts (only for non-group contacts)
    const phonesForGroupSearch = combined.map(c => c.phone_e164?.replace(/\D/g, '')).filter(Boolean) as string[];
    
    if (phonesForGroupSearch.length > 0) {
      // Fetch group participants separately (no direct FK relation)
      const { data: groupParticipants } = await supabase
        .from("whatsapp_group_participants")
        .select("phone, group_jid")
        .eq("account_id", currentUser.account_id)
        .in("phone", phonesForGroupSearch);

      // Get unique group JIDs to fetch group details
      const groupJids = [...new Set((groupParticipants || []).map(p => p.group_jid))];
      
      let groupsMapForCommon = new Map<string, { name: string; avatar_url: string | null }>();
      if (groupJids.length > 0) {
        const { data: groupDetails } = await supabase
          .from("whatsapp_groups")
          .select("group_jid, name")
          .eq("account_id", currentUser.account_id)
          .in("group_jid", groupJids);
        
        (groupDetails || []).forEach((g: { group_jid: string; name: string }) => {
          groupsMapForCommon.set(g.group_jid, { name: g.name, avatar_url: null });
        });
      }

      // Create phone -> groups map
      const phoneToGroups = new Map<string, Array<{name: string, avatar_url: string | null}>>();
      (groupParticipants || []).forEach((p) => {
        const phone = p.phone;
        const groupInfo = groupsMapForCommon.get(p.group_jid);
        if (!phoneToGroups.has(phone)) {
          phoneToGroups.set(phone, []);
        }
        if (groupInfo) {
          phoneToGroups.get(phone)!.push({
            name: groupInfo.name,
            avatar_url: groupInfo.avatar_url,
          });
        }
      });

      // Add common_groups to individual contacts, then append group results
      const combinedWithGroups = combined.map(c => ({
        ...c,
        common_groups: phoneToGroups.get(c.phone_e164?.replace(/\D/g, '') || '') || [],
      }));

      setNewConversationClients([...combinedWithGroups, ...groups]);
    } else {
      setNewConversationClients(finalCombined);
    }
  }, [currentUser?.account_id]);

  // Debounced search effect
  useEffect(() => {
    if (!newConversationDialogOpen) return;
    
    const timeoutId = setTimeout(() => {
      searchContacts(newConversationSearch);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [newConversationSearch, newConversationDialogOpen, searchContacts]);

  // Create new conversation with contact (lead or client based on sector)
  const createConversationWithContact = async (contact: any) => {
    if (!currentUser?.account_id) return;
    
    // For groups, allow opening even without being an agent
    const isGroupContact = contact.type === 'group';
    
    if (!isGroupContact && !currentAgent) {
      toast.error("Você precisa estar cadastrado como atendente para iniciar conversas individuais");
      return;
    }
    
    setCreatingConversation(true);
    try {
      // Handle groups specially - they already exist as zapp_conversation
      if (contact.type === 'group') {
        const zappConvId = contact.id;
        
        // Check for existing assignment in this department
        const { data: existingAssignments } = await supabase
          .from("zapp_conversation_assignments")
          .select("id, agent_id, status, department_id")
          .eq("zapp_conversation_id", zappConvId)
          .eq("department_id", currentSectorDepartmentId)
          .order("created_at", { ascending: false });
        
        const activeAssignment = existingAssignments?.find(a => a.status !== 'closed');
        const closedAssignment = existingAssignments?.find(a => a.status === 'closed');
        
        if (activeAssignment) {
          // Open existing group conversation
          const { data: assignmentData } = await supabase
            .from("zapp_conversation_assignments")
            .select(`*, zapp_conversation:zapp_conversations(*), agent:zapp_agents(*)`)
            .eq("id", activeAssignment.id)
            .single();
          
          if (assignmentData) {
            setSelectedConversation(assignmentData);
            // CRITICAL FIX: Add immediately to local list to prevent race condition
            setAssignments(prev => {
              const exists = prev.some(a => a.id === assignmentData.id);
              if (exists) return prev.map(a => a.id === assignmentData.id ? assignmentData : a);
              return [assignmentData, ...prev];
            });
          }
          // CRITICAL FIX: Delay fetchData to prevent overwriting local state
          setTimeout(() => fetchData(), 2000);
          toast.info("Abrindo grupo existente");
          setNewConversationDialogOpen(false);
          setCreatingConversation(false);
          return;
        } else if (closedAssignment) {
          // Reopen closed group - assigned to agent if available, otherwise triage
          await supabase
            .from("zapp_conversation_assignments")
            .update({ 
              status: currentAgent ? "active" : "triage",  // Active if agent, triage otherwise
              agent_id: currentAgent?.id || null,  // Assign to current agent if available
              assigned_at: currentAgent ? new Date().toISOString() : null,
              updated_at: new Date().toISOString() 
            })
            .eq("id", closedAssignment.id);
          
          // Fetch and select the reopened assignment so it appears in sidebar
          const { data: reopenedData } = await supabase
            .from("zapp_conversation_assignments")
            .select(`*, zapp_conversation:zapp_conversations(*), agent:zapp_agents(*)`)
            .eq("id", closedAssignment.id)
            .maybeSingle();
          
          if (reopenedData) {
            // Enrich with current agent data for immediate display in "Minhas" tab
            const enrichedReopened = {
              ...reopenedData,
              agent: currentAgent ? { ...currentAgent } : null
            };
            setSelectedConversation(enrichedReopened);
            // CRITICAL: Add immediately to local list so it appears in sidebar
            setAssignments(prev => {
              const exists = prev.some(a => a.id === enrichedReopened.id);
              if (exists) {
                return prev.map(a => a.id === enrichedReopened.id ? enrichedReopened : a);
              }
              return [enrichedReopened, ...prev];
            });
          }
          
          toast.success("Grupo reaberto!");
          setNewConversationDialogOpen(false);
          setInboxTab(currentAgent ? "mine" : "queue"); // Go to correct tab based on agent
          setFilterConversationType("group"); // Switch to groups tab
          
          // CRITICAL FIX: Delay fetchData to prevent overwriting local state
          setTimeout(() => fetchData(), 2000);
          
          setCreatingConversation(false);
          return;
        } else {
          // Create new assignment for group - assigned to agent if available
          const { data: newAssignment } = await supabase
            .from("zapp_conversation_assignments")
            .insert({
              account_id: currentUser.account_id,
              zapp_conversation_id: zappConvId,
              agent_id: currentAgent?.id || null,  // Assign to current agent if available
              status: currentAgent ? "active" : "triage",  // Active if agent, triage otherwise
              department_id: currentSectorDepartmentId,
              assigned_at: currentAgent ? new Date().toISOString() : null,  // Only set if agent
            })
            .select(`*, zapp_conversation:zapp_conversations(*), agent:zapp_agents(*)`)
            .single();
          
          if (newAssignment) {
            // Enrich with current agent data for immediate display in "Minhas" tab
            const enrichedAssignment = {
              ...newAssignment,
              agent: currentAgent ? { ...currentAgent } : null
            };
            setSelectedConversation(enrichedAssignment);
            // CRITICAL: Add immediately to local list so it appears in sidebar
            setAssignments(prev => [enrichedAssignment, ...prev]);
          }
          
          toast.success("Grupo adicionado!");
          setNewConversationDialogOpen(false);
          setInboxTab(currentAgent ? "mine" : "queue"); // Go to correct tab based on agent
          setFilterConversationType("group"); // Switch to groups tab
          
          // CRITICAL FIX: Delay fetchData to prevent overwriting local state
          setTimeout(() => fetchData(), 2000);
          
          setCreatingConversation(false);
          return;
        }
      }
      
      // Usar o TIPO do contato selecionado, não o setor
      const isLeadContact = contact.type === 'lead';
      const isClientContact = contact.type === 'client';
      
      // Normalizar telefone para busca consistente
      const normalizedPhone = contact.phone_e164?.startsWith('+') 
        ? contact.phone_e164 
        : `+${contact.phone_e164}`;
      
      let zappConvId: string | null = null;
      
      // PRIORIZAR busca por telefone + integration_id (cada instância tem sua própria conversa)
      let convByPhone = await supabase
        .from("zapp_conversations")
        .select("id, lead_id, client_id, integration_id")
        .eq("account_id", currentUser.account_id)
        .eq("phone_e164", normalizedPhone)
        .eq("integration_id", selectedIntegrationId)
        .eq("is_group", false)
        .maybeSingle();
      
      // FALLBACK: Buscar conversa LEGADA (mesmo telefone, mesmo setor, sem integration_id)
      // Isso resolve duplicação de conversas criadas antes do sistema multi-instância
      if (!convByPhone?.data && selectedSectorId) {
        const { data: legacyConv } = await supabase
          .from("zapp_conversations")
          .select("id, lead_id, client_id, integration_id")
          .eq("account_id", currentUser.account_id)
          .eq("phone_e164", normalizedPhone)
          .eq("sector_id", selectedSectorId)
          .is("integration_id", null)
          .eq("is_group", false)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (legacyConv) {
          // Migrar conversa legada para o novo formato com integration_id
          console.log("[RoyZapp] Conversa legada encontrada e migrada:", legacyConv.id);
          await supabase
            .from("zapp_conversations")
            .update({ integration_id: selectedIntegrationId })
            .eq("id", legacyConv.id);
          
          convByPhone = { data: legacyConv, error: null, count: null, status: 200, statusText: "OK" };
        }
      }
      
      if (convByPhone?.data) {
        zappConvId = convByPhone.data.id;
        
        // ============================================
        // AUTO-UNIFY DUPLICATE CONVERSATIONS
        // ============================================
        // Check if there's a legacy duplicate (same phone, same sector, no integration_id)
        // and merge it to eliminate duplicate entries in the conversation list
        
        if (selectedSectorId && selectedIntegrationId) {
          const { data: legacyDuplicate } = await supabase
            .from("zapp_conversations")
            .select("id")
            .eq("account_id", currentUser.account_id)
            .eq("phone_e164", normalizedPhone)
            .eq("sector_id", selectedSectorId)
            .is("integration_id", null)
            .eq("is_group", false)
            .neq("id", convByPhone.data.id)
            .maybeSingle();
          
          if (legacyDuplicate) {
            console.log(`[AUTO-UNIFY] Merging legacy ${legacyDuplicate.id} into ${convByPhone.data.id}`);
            
            // 1. Move all messages from legacy to current
            await supabase
              .from("zapp_messages")
              .update({ zapp_conversation_id: convByPhone.data.id })
              .eq("zapp_conversation_id", legacyDuplicate.id);
            
            // 2. Delete assignments from legacy conversation
            await supabase
              .from("zapp_conversation_assignments")
              .delete()
              .eq("zapp_conversation_id", legacyDuplicate.id);
            
            // 3. Delete legacy conversation
            await supabase
              .from("zapp_conversations")
              .delete()
              .eq("id", legacyDuplicate.id);
            
            console.log(`[AUTO-UNIFY] Completed: legacy conversation deleted`);
          }
        }
        
        // Atualizar lead_id/client_id se não estiver vinculado (baseado no tipo do contato)
        const realContactId = contact.id.includes('-alt-') ? contact.id.split('-alt-')[0] : contact.id;
        if (isLeadContact && !convByPhone.data.lead_id && realContactId) {
          await supabase
            .from("zapp_conversations")
            .update({ lead_id: realContactId, contact_name: contact.full_name })
            .eq("id", convByPhone.data.id);
        } else if (isClientContact && !convByPhone.data.client_id && realContactId) {
          await supabase
            .from("zapp_conversations")
            .update({ client_id: realContactId, contact_name: contact.full_name })
            .eq("id", convByPhone.data.id);
        }
      } else {
        // Não fazer fallback por lead_id/client_id — se o telefone é diferente,
        // devemos criar uma nova conversa para esse telefone específico.
        // zappConvId permanece null para forçar criação de nova conversa.
      }
      
      if (zappConvId) {
        // Buscar TODOS os assignments (ativos E fechados) para este departamento
        const { data: existingAssignments } = await supabase
          .from("zapp_conversation_assignments")
          .select("id, agent_id, status, department_id")
          .eq("zapp_conversation_id", zappConvId)
          .eq("department_id", currentSectorDepartmentId)
          .order("created_at", { ascending: false });
        
        const activeAssignment = existingAssignments?.find(a => a.status !== 'closed');
        const closedAssignment = existingAssignments?.find(a => a.status === 'closed');
        
        if (activeAssignment) {
          // VERIFICAÇÃO DE ISOLAMENTO: Checar se já está atribuída a outro agente
          const isManager = currentUser?.team_role_name === "Gestor";
          const hasFullVisibility = isAdmin || isManager;
          
          if (activeAssignment.agent_id && activeAssignment.agent_id !== currentAgent?.id && !hasFullVisibility) {
            // Buscar nome do agente responsável
            const responsibleAgent = agents.find(ag => ag.id === activeAssignment.agent_id);
            const agentName = responsibleAgent?.user?.name || "outro atendente";
            toast.warning(`Este contato já está em atendimento por ${agentName}`);
            setCreatingConversation(false);
            setNewConversationDialogOpen(false);
            return;
          }
          
          // Apenas abrir a conversa existente (sem mudar o responsável)
          const { data: assignmentData } = await supabase
            .from("zapp_conversation_assignments")
            .select(`
              *,
              zapp_conversation:zapp_conversations(*),
              agent:zapp_agents(*)
            `)
            .eq("id", activeAssignment.id)
            .single();
          
          if (assignmentData) {
            setSelectedConversation(assignmentData);
            // CRITICAL FIX: Add immediately to local list to prevent race condition
            setAssignments(prev => {
              const exists = prev.some(a => a.id === assignmentData.id);
              if (exists) return prev.map(a => a.id === assignmentData.id ? assignmentData : a);
              return [assignmentData, ...prev];
            });
          }
          // CRITICAL FIX: Delay fetchData to prevent overwriting local state
          setTimeout(() => fetchData(), 2000);
          toast.info("Abrindo conversa existente");
          setNewConversationDialogOpen(false);
          setCreatingConversation(false);
          return;
        } else if (closedAssignment) {
          // REABRIR: Atualizar status do assignment fechado ao invés de criar novo
          const { error: reopenError } = await supabase
            .from("zapp_conversation_assignments")
            .update({ 
              status: "triage", 
              agent_id: null,
              updated_at: new Date().toISOString() 
            })
            .eq("id", closedAssignment.id);
          
          if (reopenError) throw reopenError;
          
          toast.success("Conversa reaberta na Fila!");
          setInboxTab("queue");
          setNewConversationDialogOpen(false);
          
          // Buscar assignment reaberto para exibir
          const { data: reopenedData } = await supabase
            .from("zapp_conversation_assignments")
            .select(`
              *,
              zapp_conversation:zapp_conversations(*),
              agent:zapp_agents(*)
            `)
            .eq("id", closedAssignment.id)
            .single();
          
          if (reopenedData) {
            setSelectedConversation(reopenedData);
            // CRITICAL FIX: Add immediately to local list to prevent race condition
            setAssignments(prev => {
              const exists = prev.some(a => a.id === reopenedData.id);
              if (exists) return prev.map(a => a.id === reopenedData.id ? reopenedData : a);
              return [reopenedData, ...prev];
            });
          }
          // CRITICAL FIX: Delay fetchData to prevent overwriting local state
          setTimeout(() => fetchData(), 2000);
          setCreatingConversation(false);
          return;
        }
        // Se não tem nenhum assignment para este departamento, continua para criar
      } else {
        // Criar nova zapp_conversation
        const baseData = {
          account_id: currentUser.account_id,
          phone_e164: normalizedPhone,
          contact_name: contact.full_name,
          avatar_url: contact.avatar_url,
          sector_id: selectedSectorId,
          integration_id: selectedIntegrationId,
        };
        
        // Determinar qual ID usar baseado no TIPO do contato
        // IMPORTANTE: Se for lead, verificar se existe cliente com mesmo telefone para evitar FK violation
        let insertData: typeof baseData & { lead_id?: string; client_id?: string } = { ...baseData };
        
        if (isLeadContact) {
          // Verificar se existe cliente com mesmo telefone (qualquer status)
          const { data: existingClient } = await supabase
            .from("clients")
            .select("id")
            .eq("account_id", currentUser.account_id)
            .eq("phone_e164", normalizedPhone)
            .maybeSingle();
          
          if (existingClient) {
            // Cliente existe - usar client_id ao invés de lead_id
            console.log("Lead tem cliente correspondente, usando client_id:", existingClient.id);
            insertData = { ...baseData, client_id: existingClient.id };
          } else {
            insertData = { ...baseData, lead_id: contact.id };
          }
        } else if (isClientContact) {
          insertData = { ...baseData, client_id: contact.id };
        }
        // Se for 'conversation', não adiciona nem lead_id nem client_id
        
        const { data: newConv, error: convError } = await supabase
          .from("zapp_conversations")
          .insert(insertData)
          .select("id")
          .single();
        
        if (convError) throw convError;
        zappConvId = newConv.id;
      }
      
      // Create assignment in queue (triage) - agent must pull from queue
      const { error: assignError } = await supabase
        .from("zapp_conversation_assignments")
        .insert({
          account_id: currentUser.account_id,
          zapp_conversation_id: zappConvId,
          agent_id: null, // No agent assigned - goes to queue
          status: "triage", // Triage status for queue
          department_id: currentSectorDepartmentId,
        });
      
      if (assignError) throw assignError;
      
      toast.success("Conversa criada na Fila! Puxe-a para iniciar o atendimento.");
      setNewConversationDialogOpen(false);
      setInboxTab("queue"); // Switch to queue tab
      
      // Fetch the new assignment directly to avoid stale closure
      const { data: newAssignmentData } = await supabase
        .from("zapp_conversation_assignments")
        .select(`
          *,
          zapp_conversation:zapp_conversations(*),
          agent:zapp_agents(*)
        `)
        .eq("zapp_conversation_id", zappConvId)
        .is("agent_id", null)
        .neq("status", "closed")
        .single();
      
      if (newAssignmentData) {
        setSelectedConversation(newAssignmentData);
        // CRITICAL FIX: Add immediately to local list to prevent race condition
        setAssignments(prev => {
          const exists = prev.some(a => a.id === newAssignmentData.id);
          if (exists) return prev;
          return [newAssignmentData, ...prev];
        });
      }
      
      // CRITICAL FIX: Delay fetchData to prevent overwriting local state
      setTimeout(() => fetchData(), 2000);
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      toast.error(error.message || "Erro ao criar conversa");
    } finally {
      setCreatingConversation(false);
    }
  };

  // Clients/leads for new conversation dialog (already filtered by DB search)
  const filteredNewConversationClients = newConversationClients;


  // Filtered conversations based on tab (mine vs queue)
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      // Archive filter logic
      const isArchived = a.zapp_conversation?.is_archived || false;
      
      // If viewing archived, show only archived; otherwise hide archived
      if (filterArchived) {
        if (!isArchived) return false;
      } else {
        if (isArchived) return false;
      }
      
      // Get contact info FIRST - we need isGroup for filtering
      const contact = getContactInfo(a);
      const isGroup = contact.isGroup;
      
      // Closed conversations filter
      // When filterStatus is "closed", show only closed
      // Otherwise, HIDE closed conversations by default
      // EXCEPTION: Pinned groups ALWAYS show in the groups tab, even if closed
      const isClosed = a.status === "closed";
      const isPinned = contact.isPinned;
      const skipClosedFilterForPinnedGroups = isGroup && isPinned && filterConversationType === "group";
      
      if (!skipClosedFilterForPinnedGroups) {
        if (filterStatus === "closed") {
          if (!isClosed) return false;
        } else if (filterStatus === "all") {
          // When showing "all", hide closed conversations
          if (isClosed) return false;
        }
      }
      
      // Tab filter: "mine" = assigned to current agent, "queue" = unassigned conversations only
      // Admins e Gestores podem ver TODAS as conversas em ambas as abas (para monitoramento)
      // Atendentes comuns só veem suas próprias conversas na aba "mine" e apenas não atribuídas na "queue"
      // Skip tab filter when viewing archived or closed (show all regardless of assignment)
      // EXCEPTION: Groups skip tab filter when viewing groups tab (they're permanent, not tickets)
      const skipTabFilterForGroups = filterConversationType === "group" && isGroup;
      
      // Checar se o usuário tem visibilidade total (Admin ou Gestor)
      const isManager = currentUser?.team_role_name === "Gestor";
      const hasFullVisibility = isAdmin || isManager;
      
      // Conversations with no agent should ALWAYS show in queue, regardless of status
      // This catches orphaned "waiting" conversations with no agent assigned
      const isUnassigned = a.agent_id === null;
      
      const matchesTab = (filterArchived || filterStatus === "closed" || skipTabFilterForGroups) ? true : (
        inboxTab === "mine" 
          ? (hasFullVisibility || a.agent_id === currentAgent?.id) // Admin/Gestor veem todas as conversas atribuídas
          : (hasFullVisibility ? true : isUnassigned) // Admin/Gestor veem todas na fila; demais veem só sem agente
      );
      
      const matchesSearch = matchesSearchQuery(contact, searchQuery);
      // Status filter: "triage" means no agent assigned (in queue) - also catches orphaned "waiting" with no agent
      const matchesStatus = filterStatus === "all" || filterStatus === "closed" ||
        (filterStatus === "triage" ? isUnassigned : a.status === filterStatus);
      
      // Unread filter
      const matchesUnread = !filterUnread || (contact.unreadCount > 0);
      
      // Conversation type filter: all, individual, or group
      const matchesConversationType = 
        filterConversationType === "all" ||
        (filterConversationType === "individual" && !isGroup) ||
        (filterConversationType === "group" && isGroup);
      
      // Product filter
      const clientId = a.zapp_conversation?.client_id || a.conversation?.client?.id;
      const clientProds = clientId ? clientProducts[clientId] : undefined;
      const matchesProduct = filterProductId === "all" || 
        (clientProds && clientProds.some(p => p.id === filterProductId));
      
      // Tag filter
      const matchesTag = filterTagId === "all" || 
        (a.conversation_tags && a.conversation_tags.some(ct => ct.tag_id === filterTagId));
      
      // Agent filter
      const matchesAgent = filterAgentId === "all" || a.agent_id === filterAgentId;
      
      return matchesTab && matchesSearch && matchesStatus && matchesUnread && matchesConversationType && matchesProduct && matchesTag && matchesAgent;
    });
  }, [assignments, searchQuery, filterStatus, filterUnread, filterConversationType, filterArchived, inboxTab, currentAgent?.id, filterProductId, filterTagId, filterAgentId, clientProducts, isAdmin, currentUser?.team_role_name]);

  // Helper to get agent name by id
  const getAgentName = (agentId: string | null) => {
    if (!agentId) return null;
    const agent = agents.find(a => a.id === agentId);
    return agent?.user?.name || null;
  };

  // Memoized stats to avoid recalculating on every render
  // Admin/Gestor veem todas as conversas; atendentes comuns só veem as suas
  const stats = useMemo(() => {
    const isManager = currentUser?.team_role_name === "Gestor";
    const hasFullVisibility = isAdmin || isManager;
    
    const onlineAgents = agents.filter((a) => a.is_online && a.is_active).length;
    
    // Fila SEMPRE mostra apenas conversas sem agente atribuído (igual para todos os usuários)
    const totalQueueConversations = assignments.filter((a) => 
      a.agent_id === null && 
      a.status !== "closed" && 
      !a.zapp_conversation?.is_archived
    ).length;
    
    // Para Admin/Gestor: mostrar todas as conversas atribuídas
    // Para atendentes: mostrar apenas suas próprias conversas
    const myConversations = hasFullVisibility
      ? assignments.filter((a) => a.agent_id !== null && a.status !== "closed" && !a.zapp_conversation?.is_archived).length
      : assignments.filter((a) => a.agent_id === currentAgent?.id && a.status !== "closed" && !a.zapp_conversation?.is_archived).length;
    
    const activeConversations = assignments.filter((a) => a.status === "active").length;
    const assignedToOthers = assignments.filter((a) => a.agent_id && a.agent_id !== currentAgent?.id && a.status !== "closed").length;
    
    // Unread counts também respeitam visibilidade
    const myUnreadCount = hasFullVisibility
      ? assignments.filter((a) => 
          a.agent_id !== null &&
          a.status !== "closed" && 
          !a.zapp_conversation?.is_archived &&
          (a.zapp_conversation?.unread_count || 0) > 0
        ).length
      : assignments.filter((a) => 
          a.agent_id === currentAgent?.id && 
          a.status !== "closed" && 
          !a.zapp_conversation?.is_archived &&
          (a.zapp_conversation?.unread_count || 0) > 0
        ).length;
    
    // Queue unread: sempre mostra apenas conversas SEM agente (igual para todos)
    const queueUnreadCount = assignments.filter((a) => 
      a.agent_id === null &&
      a.status !== "closed" && 
      !a.zapp_conversation?.is_archived &&
      (a.zapp_conversation?.unread_count || 0) > 0
    ).length;
    
    return { onlineAgents, totalQueueConversations, myConversations, activeConversations, assignedToOthers, myUnreadCount, queueUnreadCount };
  }, [agents, assignments, currentAgent?.id, isAdmin, currentUser?.team_role_name]);
  
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

  // If no sector selected, show selector
  if (!selectedSectorId) {
    return <ZappSectorSelector onSelectSector={(sectorId, integrationId) => {
      setSelectedSectorId(sectorId);
      setSelectedIntegrationId(integrationId);
    }} />;
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
          "w-full lg:w-[440px] lg:min-w-[440px] lg:max-w-[440px] flex flex-col overflow-hidden border-r border-zapp-border",
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
          filterConversationType={filterConversationType}
          setFilterConversationType={setFilterConversationType}
          filterArchived={filterArchived}
          setFilterArchived={setFilterArchived}
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
          leadDealStages={leadDealStages}
          activeConversations={activeConversations}
          myConversations={myConversations}
          myUnreadCount={myUnreadCount}
          totalQueueConversations={totalQueueConversations}
          queueUnreadCount={queueUnreadCount}
          onlineAgents={onlineAgents}
          sectorId={selectedSectorId}
          sectorName={currentSector?.name}
          sectorColor={currentSector?.color?.replace('text-', '').replace('-600', '')}
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
          onDismissConversation={async (assignmentId) => {
            // Find the assignment to dismiss
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
              
              // Clear selection if this was the selected conversation
              if (selectedConversation?.id === assignmentId) {
                setSelectedConversation(null);
              }
              
              // Remove from local state
              setAssignments(prev => prev.filter(a => a.id !== assignmentId));
            } catch (error) {
              console.error("Error dismissing group:", error);
              toast.error("Erro ao dispensar grupo");
            }
          }}
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
          userSignature={userSignature}
          onSignatureChange={(value) => {
            setUserSignature(value);
            if (currentUser) {
              supabase
                .from("users")
                .update({ zapp_signature: value })
                .eq("id", currentUser.id)
                .then();
            }
          }}
          spellingEnabled={spellingEnabled}
          onSpellingChange={(checked) => {
            setSpellingEnabled(checked);
            localStorage.setItem("zapp_spelling_enabled", String(checked));
          }}
          getAgentName={getAgentName}
          onPullFromQueue={pullFromQueue}
          notificationPermission={notificationPermission}
          onRequestNotificationPermission={requestNotificationPermission}
          onRefreshMessages={refreshMessages}
          isRefreshingMessages={isRefreshingMessages}
        />
      </div>

      {/* Right panel - Chat view or AI Agent Chat */}
      <div 
        className={cn(
          "flex-1 min-w-0 flex flex-col overflow-hidden",
          !selectedConversation ? "hidden lg:flex" : "flex"
        )}
      >
        {(
          <ZappChatView
            selectedConversation={selectedConversation}
          messages={messages}
          contactInfo={selectedContactInfo || { name: "", phone: "", avatar: null, clientId: null, isClient: false, isGroup: false, lastMessage: null, lastMessagePreview: "", unreadCount: 0, lastMessageAt: "", isPinned: false, isMuted: false, isArchived: false, isFavorite: false, isBlocked: false, searchableText: "" }}
          clientProducts={selectedClientProducts}
          currentAgentId={currentAgent?.id || null}
           messageInput={messaging.messageInput}
           sendingMessage={messaging.sendingMessage}
           uploadingMedia={messaging.uploadingMedia}
           isRecording={messaging.isRecording}
           recordingDuration={messaging.recordingDuration}
           audioPreview={messaging.audioPreview}
           imagePreview={messaging.imagePreview}
           onSetImagePreview={messaging.setImagePreview}
           showFormatting={messaging.showFormatting}
           messageInputRef={messaging.messageInputRef}
           imageInputRef={messaging.imageInputRef}
           fileInputRef={messaging.fileInputRef}
           sectorId={selectedSectorId}
           spellingEnabled={spellingEnabled}
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
           onOpenRoiDialog={() => {}}
           onOpenRiskDialog={() => {}}
           onOpenAddClient={openAddContactDialog}
           onOpenLinkClient={() => setLinkClientDialogOpen(true)}
           onClientLinked={() => fetchData()}
           onDeleteConversation={() => setPermanentDeleteDialogOpen(true)}
           onDismissConversation={
             selectedConversation?.zapp_conversation?.is_group 
               ? dismissGroupConversation 
               : undefined
           }
           onOpenEditGroup={
             selectedConversation?.zapp_conversation?.is_group 
               ? () => setEditGroupDialogOpen(true) 
               : undefined
           }
           accountId={currentUser?.account_id}
           showLeadOption={hasVendasAccess}
           onMessageChange={messaging.setMessageInput}
           onSendMessage={messaging.sendMessage}
           onKeyPress={messaging.handleKeyPress}
           onToggleFormatting={() => messaging.setShowFormatting(!messaging.showFormatting)}
           onInsertFormatting={messaging.insertFormatting}
           onStartRecording={messaging.startRecording}
           onStopRecording={messaging.stopRecording}
           onCancelRecording={messaging.cancelRecording}
           onDiscardAudioPreview={messaging.discardAudioPreview}
           onConfirmAudioSend={messaging.confirmAudioSend}
           onFileSelect={messaging.handleFileSelect}
           onOpenContactPicker={() => messaging.setContactPickerOpen(true)}
           onOpenQuickReplies={() => messaging.setQuickRepliesOpen(true)}
           replyingTo={messaging.replyingTo}
           onReplyMessage={messaging.handleReplyMessage}
           onCancelReply={() => messaging.setReplyingTo(null)}
           onDeleteMessage={messaging.handleDeleteMessage}
           onEditMessage={messaging.handleEditMessage}
           onRetryMessage={messaging.retryMessage}
           onRetryMediaDownload={messaging.retryMediaDownload}
           onMentionInsert={messaging.handleMentionInsert}
           signatureEnabled={signatureEnabled}
           hasSignature={!!userSignature.trim()}
           onToggleSignature={() => {
             const newValue = !signatureEnabled;
             setSignatureEnabled(newValue);
             if (currentUser) {
               supabase
                 .from("users")
                 .update({ zapp_signature_enabled: newValue })
                 .eq("id", currentUser.id)
                 .then();
             }
           }}
           onOpenPlaybook={() => setPlaybookDialogOpen(true)}
           filePreview={messaging.filePreview}
           onSetFilePreview={(preview) => {
             if (preview && preview.file.size > 50 * 1024 * 1024) {
               toast.error("Arquivo muito grande. Máximo 50MB.");
               URL.revokeObjectURL(preview.url);
               return;
             }
             messaging.setFilePreview(preview);
           }}
        />
        )}
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



      {/* Transfer Dialog */}
      <ZappTransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        transferTarget={transferTarget}
        onTransferTargetChange={setTransferTarget}
        agents={agents}
        departments={departments}
        currentAgentId={selectedConversation?.agent_id}
        onTransfer={async () => {
          if (!selectedConversation || !transferTarget.id) return;
          
          try {
            if (transferTarget.type === "agent") {
              // Transfer to another agent
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
              // Transfer to department (put back in queue)
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
              
              const targetDept = departments.find(d => d.id === transferTarget.id);
              toast.success(`Conversa transferida para fila de ${targetDept?.name || 'departamento'}`);
            }
            
            // Clear selection and close dialog
            setSelectedConversation(null);
            setTransferDialogOpen(false);
            setTransferTarget({ type: "agent", id: "" });
            fetchData();
          } catch (error) {
            console.error("[RoyZapp] Error transferring conversation:", error);
            toast.error("Erro ao transferir conversa");
          }
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

      {/* Client Quick Edit Sheet with Deals */}
      <ClientZappSheet
        clientId={editingClientId}
        open={clientEditSheetOpen}
        onOpenChange={setClientEditSheetOpen}
        onClientUpdated={() => fetchData()}
      />

      {/* Contact Picker Dialog */}
      <ZappContactPickerDialog
        open={messaging.contactPickerOpen}
        onOpenChange={messaging.setContactPickerOpen}
        searchQuery={messaging.contactSearch}
        onSearchChange={messaging.setContactSearch}
        filteredClients={allClients.filter(c => {
          if (!messaging.contactSearch.trim()) return false;
          const search = messaging.contactSearch.toLowerCase();
          return c.full_name.toLowerCase().includes(search) || c.phone_e164.includes(search);
        }).slice(0, 10)}
        onSelectContact={messaging.sendContact}
        sending={messaging.sendingContact}
      />

      {/* Quick Replies Dialog */}
      <ZappQuickRepliesDialog
        open={messaging.quickRepliesOpen}
        onOpenChange={messaging.setQuickRepliesOpen}
        quickReplies={messaging.quickReplies}
        onUseReply={messaging.useQuickReply}
        onEditReply={(reply) => {
          messaging.setEditingQuickReply(reply);
          messaging.setQuickReplyForm({ title: reply.title, content: reply.content });
          messaging.setQuickReplyDialogOpen(true);
        }}
        onDeleteReply={messaging.deleteQuickReply}
        onCreateNew={() => {
          messaging.setEditingQuickReply(null);
          messaging.setQuickReplyForm({ title: "", content: "" });
          messaging.setQuickReplyDialogOpen(true);
        }}
        editDialogOpen={messaging.quickReplyDialogOpen}
        onEditDialogChange={messaging.setQuickReplyDialogOpen}
        editingReply={messaging.editingQuickReply}
        form={messaging.quickReplyForm}
        onFormChange={messaging.setQuickReplyForm}
        onSave={messaging.saveQuickReply}
        saving={messaging.savingQuickReply}
      />

      {/* Add Client/Lead Dialog */}
      <ZappAddContactDialog
        open={addContactDialogOpen}
        onOpenChange={setAddContactDialogOpen}
        phone={addContactPhone}
        contactName={addContactName}
        showLeadOption={hasVendasAccess}
        onSaveClient={saveNewClient}
        onSaveLead={saveNewLead}
        savingClient={savingNewClient}
        savingLead={savingNewLead}
        accountId={currentUser?.account_id}
        conversationId={selectedConversation?.zapp_conversation_id || selectedConversation?.zapp_conversation?.id}
        onLinked={() => {
          fetchData();
          // Update selected conversation
          if (selectedConversation) {
            const zappConvId = selectedConversation.zapp_conversation_id || selectedConversation.zapp_conversation?.id;
            if (zappConvId) {
              fetchMessages(zappConvId);
            }
          }
        }}
      />

      {/* New Conversation Dialog */}
      <ZappNewConversationDialog
        open={newConversationDialogOpen}
        onOpenChange={setNewConversationDialogOpen}
        searchQuery={newConversationSearch}
        onSearchChange={setNewConversationSearch}
        clients={filteredNewConversationClients}
        onSelectClient={createConversationWithContact}
        creating={creatingConversation}
        isLeadMode={selectedSectorId === "vendas"}
      />

      {/* Playbook Dialog for Chat */}
      <PlaybookDialog
        open={playbookDialogOpen}
        onOpenChange={setPlaybookDialogOpen}
        sectorId={selectedSectorId}
        onUseItem={async (item, processedText) => {
          // Insert text content into message input
          if (item.content_type === 'text' && processedText) {
            messaging.setMessageInput(processedText);
            messaging.messageInputRef.current?.focus();
          } else if (item.content_type === 'image' && item.media_url) {
            try {
              const response = await fetch(item.media_url);
              if (!response.ok) throw new Error('Failed to fetch image');
              const blob = await response.blob();
              const fileName = item.name || 'playbook-image.jpg';
              const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
              const url = URL.createObjectURL(blob);
              messaging.setImagePreview({ file, url, caption: item.media_caption || undefined });
              toast.success(item.media_caption ? "Imagem com legenda anexada! Clique em enviar." : "Imagem anexada! Clique em enviar.");
              messaging.messageInputRef.current?.focus();
            } catch (error) {
              console.error('Error loading playbook image:', error);
              toast.error("Erro ao carregar imagem do playbook");
            }
          } else if (item.content_type === 'audio' && item.media_url) {
            try {
              toast.info("Enviando áudio...");
              const response = await fetch(item.media_url);
              if (!response.ok) throw new Error('Failed to fetch audio');
              const blob = await response.blob();
              await messaging.sendMediaMessage(new File([blob], 'audio.webm', { type: blob.type || 'audio/webm' }), 'document');
            } catch (error) {
              console.error('Error sending playbook audio:', error);
              toast.error("Erro ao enviar áudio do playbook");
            }
          } else if ((item.content_type === 'video' || item.content_type === 'document') && item.media_url) {
            try {
              const mediaTypeLabel = item.content_type === 'video' ? 'vídeo' : 'documento';
              toast.info(`Enviando ${mediaTypeLabel}...`);
              const response = await fetch(item.media_url);
              if (!response.ok) throw new Error(`Failed to fetch ${item.content_type}`);
              const blob = await response.blob();
              const fileName = item.media_filename || item.name || `playbook-file`;
              const mimeType = blob.type || (item.content_type === 'video' ? 'video/mp4' : 'application/octet-stream');
              const file = new File([blob], fileName, { type: mimeType });
              await messaging.sendMediaMessage(file, item.content_type === 'video' ? 'video' : 'document', item.media_caption || undefined);
            } catch (error) {
              console.error(`Error sending playbook ${item.content_type}:`, error);
              toast.error(`Erro ao enviar ${item.content_type === 'video' ? 'vídeo' : 'documento'} do playbook`);
            }
          } else if (item.media_url) {
            // For other media types (sticker, link, template), copy the URL to clipboard
            navigator.clipboard.writeText(item.media_url);
            toast.success("Link copiado para a área de transferência!");
          }
        }}
        variables={extractPlaybookVariables({
          conversation: selectedConversation,
          currentUser: currentUser,
          deal: null,
        })}
      />

      {/* Close Ticket Dialog */}
      {selectedConversation && (
        <ZappCloseTicketDialog
          open={closeTicketDialogOpen}
          onOpenChange={setCloseTicketDialogOpen}
          assignment={selectedConversation}
          agentName={currentAgent?.user?.name || currentUser?.name || ""}
          sectorId={selectedSectorId || ""}
          departmentName={currentAgent?.department?.name || ""}
          onSuccess={() => {
            setCloseTicketDialogOpen(false);
            setSelectedConversation(null);
            fetchData();
          }}
        />
      )}

      {/* Link Client Dialog */}
      {selectedConversation && (
        <ZappLinkClientDialog
          open={linkClientDialogOpen}
          onOpenChange={setLinkClientDialogOpen}
          conversationId={selectedConversation.zapp_conversation_id || selectedConversation.zapp_conversation?.id || ""}
          conversationPhone={selectedConversation.zapp_conversation?.phone_e164 || ""}
          contactName={selectedConversation.zapp_conversation?.contact_name || ""}
          accountId={currentUser?.account_id || ""}
          isGroup={selectedConversation.zapp_conversation?.is_group || false}
          onLinked={() => {
            setLinkClientDialogOpen(false);
            fetchData();
          }}
        />
      )}

      {/* Edit Group Dialog */}
      {selectedConversation?.zapp_conversation?.is_group && (
        <ZappEditGroupDialog
          open={editGroupDialogOpen}
          onOpenChange={setEditGroupDialogOpen}
          conversationId={selectedConversation.zapp_conversation.id}
          groupJid={selectedConversation.zapp_conversation.group_jid || ""}
          currentName={selectedConversation.zapp_conversation.contact_name || ""}
          onSuccess={() => fetchData()}
        />
      )}

      {/* Permanent Delete Conversation Dialog */}
      <AlertDialog 
        open={permanentDeleteDialogOpen} 
        onOpenChange={setPermanentDeleteDialogOpen}
      >
        <AlertDialogContent className="bg-zapp-panel border-zapp-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zapp-text">
              Excluir conversa permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zapp-text-muted">
              Esta ação não pode ser desfeita. A conversa e todo o histórico de mensagens 
              serão apagados permanentemente.
              <br/><br/>
              <strong className="text-zapp-text">O cadastro de Lead/Cliente será mantido.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zapp-border text-zapp-text hover:bg-zapp-hover">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={permanentlyDeleteConversation}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
