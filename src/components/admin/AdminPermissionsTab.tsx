import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Save, RefreshCw, Search, Shield, Users, Building2, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { sectors } from "@/config/sectors";
import { cn } from "@/lib/utils";

interface Account {
  id: string;
  name: string;
}

interface AccountUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  auth_user_id: string | null;
}

interface UserSectorAccess {
  id: string;
  user_id: string;
  sector_id: string;
  role_in_sector: string;
  is_active: boolean;
}

const SECTOR_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Gestor" },
  { value: "member", label: "Membro" },
  { value: "viewer", label: "Viewer" },
];

type PendingKey = string; // `${userId}::${sectorId}`

export function AdminPermissionsTab({ accounts }: { accounts: Account[] }) {
  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name)),
    [accounts]
  );

  const [accountId, setAccountId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [pending, setPending] = useState<Map<PendingKey, Partial<UserSectorAccess>>>(new Map());
  const [pendingSuperAdmin, setPendingSuperAdmin] = useState<Map<string, boolean>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accountId && sortedAccounts.length) setAccountId(sortedAccounts[0].id);
  }, [sortedAccounts, accountId]);

  // Reset pending changes and selected user when switching account
  useEffect(() => {
    setPending(new Map());
    setPendingSuperAdmin(new Map());
    setSelectedUserId("");
  }, [accountId]);

  const activeSectors = useMemo(() => sectors.filter((s) => !s.comingSoon), []);

  const { data: users = [], isLoading: loadingUsers, refetch: refetchUsers } = useQuery({
    queryKey: ["admin-permissions-users", accountId],
    queryFn: async (): Promise<AccountUser[]> => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, avatar_url, role, auth_user_id")
        .eq("account_id", accountId)
        .order("name");
      if (error) throw error;
      return (data || []) as AccountUser[];
    },
    enabled: !!accountId,
  });

  const { data: accessList = [], isLoading: loadingAccess, refetch: refetchAccess } = useQuery({
    queryKey: ["admin-permissions-access", accountId],
    queryFn: async (): Promise<UserSectorAccess[]> => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("user_sector_access")
        .select("id, user_id, sector_id, role_in_sector, is_active")
        .eq("account_id", accountId);
      if (error) throw error;
      return (data || []) as UserSectorAccess[];
    },
    enabled: !!accountId,
  });

  const authUserIds = useMemo(
    () => users.map((u) => u.auth_user_id).filter(Boolean) as string[],
    [users]
  );

  const { data: superAdminIds = [], refetch: refetchSuperAdmins } = useQuery({
    queryKey: ["admin-permissions-superadmins", authUserIds],
    queryFn: async (): Promise<string[]> => {
      if (!authUserIds.length) return [];
      const { data, error } = await supabase
        .from("super_admins")
        .select("user_id")
        .in("user_id", authUserIds);
      if (error) throw error;
      return (data || []).map((r: { user_id: string }) => r.user_id);
    },
    enabled: authUserIds.length > 0,
  });

  const isSuperAdminEffective = (authUserId: string | null) => {
    if (!authUserId) return false;
    if (pendingSuperAdmin.has(authUserId)) return pendingSuperAdmin.get(authUserId)!;
    return superAdminIds.includes(authUserId);
  };

  // Auto-select first user when list loads
  useEffect(() => {
    if (users.length && !selectedUserId) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  const filteredUsers = useMemo(() => {
    if (!selectedUserId) return [];
    return users.filter((u) => u.id === selectedUserId);
  }, [users, selectedUserId]);

  const getAccess = (userId: string, sectorId: string) =>
    accessList.find((a) => a.user_id === userId && a.sector_id === sectorId);

  const getEffective = (userId: string, sectorId: string) => {
    const key: PendingKey = `${userId}::${sectorId}`;
    const p = pending.get(key);
    const existing = getAccess(userId, sectorId);
    return {
      isActive: p?.is_active ?? existing?.is_active ?? false,
      role: (p?.role_in_sector ?? existing?.role_in_sector ?? "member") as string,
      hasPending: pending.has(key),
    };
  };

  const setEffective = (userId: string, sectorId: string, changes: Partial<UserSectorAccess>) => {
    const key: PendingKey = `${userId}::${sectorId}`;
    const next = new Map(pending);
    const existing = next.get(key) || {};
    next.set(key, { ...existing, ...changes });
    setPending(next);
  };

  const toggleSuperAdmin = (authUserId: string, value: boolean) => {
    const next = new Map(pendingSuperAdmin);
    next.set(authUserId, value);
    setPendingSuperAdmin(next);
  };

  const totalChanges = pending.size + pendingSuperAdmin.size;

  const handleSave = async (options?: { advanceToNext?: boolean }): Promise<boolean> => {
    if (!accountId || totalChanges === 0) {
      // Nothing to save — still allow advance if requested
      if (options?.advanceToNext) advanceToNextUser();
      return true;
    }
    setSaving(true);
    let errors = 0;

    try {
      // Sector access changes
      for (const [key, changes] of pending.entries()) {
        const [userId, sectorId] = key.split("::");
        const existing = getAccess(userId, sectorId);

        if (existing) {
          if (changes.is_active === false) {
            const { error } = await supabase
              .from("user_sector_access")
              .delete()
              .eq("id", existing.id);
            if (error) errors++;
          } else {
            const { error } = await supabase
              .from("user_sector_access")
              .update({
                role_in_sector: changes.role_in_sector ?? existing.role_in_sector,
                is_active: changes.is_active ?? existing.is_active,
              })
              .eq("id", existing.id);
            if (error) errors++;
          }
        } else if (changes.is_active !== false) {
          const { error } = await supabase.from("user_sector_access").insert({
            account_id: accountId,
            user_id: userId,
            sector_id: sectorId,
            role_in_sector: changes.role_in_sector || "member",
            is_active: true,
          });
          if (error) errors++;
        }
      }

      // Super admin changes
      for (const [authUserId, value] of pendingSuperAdmin.entries()) {
        if (value) {
          const { error } = await supabase
            .from("super_admins")
            .upsert({ user_id: authUserId }, { onConflict: "user_id" });
          if (error) errors++;
        } else {
          const { error } = await supabase
            .from("super_admins")
            .delete()
            .eq("user_id", authUserId);
          if (error) errors++;
        }
      }

      if (errors > 0) {
        toast.error(`${errors} alteração(ões) falharam. Verifique o console.`);
        return false;
      }

      toast.success(
        options?.advanceToNext ? "Salvo! Indo para o próximo usuário…" : "Permissões salvas com sucesso!"
      );

      setPending(new Map());
      setPendingSuperAdmin(new Map());
      await Promise.all([refetchAccess(), refetchSuperAdmins()]);

      if (options?.advanceToNext) advanceToNextUser();
      return true;
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar permissões");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const advanceToNextUser = () => {
    const idx = users.findIndex((u) => u.id === selectedUserId);
    if (idx >= 0 && idx < users.length - 1) {
      setSelectedUserId(users[idx + 1].id);
    } else {
      toast.info("Você já está no último usuário.");
    }
  };

  const handleReset = () => {
    setPending(new Map());
    setPendingSuperAdmin(new Map());
  };

  const loading = loadingUsers || loadingAccess;

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Permissões por Usuário
              </CardTitle>
              <CardDescription>
                Defina quais áreas cada usuário pode acessar e o papel dentro de cada uma.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Selecionar conta" />
                </SelectTrigger>
                <SelectContent>
                  {sortedAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-xl">
              <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecionar usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <div className="flex items-center gap-2">
                        <span>{u.name}</span>
                        <span className="text-xs text-muted-foreground">— {u.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(() => {
                const idx = users.findIndex((u) => u.id === selectedUserId);
                const total = users.length;
                const canPrev = idx > 0;
                const canNext = idx >= 0 && idx < total - 1;
                return (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      disabled={!canPrev}
                      onClick={() => canPrev && setSelectedUserId(users[idx - 1].id)}
                      title="Usuário anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {total > 0 && idx >= 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums px-1 min-w-[44px] text-center">
                        {idx + 1} / {total}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      disabled={!canNext}
                      onClick={() => canNext && setSelectedUserId(users[idx + 1].id)}
                      title="Próximo usuário"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchUsers();
                  refetchAccess();
                  refetchSuperAdmins();
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {totalChanges > 0 && (
                <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving}>
                  Descartar
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving || totalChanges === 0}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar {totalChanges > 0 ? `(${totalChanges})` : ""}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">Nenhum usuário encontrado nesta conta.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="border rounded-lg p-4 bg-card hover:border-primary/30 transition-colors"
                >
                  {/* User header */}
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-4 pb-3 border-b">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {user.name?.charAt(0).toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium flex items-center gap-1.5">
                          {user.name}
                          {user.role === "admin" && (
                            <Badge variant="secondary" className="text-[10px] h-4">
                              Admin
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    {/* Super Admin toggle */}
                    {user.auth_user_id && (
                      <div
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-md border bg-muted/30",
                          pendingSuperAdmin.has(user.auth_user_id) && "ring-2 ring-primary/40"
                        )}
                      >
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-xs font-medium cursor-pointer">
                          Super Admin
                        </Label>
                        <Switch
                          checked={isSuperAdminEffective(user.auth_user_id)}
                          onCheckedChange={(v) => toggleSuperAdmin(user.auth_user_id!, v)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Sectors grid - 5 per row on large screens */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                    {activeSectors.map((sector) => {
                      const eff = getEffective(user.id, sector.id);
                      const Icon = sector.icon;
                      return (
                        <div
                          key={sector.id}
                          className={cn(
                            "rounded-lg border p-3 transition-all",
                            eff.isActive
                              ? "bg-card border-primary/30"
                              : "bg-muted/20 border-border",
                            eff.hasPending && "ring-2 ring-primary/40"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className={cn("p-1 rounded", sector.bgColor)}>
                                <Icon className={cn("h-3.5 w-3.5", sector.color)} />
                              </div>
                              <span className="text-xs font-medium truncate">
                                {sector.name}
                              </span>
                            </div>
                            <Switch
                              checked={eff.isActive}
                              onCheckedChange={(v) =>
                                setEffective(user.id, sector.id, {
                                  is_active: v,
                                  role_in_sector: v ? eff.role || "member" : eff.role,
                                })
                              }
                            />
                          </div>
                          {eff.isActive ? (
                            <Select
                              value={eff.role}
                              onValueChange={(v) =>
                                setEffective(user.id, sector.id, { role_in_sector: v })
                              }
                            >
                              <SelectTrigger className="h-7 px-2 text-xs w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SECTOR_ROLES.map((r) => (
                                  <SelectItem key={r.value} value={r.value} className="text-xs">
                                    {r.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-[10px] text-muted-foreground text-center py-1">
                              Sem acesso
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-1 pt-2">
            <p>
              <span className="font-medium text-foreground">Admin:</span> acesso total ao setor ·{" "}
              <span className="font-medium text-foreground">Gestor:</span> gerencia equipe e dados ·{" "}
              <span className="font-medium text-foreground">Membro:</span> acesso padrão ·{" "}
              <span className="font-medium text-foreground">Viewer:</span> apenas leitura.
            </p>
            <p>
              Usuários marcados como <Badge variant="secondary" className="text-[10px] h-4">Admin</Badge> da conta
              já têm acesso completo a todos os setores, independentemente desta configuração.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
