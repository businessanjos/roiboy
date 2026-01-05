import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, Shield, Save, RefreshCw, MessageSquare, Building } from "lucide-react";
import { sectors, SectorId } from "@/config/sectors";
import { cn } from "@/lib/utils";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
}

interface UserSectorAccess {
  id: string;
  user_id: string;
  sector_id: string;
  role_in_sector: string;
  is_active: boolean;
}

interface SectorSettings {
  id: string;
  sector_id: string;
  royzapp_enabled: boolean;
}

const SECTOR_ROLES = [
  { value: "admin", label: "Administrador", description: "Acesso total ao setor" },
  { value: "manager", label: "Gestor", description: "Pode gerenciar equipe e dados" },
  { value: "member", label: "Membro", description: "Acesso padrão" },
  { value: "viewer", label: "Visualizador", description: "Apenas leitura" },
];

export function UserSectorAccessManager() {
  const { currentUser } = useCurrentUser();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [accessList, setAccessList] = useState<UserSectorAccess[]>([]);
  const [sectorSettings, setSectorSettings] = useState<SectorSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<UserSectorAccess>>>(new Map());
  const [pendingSectorSettings, setPendingSectorSettings] = useState<Map<string, boolean>>(new Map());
  const [activeTab, setActiveTab] = useState("sectors");

  const activeSectors = sectors.filter(s => !s.comingSoon);

  useEffect(() => {
    if (currentUser?.account_id) {
      fetchData();
    }
  }, [currentUser?.account_id]);

  const fetchData = async () => {
    if (!currentUser?.account_id) return;
    
    setLoading(true);
    try {
      const [usersRes, accessRes, settingsRes] = await Promise.all([
        supabase
          .from("users")
          .select("id, name, email, avatar_url, role")
          .eq("account_id", currentUser.account_id)
          .order("name"),
        supabase
          .from("user_sector_access")
          .select("*")
          .eq("account_id", currentUser.account_id),
        supabase
          .from("sector_settings")
          .select("*")
          .eq("account_id", currentUser.account_id),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (accessRes.error) throw accessRes.error;
      if (settingsRes.error) throw settingsRes.error;

      setUsers(usersRes.data || []);
      setAccessList(accessRes.data || []);
      setSectorSettings(settingsRes.data || []);
      
      if (usersRes.data && usersRes.data.length > 0 && !selectedUserId) {
        setSelectedUserId(usersRes.data[0].id);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const getUserAccess = (userId: string, sectorId: string): UserSectorAccess | undefined => {
    return accessList.find(a => a.user_id === userId && a.sector_id === sectorId);
  };

  const getPendingChange = (userId: string, sectorId: string): Partial<UserSectorAccess> | undefined => {
    return pendingChanges.get(`${userId}-${sectorId}`);
  };

  const updatePendingChange = (userId: string, sectorId: string, changes: Partial<UserSectorAccess>) => {
    const key = `${userId}-${sectorId}`;
    const existing = pendingChanges.get(key) || {};
    const newChanges = new Map(pendingChanges);
    newChanges.set(key, { ...existing, ...changes });
    setPendingChanges(newChanges);
  };

  const toggleSectorRoyzapp = (sectorId: string, enabled: boolean) => {
    const newSettings = new Map(pendingSectorSettings);
    newSettings.set(sectorId, enabled);
    setPendingSectorSettings(newSettings);
  };

  const getSectorRoyzappEnabled = (sectorId: string): boolean => {
    // Check pending changes first
    if (pendingSectorSettings.has(sectorId)) {
      return pendingSectorSettings.get(sectorId)!;
    }
    // Check existing settings
    const setting = sectorSettings.find(s => s.sector_id === sectorId);
    // Default to true if no setting exists
    return setting?.royzapp_enabled ?? true;
  };

  const toggleSectorAccess = (userId: string, sectorId: string, enabled: boolean) => {
    updatePendingChange(userId, sectorId, { 
      is_active: enabled,
      role_in_sector: enabled ? "member" : undefined 
    });
  };

  const updateSectorRole = (userId: string, sectorId: string, role: string) => {
    updatePendingChange(userId, sectorId, { role_in_sector: role });
  };

  const saveSectorSettings = async () => {
    if (!currentUser?.account_id || pendingSectorSettings.size === 0) return;

    setSaving(true);
    let hasErrors = false;
    
    try {
      for (const [sectorId, enabled] of pendingSectorSettings.entries()) {
        const existing = sectorSettings.find(s => s.sector_id === sectorId);

        if (existing) {
          const { error } = await supabase
            .from("sector_settings")
            .update({ royzapp_enabled: enabled })
            .eq("id", existing.id);
          
          if (error) {
            console.error("Error updating sector setting:", error);
            hasErrors = true;
          }
        } else {
          const { error } = await supabase.from("sector_settings").insert({
            account_id: currentUser.account_id,
            sector_id: sectorId,
            royzapp_enabled: enabled,
          });
          
          if (error) {
            console.error("Error inserting sector setting:", error);
            hasErrors = true;
          }
        }
      }

      if (hasErrors) {
        toast.error("Alguns itens falharam. Verifique o console.");
      } else {
        toast.success("Configurações de setores salvas!");
      }
      
      setPendingSectorSettings(new Map());
      fetchData();
    } catch (error: any) {
      console.error("Error saving sector settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const saveUserAccess = async () => {
    if (!currentUser?.account_id || pendingChanges.size === 0) return;

    setSaving(true);
    let hasErrors = false;
    
    try {
      for (const [key, changes] of pendingChanges.entries()) {
        const [userId, sectorId] = key.split("-");
        const existing = getUserAccess(userId, sectorId);

        if (existing) {
          if (changes.is_active === false) {
            // Delete access
            const { error } = await supabase
              .from("user_sector_access")
              .delete()
              .eq("id", existing.id);
            
            if (error) {
              console.error("Error deleting access:", error);
              hasErrors = true;
            }
          } else {
            // Update existing
            const { error } = await supabase
              .from("user_sector_access")
              .update({
                role_in_sector: changes.role_in_sector || existing.role_in_sector,
                is_active: changes.is_active ?? existing.is_active,
              })
              .eq("id", existing.id);
            
            if (error) {
              console.error("Error updating access:", error);
              hasErrors = true;
            }
          }
        } else if (changes.is_active !== false) {
          // Insert new
          const { error } = await supabase.from("user_sector_access").insert({
            account_id: currentUser.account_id,
            user_id: userId,
            sector_id: sectorId,
            role_in_sector: changes.role_in_sector || "member",
            is_active: true,
          });
          
          if (error) {
            console.error("Error inserting access:", error);
            hasErrors = true;
          }
        }
      }

      if (hasErrors) {
        toast.error("Alguns itens falharam. Verifique o console.");
      } else {
        toast.success("Permissões de usuário salvas!");
      }
      
      setPendingChanges(new Map());
      fetchData();
    } catch (error: any) {
      console.error("Error saving changes:", error);
      toast.error("Erro ao salvar permissões");
    } finally {
      setSaving(false);
    }
  };

  const getEffectiveValue = (userId: string, sectorId: string, field: "is_active" | "role_in_sector") => {
    const pending = getPendingChange(userId, sectorId);
    const existing = getUserAccess(userId, sectorId);
    
    if (pending && pending[field] !== undefined) {
      return pending[field];
    }
    
    if (existing) {
      return existing[field];
    }
    
    return field === "is_active" ? false : "member";
  };

  const selectedUser = users.find(u => u.id === selectedUserId);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Acesso aos Setores
            </CardTitle>
            <CardDescription>
              Configure quais setores têm ROY zAPP e quais usuários podem acessar cada setor.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sectors" className="gap-2">
              <Building className="h-4 w-4" />
              Setores com ROY zAPP
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Acesso por Usuário
            </TabsTrigger>
          </TabsList>

          {/* Sectors Tab - Configure which sectors have ROY zAPP */}
          <TabsContent value="sectors" className="space-y-4 mt-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Escolha quais setores terão acesso ao ROY zAPP. Depois, configure quais usuários podem acessar cada setor na aba "Acesso por Usuário".
              </p>
            </div>

            <div className="grid gap-3">
              {activeSectors.map((sector) => {
                const Icon = sector.icon;
                const isEnabled = getSectorRoyzappEnabled(sector.id);
                const hasPendingChange = pendingSectorSettings.has(sector.id);

                return (
                  <div
                    key={sector.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border transition-colors",
                      isEnabled ? "bg-card" : "bg-muted/30",
                      hasPendingChange && "ring-2 ring-primary/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", sector.bgColor)}>
                        <Icon className={cn("h-5 w-5", sector.color)} />
                      </div>
                      <div>
                        <p className="font-medium">{sector.name}</p>
                        <p className="text-sm text-muted-foreground">{sector.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {isEnabled && (
                        <Badge variant="secondary" className="gap-1">
                          <MessageSquare className="h-3 w-3" />
                          ROY zAPP
                        </Badge>
                      )}
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => toggleSectorRoyzapp(sector.id, checked)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {pendingSectorSettings.size > 0 && (
              <div className="flex justify-end pt-4">
                <Button onClick={saveSectorSettings} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar ({pendingSectorSettings.size})
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Users Tab - Configure user access to sectors */}
          <TabsContent value="users" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Selecione o usuário</Label>
              <div className="flex flex-wrap gap-2">
                {users.map((user) => (
                  <Button
                    key={user.id}
                    variant={selectedUserId === user.id ? "default" : "outline"}
                    size="sm"
                    className="gap-2"
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {user.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {user.name}
                    {user.role === "admin" && (
                      <Badge variant="secondary" className="text-xs">Admin</Badge>
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {selectedUser && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedUser.avatar_url || undefined} />
                    <AvatarFallback>{selectedUser.name?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedUser.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  <span className="text-primary">Lembre-se:</span> O usuário também precisa ter a permissão "Acessar ROY zAPP" na função dele.
                </p>

                <div className="grid gap-3">
                  {activeSectors.map((sector) => {
                    const Icon = sector.icon;
                    const isActive = getEffectiveValue(selectedUser.id, sector.id, "is_active") as boolean;
                    const role = getEffectiveValue(selectedUser.id, sector.id, "role_in_sector") as string;
                    const hasPendingChange = getPendingChange(selectedUser.id, sector.id) !== undefined;
                    const sectorHasRoyzapp = getSectorRoyzappEnabled(sector.id);

                    return (
                      <div
                        key={sector.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border transition-colors",
                          isActive ? "bg-card" : "bg-muted/30",
                          hasPendingChange && "ring-2 ring-primary/30",
                          !sectorHasRoyzapp && "opacity-50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-lg", sector.bgColor)}>
                            <Icon className={cn("h-5 w-5", sector.color)} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{sector.name}</p>
                              {sectorHasRoyzapp && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  ROY zAPP
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{sector.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {isActive && (
                            <Select
                              value={role}
                              onValueChange={(value) => updateSectorRole(selectedUser.id, sector.id, value)}
                            >
                              <SelectTrigger className="w-[160px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SECTOR_ROLES.map((r) => (
                                  <SelectItem key={r.value} value={r.value}>
                                    <div>
                                      <span>{r.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <Switch
                            checked={isActive}
                            onCheckedChange={(checked) => toggleSectorAccess(selectedUser.id, sector.id, checked)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {pendingChanges.size > 0 && (
                  <div className="flex justify-end pt-4">
                    <Button onClick={saveUserAccess} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar ({pendingChanges.size})
                    </Button>
                  </div>
                )}
              </div>
            )}

            {users.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum usuário encontrado</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
