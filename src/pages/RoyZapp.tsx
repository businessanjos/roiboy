import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import {
  MessageSquare,
  Users,
  Inbox,
  ArrowRightLeft,
  Building2,
  UserCheck,
  Settings,
  Plus,
  Trash2,
  Pencil,
  Circle,
  Phone,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  agent: "Atendente",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/10 text-red-500 border-red-500/20",
  supervisor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  agent: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Aguardando",
  active: "Em atendimento",
  waiting: "Esperando cliente",
  closed: "Fechado",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  waiting: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  closed: "bg-muted text-muted-foreground border-border",
};

export default function RoyZapp() {
  const { currentUser } = useCurrentUser();
  const [activeTab, setActiveTab] = useState("inbox");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [assignments, setAssignments] = useState<ConversationAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Department dialog state
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentForm, setDepartmentForm] = useState({
    name: "",
    description: "",
    color: "#6366f1",
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

  useEffect(() => {
    if (currentUser?.account_id) {
      fetchData();
    }
  }, [currentUser?.account_id]);

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
          .limit(50),
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
        color: "#6366f1",
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            ROY zAPP
          </h1>
          <p className="text-muted-foreground">
            Central de atendimento multiusuário via WhatsApp
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <UserCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{onlineAgents}</p>
                <p className="text-sm text-muted-foreground">Atendentes online</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingConversations}</p>
                <p className="text-sm text-muted-foreground">Aguardando</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeConversations}</p>
                <p className="text-sm text-muted-foreground">Em atendimento</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{departments.length}</p>
                <p className="text-sm text-muted-foreground">Departamentos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="inbox" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            <span className="hidden sm:inline">Inbox</span>
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Atendentes</span>
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Filas</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Conversas Ativas</CardTitle>
              <CardDescription>
                Gerencie as conversas em andamento e atribua atendentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <div className="text-center py-8">
                  <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma conversa ativa no momento</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Atendente</TableHead>
                      <TableHead>Iniciada em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={assignment.conversation?.client?.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {assignment.conversation?.client?.full_name
                                  ? getInitials(assignment.conversation.client.full_name)
                                  : "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">
                                {assignment.conversation?.client?.full_name || "Desconhecido"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {assignment.conversation?.client?.phone_e164}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[assignment.status]}>
                            {STATUS_LABELS[assignment.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {assignment.department ? (
                            <Badge
                              variant="outline"
                              style={{
                                borderColor: assignment.department.color,
                                color: assignment.department.color,
                              }}
                            >
                              {assignment.department.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {assignment.agent?.user ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={assignment.agent.user.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(assignment.agent.user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{assignment.agent.user.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Não atribuído</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(assignment.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Equipe de Atendimento</h3>
              <p className="text-sm text-muted-foreground">
                Gerencie os atendentes e suas permissões
              </p>
            </div>
            <Button onClick={() => openAgentDialog()} disabled={availableUsers.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Atendente
            </Button>
          </div>

          <div className="grid gap-4">
            {agents.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum atendente cadastrado</p>
                  <Button className="mt-4" onClick={() => openAgentDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Primeiro Atendente
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Atendente</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Atendimentos</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={agent.user?.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {agent.user ? getInitials(agent.user.name) : "?"}
                                </AvatarFallback>
                              </Avatar>
                              <Circle
                                className={cn(
                                  "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                                  agent.is_online ? "fill-green-500 text-green-500" : "fill-muted text-muted"
                                )}
                              />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{agent.user?.name}</p>
                              <p className="text-xs text-muted-foreground">{agent.user?.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ROLE_COLORS[agent.role]}>
                            {ROLE_LABELS[agent.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {agent.department ? (
                            <Badge
                              variant="outline"
                              style={{
                                borderColor: agent.department.color,
                                color: agent.department.color,
                              }}
                            >
                              {agent.department.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Todos</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={agent.is_online}
                            onCheckedChange={() => toggleAgentOnline(agent)}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {agent.current_chats}/{agent.max_concurrent_chats}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openAgentDialog(agent)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeletingAgentId(agent.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Departamentos / Filas</h3>
              <p className="text-sm text-muted-foreground">
                Organize os atendimentos por departamento
              </p>
            </div>
            <Button onClick={() => openDepartmentDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Departamento
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {departments.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum departamento cadastrado</p>
                  <Button className="mt-4" onClick={() => openDepartmentDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Departamento
                  </Button>
                </CardContent>
              </Card>
            ) : (
              departments.map((dept) => (
                <Card key={dept.id} className="relative overflow-hidden">
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: dept.color }}
                  />
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: dept.color }}
                        />
                        <CardTitle className="text-base">{dept.name}</CardTitle>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openDepartmentDialog(dept)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingDepartmentId(dept.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {dept.description && (
                      <CardDescription className="text-xs">{dept.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Distribuição automática</span>
                      <Badge variant={dept.auto_distribution ? "default" : "secondary"}>
                        {dept.auto_distribution ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Atendentes</span>
                      <span className="font-medium">
                        {agents.filter((a) => a.department_id === dept.id).length}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configurações do ROY zAPP</CardTitle>
              <CardDescription>
                Configure as opções gerais do sistema de atendimento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium">Distribuição Automática</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Round-robin</p>
                    <p className="text-xs text-muted-foreground">
                      Distribui conversas igualmente entre atendentes online
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Respeitar limite de atendimentos</p>
                    <p className="text-xs text-muted-foreground">
                      Não atribuir se atendente atingiu o máximo
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Notificações</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Som de nova conversa</p>
                    <p className="text-xs text-muted-foreground">
                      Tocar som ao receber nova conversa
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Department Dialog */}
      <Dialog open={departmentDialogOpen} onOpenChange={setDepartmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? "Editar Departamento" : "Novo Departamento"}
            </DialogTitle>
            <DialogDescription>
              Departamentos organizam as conversas por área de atendimento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dept-name">Nome</Label>
              <Input
                id="dept-name"
                value={departmentForm.name}
                onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                placeholder="Ex: Vendas, Suporte, Financeiro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-description">Descrição</Label>
              <Textarea
                id="dept-description"
                value={departmentForm.description}
                onChange={(e) =>
                  setDepartmentForm({ ...departmentForm, description: e.target.value })
                }
                placeholder="Descreva a função deste departamento"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-color">Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="dept-color"
                  value={departmentForm.color}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, color: e.target.value })}
                  className="h-10 w-10 rounded border cursor-pointer"
                />
                <Input
                  value={departmentForm.color}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Distribuição Automática</Label>
                <p className="text-xs text-muted-foreground">
                  Atribuir conversas automaticamente aos atendentes
                </p>
              </div>
              <Switch
                checked={departmentForm.auto_distribution}
                onCheckedChange={(checked) =>
                  setDepartmentForm({ ...departmentForm, auto_distribution: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepartmentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveDepartment} disabled={savingDepartment}>
              {savingDepartment ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent Dialog */}
      <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAgent ? "Editar Atendente" : "Adicionar Atendente"}
            </DialogTitle>
            <DialogDescription>
              Configure as permissões e departamento do atendente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Select
                value={agentForm.user_id}
                onValueChange={(value) => setAgentForm({ ...agentForm, user_id: value })}
                disabled={!!editingAgent}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{user.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select
                value={agentForm.role}
                onValueChange={(value: "admin" | "supervisor" | "agent") =>
                  setAgentForm({ ...agentForm, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="agent">Atendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select
                value={agentForm.department_id}
                onValueChange={(value) => setAgentForm({ ...agentForm, department_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os departamentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os departamentos</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: dept.color }}
                        />
                        {dept.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Máximo de atendimentos simultâneos</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={agentForm.max_concurrent_chats}
                onChange={(e) =>
                  setAgentForm({ ...agentForm, max_concurrent_chats: parseInt(e.target.value) || 5 })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveAgent} disabled={savingAgent}>
              {savingAgent ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Department Confirmation */}
      <AlertDialog
        open={!!deletingDepartmentId}
        onOpenChange={(open) => !open && setDeletingDepartmentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir departamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As conversas e atendentes deste departamento serão
              desvinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingDepartmentId && deleteDepartment(deletingDepartmentId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Agent Confirmation */}
      <AlertDialog
        open={!!deletingAgentId}
        onOpenChange={(open) => !open && setDeletingAgentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover atendente?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário será removido da equipe de atendimento e não poderá mais atender conversas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
