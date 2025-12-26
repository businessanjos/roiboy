import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions, PERMISSIONS } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageSquare,
  Users,
  Users2,
  User,
  Search,
  MoreVertical,
  Phone,
  Video,
  Send,
  Paperclip,
  Smile,
  Mic,
  Check,
  CheckCheck,
  Circle,
  Settings,
  Plus,
  Trash2,
  Pencil,
  Building2,
  UserCheck,
  ArrowLeft,
  Filter,
  ArrowRightLeft,
  Loader2,
  Clock,
  X,
  Power,
  Wifi,
  WifiOff,
  Tags,
  ExternalLink,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Square,
  Play,
  Pause,
  FileText,
  Download,
  Image as ImageIcon,
  Archive,
  BellOff,
  Pin,
  Tag,
  MailOpen,
  Heart,
  Ban,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ClientQuickEditSheet } from "@/components/client/ClientQuickEditSheet";

interface ZappTag {
  id: string;
  account_id: string;
  name: string;
  color: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface Department {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  auto_distribution: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface Agent {
  id: string;
  account_id: string;
  user_id: string;
  department_id: string | null;
  is_active: boolean;
  is_online: boolean;
  max_concurrent_chats: number;
  current_chats: number;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    team_role_id?: string | null;
  };
  department?: Department | null;
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  team_role_id: string | null;
  team_role?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface Message {
  id: string;
  content: string | null;
  is_from_client: boolean;
  created_at: string;
  message_type: string;
  media_url?: string | null;
  media_type?: string | null;
  media_mimetype?: string | null;
  media_filename?: string | null;
  audio_duration_sec?: number | null;
  sender_name?: string | null;
}

interface ConversationAssignment {
  id: string;
  conversation_id: string | null;
  zapp_conversation_id: string | null;
  agent_id: string | null;
  department_id: string | null;
  status: "triage" | "pending" | "active" | "waiting" | "closed";
  priority: number;
  assigned_at: string | null;
  first_response_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  agent?: Agent | null;
  department?: Department | null;
  // Old conversation link (for clients)
  conversation?: {
    id: string;
    client_id: string;
    client?: {
      id: string;
      full_name: string;
      phone_e164: string;
      avatar_url: string | null;
    };
  };
  // New zapp_conversation link (for all contacts)
  zapp_conversation?: {
    id: string;
    phone_e164: string;
    contact_name: string | null;
    client_id: string | null;
    last_message_at: string | null;
    last_message_preview: string | null;
    unread_count: number;
    is_group: boolean;
    group_jid: string | null;
    is_archived?: boolean;
    is_muted?: boolean;
    is_pinned?: boolean;
    is_favorite?: boolean;
    is_blocked?: boolean;
    client?: {
      id: string;
      full_name: string;
      phone_e164: string;
      avatar_url: string | null;
    } | null;
  };
}


const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  triage: { label: "Triagem", color: "text-purple-600", bgColor: "bg-purple-500" },
  pending: { label: "Aguardando", color: "text-amber-600", bgColor: "bg-amber-500" },
  active: { label: "Em atendimento", color: "text-emerald-600", bgColor: "bg-emerald-500" },
  waiting: { label: "Aguardando cliente", color: "text-blue-600", bgColor: "bg-blue-500" },
  closed: { label: "Finalizado", color: "text-muted-foreground", bgColor: "bg-muted-foreground" },
};

// Generate a consistent color for a sender name in group chats
const getSenderColor = (name: string): string => {
  const colors = [
    '#E91E63', // Pink
    '#9C27B0', // Purple
    '#673AB7', // Deep Purple
    '#3F51B5', // Indigo
    '#2196F3', // Blue
    '#00BCD4', // Cyan
    '#009688', // Teal
    '#4CAF50', // Green
    '#8BC34A', // Light Green
    '#FF9800', // Orange
    '#FF5722', // Deep Orange
    '#795548', // Brown
  ];
  
  // Simple hash function based on name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

export default function RoyZapp() {
  const { currentUser } = useCurrentUser();
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<"inbox" | "team" | "departments" | "tags" | "settings">("inbox");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tags, setTags] = useState<ZappTag[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [teamRoles, setTeamRoles] = useState<{ id: string; name: string; color: string }[]>([]);
  const [assignments, setAssignments] = useState<ConversationAssignment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterGroups, setFilterGroups] = useState(false);
  const [filterProductId, setFilterProductId] = useState<string>("all");
  const [filterTagId, setFilterTagId] = useState<string>("all");
  const [filterAgentId, setFilterAgentId] = useState<string>("all");
  const [availableProducts, setAvailableProducts] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationAssignment | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const messageInputRef = useRef<HTMLInputElement>(null);
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

  // WhatsApp connection state
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [whatsappConnecting, setWhatsappConnecting] = useState(false);
  const [whatsappInstanceName, setWhatsappInstanceName] = useState<string | null>(null);

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
  
  // Client products state (for badges)
  const [clientProducts, setClientProducts] = useState<Record<string, { id: string; name: string; color?: string }[]>>({});
  
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

  useEffect(() => {
    if (currentUser?.account_id) {
      fetchData();
      checkWhatsAppStatus();
    }
  }, [currentUser?.account_id]);

  // Realtime subscription for conversations and assignments
  useEffect(() => {
    if (!currentUser?.account_id) return;

    const conversationsChannel = supabase
      .channel('zapp-conversations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zapp_conversations',
          filter: `account_id=eq.${currentUser.account_id}`
        },
        (payload) => {
          console.log("Realtime conversation update:", payload);
          // Refetch assignments to get updated conversation data
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zapp_conversation_assignments',
          filter: `account_id=eq.${currentUser.account_id}`
        },
        (payload) => {
          console.log("Realtime assignment update:", payload);
          // Refetch assignments when new conversation comes in
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
    };
  }, [currentUser?.account_id]);

  // Realtime subscription for messages in selected conversation
  useEffect(() => {
    if (!selectedConversation?.zapp_conversation_id) return;

    const messagesChannel = supabase
      .channel(`zapp-messages-${selectedConversation.zapp_conversation_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'zapp_messages',
          filter: `zapp_conversation_id=eq.${selectedConversation.zapp_conversation_id}`
        },
        (payload) => {
          console.log("Realtime new message:", payload);
          const newMsg = payload.new as any;
          setMessages((prev) => {
            // Avoid duplicates - check by id or if it's a temp message being replaced
            if (prev.some(m => m.id === newMsg.id)) return prev;
            
            // For outbound messages, check if we already have an optimistic version
            // (temp messages start with "temp-")
            if (newMsg.direction === "outbound") {
              const hasOptimistic = prev.some(m => 
                m.id.startsWith("temp-") && 
                m.content === newMsg.content &&
                !m.is_from_client
              );
              if (hasOptimistic) {
                // Replace optimistic message with real one
                return prev.map(m => 
                  m.id.startsWith("temp-") && m.content === newMsg.content && !m.is_from_client
                    ? {
                        id: newMsg.id,
                        content: newMsg.content,
                        is_from_client: false,
                        created_at: newMsg.sent_at,
                        message_type: newMsg.message_type || "text",
                        media_url: newMsg.media_url,
                        media_type: newMsg.media_type,
                        media_mimetype: newMsg.media_mimetype,
                        media_filename: newMsg.media_filename,
                        audio_duration_sec: newMsg.audio_duration_sec,
                        sender_name: newMsg.sender_name,
                      }
                    : m
                );
              }
            }
            
            return [...prev, {
              id: newMsg.id,
              content: newMsg.content,
              is_from_client: newMsg.direction === "inbound",
              created_at: newMsg.sent_at,
              message_type: newMsg.message_type || "text",
              media_url: newMsg.media_url,
              media_type: newMsg.media_type,
              media_mimetype: newMsg.media_mimetype,
              media_filename: newMsg.media_filename,
              audio_duration_sec: newMsg.audio_duration_sec,
              sender_name: newMsg.sender_name,
            }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [selectedConversation?.zapp_conversation_id]);

  useEffect(() => {
    if (selectedConversation?.zapp_conversation_id) {
      fetchMessages(selectedConversation.zapp_conversation_id);
    }
  }, [selectedConversation]);

  const checkWhatsAppStatus = async () => {
    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "status" },
      });

      if (response.data) {
        const state = response.data?.state || response.data?.data?.state;
        const connected = state === "open" || response.data?.connected || response.data?.data?.connected;
        setWhatsappConnected(connected);
        setWhatsappInstanceName(response.data?.instance || response.data?.data?.instance || null);
      }
    } catch (error) {
      console.log("WhatsApp status check failed:", error);
    }
  };

  const toggleWhatsAppConnection = async () => {
    setWhatsappConnecting(true);
    try {
      if (whatsappConnected) {
        // Disconnect
        const response = await supabase.functions.invoke("uazapi-manager", {
          body: { action: "disconnect" },
        });

        if (response.error) throw new Error(response.error.message);
        
        setWhatsappConnected(false);
        toast.success("WhatsApp desconectado do zAPP");
      } else {
        // Connect - check if already connected via main integration
        const statusResponse = await supabase.functions.invoke("uazapi-manager", {
          body: { action: "status" },
        });

        const state = statusResponse.data?.state || statusResponse.data?.data?.state;
        const connected = state === "open" || statusResponse.data?.connected || statusResponse.data?.data?.connected;

        if (connected) {
          setWhatsappConnected(true);
          toast.success("WhatsApp conectado ao zAPP!");
        } else {
          toast.warning("Configure a conexão WhatsApp primeiro em Integrações");
        }
      }
    } catch (error: any) {
      console.error("WhatsApp toggle error:", error);
      toast.error(error.message || "Erro ao alterar conexão WhatsApp");
    } finally {
      setWhatsappConnecting(false);
    }
  };

  const fetchData = async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);

    try {
      const [
        { data: depts, error: deptsError },
        { data: agentsData, error: agentsError },
        { data: usersData, error: usersError },
        { data: rolesData, error: rolesError },
        { data: assignmentsData, error: assignmentsError },
        { data: tagsData, error: tagsError },
      ] = await Promise.all([
        supabase
          .from("zapp_departments")
          .select("*")
          .eq("account_id", currentUser.account_id)
          .order("display_order"),
        supabase
          .from("zapp_agents")
          .select(`
            *,
            user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url, team_role_id),
            department:zapp_departments(*)
          `)
          .eq("account_id", currentUser.account_id)
          .order("created_at"),
        supabase
          .from("users")
          .select("id, name, email, avatar_url, role, team_role_id, team_role:team_roles(id, name, color)")
          .eq("account_id", currentUser.account_id)
          .order("name"),
        supabase
          .from("team_roles")
          .select("id, name, color")
          .eq("account_id", currentUser.account_id)
          .order("display_order"),
        supabase
          .from("zapp_conversation_assignments")
          .select(`
            *,
            agent:zapp_agents(*, user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url, team_role_id)),
            department:zapp_departments(*),
            conversation:conversations(id, client_id, client:clients(id, full_name, phone_e164, avatar_url)),
            zapp_conversation:zapp_conversations(id, phone_e164, contact_name, client_id, last_message_at, last_message_preview, unread_count, is_group, group_jid, is_archived, is_muted, is_pinned, is_favorite, is_blocked, client:clients(id, full_name, phone_e164, avatar_url))
          `)
          .eq("account_id", currentUser.account_id)
          .neq("status", "closed")
          .order("updated_at", { ascending: false })
          .limit(100),
        supabase
          .from("zapp_tags")
          .select("*")
          .eq("account_id", currentUser.account_id)
          .order("display_order"),
      ]);

      if (deptsError) throw deptsError;
      if (agentsError) throw agentsError;
      if (usersError) throw usersError;
      if (rolesError) throw rolesError;
      if (assignmentsError) throw assignmentsError;
      if (tagsError) throw tagsError;

      setDepartments(depts || []);
      setTeamUsers((usersData || []) as TeamUser[]);
      setTeamRoles(rolesData || []);
      setAssignments(assignmentsData || []);
      setTags(tagsData || []);
      
      // Fetch available products for filter dropdown
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, color")
        .eq("account_id", currentUser.account_id)
        .eq("is_active", true)
        .order("name");
      
      setAvailableProducts(productsData || []);
      // Fetch products for all clients in the conversations
      const clientIds = (assignmentsData || [])
        .map((a: ConversationAssignment) => a.zapp_conversation?.client_id || a.conversation?.client?.id)
        .filter((id: string | null | undefined): id is string => !!id);
      
      if (clientIds.length > 0) {
        const { data: cpData } = await supabase
          .from("client_products")
          .select("client_id, product:products(id, name, color)")
          .in("client_id", clientIds);
        
        if (cpData) {
          const productsMap: Record<string, { id: string; name: string; color?: string }[]> = {};
          cpData.forEach((cp: any) => {
            if (cp.client_id && cp.product) {
              if (!productsMap[cp.client_id]) {
                productsMap[cp.client_id] = [];
              }
              productsMap[cp.client_id].push({ 
                id: cp.product.id, 
                name: cp.product.name,
                color: cp.product.color 
              });
            }
          });
          setClientProducts(productsMap);
        }
      }
      
      // Check if current user is already an agent, if not, auto-register
      let finalAgents = agentsData || [];
      const existingAgent = finalAgents.find((a: Agent) => a.user_id === currentUser.id);
      
      if (!existingAgent) {
        // Auto-register current user as agent
        const { data: newAgent, error: createError } = await supabase
          .from("zapp_agents")
          .insert({
            account_id: currentUser.account_id,
            user_id: currentUser.id,
            is_online: true,
            last_activity_at: new Date().toISOString(),
          })
          .select(`
            *,
            user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url, team_role_id),
            department:zapp_departments(*)
          `)
          .single();
        
        if (!createError && newAgent) {
          finalAgents = [...finalAgents, newAgent];
          console.log("Auto-registered as agent:", newAgent.id);
        } else if (createError) {
          console.error("Error auto-registering agent:", createError);
        }
      } else {
        // Update last activity and online status
        await supabase
          .from("zapp_agents")
          .update({ 
            is_online: true, 
            last_activity_at: new Date().toISOString() 
          })
          .eq("id", existingAgent.id);
      }
      
      setAgents(finalAgents);
    } catch (error: any) {
      console.error("Error fetching zapp data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (zappConversationId: string) => {
    try {
      const { data, error } = await supabase
        .from("zapp_messages")
        .select("id, content, direction, sent_at, message_type, media_url, media_type, media_mimetype, media_filename, audio_duration_sec, sender_name")
        .eq("zapp_conversation_id", zappConversationId)
        .order("sent_at", { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages((data || []).map((m: any) => ({
        id: m.id,
        content: m.content,
        is_from_client: m.direction === "inbound",
        created_at: m.sent_at,
        message_type: m.message_type || "text",
        media_url: m.media_url,
        media_type: m.media_type,
        media_mimetype: m.media_mimetype,
        media_filename: m.media_filename,
        audio_duration_sec: m.audio_duration_sec,
        sender_name: m.sender_name,
      })));
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

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
      avatar: zc?.client?.avatar_url || c?.avatar_url || null,
      isClient: !!(zc?.client_id || c?.id),
      isGroup: zc?.is_group || false,
      lastMessage: zc?.last_message_preview || null,
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

  const markAsUnread = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from("zapp_conversations")
        .update({ unread_count: 1 })
        .eq("id", conversationId);

      if (error) throw error;
      toast.success("Marcada como não lida!");
      fetchData();
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

  // Handle key press in input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

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

  // Get current user's agent record
  const currentAgent = useMemo(() => {
    return agents.find((a) => a.user_id === currentUser?.id);
  }, [agents, currentUser?.id]);

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


  // Filtered conversations based on tab (mine vs queue)
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
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

  // Stats
  const onlineAgents = agents.filter((a) => a.is_online && a.is_active).length;
  const totalQueueConversations = assignments.filter((a) => a.status !== "closed").length;
  const myConversations = assignments.filter((a) => a.agent_id === currentAgent?.id && a.status !== "closed").length;
  const activeConversations = assignments.filter((a) => a.status === "active").length;
  const assignedToOthers = assignments.filter((a) => a.agent_id && a.agent_id !== currentAgent?.id && a.status !== "closed").length;

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const formatTime = (date: string) => {
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
  };

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

  // Render sidebar navigation
  const renderSidebarNav = () => (
    <div className="bg-zapp-panel-header border-b border-zapp-border p-2 flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full h-10 w-10",
              activeView === "inbox" ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
            )}
            onClick={() => setActiveView("inbox")}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Conversas</TooltipContent>
      </Tooltip>


      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full h-10 w-10",
              activeView === "tags" ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
            )}
            onClick={() => setActiveView("tags")}
          >
            <Tags className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Tags</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full h-10 w-10",
              filterGroups ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
            )}
            onClick={() => setFilterGroups(!filterGroups)}
          >
            <Users2 className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{filterGroups ? "Mostrar todas" : "Filtrar grupos"}</TooltipContent>
      </Tooltip>


      <div className="flex-1" />

      {/* Status indicators */}
      <div className="flex items-center gap-3 px-2 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-zapp-accent" />
          <span className="text-zapp-text-muted">{onlineAgents} online</span>
        </div>
        {totalQueueConversations > 0 && (
          <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
            {totalQueueConversations}
          </Badge>
        )}
      </div>
    </div>
  );

  // Render conversation list
  const renderConversationList = () => (
    <div className="flex flex-col h-full bg-zapp-bg">
      {/* Header */}
      <div className="bg-zapp-panel-header px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={currentUser?.avatar_url || undefined} />
            <AvatarFallback className="bg-zapp-accent text-white text-sm">
              {currentUser ? getInitials(currentUser.name) : "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-zapp-text font-medium">ROY zAPP</h2>
            <p className="text-xs text-zapp-text-muted">{activeConversations} em atendimento</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-zapp-text-muted hover:bg-zapp-panel rounded-full">
                <Filter className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border w-56 max-h-80 overflow-y-auto">
              {/* Status filters */}
              <div className="px-2 py-1.5 text-xs font-medium text-zapp-text-muted">Status</div>
              <DropdownMenuItem 
                className={cn("text-zapp-text", filterStatus === "all" && "bg-zapp-bg-dark")}
                onClick={() => setFilterStatus("all")}
              >
                Todas
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn("text-zapp-text", filterUnread && "bg-zapp-bg-dark")}
                onClick={() => setFilterUnread(!filterUnread)}
              >
                Não lidas
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn("text-zapp-text", filterStatus === "triage" && "bg-zapp-bg-dark")}
                onClick={() => setFilterStatus("triage")}
              >
                Triagem
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn("text-zapp-text", filterStatus === "active" && "bg-zapp-bg-dark")}
                onClick={() => setFilterStatus("active")}
              >
                Em atendimento
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn("text-zapp-text", filterStatus === "closed" && "bg-zapp-bg-dark")}
                onClick={() => setFilterStatus("closed")}
              >
                Finalizado
              </DropdownMenuItem>
              
              {/* Product filters */}
              {availableProducts.length > 0 && (
                <>
                  <DropdownMenuSeparator className="bg-zapp-border" />
                  <div className="px-2 py-1.5 text-xs font-medium text-zapp-text-muted">Produto</div>
                  <DropdownMenuItem 
                    className={cn("text-zapp-text", filterProductId === "all" && "bg-zapp-bg-dark")}
                    onClick={() => setFilterProductId("all")}
                  >
                    Todos os produtos
                  </DropdownMenuItem>
                  {availableProducts.map((product) => (
                    <DropdownMenuItem 
                      key={product.id}
                      className={cn("text-zapp-text flex items-center gap-2", filterProductId === product.id && "bg-zapp-bg-dark")}
                      onClick={() => setFilterProductId(product.id)}
                    >
                      <div 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: product.color || '#10b981' }}
                      />
                      <span className="truncate">{product.name}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              
              {/* Tag filters */}
              {tags.length > 0 && (
                <>
                  <DropdownMenuSeparator className="bg-zapp-border" />
                  <div className="px-2 py-1.5 text-xs font-medium text-zapp-text-muted">Etiqueta</div>
                  <DropdownMenuItem 
                    className={cn("text-zapp-text", filterTagId === "all" && "bg-zapp-bg-dark")}
                    onClick={() => setFilterTagId("all")}
                  >
                    Todas as etiquetas
                  </DropdownMenuItem>
                  {tags.filter(t => t.is_active).map((tag) => (
                    <DropdownMenuItem 
                      key={tag.id}
                      className={cn("text-zapp-text flex items-center gap-2", filterTagId === tag.id && "bg-zapp-bg-dark")}
                      onClick={() => setFilterTagId(tag.id)}
                    >
                      <div 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="truncate">{tag.name}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              
              {/* Agent filters */}
              {agents.length > 0 && (
                <>
                  <DropdownMenuSeparator className="bg-zapp-border" />
                  <div className="px-2 py-1.5 text-xs font-medium text-zapp-text-muted">Atendente</div>
                  <DropdownMenuItem 
                    className={cn("text-zapp-text", filterAgentId === "all" && "bg-zapp-bg-dark")}
                    onClick={() => setFilterAgentId("all")}
                  >
                    Todos os atendentes
                  </DropdownMenuItem>
                  {agents.filter(a => a.is_active).map((agent) => (
                    <DropdownMenuItem 
                      key={agent.id}
                      className={cn("text-zapp-text flex items-center gap-2", filterAgentId === agent.id && "bg-zapp-bg-dark")}
                      onClick={() => setFilterAgentId(agent.id)}
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={agent.user?.avatar_url || undefined} />
                        <AvatarFallback className="text-[8px] bg-zapp-panel">
                          {agent.user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{agent.user?.name || "Atendente"}</span>
                      {agent.is_online && (
                        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "text-zapp-text-muted hover:bg-zapp-panel rounded-full",
                  (activeView === "team" || activeView === "departments" || activeView === "settings") && "text-zapp-accent"
                )}
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border z-50">
              <DropdownMenuItem 
                className={cn(
                  "text-zapp-text hover:bg-zapp-hover",
                  activeView === "team" && "bg-zapp-bg-dark"
                )}
                onClick={() => setActiveView("team")}
              >
                <Users className="h-4 w-4 mr-2" />
                Equipe
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn(
                  "text-zapp-text hover:bg-zapp-hover",
                  activeView === "departments" && "bg-zapp-bg-dark"
                )}
                onClick={() => setActiveView("departments")}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Departamentos
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn(
                  "text-zapp-text hover:bg-zapp-hover",
                  activeView === "settings" && "bg-zapp-bg-dark"
                )}
                onClick={() => setActiveView("settings")}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs: Minhas | Fila */}
      <div className="flex border-b border-zapp-border bg-zapp-bg">
        <button
          onClick={() => setInboxTab("mine")}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors relative",
            inboxTab === "mine" 
              ? "text-zapp-accent" 
              : "text-zapp-text-muted hover:text-zapp-text"
          )}
        >
          <span className="flex items-center justify-center gap-2">
            Minhas
            {myConversations > 0 && (
              <Badge variant="secondary" className="bg-zapp-accent text-white text-[10px] px-1.5 py-0 h-4 min-w-[18px]">
                {myConversations}
              </Badge>
            )}
          </span>
          {inboxTab === "mine" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zapp-accent" />
          )}
        </button>
        <button
          onClick={() => setInboxTab("queue")}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors relative",
            inboxTab === "queue" 
              ? "text-zapp-accent" 
              : "text-zapp-text-muted hover:text-zapp-text"
          )}
        >
          <span className="flex items-center justify-center gap-2">
            Fila
            {totalQueueConversations > 0 && (
              <Badge variant="secondary" className="bg-amber-500 text-white text-[10px] px-1.5 py-0 h-4 min-w-[18px]">
                {totalQueueConversations}
              </Badge>
            )}
          </span>
          {inboxTab === "queue" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zapp-accent" />
          )}
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 bg-zapp-bg">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zapp-text-muted" />
          <Input
            placeholder="Pesquisar conversa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-zapp-input border-0 text-zapp-text placeholder:text-zapp-text-muted focus-visible:ring-0 rounded-lg h-9"
          />
        </div>
      </div>

      {renderSidebarNav()}

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {activeView === "inbox" && (
          <div className="divide-y divide-zapp-border">
            {filteredAssignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-20 h-20 rounded-full bg-zapp-panel flex items-center justify-center mb-4">
                  <MessageSquare className="h-10 w-10 text-zapp-text-muted" />
                </div>
                <p className="text-zapp-text-muted text-sm">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              filteredAssignments.map((assignment) => {
                const contact = getContactInfo(assignment);
                const zappConvId = assignment.zapp_conversation?.id;
                return (
                  <div
                    key={assignment.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zapp-panel transition-colors group",
                      selectedConversation?.id === assignment.id && "bg-zapp-bg-dark"
                    )}
                    onClick={() => setSelectedConversation(assignment)}
                  >
                    <div className="relative">
                      <Avatar className="h-11 w-11">
                        <AvatarImage src={contact.avatar || undefined} />
                        <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                          {contact.name ? getInitials(contact.name) : "?"}
                        </AvatarFallback>
                      </Avatar>
                      {assignment.status === "pending" && (
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 border-2 border-zapp-bg" />
                      )}
                      {contact.isGroup ? (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-zapp-bg flex items-center justify-center">
                          <Users2 className="h-2.5 w-2.5 text-white" />
                        </div>
                      ) : !contact.isClient && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 border-2 border-zapp-bg flex items-center justify-center">
                          <span className="text-[8px] text-white font-bold">?</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {contact.isPinned && (
                            <Pin className="h-3 w-3 text-zapp-text-muted flex-shrink-0" />
                          )}
                          {contact.isMuted && (
                            <BellOff className="h-3 w-3 text-zapp-text-muted flex-shrink-0" />
                          )}
                          {contact.isFavorite && (
                            <Heart className="h-3 w-3 text-red-400 fill-red-400 flex-shrink-0" />
                          )}
                          <span className="text-zapp-text font-medium truncate text-sm">
                            {contact.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-zapp-text-muted text-xs">
                            {formatTime(contact.lastMessageAt)}
                          </span>
                          {/* Dropdown menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-zapp-text-muted hover:bg-zapp-hover"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border w-56">
                              {zappConvId && (
                                <>
                                  <DropdownMenuItem 
                                    className="text-zapp-text hover:bg-zapp-hover"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateConversationFlag(zappConvId, "is_archived", !contact.isArchived);
                                    }}
                                  >
                                    <Archive className="h-4 w-4 mr-3" />
                                    {contact.isArchived ? "Desarquivar conversa" : "Arquivar conversa"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-zapp-text hover:bg-zapp-hover"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateConversationFlag(zappConvId, "is_muted", !contact.isMuted);
                                    }}
                                  >
                                    <BellOff className="h-4 w-4 mr-3" />
                                    {contact.isMuted ? "Reativar notificações" : "Silenciar notificações"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-zapp-text hover:bg-zapp-hover"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateConversationFlag(zappConvId, "is_pinned", !contact.isPinned);
                                    }}
                                  >
                                    <Pin className="h-4 w-4 mr-3" />
                                    {contact.isPinned ? "Desafixar conversa" : "Fixar conversa"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-zapp-text hover:bg-zapp-hover"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // TODO: Open tag dialog
                                      toast.info("Em breve: Etiquetar conversa");
                                    }}
                                  >
                                    <Tag className="h-4 w-4 mr-3" />
                                    Etiquetar conversa
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-zapp-text hover:bg-zapp-hover"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsUnread(zappConvId);
                                    }}
                                  >
                                    <MailOpen className="h-4 w-4 mr-3" />
                                    Marcar como não lida
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-zapp-text hover:bg-zapp-hover"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateConversationFlag(zappConvId, "is_favorite", !contact.isFavorite);
                                    }}
                                  >
                                    <Heart className={cn("h-4 w-4 mr-3", contact.isFavorite && "fill-current text-red-400")} />
                                    {contact.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-zapp-border" />
                                  <DropdownMenuItem 
                                    className="text-zapp-text hover:bg-zapp-hover"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateConversationFlag(zappConvId, "is_blocked", !contact.isBlocked);
                                    }}
                                  >
                                    <Ban className="h-4 w-4 mr-3" />
                                    {contact.isBlocked ? "Desbloquear" : "Bloquear"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-red-400 hover:bg-zapp-hover"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteConversation(assignment.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-3" />
                                    Apagar conversa
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {assignment.status === "active" && (
                            <CheckCheck className="h-4 w-4 text-info flex-shrink-0" />
                          )}
                          <span className="text-zapp-text-muted text-xs truncate">
                            {contact.lastMessage || contact.phone || "Nova conversa"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {assignment.department && (
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: assignment.department.color }}
                            />
                          )}
                          {contact.unreadCount > 0 && (
                            <Badge className="bg-zapp-accent text-white text-[10px] px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
                              {contact.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {/* Show agent indicator when someone is handling (always show, not just in queue tab) */}
                      {assignment.agent_id && (
                        <div className="flex items-center gap-1 mt-1">
                          <User className="h-3 w-3 text-zapp-accent" />
                          <span className="text-[11px] text-zapp-accent truncate">
                            {assignment.agent_id === currentAgent?.id 
                              ? "Você" 
                              : getAgentName(assignment.agent_id) || "Atendente"}
                          </span>
                        </div>
                      )}
                      {/* Product badges */}
                      {(() => {
                        const clientId = assignment.zapp_conversation?.client_id || assignment.conversation?.client?.id;
                        const products = clientId ? clientProducts[clientId] : undefined;
                        return products && products.length > 0 && (
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {products.slice(0, 2).map((p) => (
                              <Badge 
                                key={p.id} 
                                variant="secondary" 
                                className="text-[10px] px-1.5 py-0 h-4 border-0"
                                style={{ 
                                  backgroundColor: `${p.color || '#10b981'}20`,
                                  color: p.color || '#10b981'
                                }}
                              >
                                {p.name}
                              </Badge>
                            ))}
                            {products.length > 2 && (
                              <span className="text-[10px] text-zapp-text-muted">
                                +{products.length - 2}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeView === "team" && renderTeamList()}
        {activeView === "departments" && renderDepartmentList()}
        {activeView === "tags" && renderTagsList()}
        {activeView === "settings" && renderSettingsPanel()}
      </ScrollArea>
    </div>
  );

  // Render team list
  const renderTeamList = () => (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-zapp-text font-medium">Equipe de Atendimento</h3>
        <Button
          size="sm"
          className="bg-zapp-accent hover:bg-zapp-accent-hover text-white"
          onClick={() => openAgentDialog()}
          disabled={availableUsers.length === 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-8">
          <Users className="h-12 w-12 text-zapp-text-muted mx-auto mb-3" />
          <p className="text-zapp-text-muted text-sm">Nenhum atendente cadastrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-3 p-3 bg-zapp-panel rounded-lg"
            >
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={agent.user?.avatar_url || undefined} />
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                    {agent.user ? getInitials(agent.user.name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zapp-panel",
                    agent.is_online ? "bg-zapp-accent" : "bg-muted"
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-zapp-text text-sm font-medium truncate">
                    {agent.user?.name}
                  </span>
                  {teamUsers.find(u => u.id === agent.user_id)?.team_role && (
                    <Badge 
                      variant="outline" 
                      className="text-[10px] px-1.5 py-0 border-zapp-border"
                      style={{ 
                        borderColor: teamUsers.find(u => u.id === agent.user_id)?.team_role?.color,
                        color: teamUsers.find(u => u.id === agent.user_id)?.team_role?.color
                      }}
                    >
                      {teamUsers.find(u => u.id === agent.user_id)?.team_role?.name}
                    </Badge>
                  )}
                </div>
                <p className="text-zapp-text-muted text-xs truncate">
                  {agent.department?.name || "Todos os departamentos"} • {agent.current_chats}/{agent.max_concurrent_chats}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Switch
                  checked={agent.is_online}
                  onCheckedChange={() => toggleAgentOnline(agent)}
                  className="data-[state=checked]:bg-zapp-accent"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zapp-text-muted hover:bg-zapp-bg-dark">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border">
                    <DropdownMenuItem className="text-zapp-text" onClick={() => openAgentDialog(agent)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-zapp-border" />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => setDeletingAgentId(agent.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render department list
  const renderDepartmentList = () => (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-zapp-text font-medium">Departamentos</h3>
        <Button
          size="sm"
          className="bg-zapp-accent hover:bg-zapp-accent-hover text-white"
          onClick={() => openDepartmentDialog()}
        >
          <Plus className="h-4 w-4 mr-1" />
          Novo
        </Button>
      </div>

      {departments.length === 0 ? (
        <div className="text-center py-8">
          <Building2 className="h-12 w-12 text-zapp-text-muted mx-auto mb-3" />
          <p className="text-zapp-text-muted text-sm">Nenhum departamento cadastrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="p-3 bg-zapp-panel rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: dept.color }}
                  />
                  <span className="text-zapp-text font-medium">{dept.name}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zapp-text-muted hover:bg-zapp-bg-dark">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border">
                    <DropdownMenuItem className="text-zapp-text" onClick={() => openDepartmentDialog(dept)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-zapp-border" />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => setDeletingDepartmentId(dept.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {dept.description && (
                <p className="text-zapp-text-muted text-xs mt-1">{dept.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-zapp-text-muted">
                <span>{agents.filter((a) => a.department_id === dept.id).length} atendentes</span>
                <span>•</span>
                <span>{dept.auto_distribution ? "Distribuição automática" : "Manual"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

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

  // Render tags list
  const renderTagsList = () => (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-zapp-text font-medium">Tags</h3>
        <Button
          size="sm"
          className="bg-zapp-accent hover:bg-zapp-accent-hover text-white"
          onClick={() => openTagDialog()}
        >
          <Plus className="h-4 w-4 mr-1" />
          Nova
        </Button>
      </div>

      {tags.length === 0 ? (
        <div className="text-center py-8">
          <Tags className="h-12 w-12 text-zapp-text-muted mx-auto mb-3" />
          <p className="text-zapp-text-muted text-sm">Nenhuma tag cadastrada</p>
          <p className="text-zapp-text-muted text-xs mt-1">Crie tags para organizar suas conversas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="p-3 bg-zapp-panel rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-zapp-text font-medium">{tag.name}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zapp-text-muted hover:bg-zapp-bg-dark">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border">
                    <DropdownMenuItem className="text-zapp-text" onClick={() => openTagDialog(tag)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-zapp-border" />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => setDeletingTagId(tag.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {tag.description && (
                <p className="text-zapp-text-muted text-xs mt-1">{tag.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );


  // Render settings panel
  const renderSettingsPanel = () => (
    <div className="p-4 space-y-6">
      <h3 className="text-zapp-text font-medium">Configurações</h3>

      {/* WhatsApp Connection */}
      <div className="space-y-3">
        <div>
          <p className="text-zapp-text text-sm font-medium">Conexão WhatsApp</p>
          <p className="text-zapp-text-muted text-xs">Ative para receber e enviar mensagens pelo zAPP</p>
        </div>
        
        <div className={cn(
          "p-4 rounded-lg border-2 transition-colors",
          whatsappConnected 
            ? "bg-zapp-accent/10 border-zapp-accent" 
            : "bg-zapp-panel border-zapp-border"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {whatsappConnected ? (
                <div className="w-10 h-10 rounded-full bg-zapp-accent flex items-center justify-center">
                  <Wifi className="h-5 w-5 text-white" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-zapp-bg flex items-center justify-center">
                  <WifiOff className="h-5 w-5 text-zapp-text-muted" />
                </div>
              )}
              <div>
                <p className="text-zapp-text text-sm font-medium">
                  {whatsappConnected ? "Conectado" : "Desconectado"}
                </p>
                <p className="text-zapp-text-muted text-xs">
                  {whatsappConnected 
                    ? "Recebendo mensagens em tempo real" 
                    : "Clique para ativar a conexão"}
                </p>
              </div>
            </div>
            <Button
              variant={whatsappConnected ? "outline" : "default"}
              size="sm"
              onClick={toggleWhatsAppConnection}
              disabled={whatsappConnecting}
              className={cn(
                whatsappConnected 
                  ? "border-red-500 text-red-500 hover:bg-red-500/10" 
                  : "bg-zapp-accent hover:bg-zapp-accent-hover text-white"
              )}
            >
              {whatsappConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Power className="h-4 w-4 mr-1" />
                  {whatsappConnected ? "Desligar" : "Ligar"}
                </>
              )}
            </Button>
          </div>
          {whatsappInstanceName && (
            <p className="text-zapp-text-muted text-xs mt-2">
              Instância: {whatsappInstanceName}
            </p>
          )}
        </div>
      </div>

      {/* Access Configuration Notice */}
      <div className="space-y-3 pt-4 border-t border-zapp-border">
        <div>
          <p className="text-zapp-text text-sm font-medium">Controle de Acesso</p>
          <p className="text-zapp-text-muted text-xs">
            O acesso ao ROY zAPP é controlado pela permissão "Acessar ROY zAPP" configurada na página de Equipe → Cargos.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/team")}
          className="border-zapp-border text-zapp-text hover:bg-zapp-hover"
        >
          <Users className="h-4 w-4 mr-2" />
          Gerenciar Cargos
        </Button>
      </div>

      {/* Distribution Settings */}
      <div className="space-y-4 pt-4 border-t border-zapp-border">
        <p className="text-zapp-text text-sm font-medium">Distribuição</p>
        
        <div className="flex items-center justify-between p-3 bg-zapp-panel rounded-lg">
          <div>
            <p className="text-zapp-text text-sm">Distribuição round-robin</p>
            <p className="text-zapp-text-muted text-xs">Distribui igualmente entre atendentes</p>
          </div>
          <Switch 
            checked={roundRobinEnabled} 
            onCheckedChange={(checked) => {
              setRoundRobinEnabled(checked);
              localStorage.setItem("zapp_roundRobin", String(checked));
            }}
            className="data-[state=checked]:bg-zapp-accent" 
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-zapp-panel rounded-lg">
          <div>
            <p className="text-zapp-text text-sm">Respeitar limite</p>
            <p className="text-zapp-text-muted text-xs">Não atribuir se atingiu o máximo</p>
          </div>
          <Switch 
            checked={respectLimitEnabled} 
            onCheckedChange={(checked) => {
              setRespectLimitEnabled(checked);
              localStorage.setItem("zapp_respectLimit", String(checked));
            }}
            className="data-[state=checked]:bg-zapp-accent" 
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-zapp-panel rounded-lg">
          <div>
            <p className="text-zapp-text text-sm">Som de nova conversa</p>
            <p className="text-zapp-text-muted text-xs">Tocar som ao receber mensagem</p>
          </div>
          <Switch 
            checked={soundEnabled} 
            onCheckedChange={(checked) => {
              setSoundEnabled(checked);
              localStorage.setItem("zapp_sound", String(checked));
            }}
            className="data-[state=checked]:bg-zapp-accent" 
          />
        </div>
      </div>

      {/* Import Conversations */}
      <div className="space-y-4 pt-4 border-t border-zapp-border">
        <div>
          <p className="text-zapp-text text-sm font-medium">Importar Conversas</p>
          <p className="text-zapp-text-muted text-xs">
            Carrega as últimas conversas do WhatsApp para o sistema
          </p>
        </div>
        
        <div className="p-4 bg-zapp-panel rounded-lg space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label htmlFor="importLimit" className="text-zapp-text text-xs">
                Quantidade de conversas
              </Label>
              <Select value={importLimit} onValueChange={setImportLimit}>
                <SelectTrigger className="mt-1 bg-zapp-input border-zapp-border text-zapp-text">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 conversas</SelectItem>
                  <SelectItem value="50">50 conversas</SelectItem>
                  <SelectItem value="100">100 conversas</SelectItem>
                  <SelectItem value="200">200 conversas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button
            onClick={importRecentConversations}
            disabled={importingConversations || !whatsappConnected}
            className="w-full bg-zapp-accent hover:bg-zapp-accent-hover text-white"
          >
            {importingConversations ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Carregar Conversas
              </>
            )}
          </Button>
          
          {!whatsappConnected && (
            <p className="text-amber-500 text-xs text-center">
              Conecte o WhatsApp primeiro para importar conversas
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // Render chat view
  const renderChatView = () => {
    if (!selectedConversation) {
      return (
        <div className="flex flex-col flex-1 min-h-0 w-full items-center justify-center bg-zapp-bg-dark relative overflow-hidden">
          <div className="relative z-10 text-center px-8 max-w-md">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-zapp-accent/10 flex items-center justify-center">
              <MessageSquare className="h-12 w-12 text-zapp-accent" />
            </div>
            <h2 className="text-zapp-text text-2xl font-light mb-3">ROY zAPP</h2>
            <p className="text-zapp-text-muted text-sm leading-relaxed">
              Selecione uma conversa para começar a atender. Suas mensagens serão enviadas em nome da conta principal do WhatsApp.
            </p>
          </div>

          {/* Stats bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-zapp-panel-header px-6 py-4 flex items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-zapp-accent" />
              <span className="text-zapp-text-muted">{onlineAgents} atendentes online</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-zapp-text-muted">{totalQueueConversations} na fila</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-zapp-accent" />
              <span className="text-zapp-text-muted">{activeConversations} em atendimento</span>
            </div>
          </div>
        </div>
      );
    }

    const contactInfo = getContactInfo(selectedConversation);
    const clientId = selectedConversation.zapp_conversation?.client_id || selectedConversation.conversation?.client?.id;

    return (
      <div className="flex flex-col flex-1 min-h-0 w-full bg-zapp-bg overflow-hidden">
        {/* Chat header */}
        <div className="bg-zapp-panel-header px-4 py-3 flex items-center gap-3 border-b border-zapp-border">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-zapp-text-muted hover:bg-zapp-hover"
            onClick={() => setSelectedConversation(null)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div 
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              if (clientId) {
                setEditingClientId(clientId);
                setClientEditSheetOpen(true);
              }
            }}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={contactInfo.avatar || undefined} />
              <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                {contactInfo.isGroup ? (
                  <Users2 className="h-5 w-5" />
                ) : (
                  getInitials(contactInfo.name)
                )}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {contactInfo.isGroup && <Users2 className="h-4 w-4 text-zapp-accent flex-shrink-0" />}
                <h3 className="text-zapp-text font-medium truncate">
                  {contactInfo.name}
                </h3>
                {clientId && <ExternalLink className="h-3.5 w-3.5 text-zapp-text-muted flex-shrink-0" />}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-zapp-text-muted text-xs">
                  {contactInfo.phone}
                  {selectedConversation.agent?.user && (
                    <span> • Atendido por {selectedConversation.agent.user.name}</span>
                  )}
                </p>
                {/* Product badges in header */}
                {clientId && clientProducts[clientId] && clientProducts[clientId].length > 0 && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {clientProducts[clientId].slice(0, 2).map((p) => (
                      <Badge 
                        key={p.id} 
                        variant="secondary" 
                        className="text-[10px] px-1.5 py-0 h-4 border-0"
                        style={{ 
                          backgroundColor: `${p.color || '#10b981'}20`,
                          color: p.color || '#10b981'
                        }}
                      >
                        {p.name}
                      </Badge>
                    ))}
                    {clientProducts[clientId].length > 2 && (
                      <span className="text-[10px] text-zapp-text-muted">
                        +{clientProducts[clientId].length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Assign to me / Release button */}
            {selectedConversation.agent_id !== currentAgent?.id ? (
              <Button
                size="sm"
                className="bg-zapp-accent hover:bg-zapp-accent-hover text-white text-xs h-8 px-3"
                onClick={() => assignToMe(selectedConversation.id)}
              >
                <UserCheck className="h-4 w-4 mr-1.5" />
                Puxar para mim
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500 text-amber-500 hover:bg-amber-500/10 text-xs h-8 px-3"
                onClick={() => releaseToQueue(selectedConversation.id)}
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Devolver
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 px-3 text-xs font-semibold transition-colors cursor-pointer hover:opacity-80",
                    STATUS_CONFIG[selectedConversation.status]?.color || "text-muted-foreground",
                    "border-current bg-transparent"
                  )}
                >
                  {STATUS_CONFIG[selectedConversation.status]?.label || "Status"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border w-48 z-50">
                <div className="px-2 py-1.5 text-xs font-medium text-zapp-text-muted">Alterar status</div>
                <DropdownMenuItem 
                  className={cn("text-zapp-text flex items-center gap-2", selectedConversation.status === "triage" && "bg-zapp-bg-dark")}
                  onClick={() => updateConversationStatus(selectedConversation.id, "triage")}
                >
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  Triagem
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className={cn("text-zapp-text flex items-center gap-2", selectedConversation.status === "active" && "bg-zapp-bg-dark")}
                  onClick={() => updateConversationStatus(selectedConversation.id, "active")}
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Em atendimento
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className={cn("text-zapp-text flex items-center gap-2", selectedConversation.status === "closed" && "bg-zapp-bg-dark")}
                  onClick={() => updateConversationStatus(selectedConversation.id, "closed")}
                >
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  Finalizado
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="text-zapp-text-muted hover:bg-zapp-hover h-8 w-8"
                onClick={() => setTransferDialogOpen(true)}
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-zapp-text-muted hover:bg-zapp-hover h-8 w-8">
                <Phone className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-zapp-text-muted hover:bg-zapp-hover h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border z-50">
                  {selectedConversation?.zapp_conversation?.client_id && (
                    <>
                      <DropdownMenuItem 
                        className="text-zapp-text hover:bg-zapp-hover"
                        onClick={() => setRoiDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2 text-zapp-accent" />
                        Adicionar ROI
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-zapp-text hover:bg-zapp-hover"
                        onClick={() => setRiskDialogOpen(true)}
                      >
                        <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                        Adicionar Risco
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-zapp-border" />
                    </>
                  )}
                  <DropdownMenuItem 
                    className="text-zapp-text hover:bg-zapp-hover"
                    onClick={() => {
                      const zc = selectedConversation?.zapp_conversation;
                      if (zc?.client_id) {
                        setEditingClientId(zc.client_id);
                        setClientEditSheetOpen(true);
                      }
                    }}
                    disabled={!selectedConversation?.zapp_conversation?.client_id}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Editar Cliente
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-2">
          <div className="space-y-1">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zapp-text-muted text-sm">Nenhuma mensagem ainda</p>
              </div>
            ) : (
              messages.map((message, index) => {
                const showTimestamp = index === 0 ||
                  new Date(message.created_at).toDateString() !== new Date(messages[index - 1].created_at).toDateString();

                return (
                  <div key={message.id}>
                    {showTimestamp && (
                      <div className="flex justify-center my-3">
                        <span className="bg-zapp-panel text-zapp-text-muted text-xs px-3 py-1 rounded-lg shadow">
                          {format(new Date(message.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                    <div className={cn(
                      "flex mb-1",
                      message.is_from_client ? "justify-start" : "justify-end"
                    )}>
                      <div className={cn(
                        "max-w-[65%] px-3 py-2 rounded-lg relative shadow",
                        message.is_from_client
                          ? "bg-zapp-message-in text-zapp-text rounded-tl-none"
                          : "bg-zapp-message-out text-zapp-text rounded-tr-none"
                      )}>
                        {/* Sender name for group messages */}
                        {message.is_from_client && contactInfo.isGroup && message.sender_name && (
                          <p 
                            className="text-xs font-medium mb-1"
                            style={{ color: getSenderColor(message.sender_name) }}
                          >
                            {message.sender_name}
                          </p>
                        )}
                        {/* Media content */}
                        {message.media_url && message.media_type === "image" && (
                          <div className="mb-2 rounded-lg overflow-hidden">
                            <img 
                              src={message.media_url} 
                              alt="Imagem"
                              className="max-w-full max-h-72 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(message.media_url!, '_blank')}
                            />
                          </div>
                        )}
                        {message.media_url && message.media_type === "audio" && (
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex items-center gap-2 bg-black/20 rounded-full px-3 py-2 min-w-[200px]">
                              <Mic className="h-4 w-4 text-zapp-text-muted" />
                              <audio 
                                controls 
                                className="h-8 max-w-[180px]" 
                                style={{ width: '100%' }}
                              >
                                <source src={message.media_url} type={message.media_mimetype || "audio/ogg"} />
                              </audio>
                              {message.audio_duration_sec && (
                                <span className="text-[10px] text-zapp-text-muted">
                                  {Math.floor(message.audio_duration_sec / 60)}:{(message.audio_duration_sec % 60).toString().padStart(2, '0')}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {message.media_url && message.media_type === "video" && (
                          <div className="mb-2 rounded-lg overflow-hidden">
                            <video 
                              src={message.media_url} 
                              controls
                              className="max-w-full max-h-72"
                            />
                          </div>
                        )}
                        {message.media_url && message.media_type === "document" && (
                          <a 
                            href={message.media_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2 mb-2 hover:bg-black/30 transition-colors"
                          >
                            <FileText className="h-8 w-8 text-zapp-text-muted" />
                            <div className="flex-1 min-w-0">
                              <p className="text-zapp-text text-sm truncate">
                                {message.media_filename || "Documento"}
                              </p>
                              <p className="text-zapp-text-muted text-xs">Clique para baixar</p>
                            </div>
                            <Download className="h-4 w-4 text-zapp-text-muted" />
                          </a>
                        )}
                        {message.media_url && message.media_type === "sticker" && (
                          <div className="mb-2">
                            <img 
                              src={message.media_url} 
                              alt="Figurinha"
                              className="max-w-[150px] max-h-[150px] object-contain"
                            />
                          </div>
                        )}
                        
                        {/* Text content (hide for audio-only messages) */}
                        {(message.content && message.content !== "[Áudio]" && message.content !== "[Figurinha]") && (
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                        )}
                        {(!message.content && !message.media_url) && (
                          <p className="text-sm whitespace-pre-wrap break-words opacity-50">
                            [Mensagem não suportada]
                          </p>
                        )}
                        <div className={cn(
                          "flex items-center justify-end gap-1 mt-1",
                          message.is_from_client ? "text-zapp-text-muted" : "opacity-70"
                        )}>
                          <span className="text-[10px]">
                            {format(new Date(message.created_at), "HH:mm")}
                          </span>
                          {!message.is_from_client && (
                            <CheckCheck className="h-3.5 w-3.5 text-primary" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Formatting toolbar */}
        {showFormatting && (
          <div className="bg-zapp-panel px-4 py-2 border-b border-zapp-border flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-zapp-text-muted hover:bg-zapp-hover hover:text-zapp-text"
                  onClick={() => insertFormatting('bold')}
                >
                  <Bold className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Negrito (*texto*)</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-zapp-text-muted hover:bg-zapp-hover hover:text-zapp-text"
                  onClick={() => insertFormatting('italic')}
                >
                  <Italic className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Itálico (_texto_)</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-zapp-text-muted hover:bg-zapp-hover hover:text-zapp-text"
                  onClick={() => insertFormatting('strikethrough')}
                >
                  <Strikethrough className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Tachado (~texto~)</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-zapp-text-muted hover:bg-zapp-hover hover:text-zapp-text"
                  onClick={() => insertFormatting('monospace')}
                >
                  <Code className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Monoespaçado (```texto```)</TooltipContent>
            </Tooltip>
            
            <span className="text-xs text-zapp-text-muted ml-2">Selecione e clique</span>
          </div>
        )}

        {/* Message input */}
        <div className="bg-zapp-panel px-4 py-3 flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "flex-shrink-0",
                  showFormatting 
                    ? "text-zapp-accent hover:bg-zapp-hover" 
                    : "text-zapp-text-muted hover:bg-zapp-hover"
                )}
                onClick={() => setShowFormatting(!showFormatting)}
              >
                <Bold className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Formatação</TooltipContent>
          </Tooltip>
          
          <Button variant="ghost" size="icon" className="text-zapp-text-muted hover:bg-zapp-hover flex-shrink-0">
            <Paperclip className="h-6 w-6" />
          </Button>
          
          <Input
            ref={messageInputRef}
            placeholder="Digite uma mensagem"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={sendingMessage}
            className="flex-1 bg-zapp-input border-0 text-zapp-text placeholder:text-zapp-text-muted focus-visible:ring-0 rounded-lg h-10"
          />
          
          {messageInput.trim() ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-zapp-accent hover:bg-zapp-hover flex-shrink-0"
              onClick={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              disabled={sendingMessage}
            >
              {sendingMessage ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Send className="h-6 w-6" />
              )}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "flex-shrink-0",
                    isRecording 
                      ? "text-destructive hover:bg-zapp-hover animate-pulse" 
                      : "text-zapp-text-muted hover:bg-zapp-hover"
                  )}
                  onClick={() => {
                    if (isRecording) {
                      setIsRecording(false);
                      toast.info("Gravação cancelada");
                    } else {
                      toast.info("Gravação de áudio será implementada em breve!");
                      // setIsRecording(true);
                    }
                  }}
                >
                  {isRecording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isRecording ? "Parar gravação" : "Gravar áudio"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-row flex-1 min-h-0 w-full overflow-hidden bg-zapp-bg">
      {/* Left panel - Conversation list */}
      <div 
        className={cn(
          "w-[400px] min-w-[400px] max-w-[400px] flex flex-col overflow-hidden border-r border-zapp-border",
          selectedConversation ? "hidden lg:flex" : "flex"
        )}
      >
        {renderConversationList()}
      </div>

      {/* Right panel - Chat view */}
      <div 
        className={cn(
          "flex-1 min-w-0 flex flex-col overflow-hidden",
          !selectedConversation ? "hidden lg:flex" : "flex"
        )}
      >
        {renderChatView()}
      </div>

      {/* Department Dialog */}
      <Dialog open={departmentDialogOpen} onOpenChange={setDepartmentDialogOpen}>
        <DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef]">
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? "Editar Departamento" : "Novo Departamento"}
            </DialogTitle>
            <DialogDescription className="text-[#8696a0]">
              Departamentos organizam as conversas por área
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dept-name" className="text-[#8696a0]">Nome</Label>
              <Input
                id="dept-name"
                value={departmentForm.name}
                onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                placeholder="Ex: Vendas, Suporte"
                className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-description" className="text-[#8696a0]">Descrição</Label>
              <Textarea
                id="dept-description"
                value={departmentForm.description}
                onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })}
                placeholder="Descreva a função"
                rows={2}
                className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#8696a0]">Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={departmentForm.color}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, color: e.target.value })}
                  className="h-10 w-10 rounded border-0 cursor-pointer"
                />
                <Input
                  value={departmentForm.color}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, color: e.target.value })}
                  className="flex-1 bg-[#202c33] border-[#3b4a54] text-[#e9edef]"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-[#e9edef]">Distribuição Automática</Label>
                <p className="text-xs text-[#8696a0]">Atribuir conversas automaticamente</p>
              </div>
              <Switch
                checked={departmentForm.auto_distribution}
                onCheckedChange={(checked) => setDepartmentForm({ ...departmentForm, auto_distribution: checked })}
                className="data-[state=checked]:bg-[#00a884]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepartmentDialogOpen(false)} className="border-[#3b4a54] text-[#8696a0]">
              Cancelar
            </Button>
            <Button onClick={saveDepartment} disabled={savingDepartment} className="bg-[#00a884] hover:bg-[#00a884]/90">
              {savingDepartment ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent Dialog */}
      <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
        <DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef]">
          <DialogHeader>
            <DialogTitle>
              {editingAgent ? "Editar Atendente" : "Adicionar Atendente"}
            </DialogTitle>
            <DialogDescription className="text-[#8696a0]">
              Configure as permissões do atendente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[#8696a0]">Usuário</Label>
              <Select
                value={agentForm.user_id}
                onValueChange={(value) => setAgentForm({ ...agentForm, user_id: value })}
                disabled={!!editingAgent}
              >
                <SelectTrigger className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-[#233138] border-[#3b4a54]">
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id} className="text-[#e9edef]">
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            <div className="space-y-2">
              <Label className="text-[#8696a0]">Departamento</Label>
              <Select
                value={agentForm.department_id || "all"}
                onValueChange={(value) => setAgentForm({ ...agentForm, department_id: value === "all" ? "" : value })}
              >
                <SelectTrigger className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="bg-[#233138] border-[#3b4a54]">
                  <SelectItem value="all" className="text-[#e9edef]">Todos</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id} className="text-[#e9edef]">
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[#8696a0]">Máx. atendimentos simultâneos</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={agentForm.max_concurrent_chats}
                onChange={(e) => setAgentForm({ ...agentForm, max_concurrent_chats: parseInt(e.target.value) || 5 })}
                className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentDialogOpen(false)} className="border-[#3b4a54] text-[#8696a0]">
              Cancelar
            </Button>
            <Button onClick={saveAgent} disabled={savingAgent} className="bg-[#00a884] hover:bg-[#00a884]/90">
              {savingAgent ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ROI Dialog */}
      <Dialog open={roiDialogOpen} onOpenChange={setRoiDialogOpen}>
        <DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef]">
          <DialogHeader>
            <DialogTitle>Adicionar ROI</DialogTitle>
            <DialogDescription className="text-[#8696a0]">
              Registre uma percepção de valor do cliente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#8696a0]">Tipo</Label>
                <Select value={roiType} onValueChange={(v) => {
                  setRoiType(v);
                  setRoiCategory(v === "tangible" ? "revenue" : "clarity");
                }}>
                  <SelectTrigger className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#233138] border-[#3b4a54]">
                    <SelectItem value="tangible" className="text-[#e9edef]">Tangível</SelectItem>
                    <SelectItem value="intangible" className="text-[#e9edef]">Intangível</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[#8696a0]">Categoria</Label>
                <Select value={roiCategory} onValueChange={setRoiCategory}>
                  <SelectTrigger className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#233138] border-[#3b4a54]">
                    {roiType === "tangible" ? (
                      <>
                        <SelectItem value="revenue" className="text-[#e9edef]">Receita</SelectItem>
                        <SelectItem value="cost" className="text-[#e9edef]">Redução de Custo</SelectItem>
                        <SelectItem value="time" className="text-[#e9edef]">Economia de Tempo</SelectItem>
                        <SelectItem value="process" className="text-[#e9edef]">Melhoria de Processo</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="clarity" className="text-[#e9edef]">Clareza</SelectItem>
                        <SelectItem value="confidence" className="text-[#e9edef]">Confiança</SelectItem>
                        <SelectItem value="tranquility" className="text-[#e9edef]">Tranquilidade</SelectItem>
                        <SelectItem value="status_direction" className="text-[#e9edef]">Direção</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#8696a0]">Impacto</Label>
              <Select value={roiImpact} onValueChange={setRoiImpact}>
                <SelectTrigger className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#233138] border-[#3b4a54]">
                  <SelectItem value="low" className="text-[#e9edef]">Baixo</SelectItem>
                  <SelectItem value="medium" className="text-[#e9edef]">Médio</SelectItem>
                  <SelectItem value="high" className="text-[#e9edef]">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#8696a0]">Evidência / Detalhe</Label>
              <Textarea
                value={roiEvidence}
                onChange={(e) => setRoiEvidence(e.target.value)}
                placeholder="Descreva o que o cliente percebeu como valor..."
                className="bg-[#202c33] border-[#3b4a54] text-[#e9edef] min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoiDialogOpen(false)} className="border-[#3b4a54] text-[#8696a0]">
              Cancelar
            </Button>
            <Button onClick={handleAddRoi} disabled={uploadingRoi} className="bg-[#00a884] hover:bg-[#00a884]/90">
              {uploadingRoi ? "Salvando..." : "Adicionar ROI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Risk Dialog */}
      <Dialog open={riskDialogOpen} onOpenChange={setRiskDialogOpen}>
        <DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef]">
          <DialogHeader>
            <DialogTitle>Adicionar Risco</DialogTitle>
            <DialogDescription className="text-[#8696a0]">
              Registre um alerta de risco para este cliente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[#8696a0]">Nível de Risco</Label>
              <Select value={riskLevel} onValueChange={setRiskLevel}>
                <SelectTrigger className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#233138] border-[#3b4a54]">
                  <SelectItem value="low" className="text-[#e9edef]">Baixo</SelectItem>
                  <SelectItem value="medium" className="text-[#e9edef]">Médio</SelectItem>
                  <SelectItem value="high" className="text-[#e9edef]">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#8696a0]">Motivo do Risco</Label>
              <Textarea
                value={riskReason}
                onChange={(e) => setRiskReason(e.target.value)}
                placeholder="Descreva o motivo do alerta de risco..."
                className="bg-[#202c33] border-[#3b4a54] text-[#e9edef] min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRiskDialogOpen(false)} className="border-[#3b4a54] text-[#8696a0]">
              Cancelar
            </Button>
            <Button onClick={handleAddRisk} disabled={uploadingRisk} className="bg-amber-500 hover:bg-amber-600">
              {uploadingRisk ? "Salvando..." : "Adicionar Risco"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef]">
          <DialogHeader>
            <DialogTitle>Transferir Conversa</DialogTitle>
            <DialogDescription className="text-[#8696a0]">
              Selecione para quem transferir
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Tabs defaultValue="agent" onValueChange={(v) => setTransferTarget({ ...transferTarget, type: v as "agent" | "department" })}>
              <TabsList className="w-full bg-[#202c33]">
                <TabsTrigger value="agent" className="flex-1 data-[state=active]:bg-[#00a884] data-[state=active]:text-white ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                  Atendente
                </TabsTrigger>
                <TabsTrigger value="department" className="flex-1 data-[state=active]:bg-[#00a884] data-[state=active]:text-white ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0">
                  Departamento
                </TabsTrigger>
              </TabsList>
              <TabsContent value="agent" className="mt-4">
                <Select
                  value={transferTarget.id}
                  onValueChange={(value) => setTransferTarget({ ...transferTarget, id: value })}
                >
                  <SelectTrigger className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]">
                    <SelectValue placeholder="Selecione um atendente" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#233138] border-[#3b4a54]">
                    {agents.filter(a => a.is_online && a.id !== selectedConversation?.agent_id).map((agent) => (
                      <SelectItem key={agent.id} value={agent.id} className="text-[#e9edef]">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[#00a884]" />
                          {agent.user?.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
              <TabsContent value="department" className="mt-4">
                <Select
                  value={transferTarget.id}
                  onValueChange={(value) => setTransferTarget({ ...transferTarget, id: value })}
                >
                  <SelectTrigger className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]">
                    <SelectValue placeholder="Selecione um departamento" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#233138] border-[#3b4a54]">
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id} className="text-[#e9edef]">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dept.color }} />
                          {dept.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)} className="border-[#3b4a54] text-[#8696a0]">
              Cancelar
            </Button>
            <Button className="bg-[#00a884] hover:bg-[#00a884]/90 text-white border-0 ring-0 ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0" disabled={!transferTarget.id}>
              Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmations */}
      <AlertDialog open={!!deletingDepartmentId} onOpenChange={(open) => !open && setDeletingDepartmentId(null)}>
        <AlertDialogContent className="bg-[#2a3942] border-[#3b4a54]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#e9edef]">Excluir departamento?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#8696a0]">
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#3b4a54] text-[#8696a0]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => deletingDepartmentId && deleteDepartment(deletingDepartmentId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingAgentId} onOpenChange={(open) => !open && setDeletingAgentId(null)}>
        <AlertDialogContent className="bg-[#2a3942] border-[#3b4a54]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#e9edef]">Remover atendente?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#8696a0]">
              O usuário não poderá mais atender conversas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#3b4a54] text-[#8696a0]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => deletingAgentId && deleteAgent(deletingAgentId)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tag Dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef]">
          <DialogHeader>
            <DialogTitle>
              {editingTag ? "Editar Tag" : "Nova Tag"}
            </DialogTitle>
            <DialogDescription className="text-[#8696a0]">
              Tags ajudam a organizar suas conversas
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name" className="text-[#8696a0]">Nome</Label>
              <Input
                id="tag-name"
                value={tagForm.name}
                onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                placeholder="Ex: Urgente, VIP, Suporte"
                className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag-description" className="text-[#8696a0]">Descrição</Label>
              <Textarea
                id="tag-description"
                value={tagForm.description}
                onChange={(e) => setTagForm({ ...tagForm, description: e.target.value })}
                placeholder="Descrição opcional"
                rows={2}
                className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#8696a0]">Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tagForm.color}
                  onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                  className="h-10 w-10 rounded border-0 cursor-pointer"
                />
                <Input
                  value={tagForm.color}
                  onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                  className="flex-1 bg-[#202c33] border-[#3b4a54] text-[#e9edef]"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)} className="border-[#3b4a54] text-[#8696a0]">
              Cancelar
            </Button>
            <Button onClick={saveTag} disabled={savingTag} className="bg-[#00a884] hover:bg-[#00a884]/90">
              {savingTag ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Tag Confirmation */}
      <AlertDialog open={!!deletingTagId} onOpenChange={(open) => !open && setDeletingTagId(null)}>
        <AlertDialogContent className="bg-[#2a3942] border-[#3b4a54]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#e9edef]">Excluir tag?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#8696a0]">
              A tag será removida de todas as conversas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#3b4a54] text-[#8696a0]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => deletingTagId && deleteTag(deletingTagId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Client Quick Edit Sheet */}
      <ClientQuickEditSheet
        clientId={editingClientId}
        open={clientEditSheetOpen}
        onOpenChange={setClientEditSheetOpen}
        onClientUpdated={() => fetchData()}
      />
    </div>
  );
}
