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
  ZappAIAgentChat,
} from "@/components/royzapp";
import { normalizeSearchText, normalizePhone, matchesSearchQuery } from "@/components/royzapp/types";
import { ZappSectorSelector } from "@/components/royzapp/ZappSectorSelector";
import type { AIAgent } from "@/components/royzapp/ZappAIAgentItem";
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
  ZappAddContactDialog,
  ZappNewConversationDialog,
  ZappCloseTicketDialog,
  ZappLinkClientDialog,
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
  const [searchParams] = useSearchParams();
  
  // Get sector and integrationId from URL if provided
  const sectorFromUrl = searchParams.get('sector') as SectorId | null;
  const integrationFromUrl = searchParams.get('integrationId');
  
  // Sector selection state - initialize from URL if provided
  const [selectedSectorId, setSelectedSectorId] = useState<SectorId | null>(sectorFromUrl);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | undefined>(integrationFromUrl || undefined);
  
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
  const [activeView, setActiveView] = useState<"inbox" | "team" | "departments" | "tags" | "settings" | "playbook" | "marketing" | "sector">("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterConversationType, setFilterConversationType] = useState<"all" | "individual" | "group">("all");
  const [filterArchived, setFilterArchived] = useState(false);
  const [filterProductId, setFilterProductId] = useState<string>("all");
  const [filterTagId, setFilterTagId] = useState<string>("all");
  const [filterAgentId, setFilterAgentId] = useState<string>("all");
  const [selectedConversation, setSelectedConversation] = useState<ConversationAssignment | null>(null);
  
  // Sync selectedConversation when assignments are updated (e.g., after linking to a lead)
  useEffect(() => {
    if (selectedConversation && assignments.length > 0) {
      const updatedAssignment = assignments.find(a => a.id === selectedConversation.id);
      if (updatedAssignment) {
        // Check if the linked client OR lead has changed
        const currentClientId = selectedConversation.zapp_conversation?.client_id;
        const updatedClientId = updatedAssignment.zapp_conversation?.client_id;
        const currentLeadId = selectedConversation.zapp_conversation?.lead_id;
        const updatedLeadId = updatedAssignment.zapp_conversation?.lead_id;
        const currentClientName = selectedConversation.zapp_conversation?.client?.full_name;
        const updatedClientName = updatedAssignment.zapp_conversation?.client?.full_name;
        const currentLeadName = selectedConversation.zapp_conversation?.lead?.full_name;
        const updatedLeadName = updatedAssignment.zapp_conversation?.lead?.full_name;
        
        if (currentClientId !== updatedClientId || 
            currentLeadId !== updatedLeadId ||
            currentClientName !== updatedClientName ||
            currentLeadName !== updatedLeadName) {
          setSelectedConversation(updatedAssignment);
        }
      }
    }
  }, [assignments]);

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
      
      // PRIORIZAR busca por telefone (constraint real é account_id + phone_e164)
      const { data: convByPhone } = await supabase
        .from("zapp_conversations")
        .select("id, lead_id, client_id")
        .eq("account_id", currentUser.account_id)
        .eq("phone_e164", normalizedPhone)
        .eq("is_group", false)
        .maybeSingle();
      
      if (convByPhone) {
        zappConvId = convByPhone.id;
        
        // Atualizar lead_id/client_id se não estiver vinculado
        if (isLead && !convByPhone.lead_id && contact.id) {
          await supabase
            .from("zapp_conversations")
            .update({ lead_id: contact.id, contact_name: contact.full_name })
            .eq("id", convByPhone.id);
        } else if (!isLead && !convByPhone.client_id && contact.id) {
          await supabase
            .from("zapp_conversations")
            .update({ client_id: contact.id, contact_name: contact.full_name })
            .eq("id", convByPhone.id);
        }
      } else {
        // Fallback: buscar por lead_id/client_id (caso telefone seja diferente)
        const { data: convById } = await supabase
          .from("zapp_conversations")
          .select("id")
          .eq("account_id", currentUser.account_id)
          .eq(idField, contact.id)
          .maybeSingle();
        
        if (convById) {
          zappConvId = convById.id;
        }
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
          }
          fetchData();
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
          }
          fetchData();
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
      }
      
      fetchData(); // Update list in background
    } catch (error) {
      console.error("Error creating conversation from URL:", error);
      toast.error("Erro ao criar conversa");
    } finally {
      setCreatingConversation(false);
    }
  };
  
  const [messageInput, setMessageInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioPreview, setAudioPreview] = useState<{ blob: Blob; url: string; duration: number } | null>(null);
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string; caption?: string } | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [showFormatting, setShowFormatting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string | null; sender_name: string | null; is_from_client: boolean; external_message_id?: string | null } | null>(null);
  const [pendingMentions, setPendingMentions] = useState<{ phone: string; jid: string }[]>([]);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(() => {
    const saved = localStorage.getItem("zapp_suggestions_enabled");
    return saved !== null ? saved === "true" : true;
  });
  const [autoLearningEnabled, setAutoLearningEnabled] = useState(() => {
    const saved = localStorage.getItem("zapp_auto_learning_enabled");
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

  // AI Agents state
  const [aiAgents, setAiAgents] = useState<AIAgent[]>([]);
  const [selectedAIAgent, setSelectedAIAgent] = useState<AIAgent | null>(null);

  // Playbook dialog state for chat
  const [playbookDialogOpen, setPlaybookDialogOpen] = useState(false);
  
  // Close ticket dialog state
  const [closeTicketDialogOpen, setCloseTicketDialogOpen] = useState(false);
  
  // Link client dialog state
  const [linkClientDialogOpen, setLinkClientDialogOpen] = useState(false);
  
  // Permanent delete conversation dialog state
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);

  // Fetch AI agents
  useEffect(() => {
    const fetchAIAgents = async () => {
      const { data, error } = await supabase
        .from("ai_sector_agents")
        .select("id, sector_id, name, display_name, avatar_url, greeting_message, is_enabled")
        .eq("is_enabled", true)
        .order("name");

      if (!error && data) {
        setAiAgents(data as AIAgent[]);
      }
    };

    fetchAIAgents();
  }, []);

  // Ref to track current conversation ID for realtime validation
  const currentConversationIdRef = useRef<string | null>(null);

  // Update ref when conversation changes
  useEffect(() => {
    currentConversationIdRef.current = 
      selectedConversation?.zapp_conversation_id || 
      selectedConversation?.zapp_conversation?.id || 
      null;
  }, [selectedConversation?.id, selectedConversation?.zapp_conversation_id, selectedConversation?.zapp_conversation?.id]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    const zappConvId = selectedConversation?.zapp_conversation_id || selectedConversation?.zapp_conversation?.id;
    
    // CRITICAL FIX: Clear messages IMMEDIATELY when conversation changes
    // This prevents showing messages from previous conversation during fetch
    setMessages([]);
    
    if (zappConvId) {
      fetchMessages(zappConvId);
    }
  }, [selectedConversation?.id, fetchMessages, setMessages]);

  // Realtime subscription for messages in selected conversation
  useEffect(() => {
    const zappConvId = selectedConversation?.zapp_conversation_id || selectedConversation?.zapp_conversation?.id;
    if (!zappConvId || !currentUser?.account_id) return;

    console.log("[RoyZapp] Setting up realtime for conversation:", zappConvId);

    // Track recently sent messages to avoid duplicate processing
    const recentlySentRef = { current: new Set<string>() };
    
    const messagesChannel = supabase
      .channel(`zapp-messages-${zappConvId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'zapp_messages',
          filter: `zapp_conversation_id=eq.${zappConvId}`
        },
        (payload) => {
          console.log("[RoyZapp] Realtime INSERT received:", payload);
          const newMsg = payload.new as any;
          
          // CRITICAL FIX: Validate this message belongs to CURRENTLY selected conversation
          // This prevents messages from being added if user switched conversations
          if (currentConversationIdRef.current !== zappConvId) {
            console.log("[RoyZapp] Ignoring realtime INSERT - conversation changed:", {
              receivedFor: zappConvId,
              currentlySelected: currentConversationIdRef.current
            });
            return;
          }
          
          // Skip if this is our own recently sent outbound message
          // This prevents duplicate fetching right after we insert
          if (newMsg.direction === 'outbound' && newMsg.id) {
            const insertTime = new Date(newMsg.sent_at || newMsg.created_at).getTime();
            const now = Date.now();
            // If message was sent in last 3 seconds by us, skip refetch
            if (now - insertTime < 3000) {
              console.log("[RoyZapp] Skipping refetch for own recent message:", newMsg.id);
              // Just update state directly instead of refetching
              setMessages(prev => {
                // CRITICAL FIX: Check if message already exists by id OR external_message_id
                const existingByExternal = prev.find(m => 
                  m.external_message_id && m.external_message_id === newMsg.external_message_id
                );
                const existsById = prev.some(m => m.id === newMsg.id);
                
                // If message exists (especially edited ones), skip to prevent duplicates
                if (existsById || existingByExternal) {
                  if (existingByExternal) {
                    console.log("[RoyZapp] Ignoring INSERT for existing message with same external_id:", newMsg.external_message_id);
                  }
                  return prev;
                }
                // Remove any temp messages that might be for this audio
                const filtered = prev.filter(m => !m.id.startsWith('temp-audio-'));
                return [...filtered, {
                  id: newMsg.id,
                  content: newMsg.content,
                  is_from_client: newMsg.direction === 'inbound',
                  created_at: newMsg.sent_at || newMsg.created_at,
                  message_type: newMsg.message_type,
                  media_url: newMsg.media_url,
                  media_type: newMsg.media_type,
                  media_mimetype: newMsg.media_mimetype,
                  media_filename: newMsg.media_filename,
                  audio_duration_sec: newMsg.audio_duration_sec,
                  sender_name: newMsg.sender_name,
                  external_message_id: newMsg.external_message_id,
                }];
              });
              return;
            }
          }
          
          // For inbound messages or older outbound, refetch to ensure proper ordering
          fetchMessages(zappConvId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'zapp_messages',
          filter: `zapp_conversation_id=eq.${zappConvId}`
        },
        (payload) => {
          console.log("[RoyZapp] Realtime UPDATE received:", payload);
          const updatedMsg = payload.new as any;
          
          // CRITICAL FIX: Validate this update belongs to CURRENTLY selected conversation
          if (currentConversationIdRef.current !== zappConvId) {
            console.log("[RoyZapp] Ignoring realtime UPDATE - conversation changed:", {
              receivedFor: zappConvId,
              currentlySelected: currentConversationIdRef.current
            });
            return;
          }
          
          // Update message in local state (includes is_deleted changes)
          setMessages(prev => prev.map(m => 
            m.id === updatedMsg.id 
              ? { ...m, ...updatedMsg }
              : m
          ));
        }
      )
      .subscribe((status) => {
        console.log("[RoyZapp] Realtime subscription status:", status);
      });

    return () => {
      console.log("[RoyZapp] Cleaning up realtime for conversation:", zappConvId);
      supabase.removeChannel(messagesChannel);
    };
  }, [selectedConversation?.id, currentUser?.account_id, fetchMessages]);

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
      setSelectedAIAgent(null);
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

  // Send message via UAZAPI
  const sendMessage = async () => {
    // If there's an image preview, send it instead
    if (imagePreview && selectedConversation) {
      const file = imagePreview.file;
      const caption = imagePreview.caption;
      URL.revokeObjectURL(imagePreview.url);
      setImagePreview(null);
      
      // Send media message with caption
      await sendMediaMessage(file, "image", caption);
      return;
    }
    
    if (!messageInput.trim() || !selectedConversation) return;
    
    const contactInfo = getContactInfo(selectedConversation);
    const phone = contactInfo.phone;
    const isGroup = contactInfo.isGroup;
    const groupJid = selectedConversation.zapp_conversation?.group_jid;
    
    if (!phone && !groupJid) {
      toast.error("Número de telefone não encontrado");
      return;
    }
    
    // Add signature at the top of the message if enabled (bold name with colon)
    const baseMessage = messageInput.trim();
    const formattedSignature = userSignature.trim() ? `*${userSignature.trim()}:*` : "";
    const messageContent = signatureEnabled && formattedSignature 
      ? `${formattedSignature}\n${baseMessage}`
      : baseMessage;
    const tempMessageId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const conversationId = selectedConversation.zapp_conversation_id;
    const accountId = currentUser!.account_id;
    
    // Capture reply context before clearing
    const replyContext = replyingTo ? { ...replyingTo } : null;
    
    // Optimistic update - add message to UI immediately and clear input
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
      // Dados da citação para exibição imediata
      quoted_message_id: replyContext?.external_message_id || null,
      quoted_content: replyContext?.content || null,
      quoted_sender_name: replyContext?.is_from_client 
        ? (replyContext.sender_name || "Cliente") 
        : "Você",
      // Status de envio local
      send_status: "sending",
      send_error: null,
    };
    
    console.log("[RoyZapp] Adding optimistic message:", optimisticMessage.id);
    setMessages(prev => {
      console.log("[RoyZapp] Previous messages count:", prev.length);
      const newMessages = [...prev, optimisticMessage];
      console.log("[RoyZapp] New messages count:", newMessages.length);
      return newMessages;
    });
    setMessageInput("");
    setReplyingTo(null);
    
    // Capture current mentions before clearing
    const mentionsToSend = [...pendingMentions];
    setPendingMentions([]);
    
    // Fire and forget - don't block UI while sending
    (async () => {
      try {
        // Call UAZAPI to send message
        const action = isGroup && groupJid ? "send_to_group" : "send_text";
        const payload: Record<string, unknown> = {
          action,
          message: messageContent,
          sector_id: selectedSectorId,
          integration_id: selectedIntegrationId,
        };
        
        if (isGroup && groupJid) {
          payload.group_id = groupJid;
          // Add mentions for group messages
          if (mentionsToSend.length > 0) {
            payload.mentions = mentionsToSend.map(m => m.jid);
          }
        } else {
          payload.phone = phone;
        }
        
        // Add quoted message for replies (use external_message_id if available, fallback to id)
        if (replyContext?.external_message_id) {
          payload.quoted_message_id = replyContext.external_message_id;
          // is_from_client = true means CLIENT sent the message, so fromMe = false (we didn't send it)
          // is_from_client = false means WE sent the message, so fromMe = true
          payload.quoted_from_me = !replyContext.is_from_client;
        }
        
        const { error } = await supabase.functions.invoke("uazapi-manager", {
          body: payload,
        });
        
        if (error) throw error;
        
        // Save message to zapp_messages in background
        if (conversationId) {
          const { data: insertedMessage } = await supabase.from("zapp_messages").insert({
            account_id: accountId,
            zapp_conversation_id: conversationId,
            direction: "outbound",
            content: messageContent,
            message_type: "text",
            sent_at: now,
            // Dados da mensagem citada
            quoted_message_id: replyContext?.external_message_id || null,
            quoted_content: replyContext?.content || null,
            quoted_sender_name: replyContext?.is_from_client 
              ? (replyContext.sender_name || "Cliente") 
              : "Você",
          }).select("id").single();
          
          // Replace temp message with real one and mark as sent
          if (insertedMessage) {
            setMessages(prev => prev.map(m => 
              m.id === tempMessageId ? { ...m, id: insertedMessage.id, send_status: "sent" as const } : m
            ));
          }
          
          // Update conversation last message - don't await
          supabase.from("zapp_conversations").update({
            last_message_at: now,
            last_message_preview: messageContent.substring(0, 100),
            unread_count: 0,
          }).eq("id", conversationId);
        }
      } catch (error: any) {
        console.error("Error sending message:", error);
        
        // Try to extract error message from Edge Function JSON response
        let errorMsg = error.message || "Erro ao enviar mensagem";
        
        // If error has context body (from Edge Function), try to parse it
        if (error.context?.body) {
          try {
            const errorBody = JSON.parse(error.context.body);
            if (errorBody.error) {
              errorMsg = errorBody.error;
            }
          } catch {
            // Ignore JSON parse errors
          }
        }
        
        // Check for WhatsApp disconnection
        const isWhatsAppDisconnected = errorMsg.includes("WHATSAPP_DISCONNECTED") || 
                                        errorMsg.includes("desconectado") ||
                                        errorMsg.includes("disconnected");
        
        // Check for "no LID found" error (number not registered on WhatsApp)
        const isLidNotFound = errorMsg.includes("no LID found") || 
                              errorMsg.includes("LID not found") ||
                              (errorMsg.includes("not found for") && errorMsg.includes("@s.whatsapp.net"));
        
        // Check for invalid phone number format
        const isInvalidNumber = errorMsg.includes("invalid") || 
                                errorMsg.includes("Could not parse") ||
                                errorMsg.includes("not valid") ||
                                errorMsg.includes("número inválido") ||
                                errorMsg.includes("formato inválido");
        
        // Determine user-friendly error message
        let userErrorMessage = errorMsg;
        if (isWhatsAppDisconnected) {
          userErrorMessage = "WhatsApp desconectado";
        } else if (isLidNotFound) {
          userErrorMessage = "Número não encontrado no WhatsApp";
        } else if (isInvalidNumber) {
          userErrorMessage = "Número de telefone inválido ou não registrado no WhatsApp";
        }
        
        // Mark message as failed instead of removing it
        setMessages(prev => prev.map(m => 
          m.id === tempMessageId 
            ? { 
                ...m, 
                send_status: "failed" as const, 
                send_error: userErrorMessage
              } 
            : m
        ));
        
        // Show appropriate error toast
        if (isWhatsAppDisconnected) {
          toast.error("WhatsApp desconectado. Reconecte nas configurações para enviar mensagens.", {
            duration: 6000,
            action: {
              label: "Ir para Configurações",
              onClick: () => navigate("/settings"),
            },
          });
        } else if (isLidNotFound) {
          toast.error("Este número não está cadastrado no WhatsApp ou é inválido. Verifique se o número está correto.", {
            duration: 8000,
          });
        } else if (isInvalidNumber) {
          toast.error("Número de telefone inválido. Verifique o formato e tente novamente.", {
            duration: 8000,
          });
        } else {
          toast.error(errorMsg);
        }
      }
    })();
  };

  // Send media message (image/document)
  const sendMediaMessage = async (file: File, mediaType: "image" | "document", caption?: string) => {
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
      content: caption || (mediaType === "image" ? "" : file.name),
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
      // Upload file to public bucket (UAZAPI needs to access the URL)
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser!.account_id}/${Date.now()}.${fileExt}`;
      const bucket = "zapp-media";
      
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
        caption: caption || "",
        file_name: file.name,
        sector_id: selectedSectorId || "",
        integration_id: selectedIntegrationId || "",
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
          content: caption || (mediaType === "image" ? "" : file.name),
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
      
      // Try to use ogg format first (better WhatsApp compatibility), fallback to webm
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      }
      
      console.log('Recording with mimeType:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
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
          // Use the actual mimeType from the recorder for the blob
          const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
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
    const now = new Date().toISOString();
    let insertedMessageId: string | null = null;
    
    try {
      // 1. UPLOAD: First upload audio to storage
      const isOgg = audioBlob.type.includes('ogg');
      const extension = isOgg ? 'ogg' : 'webm';
      const fileName = `${currentUser!.account_id}/audio_${Date.now()}.${extension}`;
      const bucket = "zapp-media";
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, audioBlob, {
          contentType: audioBlob.type,
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      const mediaUrl = urlData.publicUrl;
      
      // 2. INSERT FIRST: Save to database BEFORE calling UAZAPI
      // This ensures webhook finds the record to update (prevents duplicates)
      if (selectedConversation.zapp_conversation_id) {
        const { data: insertedMessage, error: insertError } = await supabase.from("zapp_messages").insert({
          account_id: currentUser!.account_id,
          zapp_conversation_id: selectedConversation.zapp_conversation_id,
          direction: "outbound",
          content: "",
          message_type: "audio",
          media_url: mediaUrl,
          media_type: "audio",
          media_mimetype: audioBlob.type,
          media_filename: `audio_${Date.now()}.webm`,
          audio_duration_sec: duration || null,
          sent_at: now,
          // external_message_id will be filled by webhook
        }).select("id").single();
        
        if (insertError) throw insertError;
        insertedMessageId = insertedMessage?.id || null;
        
        // 3. UPDATE UI: Add to messages list with real ID
        if (insertedMessageId) {
          const optimisticMessage: Message = {
            id: insertedMessageId,
            content: "",
            is_from_client: false,
            created_at: now,
            message_type: "audio",
            media_url: mediaUrl,
            media_type: "audio",
            media_mimetype: audioBlob.type,
            media_filename: `audio_${Date.now()}.webm`,
            audio_duration_sec: duration || null,
            sender_name: null,
            delivery_status: "pending",
          };
          
          setMessages(prev => {
            // Check if this message already exists
            const exists = prev.some(m => m.id === insertedMessageId);
            if (exists) return prev;
            // Remove any temp audio messages
            const filtered = prev.filter(m => !m.id.startsWith('temp-audio-'));
            return [...filtered, optimisticMessage];
          });
        }
        
        // 4. SEND: Now call UAZAPI (webhook will update existing record)
        const action = isGroup && groupJid ? "send_media_to_group" : "send_media";
        const payload: Record<string, string> = {
          action,
          media_url: mediaUrl,
          media_type: "audio",
          caption: "",
          file_name: `audio_${Date.now()}.webm`,
          sector_id: selectedSectorId || "",
          integration_id: selectedIntegrationId || "",
        };
        
        if (isGroup && groupJid) {
          payload.group_id = groupJid;
        } else {
          payload.phone = phone;
        }
        
        const { data, error } = await supabase.functions.invoke("uazapi-manager", {
          body: payload,
        });
        
        if (error) {
          // ROLLBACK: Delete the inserted record if UAZAPI fails
          if (insertedMessageId) {
            console.log(`[ROLLBACK] UAZAPI failed, deleting message ${insertedMessageId}`);
            await supabase.from("zapp_messages").delete().eq("id", insertedMessageId);
            setMessages(prev => prev.filter(m => m.id !== insertedMessageId));
          }
          throw error;
        }
        
        // Check both wrapper and inner success
        const innerData = data?.data || data;
        if (!innerData?.success && innerData?.message) {
          // ROLLBACK: Delete the inserted record if UAZAPI reports failure
          if (insertedMessageId) {
            console.log(`[ROLLBACK] UAZAPI reported failure, deleting message ${insertedMessageId}`);
            await supabase.from("zapp_messages").delete().eq("id", insertedMessageId);
            setMessages(prev => prev.filter(m => m.id !== insertedMessageId));
          }
          throw new Error(innerData.message || "Falha ao enviar áudio");
        }
        
        // 5. UPDATE UI: Mark as sent
        setMessages(prev => prev.map(m => 
          m.id === insertedMessageId 
            ? { ...m, delivery_status: "sent" as const }
            : m
        ));
        
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
      toast.error(error.message || "Erro ao enviar áudio. O áudio foi gravado mas não enviado ao WhatsApp.");
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

  // Handle delete message for everyone (soft delete)
  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedConversation) return;
    
    // Find the message to get the external_message_id
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    // Failsafe: Temporary IDs should be blocked at UI level, but double-check
    if (messageId.startsWith("temp-")) {
      console.warn("Attempted to delete temporary message - button should be disabled");
      return;
    }
    
    try {
      // 1. Try to delete on WhatsApp via UAZAPI (using external_message_id)
      let whatsappDeleted = false;
      
      if (message.external_message_id) {
        const { data, error } = await supabase.functions.invoke("uazapi-manager", {
          body: {
            action: "delete_message",
            message_id: message.external_message_id,
            phone: getContactInfo(selectedConversation).phone,
            sector_id: selectedSectorId || "",
          },
        });
        
        if (!error && data?.data?.deleted) {
          whatsappDeleted = true;
          console.log("WhatsApp delete successful");
        } else {
          const errorMsg = data?.data?.error || data?.error || "Unknown error";
          console.warn("WhatsApp delete failed:", errorMsg);
          
          // Check if it's a time limit issue
          if (errorMsg.includes("7 minutos") || errorMsg.includes("time") || errorMsg.includes("expired")) {
            toast.warning("Mensagens só podem ser apagadas para todos em até 7 minutos após o envio");
          }
        }
      }
      
      // 2. Soft delete in database - check affected rows
      const { data: updateData, error: updateError } = await supabase
        .from("zapp_messages")
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString(),
          content: "🚫 Mensagem apagada"
        })
        .eq("id", messageId)
        .select();
      
      if (updateError) throw updateError;
      
      // Verify rows were actually affected
      if (!updateData || updateData.length === 0) {
        console.warn("No rows affected by delete - message may not exist in DB");
        toast.error("Mensagem não encontrada no banco de dados");
        return;
      }
      
      // 3. DO NOT update local state - let Realtime propagate the change
      // The postgres_changes UPDATE event will update the state automatically
      
      toast.success(
        whatsappDeleted 
          ? "Mensagem apagada para todos" 
          : "Mensagem apagada localmente"
      );
      
    } catch (error: any) {
      console.error("Error deleting message:", error);
      toast.error(error.message || "Erro ao apagar mensagem");
    }
  };

  // Handle editing a message
  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!selectedConversation || !newContent.trim()) return;
    
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    try {
      // 1. Try to edit on WhatsApp via UAZAPI
      let whatsappEdited = false;
      
      if (message.external_message_id) {
        const { data, error } = await supabase.functions.invoke("uazapi-manager", {
          body: {
            action: "edit_message",
            message_id: message.external_message_id,
            new_content: newContent.trim(),
            phone: getContactInfo(selectedConversation).phone,
            sector_id: selectedSectorId || "",
          },
        });
        
        if (!error && data?.data?.edited) {
          whatsappEdited = true;
          console.log("WhatsApp edit successful");
        } else {
          const errorMsg = data?.data?.error || data?.error || "Unknown error";
          console.warn("WhatsApp edit failed:", errorMsg);
        }
      }
      
      // 2. Update in database
      const { error: updateError } = await supabase
        .from("zapp_messages")
        .update({ 
          content: newContent.trim(),
          updated_at: new Date().toISOString(),
          is_edited: true,
        })
        .eq("id", messageId);
      
      if (updateError) throw updateError;
      
      // 3. Update local state immediately for responsiveness
      setMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, content: newContent.trim(), is_edited: true }
          : m
      ));
      
      toast.success(
        whatsappEdited 
          ? "Mensagem editada" 
          : "Mensagem editada localmente"
      );
      
    } catch (error: any) {
      console.error("Error editing message:", error);
      toast.error(error.message || "Erro ao editar mensagem");
    }
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
        sector_id: selectedSectorId || "",
        integration_id: selectedIntegrationId || "",
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
    const textSearch = trimmedSearch.toLowerCase();
    
    const isPhoneSearch = trimmedSearch.startsWith('+') || 
      (normalizedPhone.length >= 4 && normalizedPhone.length >= trimmedSearch.replace(/[\s\-\(\)]/g, '').length * 0.7);

    // Search in parallel across all sources
    const [clientsResult, leadsResult, conversationsResult, groupsResult] = await Promise.all([
      // 1. Search clients (include all relevant statuses, not just active)
      supabase
        .from("clients")
        .select("id, full_name, phone_e164, avatar_url, status")
        .eq("account_id", currentUser.account_id)
        .in("status", ["active", "churn_risk", "churned", "no_contract", "paused"])
        .or(isPhoneSearch && normalizedPhone.length >= 4 
          ? `phone_e164.ilike.%${normalizedPhone}%`
          : `full_name.ilike.%${textSearch}%,phone_e164.ilike.%${textSearch}%`)
        .order("full_name")
        .limit(15),
      
      // 2. Search unconverted leads
      supabase
        .from("leads")
        .select("id, full_name, phone, avatar_url")
        .eq("account_id", currentUser.account_id)
        .is("converted_to_client_id", null)
        .or(isPhoneSearch && normalizedPhone.length >= 4
          ? `phone.ilike.%${normalizedPhone}%`
          : `full_name.ilike.%${textSearch}%,phone.ilike.%${textSearch}%`)
        .order("full_name")
        .limit(10),
      
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
      
      // 4. Search groups by name
      supabase
        .from("zapp_conversations")
        .select("id, contact_name, avatar_url, group_jid")
        .eq("account_id", currentUser.account_id)
        .eq("is_group", true)
        .ilike("contact_name", `%${textSearch}%`)
        .order("last_message_at", { ascending: false })
        .limit(10),
    ]);

    // Map results with type indicator
    const clients = (clientsResult.data || []).map(c => ({
      id: c.id,
      full_name: c.full_name,
      phone_e164: c.phone_e164,
      avatar_url: c.avatar_url,
      type: 'client' as const,
    }));

    const leads = (leadsResult.data || []).map(l => ({
      id: l.id,
      full_name: l.full_name,
      phone_e164: l.phone || "",
      avatar_url: l.avatar_url,
      type: 'lead' as const,
    }));

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
    if (!currentUser?.account_id || !currentAgent) return;
    
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
          
          if (assignmentData) setSelectedConversation(assignmentData);
          fetchData();
          toast.info("Abrindo grupo existente");
          setNewConversationDialogOpen(false);
          setCreatingConversation(false);
          return;
        } else if (closedAssignment) {
          // Reopen closed group
          await supabase
            .from("zapp_conversation_assignments")
            .update({ status: "triage", agent_id: null, updated_at: new Date().toISOString() })
            .eq("id", closedAssignment.id);
          
          toast.success("Grupo reaberto na Fila!");
          setInboxTab("queue");
          setNewConversationDialogOpen(false);
          fetchData();
          setCreatingConversation(false);
          return;
        } else {
          // Create new assignment for group
          await supabase
            .from("zapp_conversation_assignments")
            .insert({
              account_id: currentUser.account_id,
              zapp_conversation_id: zappConvId,
              agent_id: null,
              status: "triage",
              department_id: currentSectorDepartmentId,
            });
          
          toast.success("Grupo adicionado à Fila!");
          setInboxTab("queue");
          setNewConversationDialogOpen(false);
          fetchData();
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
      
      // PRIORIZAR busca por telefone (constraint real é account_id + phone_e164)
      const { data: convByPhone } = await supabase
        .from("zapp_conversations")
        .select("id, lead_id, client_id")
        .eq("account_id", currentUser.account_id)
        .eq("phone_e164", normalizedPhone)
        .eq("is_group", false)
        .maybeSingle();
      
      if (convByPhone) {
        zappConvId = convByPhone.id;
        
        // Atualizar lead_id/client_id se não estiver vinculado (baseado no tipo do contato)
        if (isLeadContact && !convByPhone.lead_id && contact.id) {
          await supabase
            .from("zapp_conversations")
            .update({ lead_id: contact.id, contact_name: contact.full_name })
            .eq("id", convByPhone.id);
        } else if (isClientContact && !convByPhone.client_id && contact.id) {
          await supabase
            .from("zapp_conversations")
            .update({ client_id: contact.id, contact_name: contact.full_name })
            .eq("id", convByPhone.id);
        }
      } else {
        // Fallback: buscar por lead_id/client_id (caso telefone seja diferente)
        if (isLeadContact || isClientContact) {
          const idField = isLeadContact ? 'lead_id' : 'client_id';
          const { data: convById } = await supabase
            .from("zapp_conversations")
            .select("id")
            .eq("account_id", currentUser.account_id)
            .eq(idField, contact.id)
            .maybeSingle();
          
          if (convById) {
            zappConvId = convById.id;
          }
        }
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
          }
          fetchData();
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
          }
          fetchData();
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
      }
      
      fetchData(); // Update list in background
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
      const isClosed = a.status === "closed";
      if (filterStatus === "closed") {
        if (!isClosed) return false;
      } else if (filterStatus === "all") {
        // When showing "all", hide closed conversations
        if (isClosed) return false;
      }
      
      // Tab filter: "mine" = assigned to current agent, "queue" = unassigned conversations only
      // Admins can see ALL conversations in "mine" tab (to monitor team)
      // Skip tab filter when viewing archived or closed (show all regardless of assignment)
      const matchesTab = (filterArchived || filterStatus === "closed") ? true : (
        inboxTab === "mine" 
          ? (isAdmin || a.agent_id === currentAgent?.id) // Admins see all assigned, others see only their own
          : a.agent_id === null // Queue always shows only unassigned
      );
      
      const matchesSearch = matchesSearchQuery(contact, searchQuery);
      // Status filter: "triage" means no agent assigned (in queue)
      // Skip status filter for "closed" and "all" as they're handled above
      const matchesStatus = filterStatus === "all" || filterStatus === "closed" ||
        (filterStatus === "triage" ? a.agent_id === null : a.status === filterStatus);
      
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
  }, [assignments, searchQuery, filterStatus, filterUnread, filterConversationType, filterArchived, inboxTab, currentAgent?.id, filterProductId, filterTagId, filterAgentId, clientProducts, isAdmin]);

  // Helper to get agent name by id
  const getAgentName = (agentId: string | null) => {
    if (!agentId) return null;
    const agent = agents.find(a => a.id === agentId);
    return agent?.user?.name || null;
  };

  // Memoized stats to avoid recalculating on every render
  const stats = useMemo(() => {
    const onlineAgents = agents.filter((a) => a.is_online && a.is_active).length;
    // Queue shows only unassigned conversations (agent_id === null)
    const totalQueueConversations = assignments.filter((a) => a.agent_id === null && a.status !== "closed").length;
    const myConversations = assignments.filter((a) => a.agent_id === currentAgent?.id && a.status !== "closed").length;
    const activeConversations = assignments.filter((a) => a.status === "active").length;
    const assignedToOthers = assignments.filter((a) => a.agent_id && a.agent_id !== currentAgent?.id && a.status !== "closed").length;
    
    const myUnreadCount = assignments.filter((a) => 
      a.agent_id === currentAgent?.id && 
      a.status !== "closed" && 
      !a.zapp_conversation?.is_archived &&
      (a.zapp_conversation?.unread_count || 0) > 0
    ).length;
    // Queue unread shows only unassigned conversations with unread messages
    const queueUnreadCount = assignments.filter((a) => 
      a.agent_id === null &&
      a.status !== "closed" && 
      !a.zapp_conversation?.is_archived &&
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
            setSelectedAIAgent(null); // Clear AI agent when selecting regular conversation
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
          suggestionsEnabled={suggestionsEnabled}
          autoLearningEnabled={autoLearningEnabled}
          onSpellingChange={(checked) => {
            setSpellingEnabled(checked);
            localStorage.setItem("zapp_spelling_enabled", String(checked));
          }}
          onSuggestionsChange={(checked) => {
            setSuggestionsEnabled(checked);
            localStorage.setItem("zapp_suggestions_enabled", String(checked));
          }}
          onAutoLearningChange={(checked) => {
            setAutoLearningEnabled(checked);
            localStorage.setItem("zapp_auto_learning_enabled", String(checked));
          }}
          getAgentName={getAgentName}
          onPullFromQueue={pullFromQueue}
          aiAgents={[]} // Hidden for now - TODO: configure AI agents properly
          selectedAIAgent={null}
          onSelectAIAgent={() => {}} // Disabled for now
        />
      </div>

      {/* Right panel - Chat view or AI Agent Chat */}
      <div 
        className={cn(
          "flex-1 min-w-0 flex flex-col overflow-hidden",
          !selectedConversation && !selectedAIAgent ? "hidden lg:flex" : "flex"
        )}
      >
        {selectedAIAgent ? (
          <ZappAIAgentChat
            agent={selectedAIAgent}
            currentUserName={currentUser?.name || "Usuário"}
            currentUserAvatar={currentUser?.avatar_url || null}
            onBack={() => setSelectedAIAgent(null)}
            isMobile={!!selectedAIAgent}
          />
        ) : (
          <ZappChatView
            selectedConversation={selectedConversation}
          messages={messages}
          contactInfo={selectedContactInfo || { name: "", phone: "", avatar: null, clientId: null, isClient: false, isGroup: false, lastMessage: null, lastMessagePreview: "", unreadCount: 0, lastMessageAt: "", isPinned: false, isMuted: false, isArchived: false, isFavorite: false, isBlocked: false, searchableText: "" }}
          clientProducts={selectedClientProducts}
          currentAgentId={currentAgent?.id || null}
          messageInput={messageInput}
          sendingMessage={sendingMessage}
          uploadingMedia={uploadingMedia}
          isRecording={isRecording}
          recordingDuration={recordingDuration}
          audioPreview={audioPreview}
          imagePreview={imagePreview}
          onSetImagePreview={setImagePreview}
          showFormatting={showFormatting}
          messageInputRef={messageInputRef}
          imageInputRef={imageInputRef}
          fileInputRef={fileInputRef}
          sectorId={selectedSectorId}
          spellingEnabled={spellingEnabled}
          suggestionsEnabled={suggestionsEnabled}
          autoLearningEnabled={autoLearningEnabled}
          onToggleSuggestions={() => {
            const newValue = !suggestionsEnabled;
            setSuggestionsEnabled(newValue);
            localStorage.setItem("zapp_suggestions_enabled", String(newValue));
          }}
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
          onOpenAddClient={openAddContactDialog}
          onOpenLinkClient={() => setLinkClientDialogOpen(true)}
          onClientLinked={() => fetchData()}
          onDeleteConversation={() => setPermanentDeleteDialogOpen(true)}
          accountId={currentUser?.account_id}
          showLeadOption={hasVendasAccess}
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
          replyingTo={replyingTo}
          onReplyMessage={(msg) => {
            setReplyingTo({
              id: msg.id,
              content: msg.content,
              sender_name: msg.sender_name || null,
              is_from_client: msg.is_from_client,
              external_message_id: msg.external_message_id || null,
            });
            messageInputRef.current?.focus();
          }}
          onCancelReply={() => setReplyingTo(null)}
          onDeleteMessage={handleDeleteMessage}
          onEditMessage={handleEditMessage}
          onRetryMessage={(msg) => {
            // Remove the failed message and re-add its content to input for retry
            setMessages(prev => prev.filter(m => m.id !== msg.id));
            setMessageInput(msg.content || "");
            messageInputRef.current?.focus();
            toast.info("Mensagem restaurada para reenvio");
          }}
          onMentionInsert={(mention) => {
            setPendingMentions(prev => [...prev, { phone: mention.phone, jid: mention.jid }]);
          }}
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
            setMessageInput(processedText);
            messageInputRef.current?.focus();
          } else if (item.content_type === 'image' && item.media_url) {
            // For image items, download and set as image preview
            try {
              const response = await fetch(item.media_url);
              if (!response.ok) throw new Error('Failed to fetch image');
              
              const blob = await response.blob();
              const fileName = item.name || 'playbook-image.jpg';
              const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
              const url = URL.createObjectURL(blob);
              
              // Include caption from playbook item
              setImagePreview({ file, url, caption: item.media_caption || undefined });
              toast.success(item.media_caption ? "Imagem com legenda anexada! Clique em enviar." : "Imagem anexada! Clique em enviar.");
              messageInputRef.current?.focus();
            } catch (error) {
              console.error('Error loading playbook image:', error);
              toast.error("Erro ao carregar imagem do playbook");
            }
          } else if (item.content_type === 'audio' && item.media_url) {
            // For audio items, download and send directly
            try {
              toast.info("Enviando áudio...");
              const response = await fetch(item.media_url);
              if (!response.ok) throw new Error('Failed to fetch audio');
              const blob = await response.blob();
              await sendAudioMessage(blob);
            } catch (error) {
              console.error('Error sending playbook audio:', error);
              toast.error("Erro ao enviar áudio do playbook");
            }
          } else if ((item.content_type === 'video' || item.content_type === 'document') && item.media_url) {
            // For video and document items, download and send directly
            try {
              const mediaTypeLabel = item.content_type === 'video' ? 'vídeo' : 'documento';
              toast.info(`Enviando ${mediaTypeLabel}...`);
              
              const response = await fetch(item.media_url);
              if (!response.ok) throw new Error(`Failed to fetch ${item.content_type}`);
              
              const blob = await response.blob();
              const fileName = item.media_filename || item.name || `playbook-file`;
              const mimeType = blob.type || (item.content_type === 'video' ? 'video/mp4' : 'application/octet-stream');
              const file = new File([blob], fileName, { type: mimeType });
              
              await sendMediaMessage(file, 'document', item.media_caption || undefined);
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
