import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { 
  Plus, Search, Pencil, User, Users, Camera, Loader2, 
  Shield, Trash2, Settings, Check, Mail, LayoutGrid, List, Eye, EyeOff, Lock, Sparkles
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions, PERMISSIONS } from "@/hooks/usePermissions";

/**
 * Roles considered "CX scope". A Supervisor CX (team.edit_cx without admin)
 * can only see and assign these roles. Match by area or by name prefix to
 * cover the legacy CX/CS roles that don't have area populated yet.
 */
function isCxScopedRole(role: { name?: string | null; area?: string | null }): boolean {
  const name = (role?.name || "").trim().toUpperCase();
  const area = (role?.area || "").toLowerCase();
  if (area.includes("customer")) return true;
  return /^CX(\b|\s|$)|^CS(\b|\s|$)|SUPERVISOR\s+CX|CUSTOMER/.test(name);
}

// Password input component with toggle visibility
function PasswordInput({ 
  id, 
  value, 
  onChange, 
  placeholder 
}: { 
  id: string; 
  value: string; 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  placeholder?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  
  return (
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="bg-card pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
        onClick={() => setShowPassword(!showPassword)}
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Eye className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}

interface TeamRole {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_system: boolean;
  display_order: number;
  permissions?: string[];
  area?: string | null;
  cargo?: string | null;
  seniority?: string | null;
}

const ROLE_AREAS = [
  "Comercial", "Marketing", "Pessoas", "Financeiro",
  "Customer Success", "Customer Experience", "Administrativo", "Tech", "Jurídico",
];

const CARGOS_POR_AREA: Record<string, string[]> = {
  "Comercial": ["SDR", "BDR", "Closer", "Vendedor", "Consultor", "Executivo de Contas", "Assistente", "Analista", "Coordenador", "Gerente", "Diretor", "Head"],
  "Marketing": ["Social Media", "Designer", "Copywriter", "Analista de Mídia", "Assistente", "Analista", "Coordenador", "Gerente", "Diretor", "Head"],
  "Pessoas": ["Recrutador", "Analista de RH", "Assistente", "Analista", "Coordenador", "Gerente", "Diretor", "Head"],
  "Financeiro": ["Assistente Financeiro", "Analista Financeiro", "Controller", "Assistente", "Analista", "Coordenador", "Gerente", "Diretor", "Head"],
  "Customer Success": ["CSM", "Onboarding Specialist", "Assistente", "Analista", "Coordenador", "Gerente", "Diretor", "Head"],
  "Customer Experience": ["CX Analyst", "CX Specialist", "Assistente", "Analista", "Coordenador", "Gerente", "Diretor", "Head"],
  "Administrativo": ["Recepcionista", "Assistente Administrativo", "Assistente", "Analista", "Coordenador", "Gerente", "Diretor", "Head"],
  "Tech": ["Desenvolvedor", "DevOps", "QA", "Product Manager", "Assistente", "Analista", "Coordenador", "Gerente", "Diretor", "Head"],
  "Jurídico": ["Advogado", "Paralegal", "Assistente", "Analista", "Coordenador", "Gerente", "Diretor", "Head"],
};

const SENIORITY_LEVELS = ["Estagiário", "Júnior", "Pleno", "Sênior", "Especialista"];

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  auth_user_id: string | null;
  avatar_url: string | null;
  team_role_id: string | null;
  team_role?: TeamRole;
  team_roles?: TeamRole[];
  is_also_admin?: boolean;
}

const PERMISSION_LABELS: Record<string, { label: string; category: string }> = {
  "clients.view": { label: "Ver clientes", category: "Clientes" },
  "clients.edit": { label: "Editar clientes", category: "Clientes" },
  "clients.delete": { label: "Excluir clientes", category: "Clientes" },
  "team.view": { label: "Ver equipe", category: "Equipe" },
  "team.edit": { label: "Gerenciar equipe", category: "Equipe" },
  "settings.view": { label: "Ver configurações", category: "Configurações" },
  "settings.edit": { label: "Editar configurações", category: "Configurações" },
  "reports.view": { label: "Ver relatórios", category: "Relatórios" },
  "events.view": { label: "Ver eventos", category: "Eventos" },
  "events.edit": { label: "Gerenciar eventos", category: "Eventos" },
  "forms.view": { label: "Ver formulários", category: "Formulários" },
  "forms.edit": { label: "Gerenciar formulários", category: "Formulários" },
  "products.view": { label: "Ver produtos", category: "Produtos" },
  "products.edit": { label: "Gerenciar produtos", category: "Produtos" },
  "royzapp.access": { label: "Acessar ROY zAPP", category: "ROY zAPP" },
};

const PERMISSION_HELP: Record<string, string> = {
  "royzapp.access": "Os setores que o usuário pode acessar são definidos na aba Setores",
};

const PERMISSION_CATEGORIES = ["Clientes", "Equipe", "Relatórios", "Eventos", "Formulários", "Produtos", "Configurações", "ROY zAPP"];

const DEFAULT_ROLE_COLORS = [
  "hsl(0, 72%, 51%)",
  "hsl(39, 55%, 63%)",
  "hsl(180, 13%, 36%)",
  "hsl(152, 69%, 31%)",
  "hsl(262, 52%, 47%)",
  "hsl(199, 89%, 48%)",
];

export function TeamManager() {
  const { isAdmin, hasPermission } = usePermissions();
  // Supervisor CX (non-admin with team.edit_cx) is scoped: sees only CX
  // members and assigns only CX roles. Hides admin toggle and Funções tab.
  const cxScopeOnly = !isAdmin && hasPermission(PERMISSIONS.TEAM_EDIT_CX);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("members");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [rolesViewMode, setRolesViewMode] = useState<"grid" | "list">("grid");
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TeamUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<TeamUser | null>(null);
  
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TeamRole | null>(null);
  
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRoleIds, setFormRoleIds] = useState<string[]>([]);
  const [formIsAlsoAdmin, setFormIsAlsoAdmin] = useState(false);
  const [formAvatarUrl, setFormAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [roleFormName, setRoleFormName] = useState("");
  const [roleFormDescription, setRoleFormDescription] = useState("");
  const [roleFormColor, setRoleFormColor] = useState("hsl(39, 55%, 63%)");
  const [roleFormPermissions, setRoleFormPermissions] = useState<string[]>([]);
  const [roleFormArea, setRoleFormArea] = useState("");
  const [roleFormCargo, setRoleFormCargo] = useState("");
  const [roleFormSeniority, setRoleFormSeniority] = useState("");
  const [generatingDescription, setGeneratingDescription] = useState(false);

  const handleGenerateDescription = async () => {
    if (!roleFormArea || !roleFormCargo) {
      toast.error("Selecione Área e Cargo antes de gerar a descrição");
      return;
    }
    setGeneratingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-role-description", {
        body: { area: roleFormArea, cargo: roleFormCargo, seniority: roleFormSeniority || null },
      });
      if (error) throw error;
      if (data?.description) {
        setRoleFormDescription(data.description);
        toast.success("Descrição gerada com sucesso!");
      }
    } catch (err: any) {
      console.error("Error generating description:", err);
      toast.error("Erro ao gerar descrição");
    } finally {
      setGeneratingDescription(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: currentUser, error: currentUserError } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", authUser.id)
        .single();

      if (currentUserError) throw currentUserError;
      if (!currentUser) return;

      const { data: rolesData, error: rolesError } = await supabase
        .from("team_roles")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .order("display_order");

      if (rolesError) throw rolesError;

      const rolesWithPermissions = await Promise.all(
        (rolesData || []).map(async (role) => {
          const { data: perms } = await supabase
            .from("role_permissions")
            .select("permission")
            .eq("role_id", role.id);
          return { ...role, permissions: perms?.map(p => p.permission) || [] };
        })
      );

      setRoles(rolesWithPermissions);

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .order("name");

      if (usersError) throw usersError;

      // Fetch user_team_roles junction data
      const { data: userRolesData } = await supabase
        .from("user_team_roles")
        .select("user_id, team_role_id");

      const usersWithRoles = (usersData || []).map(user => {
        const userRoleIds = (userRolesData || [])
          .filter(ur => ur.user_id === user.id)
          .map(ur => ur.team_role_id);
        const userTeamRoles = rolesWithPermissions.filter(r => userRoleIds.includes(r.id));
        return {
          ...user,
          team_role: userTeamRoles[0] || rolesWithPermissions.find(r => r.id === user.team_role_id),
          team_roles: userTeamRoles.length > 0 ? userTeamRoles : (user.team_role_id ? [rolesWithPermissions.find(r => r.id === user.team_role_id)].filter(Boolean) : []),
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!formName || !formEmail || !formPassword) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (formPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        setIsSubmitting(false);
        return;
      }

      const { data: currentUser } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", session.user.id)
        .single();

      if (!currentUser) {
        toast.error("Erro ao obter conta do usuário");
        setIsSubmitting(false);
        return;
      }

      const response = await supabase.functions.invoke("create-team-user", {
        body: {
          name: formName,
          email: formEmail,
          password: formPassword,
          account_id: currentUser.account_id,
          team_role_ids: formRoleIds.length > 0 ? formRoleIds : null,
          team_role_id: formRoleIds[0] || null,
          is_also_admin: formIsAlsoAdmin,
        },
      });

      // Check for specific error message from edge function first
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      // Handle SDK error, but try to extract the real message
      if (response.error) {
        const errorMessage = await extractEdgeFunctionError(response.error, "Erro ao criar usuário");
        throw new Error(errorMessage);
      }

      toast.success("Membro adicionado com sucesso! Ele já pode fazer login.");
      setIsAddDialogOpen(false);
      resetMemberForm();
      fetchData();
    } catch (error: any) {
      console.error("Error adding user:", error);
      toast.error(error.message || "Erro ao adicionar membro");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);

    try {
      // Update user profile (keep team_role_id as primary for backward compat)
      const { error } = await supabase
        .from("users")
        .update({ 
          name: formName, 
          email: formEmail,
          team_role_id: formRoleIds[0] || null,
          is_also_admin: formIsAlsoAdmin,
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      // Sync user_team_roles junction table
      await supabase
        .from("user_team_roles")
        .delete()
        .eq("user_id", selectedUser.id);

      if (formRoleIds.length > 0) {
        const { error: rolesError } = await supabase
          .from("user_team_roles")
          .insert(formRoleIds.map(roleId => ({
            user_id: selectedUser.id,
            team_role_id: roleId,
          })));
        if (rolesError) console.error("Error syncing user roles:", rolesError);
      }

      // If password was provided, update it via edge function
      if (formPassword && formPassword.length >= 6 && selectedUser.auth_user_id) {
        const response = await supabase.functions.invoke("update-team-user-password", {
          body: {
            user_id: selectedUser.id,
            new_password: formPassword,
          },
        });

        if (response.error) {
          const errorMessage = await extractEdgeFunctionError(response.error, "Erro ao atualizar senha");
          throw new Error(errorMessage);
        }

        if (response.data?.error) {
          throw new Error(response.data.error);
        }

        toast.success("Membro e senha atualizados com sucesso!");
      } else {
        toast.success("Membro atualizado com sucesso");
      }

      setIsEditDialogOpen(false);
      setSelectedUser(null);
      resetMemberForm();
      fetchData();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error(error.message || "Erro ao atualizar membro");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetMemberForm = () => {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRoleIds([]);
    setFormIsAlsoAdmin(false);
    setFormAvatarUrl(null);
  };

  const openEditMemberDialog = (user: TeamUser) => {
    setSelectedUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword("");
    setFormRoleIds((user.team_roles || []).map(r => r.id));
    setFormIsAlsoAdmin(user.is_also_admin || false);
    setFormAvatarUrl(user.avatar_url);
    setIsEditDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsSubmitting(true);

    try {
      const response = await supabase.functions.invoke("delete-team-user", {
        body: { user_id: userToDelete.id },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erro ao excluir usuário");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success("Usuário excluído com sucesso!");
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Erro ao excluir usuário");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteDialog = (user: TeamUser, e: React.MouseEvent) => {
    e.stopPropagation();
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedUser) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB");
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const uniqueId = selectedUser.auth_user_id || selectedUser.id;
      const fileName = `${uniqueId}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      setFormAvatarUrl(avatarUrl);

      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: avatarUrl })
        .eq("id", selectedUser.id);

      if (updateError) throw updateError;

      setSelectedUser({ ...selectedUser, avatar_url: avatarUrl });
      toast.success("Foto atualizada!");
      fetchData();
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast.error(error.message || "Erro ao enviar foto");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const openRoleDialog = (role?: TeamRole) => {
    if (role) {
      setSelectedRole(role);
      setRoleFormName(role.name);
      setRoleFormDescription(role.description || "");
      setRoleFormColor(role.color);
      setRoleFormPermissions(role.permissions || []);
      setRoleFormArea((role as any).area || "");
      setRoleFormCargo((role as any).cargo || "");
      setRoleFormSeniority((role as any).seniority || "");
    } else {
      setSelectedRole(null);
      setRoleFormName("");
      setRoleFormDescription("");
      setRoleFormColor(DEFAULT_ROLE_COLORS[roles.length % DEFAULT_ROLE_COLORS.length]);
      setRoleFormPermissions([]);
      setRoleFormArea("");
      setRoleFormCargo("");
      setRoleFormSeniority("");
    }
    setIsRoleDialogOpen(true);
  };

  const handleSaveRole = async () => {
    const generatedName = [roleFormArea, roleFormCargo, roleFormSeniority].filter(Boolean).join(" · ");
    console.log("[TeamManager] handleSaveRole called", { generatedName, roleFormPermissions, selectedRole });
    
    if (!roleFormArea || !roleFormCargo) {
      toast.error("Área e Cargo são obrigatórios");
      return;
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        toast.error("Erro ao obter usuário autenticado");
        return;
      }

      const { data: currentUser, error: userError } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", authUser.id)
        .single();

      console.log("[TeamManager] currentUser", currentUser, "error", userError);
      
      if (!currentUser) {
        toast.error("Erro ao obter usuário atual");
        return;
      }

      let roleId = selectedRole?.id;

      if (selectedRole) {
        console.log("[TeamManager] Updating role", selectedRole.id);
        const { data: updateData, error } = await supabase
          .from("team_roles")
          .update({
            name: generatedName,
            description: roleFormDescription,
            color: roleFormColor,
            area: roleFormArea || null,
            cargo: roleFormCargo || null,
            seniority: roleFormSeniority || null,
          } as any)
          .eq("id", selectedRole.id)
          .select();

        console.log("[TeamManager] Update result", updateData, "error", error);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("team_roles")
          .insert({
            account_id: currentUser.account_id,
            name: generatedName,
            description: roleFormDescription,
            color: roleFormColor,
            display_order: roles.length + 1,
            area: roleFormArea || null,
            cargo: roleFormCargo || null,
            seniority: roleFormSeniority || null,
          } as any)
          .select()
          .single();

        if (error) throw error;
        roleId = data.id;
      }

      if (roleId) {
        await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", roleId);

        if (roleFormPermissions.length > 0) {
          const { error: permError } = await supabase
            .from("role_permissions")
            .insert(
              roleFormPermissions.map(p => ({
                role_id: roleId,
                permission: p,
              }))
            );

          if (permError) throw permError;
        }
      }

      toast.success(selectedRole ? "Função atualizada" : "Função criada");
      setIsRoleDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error saving role:", error);
      toast.error(error.message || "Erro ao salvar função");
    }
  };

  const handleDeleteRole = async (role: TeamRole) => {
    if (role.is_system) {
      toast.error("Funções do sistema não podem ser excluídas");
      return;
    }

    try {
      const { error } = await supabase
        .from("team_roles")
        .delete()
        .eq("id", role.id);

      if (error) throw error;

      toast.success("Função excluída");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting role:", error);
      toast.error(error.message || "Erro ao excluir função");
    }
  };

  const togglePermission = (permission: string) => {
    setRoleFormPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const visibleRoles = cxScopeOnly ? roles.filter(isCxScopedRole) : roles;
  const filteredUsers = users.filter((user) => {
    if (cxScopeOnly) {
      const userRoles = user.team_roles || (user.team_role ? [user.team_role] : []);
      if (userRoles.length === 0) return false;
      if (!userRoles.some(isCxScopedRole)) return false;
    }
    return (
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.team_role?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (loading) {
    return <LoadingScreen message="Carregando equipe..." fullScreen={false} />;
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="members" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="h-4 w-4" />
            Membros
          </TabsTrigger>
          {!cxScopeOnly && (
            <TabsTrigger value="roles" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Shield className="h-4 w-4" />
              Funções
            </TabsTrigger>
          )}
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-6 mt-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{users.length}</p>
                    <p className="text-xs text-muted-foreground">Total de membros</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {roles.slice(0, 3).map((role) => (
              <Card key={role.id} className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2.5 rounded-xl"
                      style={{ backgroundColor: `${role.color}20` }}
                    >
                      <User className="h-5 w-5" style={{ color: role.color }} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {users.filter((u) => u.team_roles?.some(r => r.id === role.id)).length}
                      </p>
                      <p className="text-xs text-muted-foreground">{role.name}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Search and Add */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail ou função..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex border border-border rounded-md">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className="rounded-r-none"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={() => { resetMemberForm(); setIsAddDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Membro
              </Button>
            </div>
          </div>

          {/* Members Grid/List */}
          {filteredUsers.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum membro encontrado</p>
              </CardContent>
            </Card>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map((user) => (
                <Card 
                  key={user.id} 
                  className="group hover:shadow-elevated transition-all duration-200 cursor-pointer shadow-card"
                  onClick={() => openEditMemberDialog(user)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12 ring-2 ring-background shadow-sm">
                        <AvatarImage src={user.avatar_url || undefined} alt={user.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {user.name}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate flex items-center gap-1.5">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </p>
                        {user.team_roles && user.team_roles.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {user.team_roles.map((role) => (
                              <Badge 
                                key={role.id}
                                variant="secondary" 
                                className="text-xs font-medium"
                                style={{ 
                                  backgroundColor: `${role.color}15`,
                                  color: role.color,
                                  borderColor: `${role.color}30`
                                }}
                              >
                                {role.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {user.is_also_admin && (
                          <Badge variant="destructive" className="mt-2 text-xs font-medium ml-1">
                            Admin
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditMemberDialog(user);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => openDeleteDialog(user, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="shadow-card">
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => openEditMemberDialog(user)}
                    >
                      <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                        <AvatarImage src={user.avatar_url || undefined} alt={user.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">
                          {user.name}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                      {user.team_roles && user.team_roles.length > 0 && user.team_roles.map((role) => (
                        <Badge 
                          key={role.id}
                          variant="secondary" 
                          className="text-xs font-medium hidden sm:inline-flex"
                          style={{ 
                            backgroundColor: `${role.color}15`,
                            color: role.color,
                            borderColor: `${role.color}30`
                          }}
                        >
                          {role.name}
                        </Badge>
                      ))}
                      {user.is_also_admin && (
                        <Badge variant="destructive" className="text-xs font-medium hidden sm:inline-flex">
                          Admin
                        </Badge>
                      )}
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditMemberDialog(user);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => openDeleteDialog(user, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-6 mt-6">
          <Card className="shadow-card border-dashed">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Funções da Equipe</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure funções e permissões para controlar o acesso
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex border border-border rounded-md">
                    <Button
                      variant={rolesViewMode === "grid" ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => setRolesViewMode("grid")}
                      className="rounded-r-none"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={rolesViewMode === "list" ? "secondary" : "ghost"}
                      size="icon"
                      onClick={() => setRolesViewMode("list")}
                      className="rounded-l-none"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button onClick={() => openRoleDialog()} className="shrink-0">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Função
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {rolesViewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {roles.map((role) => {
                const memberCount = users.filter(u => u.team_roles?.some(r => r.id === role.id)).length;
                const permissionCount = role.permissions?.length || 0;
                
                return (
                  <Card 
                    key={role.id} 
                    className="group hover:shadow-elevated transition-all duration-300 shadow-card overflow-hidden"
                  >
                    <div 
                      className="h-1.5 w-full"
                      style={{ backgroundColor: role.color }}
                    />
                    
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="p-2.5 rounded-xl"
                            style={{ backgroundColor: `${role.color}15` }}
                          >
                            <Shield 
                              className="h-5 w-5" 
                              style={{ color: role.color }}
                            />
                          </div>
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {role.name}
                              {role.is_system && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-[10px] px-1.5 font-normal bg-muted/50"
                                >
                                  Sistema
                                </Badge>
                              )}
                            </CardTitle>
                            {((role as any).area || role.description) && (
                              <CardDescription className="mt-1 text-xs line-clamp-1">
                                {[(role as any).area, (role as any).cargo, (role as any).seniority].filter(Boolean).join(" · ") || role.description}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => openRoleDialog(role)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          {!role.is_system && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDeleteRole(role)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{memberCount}</p>
                            <p className="text-[10px] text-muted-foreground">membros</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30">
                          <Check className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{permissionCount}</p>
                            <p className="text-[10px] text-muted-foreground">permissões</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                          Permissões
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {permissionCount === 0 ? (
                            <span className="text-xs text-muted-foreground italic">
                              Nenhuma permissão
                            </span>
                          ) : (
                            <>
                              {(role.permissions || []).slice(0, 4).map(p => (
                                <Badge 
                                  key={p} 
                                  variant="outline" 
                                  className="text-[10px] px-2 py-0.5 font-normal border-border/50"
                                >
                                  {PERMISSION_LABELS[p]?.label || p}
                                </Badge>
                              ))}
                              {permissionCount > 4 && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-[10px] px-2 py-0.5 font-normal"
                                >
                                  +{permissionCount - 4}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="shadow-card">
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {roles.map((role) => {
                    const memberCount = users.filter(u => u.team_roles?.some(r => r.id === role.id)).length;
                    const permissionCount = role.permissions?.length || 0;
                    
                    return (
                      <div
                        key={role.id}
                        className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div 
                          className="p-2.5 rounded-xl shrink-0"
                          style={{ backgroundColor: `${role.color}15` }}
                        >
                          <Shield 
                            className="h-5 w-5" 
                            style={{ color: role.color }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground">
                              {role.name}
                            </h3>
                            {role.is_system && (
                              <Badge 
                                variant="secondary" 
                                className="text-[10px] px-1.5 font-normal bg-muted/50 shrink-0"
                              >
                                Sistema
                              </Badge>
                            )}
                          </div>
                          {role.description && (
                            <p className="text-sm text-muted-foreground truncate">
                              {role.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-6 text-sm text-muted-foreground shrink-0">
                          <div className="flex items-center gap-1.5 w-12">
                            <Users className="h-4 w-4" />
                            <span>{memberCount}</span>
                          </div>
                          <div className="flex items-center gap-1.5 w-12">
                            <Check className="h-4 w-4" />
                            <span>{permissionCount}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openRoleDialog(role)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${role.is_system ? 'invisible' : 'text-destructive hover:text-destructive hover:bg-destructive/10'}`}
                            onClick={() => !role.is_system && handleDeleteRole(role)}
                            title="Excluir"
                            disabled={role.is_system}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Membro</DialogTitle>
            <DialogDescription>
              Adicione um novo membro à sua equipe
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nome completo"
                className="bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <PasswordInput
                id="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
              <p className="text-xs text-muted-foreground">
                O usuário usará esta senha para fazer login
              </p>
            </div>
            <div className="space-y-2">
              <Label>Funções</Label>
              <div className="rounded-lg border bg-card p-3 space-y-2 max-h-40 overflow-y-auto">
                {visibleRoles.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma função cadastrada</p>
                ) : visibleRoles.map((role) => (
                  <div key={role.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`add-role-${role.id}`}
                      checked={formRoleIds.includes(role.id)}
                      onCheckedChange={(checked) => {
                        setFormRoleIds(prev => 
                          checked 
                            ? [...prev, role.id] 
                            : prev.filter(id => id !== role.id)
                        );
                      }}
                    />
                    <Label htmlFor={`add-role-${role.id}`} className="flex items-center gap-2 cursor-pointer text-sm font-normal">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: role.color }} />
                      {role.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            {!cxScopeOnly && (
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50 border">
                <Checkbox
                  id="is-also-admin"
                  checked={formIsAlsoAdmin}
                  onCheckedChange={(checked) => setFormIsAlsoAdmin(checked === true)}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="is-also-admin" className="font-medium cursor-pointer">
                    Também é Admin
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Pode visualizar e editar tudo no sistema
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleAddUser} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Adicionar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Membro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="relative group">
                <Avatar className="h-20 w-20 ring-4 ring-card shadow-lg">
                  <AvatarImage src={formAvatarUrl || undefined} alt={formName} />
                  <AvatarFallback className="text-xl bg-primary/10 text-primary">
                    {getInitials(formName || "U")}
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-md"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  type="button"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome *</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nome completo"
                className="bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">E-mail *</Label>
              <Input
                id="edit-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="bg-card"
              />
            </div>
            
            {/* Password section */}
            <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-dashed">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Alterar Senha</Label>
              </div>
              {selectedUser?.auth_user_id ? (
                <>
                  <PasswordInput
                    id="edit-password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Nova senha (deixe em branco para manter)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe em branco para manter a senha atual
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Este usuário ainda não tem acesso de login. 
                  Delete e recrie com senha para ativar.
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Funções</Label>
              <div className="rounded-lg border bg-card p-3 space-y-2 max-h-40 overflow-y-auto">
                {visibleRoles.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma função cadastrada</p>
                ) : visibleRoles.map((role) => (
                  <div key={role.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-role-${role.id}`}
                      checked={formRoleIds.includes(role.id)}
                      onCheckedChange={(checked) => {
                        setFormRoleIds(prev => 
                          checked 
                            ? [...prev, role.id] 
                            : prev.filter(id => id !== role.id)
                        );
                      }}
                    />
                    <Label htmlFor={`edit-role-${role.id}`} className="flex items-center gap-2 cursor-pointer text-sm font-normal">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: role.color }} />
                      {role.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            {!cxScopeOnly && (
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50 border">
                <Checkbox
                  id="edit-is-also-admin"
                  checked={formIsAlsoAdmin}
                  onCheckedChange={(checked) => setFormIsAlsoAdmin(checked === true)}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="edit-is-also-admin" className="font-medium cursor-pointer">
                    Também é Admin
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Pode visualizar e editar tudo no sistema
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleEditUser} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 space-y-1.5">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {selectedRole ? "Editar Função" : "Nova Função"}
              </DialogTitle>
              <DialogDescription className="text-sm">
                Defina área, cargo, senioridade e permissões
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="px-6 pb-6 space-y-6">
              {/* Nome gerado automaticamente a partir de Área + Cargo + Senioridade */}
              {(roleFormArea || roleFormCargo || roleFormSeniority) && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Nome gerado</p>
                  <p className="text-sm font-medium">{[roleFormArea, roleFormCargo, roleFormSeniority].filter(Boolean).join(" · ")}</p>
                </div>
              )}
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="role-description" className="text-sm font-medium">Descrição</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateDescription}
                    disabled={generatingDescription || !roleFormArea || !roleFormCargo}
                    className="h-7 text-xs gap-1.5"
                  >
                    {generatingDescription ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Gerar com IA
                  </Button>
                </div>
                <Textarea
                  id="role-description"
                  value={roleFormDescription}
                  onChange={(e) => setRoleFormDescription(e.target.value)}
                  placeholder="Descrição da função"
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Área *</Label>
                  <Select value={roleFormArea} onValueChange={(v) => { setRoleFormArea(v); setRoleFormCargo(""); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a área" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_AREAS.map((area) => (
                        <SelectItem key={area} value={area}>{area}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Cargo *</Label>
                  <Select value={roleFormCargo} onValueChange={setRoleFormCargo} disabled={!roleFormArea}>
                    <SelectTrigger>
                      <SelectValue placeholder={roleFormArea ? "Selecione o cargo" : "Selecione a área primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(CARGOS_POR_AREA[roleFormArea] || []).map((cargo) => (
                        <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Senioridade</Label>
                <Select value={roleFormSeniority} onValueChange={setRoleFormSeniority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a senioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    {SENIORITY_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Cor</Label>
                <div className="flex gap-2">
                  {DEFAULT_ROLE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-9 h-9 rounded-lg transition-all duration-150 flex items-center justify-center ${
                        roleFormColor === color 
                          ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground' 
                          : 'hover:opacity-80'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setRoleFormColor(color)}
                    >
                      {roleFormColor === color && (
                        <Check className="h-4 w-4 text-white drop-shadow-sm" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Permissões</Label>
                  <Badge variant="outline" className="text-xs font-normal">
                    {roleFormPermissions.length} selecionadas
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {PERMISSION_CATEGORIES.map(category => {
                    const categoryPerms = Object.entries(PERMISSION_LABELS)
                      .filter(([_, v]) => v.category === category);
                    
                    if (categoryPerms.length === 0) return null;
                    
                    return (
                      <div key={category} className="rounded-lg border bg-muted/30">
                        <div className="px-3 py-2 border-b bg-muted/50">
                          <span className="text-xs font-medium">
                            {category}
                          </span>
                        </div>
                        <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2">
                          {categoryPerms.map(([perm, { label }]) => {
                            const isChecked = roleFormPermissions.includes(perm);
                            const helpText = PERMISSION_HELP[perm];
                            return (
                              <div key={perm} className="flex flex-col gap-0.5">
                                <label 
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => togglePermission(perm)}
                                    className="h-4 w-4"
                                  />
                                  <span className={`text-sm ${isChecked ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {label}
                                  </span>
                                </label>
                                {helpText && isChecked && (
                                  <p className="text-xs text-muted-foreground ml-6">
                                    {helpText}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <div className="px-6 py-4 border-t bg-muted/30 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveRole}
              style={{ backgroundColor: roleFormColor }}
              className="text-white hover:opacity-90"
            >
              {selectedRole ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Excluir Membro</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{userToDelete?.name}</strong>? 
              Esta ação não pode ser desfeita e o usuário perderá acesso ao sistema.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => { setIsDeleteDialogOpen(false); setUserToDelete(null); }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
