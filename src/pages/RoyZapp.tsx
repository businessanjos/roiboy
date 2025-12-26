import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageSquare,
  Users,
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
} from "lucide-react";
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
  role: "admin" | "supervisor" | "agent";
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
  };
  department?: Department | null;
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
}

interface Message {
  id: string;
  content: string | null;
  is_from_client: boolean;
  created_at: string;
  message_type: string;
}

interface ConversationAssignment {
  id: string;
  conversation_id: string;
  agent_id: string | null;
  department_id: string | null;
  status: "pending" | "active" | "waiting" | "closed";
  priority: number;
  assigned_at: string | null;
  first_response_at: string | null;
  closed_at: string | null;
  created_at: string;
  agent?: Agent | null;
  department?: Department | null;
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
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  agent: "Atendente",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: "Aguardando", color: "text-amber-600", bgColor: "bg-amber-500" },
  active: { label: "Em atendimento", color: "text-emerald-600", bgColor: "bg-emerald-500" },
  waiting: { label: "Aguardando cliente", color: "text-blue-600", bgColor: "bg-blue-500" },
  closed: { label: "Fechado", color: "text-muted-foreground", bgColor: "bg-muted-foreground" },
};

export default function RoyZapp() {
  const { currentUser } = useCurrentUser();
  const [activeView, setActiveView] = useState<"inbox" | "team" | "departments" | "settings">("inbox");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [assignments, setAssignments] = useState<ConversationAssignment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedConversation, setSelectedConversation] = useState<ConversationAssignment | null>(null);
  const [messageInput, setMessageInput] = useState("");

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
    role: "agent" as "admin" | "supervisor" | "agent",
    max_concurrent_chats: 5,
  });
  const [savingAgent, setSavingAgent] = useState(false);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);

  // Transfer dialog
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<{ type: "agent" | "department"; id: string }>({ type: "agent", id: "" });

  useEffect(() => {
    if (currentUser?.account_id) {
      fetchData();
    }
  }, [currentUser?.account_id]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.conversation_id);
    }
  }, [selectedConversation]);

  const fetchData = async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);

    try {
      const [
        { data: depts, error: deptsError },
        { data: agentsData, error: agentsError },
        { data: usersData, error: usersError },
        { data: assignmentsData, error: assignmentsError },
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
            user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url),
            department:zapp_departments(*)
          `)
          .eq("account_id", currentUser.account_id)
          .order("created_at"),
        supabase
          .from("users")
          .select("id, name, email, avatar_url, role")
          .eq("account_id", currentUser.account_id)
          .order("name"),
        supabase
          .from("zapp_conversation_assignments")
          .select(`
            *,
            agent:zapp_agents(*, user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url)),
            department:zapp_departments(*),
            conversation:conversations(id, client_id, client:clients(id, full_name, phone_e164, avatar_url))
          `)
          .eq("account_id", currentUser.account_id)
          .neq("status", "closed")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (deptsError) throw deptsError;
      if (agentsError) throw agentsError;
      if (usersError) throw usersError;
      if (assignmentsError) throw assignmentsError;

      setDepartments(depts || []);
      setAgents(agentsData || []);
      setTeamUsers(usersData || []);
      setAssignments(assignmentsData || []);
    } catch (error: any) {
      console.error("Error fetching zapp data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from("message_events")
        .select("id, raw_text, is_from_client, created_at, message_type")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages((data || []).map((m: any) => ({
        id: m.id,
        content: m.raw_text,
        is_from_client: m.is_from_client,
        created_at: m.created_at,
        message_type: m.message_type,
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
        role: agent.role,
        max_concurrent_chats: agent.max_concurrent_chats,
      });
    } else {
      setEditingAgent(null);
      setAgentForm({
        user_id: "",
        department_id: "",
        role: "agent",
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
            role: agentForm.role,
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
          role: agentForm.role,
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

  // Filter users not already agents
  const availableUsers = teamUsers.filter(
    (user) => !agents.some((agent) => agent.user_id === user.id) || editingAgent?.user_id === user.id
  );

  // Filtered conversations
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const matchesSearch = searchQuery === "" ||
        a.conversation?.client?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.conversation?.client?.phone_e164?.includes(searchQuery);
      const matchesStatus = filterStatus === "all" || a.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [assignments, searchQuery, filterStatus]);

  // Stats
  const onlineAgents = agents.filter((a) => a.is_online && a.is_active).length;
  const pendingConversations = assignments.filter((a) => a.status === "pending").length;
  const activeConversations = assignments.filter((a) => a.status === "active").length;

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-zapp-bg">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-zapp-accent flex items-center justify-center">
            <MessageSquare className="h-8 w-8 text-white" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-zapp-accent mx-auto" />
          <p className="text-zapp-text-muted">Carregando conversas...</p>
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
              activeView === "team" ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
            )}
            onClick={() => setActiveView("team")}
          >
            <Users className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Equipe</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full h-10 w-10",
              activeView === "departments" ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
            )}
            onClick={() => setActiveView("departments")}
          >
            <Building2 className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Departamentos</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full h-10 w-10",
              activeView === "settings" ? "bg-zapp-panel text-zapp-accent" : "text-zapp-text-muted hover:bg-zapp-panel"
            )}
            onClick={() => setActiveView("settings")}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Configurações</TooltipContent>
      </Tooltip>

      <div className="flex-1" />

      {/* Status indicators */}
      <div className="flex items-center gap-3 px-2 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-zapp-accent" />
          <span className="text-zapp-text-muted">{onlineAgents} online</span>
        </div>
        {pendingConversations > 0 && (
          <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
            {pendingConversations}
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
            <DropdownMenuContent align="end" className="bg-zapp-panel border-zapp-border">
              <DropdownMenuItem 
                className={cn("text-zapp-text", filterStatus === "all" && "bg-zapp-bg-dark")}
                onClick={() => setFilterStatus("all")}
              >
                Todas
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn("text-zapp-text", filterStatus === "pending" && "bg-zapp-bg-dark")}
                onClick={() => setFilterStatus("pending")}
              >
                Aguardando
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn("text-zapp-text", filterStatus === "active" && "bg-zapp-bg-dark")}
                onClick={() => setFilterStatus("active")}
              >
                Em atendimento
              </DropdownMenuItem>
              <DropdownMenuItem 
                className={cn("text-zapp-text", filterStatus === "waiting" && "bg-zapp-bg-dark")}
                onClick={() => setFilterStatus("waiting")}
              >
                Aguardando cliente
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" className="text-zapp-text-muted hover:bg-zapp-panel rounded-full">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 bg-zapp-bg">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zapp-text-muted" />
          <Input
            placeholder="Pesquisar ou começar uma nova conversa"
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
              filteredAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zapp-panel transition-colors",
                    selectedConversation?.id === assignment.id && "bg-zapp-bg-dark"
                  )}
                  onClick={() => setSelectedConversation(assignment)}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={assignment.conversation?.client?.avatar_url || undefined} />
                      <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                        {assignment.conversation?.client?.full_name
                          ? getInitials(assignment.conversation.client.full_name)
                          : "?"}
                      </AvatarFallback>
                    </Avatar>
                    {assignment.status === "pending" && (
                      <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 border-2 border-zapp-bg" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-zapp-text font-medium truncate">
                        {assignment.conversation?.client?.full_name || "Cliente"}
                      </span>
                      <span className="text-zapp-text-muted text-xs">
                        {formatTime(assignment.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {assignment.status === "active" && (
                          <CheckCheck className="h-4 w-4 text-info flex-shrink-0" />
                        )}
                        <span className="text-zapp-text-muted text-sm truncate">
                          {assignment.last_message || assignment.conversation?.client?.phone_e164 || "Nova conversa"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {assignment.department && (
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: assignment.department.color }}
                          />
                        )}
                        {assignment.unread_count && assignment.unread_count > 0 && (
                          <Badge className="bg-zapp-accent text-white text-[10px] px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
                            {assignment.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeView === "team" && renderTeamList()}
        {activeView === "departments" && renderDepartmentList()}
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
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-zapp-border text-zapp-text-muted">
                    {ROLE_LABELS[agent.role]}
                  </Badge>
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

  // Render settings panel
  const renderSettingsPanel = () => (
    <div className="p-4 space-y-6">
      <h3 className="text-zapp-text font-medium">Configurações</h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-zapp-panel rounded-lg">
          <div>
            <p className="text-zapp-text text-sm">Distribuição round-robin</p>
            <p className="text-zapp-text-muted text-xs">Distribui igualmente entre atendentes</p>
          </div>
          <Switch defaultChecked className="data-[state=checked]:bg-zapp-accent" />
        </div>

        <div className="flex items-center justify-between p-3 bg-zapp-panel rounded-lg">
          <div>
            <p className="text-zapp-text text-sm">Respeitar limite</p>
            <p className="text-zapp-text-muted text-xs">Não atribuir se atingiu o máximo</p>
          </div>
          <Switch defaultChecked className="data-[state=checked]:bg-zapp-accent" />
        </div>

        <div className="flex items-center justify-between p-3 bg-zapp-panel rounded-lg">
          <div>
            <p className="text-zapp-text text-sm">Som de nova conversa</p>
            <p className="text-zapp-text-muted text-xs">Tocar som ao receber mensagem</p>
          </div>
          <Switch defaultChecked className="data-[state=checked]:bg-zapp-accent" />
        </div>
      </div>
    </div>
  );

  // Render chat view
  const renderChatView = () => {
    if (!selectedConversation) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-zapp-bg-dark relative overflow-hidden">
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
              <span className="text-zapp-text-muted">{pendingConversations} aguardando</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-zapp-accent" />
              <span className="text-zapp-text-muted">{activeConversations} em atendimento</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col bg-zapp-bg">
        {/* Chat header */}
        <div className="bg-zapp-panel-header px-4 py-2 flex items-center gap-3 border-b border-zapp-border">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-[#aebac1] hover:bg-[#2a3942]"
            onClick={() => setSelectedConversation(null)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10">
            <AvatarImage src={selectedConversation.conversation?.client?.avatar_url || undefined} />
            <AvatarFallback className="bg-[#6b7c85] text-white text-sm">
              {selectedConversation.conversation?.client?.full_name
                ? getInitials(selectedConversation.conversation.client.full_name)
                : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-[#e9edef] font-medium truncate">
              {selectedConversation.conversation?.client?.full_name || "Cliente"}
            </h3>
            <p className="text-[#8696a0] text-xs">
              {selectedConversation.conversation?.client?.phone_e164}
              {selectedConversation.agent?.user && (
                <span> • Atendido por {selectedConversation.agent.user.name}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                STATUS_CONFIG[selectedConversation.status].color,
                "border-current"
              )}
            >
              {STATUS_CONFIG[selectedConversation.status].label}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="text-[#aebac1] hover:bg-[#2a3942]"
              onClick={() => setTransferDialogOpen(true)}
            >
              <ArrowRightLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-[#aebac1] hover:bg-[#2a3942]">
              <Phone className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-[#aebac1] hover:bg-[#2a3942]">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-2">
          <div className="space-y-1 max-w-3xl mx-auto">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[#8696a0] text-sm">Nenhuma mensagem ainda</p>
              </div>
            ) : (
              messages.map((message, index) => {
                const showTimestamp = index === 0 ||
                  new Date(message.created_at).toDateString() !== new Date(messages[index - 1].created_at).toDateString();

                return (
                  <div key={message.id}>
                    {showTimestamp && (
                      <div className="flex justify-center my-3">
                        <span className="bg-[#182229] text-[#8696a0] text-xs px-3 py-1 rounded-lg shadow">
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
                          ? "bg-[#202c33] rounded-tl-none"
                          : "bg-[#005c4b] rounded-tr-none"
                      )}>
                        <p className="text-[#e9edef] text-sm whitespace-pre-wrap break-words">
                          {message.content || "[Mensagem de mídia]"}
                        </p>
                        <div className={cn(
                          "flex items-center justify-end gap-1 mt-1",
                          message.is_from_client ? "text-[#8696a0]" : "text-[#ffffff99]"
                        )}>
                          <span className="text-[10px]">
                            {format(new Date(message.created_at), "HH:mm")}
                          </span>
                          {!message.is_from_client && (
                            <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
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

        {/* Message input */}
        <div className="bg-[#202c33] px-4 py-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-[#8696a0] hover:bg-[#2a3942] flex-shrink-0">
            <Smile className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" className="text-[#8696a0] hover:bg-[#2a3942] flex-shrink-0">
            <Paperclip className="h-6 w-6" />
          </Button>
          <Input
            placeholder="Digite uma mensagem"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            className="flex-1 bg-[#2a3942] border-0 text-[#d1d7db] placeholder:text-[#8696a0] focus-visible:ring-0 rounded-lg h-10"
          />
          <Button
            variant="ghost"
            size="icon"
            className="text-[#8696a0] hover:bg-[#2a3942] flex-shrink-0"
          >
            {messageInput.trim() ? (
              <Send className="h-6 w-6 text-[#00a884]" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-48px)] flex bg-zapp-bg overflow-hidden">
      {/* Left panel - Conversation list */}
      <div className={cn(
        "w-full lg:w-[400px] flex-shrink-0 border-r border-zapp-border flex flex-col",
        selectedConversation && "hidden lg:flex"
      )}>
        {renderConversationList()}
      </div>

      {/* Right panel - Chat view */}
      <div className={cn(
        "flex-1 flex flex-col",
        !selectedConversation && "hidden lg:flex"
      )}>
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
              <Label className="text-[#8696a0]">Cargo</Label>
              <Select
                value={agentForm.role}
                onValueChange={(value: "admin" | "supervisor" | "agent") => setAgentForm({ ...agentForm, role: value })}
              >
                <SelectTrigger className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#233138] border-[#3b4a54]">
                  <SelectItem value="admin" className="text-[#e9edef]">Administrador</SelectItem>
                  <SelectItem value="supervisor" className="text-[#e9edef]">Supervisor</SelectItem>
                  <SelectItem value="agent" className="text-[#e9edef]">Atendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[#8696a0]">Departamento</Label>
              <Select
                value={agentForm.department_id}
                onValueChange={(value) => setAgentForm({ ...agentForm, department_id: value })}
              >
                <SelectTrigger className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="bg-[#233138] border-[#3b4a54]">
                  <SelectItem value="" className="text-[#e9edef]">Todos</SelectItem>
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
                <TabsTrigger value="agent" className="flex-1 data-[state=active]:bg-[#00a884] data-[state=active]:text-white">
                  Atendente
                </TabsTrigger>
                <TabsTrigger value="department" className="flex-1 data-[state=active]:bg-[#00a884] data-[state=active]:text-white">
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
            <Button className="bg-[#00a884] hover:bg-[#00a884]/90" disabled={!transferTarget.id}>
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
    </div>
  );
}
