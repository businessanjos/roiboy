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
import { 
  Plus, Search, Pencil, User, Users, Camera, Loader2, 
  Shield, Trash2, Settings, Check, Mail
} from "lucide-react";

interface TeamRole {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_system: boolean;
  display_order: number;
  permissions?: string[];
}

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
};

const PERMISSION_CATEGORIES = ["Clientes", "Equipe", "Relatórios", "Eventos", "Formulários", "Produtos", "Configurações"];

// Default role colors using design system tokens
const DEFAULT_ROLE_COLORS = [
  "hsl(0, 72%, 51%)",      // destructive/red
  "hsl(39, 55%, 63%)",     // primary/gold
  "hsl(180, 13%, 36%)",    // accent/teal
  "hsl(152, 69%, 31%)",    // success/green
  "hsl(262, 52%, 47%)",    // purple
  "hsl(199, 89%, 48%)",    // blue
];

export default function Team() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("members");
  
  // Member dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TeamUser | null>(null);
  
  // Role dialogs
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TeamRole | null>(null);
  
  // Member form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRoleId, setFormRoleId] = useState<string>("");
  const [formAvatarUrl, setFormAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Role form state
  const [roleFormName, setRoleFormName] = useState("");
  const [roleFormDescription, setRoleFormDescription] = useState("");
  const [roleFormColor, setRoleFormColor] = useState("hsl(39, 55%, 63%)");
  const [roleFormPermissions, setRoleFormPermissions] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get current user's account_id
      const { data: currentUser, error: currentUserError } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (currentUserError) throw currentUserError;
      if (!currentUser) return;

      // Fetch roles with permissions
      const { data: rolesData, error: rolesError } = await supabase
        .from("team_roles")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .order("display_order");

      if (rolesError) throw rolesError;

      // Fetch permissions for each role
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

      // Fetch users from the same account
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .order("name");

      if (usersError) throw usersError;

      // Map users with their roles
      const usersWithRoles = (usersData || []).map(user => ({
        ...user,
        team_role: rolesWithPermissions.find(r => r.id === user.team_role_id)
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!formName || !formEmail) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const { data: currentUser } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (!currentUser) {
        toast.error("Erro ao obter conta do usuário");
        return;
      }

      const { error } = await supabase.from("users").insert({
        name: formName,
        email: formEmail,
        role: "mentor",
        account_id: currentUser.account_id,
        team_role_id: formRoleId || null,
      });

      if (error) throw error;

      toast.success("Membro adicionado com sucesso");
      setIsAddDialogOpen(false);
      resetMemberForm();
      fetchData();
    } catch (error: any) {
      console.error("Error adding user:", error);
      toast.error(error.message || "Erro ao adicionar membro");
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from("users")
        .update({ 
          name: formName, 
          email: formEmail,
          team_role_id: formRoleId || null,
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      toast.success("Membro atualizado com sucesso");
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      resetMemberForm();
      fetchData();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error(error.message || "Erro ao atualizar membro");
    }
  };

  const resetMemberForm = () => {
    setFormName("");
    setFormEmail("");
    setFormRoleId("");
    setFormAvatarUrl(null);
  };

  const openEditMemberDialog = (user: TeamUser) => {
    setSelectedUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRoleId(user.team_role_id || "");
    setFormAvatarUrl(user.avatar_url);
    setIsEditDialogOpen(true);
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

  // Role management functions
  const openRoleDialog = (role?: TeamRole) => {
    if (role) {
      setSelectedRole(role);
      setRoleFormName(role.name);
      setRoleFormDescription(role.description || "");
      setRoleFormColor(role.color);
      setRoleFormPermissions(role.permissions || []);
    } else {
      setSelectedRole(null);
      setRoleFormName("");
      setRoleFormDescription("");
      setRoleFormColor(DEFAULT_ROLE_COLORS[roles.length % DEFAULT_ROLE_COLORS.length]);
      setRoleFormPermissions([]);
    }
    setIsRoleDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!roleFormName) {
      toast.error("Nome da função é obrigatório");
      return;
    }

    try {
      const { data: currentUser } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (!currentUser) return;

      let roleId = selectedRole?.id;

      if (selectedRole) {
        // Update existing role
        const { error } = await supabase
          .from("team_roles")
          .update({
            name: roleFormName,
            description: roleFormDescription,
            color: roleFormColor,
          })
          .eq("id", selectedRole.id);

        if (error) throw error;
      } else {
        // Create new role
        const { data, error } = await supabase
          .from("team_roles")
          .insert({
            account_id: currentUser.account_id,
            name: roleFormName,
            description: roleFormDescription,
            color: roleFormColor,
            display_order: roles.length + 1,
          })
          .select()
          .single();

        if (error) throw error;
        roleId = data.id;
      }

      // Update permissions
      if (roleId) {
        // Delete existing permissions
        await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", roleId);

        // Insert new permissions
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

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.team_role?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Equipe</h1>
          <p className="text-muted-foreground">
            Gerencie membros e funções da sua equipe
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="members" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="h-4 w-4" />
            Membros
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Shield className="h-4 w-4" />
            Funções
          </TabsTrigger>
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
            {roles.slice(0, 3).map((role, index) => (
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
                        {users.filter((u) => u.team_role_id === role.id).length}
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
            <Button onClick={() => { resetMemberForm(); setIsAddDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Membro
            </Button>
          </div>

          {/* Members Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.length === 0 ? (
              <Card className="col-span-full shadow-card">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum membro encontrado</p>
                </CardContent>
              </Card>
            ) : (
              filteredUsers.map((user) => (
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
                        {user.team_role && (
                          <Badge 
                            variant="secondary" 
                            className="mt-2 text-xs font-medium"
                            style={{ 
                              backgroundColor: `${user.team_role.color}15`,
                              color: user.team_role.color,
                              borderColor: `${user.team_role.color}30`
                            }}
                          >
                            {user.team_role.name}
                          </Badge>
                        )}
                      </div>
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
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-6 mt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <p className="text-muted-foreground">
              Configure funções e permissões para sua equipe
            </p>
            <Button onClick={() => openRoleDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Função
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => (
              <Card 
                key={role.id} 
                className="group hover:shadow-elevated transition-all duration-200 shadow-card"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-1 h-12 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {role.name}
                          {role.is_system && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 font-normal">
                              Sistema
                            </Badge>
                          )}
                        </CardTitle>
                        {role.description && (
                          <CardDescription className="mt-0.5 text-xs">
                            {role.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
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
                          className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteRole(role)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {users.filter(u => u.team_role_id === role.id).length} membros
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      {role.permissions?.length || 0} permissões
                    </span>
                  </div>
                  {/* Permission preview */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(role.permissions || []).slice(0, 3).map(p => (
                      <Badge 
                        key={p} 
                        variant="outline" 
                        className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground"
                      >
                        {PERMISSION_LABELS[p]?.label || p}
                      </Badge>
                    ))}
                    {(role.permissions?.length || 0) > 3 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground">
                        +{(role.permissions?.length || 0) - 3}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
              <Label htmlFor="role">Função</Label>
              <Select value={formRoleId} onValueChange={setFormRoleId}>
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: role.color }}
                        />
                        {role.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddUser}>Adicionar</Button>
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
            {/* Avatar Upload */}
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
            <div className="space-y-2">
              <Label htmlFor="edit-role">Função</Label>
              <Select value={formRoleId} onValueChange={setFormRoleId}>
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: role.color }}
                        />
                        {role.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditUser}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedRole ? "Editar Função" : "Nova Função"}
            </DialogTitle>
            <DialogDescription>
              Configure nome, cor e permissões da função
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role-name">Nome *</Label>
                  <Input
                    id="role-name"
                    value={roleFormName}
                    onChange={(e) => setRoleFormName(e.target.value)}
                    placeholder="Ex: Suporte"
                    disabled={selectedRole?.is_system}
                    className="bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-color">Cor</Label>
                  <div className="flex gap-2">
                    <div className="flex gap-1">
                      {DEFAULT_ROLE_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-8 h-8 rounded-md border-2 transition-all ${
                            roleFormColor === color 
                              ? 'border-foreground scale-110' 
                              : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setRoleFormColor(color)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role-description">Descrição</Label>
                <Input
                  id="role-description"
                  value={roleFormDescription}
                  onChange={(e) => setRoleFormDescription(e.target.value)}
                  placeholder="Descrição da função"
                  className="bg-card"
                />
              </div>

              {/* Permissions */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Permissões</Label>
                <div className="space-y-3">
                  {PERMISSION_CATEGORIES.map(category => {
                    const categoryPerms = Object.entries(PERMISSION_LABELS)
                      .filter(([_, v]) => v.category === category);
                    
                    if (categoryPerms.length === 0) return null;
                    
                    return (
                      <Card key={category} className="shadow-card overflow-hidden">
                        <CardHeader className="py-2.5 px-4 bg-muted/30">
                          <CardTitle className="text-sm font-medium text-foreground">{category}</CardTitle>
                        </CardHeader>
                        <CardContent className="py-2 px-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {categoryPerms.map(([perm, { label }]) => (
                              <div 
                                key={perm}
                                className={`flex items-center space-x-2.5 p-2 rounded-md cursor-pointer transition-colors ${
                                  roleFormPermissions.includes(perm) 
                                    ? 'bg-primary/10' 
                                    : 'hover:bg-muted/50'
                                }`}
                                onClick={() => togglePermission(perm)}
                              >
                                <Checkbox
                                  id={perm}
                                  checked={roleFormPermissions.includes(perm)}
                                  onCheckedChange={() => togglePermission(perm)}
                                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                                <label
                                  htmlFor={perm}
                                  className="text-sm cursor-pointer flex-1 text-foreground"
                                >
                                  {label}
                                </label>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRole}>
              {selectedRole ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}