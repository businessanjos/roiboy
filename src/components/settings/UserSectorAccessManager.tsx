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
import { Loader2, Users, Shield, Save, RefreshCw } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<UserSectorAccess>>>(new Map());

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
      const [usersRes, accessRes] = await Promise.all([
        supabase
          .from("users")
          .select("id, name, email, avatar_url, role")
          .eq("account_id", currentUser.account_id)
          .order("name"),
        supabase
          .from("user_sector_access")
          .select("*")
          .eq("account_id", currentUser.account_id),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (accessRes.error) throw accessRes.error;

      setUsers(usersRes.data || []);
      setAccessList(accessRes.data || []);
      
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

  const toggleSectorAccess = (userId: string, sectorId: string, enabled: boolean) => {
    updatePendingChange(userId, sectorId, { 
      is_active: enabled,
      role_in_sector: enabled ? "member" : undefined 
    });
  };

  const updateSectorRole = (userId: string, sectorId: string, role: string) => {
    updatePendingChange(userId, sectorId, { role_in_sector: role });
  };

  const saveChanges = async () => {
    if (!currentUser?.account_id || pendingChanges.size === 0) return;

    setSaving(true);
    try {
      for (const [key, changes] of pendingChanges.entries()) {
        const [userId, sectorId] = key.split("-");
        const existing = getUserAccess(userId, sectorId);

        if (existing) {
          if (changes.is_active === false) {
            // Delete access
            await supabase
              .from("user_sector_access")
              .delete()
              .eq("id", existing.id);
          } else {
            // Update existing
            await supabase
              .from("user_sector_access")
              .update({
                role_in_sector: changes.role_in_sector || existing.role_in_sector,
                is_active: changes.is_active ?? existing.is_active,
              })
              .eq("id", existing.id);
          }
        } else if (changes.is_active !== false) {
          // Insert new
          await supabase.from("user_sector_access").insert({
            account_id: currentUser.account_id,
            user_id: userId,
            sector_id: sectorId,
            role_in_sector: changes.role_in_sector || "member",
            is_active: true,
          });
        }
      }

      toast.success("Permissões salvas com sucesso!");
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
              Defina quais setores cada usuário pode acessar e sua função em cada um
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {pendingChanges.size > 0 && (
              <Button onClick={saveChanges} disabled={saving} size="sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar ({pendingChanges.size})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* User selector */}
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

        {/* Sector access grid */}
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

            <div className="grid gap-3">
              {activeSectors.map((sector) => {
                const Icon = sector.icon;
                const isActive = getEffectiveValue(selectedUser.id, sector.id, "is_active") as boolean;
                const role = getEffectiveValue(selectedUser.id, sector.id, "role_in_sector") as string;
                const hasPendingChange = getPendingChange(selectedUser.id, sector.id) !== undefined;

                return (
                  <div
                    key={sector.id}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border transition-colors",
                      isActive ? "bg-card" : "bg-muted/30",
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
          </div>
        )}

        {users.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum usuário encontrado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
