import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sectors, SectorId } from "@/config/sectors";
import { PERMISSIONS } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Search, ShieldCheck, KeyRound, LayoutGrid, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  is_also_admin: boolean | null;
  account_id: string;
  team_role_id: string | null;
  team_role_ids: string[] | null;
}

interface SectorAccessRow {
  sector_id: string;
  role_in_sector: string | null;
  is_active: boolean;
}

interface RolePermRow {
  role_id: string;
  permission: string;
}

const SKIP_GUARD_PATHS = ["/setores", "/settings", "/profile", "/notifications", "/account-settings", "/billing"];

function isPathSkipped(path: string): boolean {
  return SKIP_GUARD_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export function AccessAuditTab() {
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["audit-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, full_name, role, is_also_admin, account_id, team_role_id, team_role_ids")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data || []) as UserRow[];
    },
  });

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  const { data: sectorAccess = [] } = useQuery({
    queryKey: ["audit-sector-access", selectedUserId],
    enabled: !!selectedUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_sector_access")
        .select("sector_id, role_in_sector, is_active")
        .eq("user_id", selectedUserId!);
      if (error) throw error;
      return (data || []) as SectorAccessRow[];
    },
  });

  const roleIds = useMemo(() => {
    if (!selectedUser) return [];
    return Array.from(
      new Set([...(selectedUser.team_role_ids || []), selectedUser.team_role_id].filter(Boolean))
    ) as string[];
  }, [selectedUser]);

  const { data: rolePerms = [] } = useQuery({
    queryKey: ["audit-role-perms", roleIds],
    enabled: roleIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("role_id, permission")
        .in("role_id", roleIds);
      if (error) throw error;
      return (data || []) as RolePermRow[];
    },
  });

  const { data: teamRoles = [] } = useQuery({
    queryKey: ["audit-team-roles", roleIds],
    enabled: roleIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_roles")
        .select("id, name")
        .in("id", roleIds);
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
  });

  // ===== Compute effective access =====
  const audit = useMemo(() => {
    if (!selectedUser) return null;

    const isAdminRole = selectedUser.role === "admin" || selectedUser.role === "super_admin";
    const isAlsoAdmin = selectedUser.is_also_admin === true;
    const isAdmin = isAdminRole || isAlsoAdmin;

    const activeSectorIds = new Set(
      sectorAccess.filter((s) => s.is_active).map((s) => s.sector_id)
    );

    const fromRoles = new Set(rolePerms.map((p) => p.permission));

    const fromSectors = new Set<string>();
    for (const access of sectorAccess) {
      if (!access.is_active) continue;
      const sector = sectors.find((s) => s.id === access.sector_id);
      if (!sector) continue;
      for (const item of sector.navItems) {
        if (!item.permission) continue;
        const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
        perms.forEach((p) => fromSectors.add(p));
      }
    }

    const allPerms = isAdmin
      ? new Set(Object.values(PERMISSIONS))
      : new Set([...fromRoles, ...fromSectors]);

    // Per-route verdict
    const routeVerdicts = sectors.flatMap((sector) =>
      sector.navItems.map((item) => {
        const skipped = isPathSkipped(item.to);
        const sectorActive = activeSectorIds.has(sector.id);
        const requiredPerms = item.permission
          ? Array.isArray(item.permission)
            ? item.permission
            : [item.permission]
          : [];

        let allowed = false;
        let rule = "";
        let blockedReason = "";

        if (isAdminRole) {
          allowed = true;
          rule = `Bypass: role="${selectedUser.role}"`;
        } else if (isAlsoAdmin) {
          allowed = true;
          rule = "Bypass: is_also_admin=true";
        } else if (skipped) {
          allowed = true;
          rule = "Rota global (sem guarda de setor)";
        } else if (!sectorActive) {
          allowed = false;
          blockedReason = `Setor "${sector.name}" não está ativo em user_sector_access`;
          rule = "Bloqueio: AppLayout → guarda de setor";
        } else if (requiredPerms.length === 0) {
          allowed = true;
          rule = "Setor ativo + nav item sem permissão exigida";
        } else {
          const granted = requiredPerms.filter((p) => allPerms.has(p));
          if (granted.length > 0) {
            allowed = true;
            const sourceFromRole = granted.find((p) => fromRoles.has(p));
            const sourceFromSector = granted.find((p) => fromSectors.has(p));
            const sources: string[] = [];
            if (sourceFromRole) sources.push(`role_permissions (${sourceFromRole})`);
            if (sourceFromSector) sources.push(`setor "${sector.name}" (${sourceFromSector})`);
            rule = `Setor ativo + permissão concedida via ${sources.join(" + ")}`;
          } else {
            allowed = false;
            blockedReason = `Faltam permissões: ${requiredPerms.join(", ")}`;
            rule = "Bloqueio: AppLayout → guarda de permissão";
          }
        }

        return {
          sectorId: sector.id as SectorId,
          sectorName: sector.name,
          to: item.to,
          label: item.label,
          requiredPerms,
          sectorActive,
          skipped,
          allowed,
          rule,
          blockedReason,
        };
      })
    );

    return {
      isAdmin,
      isAdminRole,
      isAlsoAdmin,
      activeSectorIds,
      fromRoles,
      fromSectors,
      allPerms,
      routeVerdicts,
    };
  }, [selectedUser, sectorAccess, rolePerms]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Auditoria de Acesso</h2>
        <p className="text-muted-foreground text-sm">
          Selecione um usuário para inspecionar setores ativos, permissões efetivas e a regra exata
          que libera ou bloqueia cada rota (incluindo /roy-zapp e /ever-ia).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* User picker */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Usuários</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, email ou role…"
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="divide-y">
                {loadingUsers && <p className="p-4 text-sm text-muted-foreground">Carregando…</p>}
                {!loadingUsers && filteredUsers.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
                )}
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                      selectedUserId === u.id && "bg-accent"
                    )}
                  >
                    <div className="font-medium text-sm truncate">
                      {u.full_name || "(sem nome)"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {u.role && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {u.role}
                        </Badge>
                      )}
                      {u.is_also_admin && (
                        <Badge className="text-[10px] px-1 py-0 bg-amber-500/20 text-amber-700 hover:bg-amber-500/20">
                          also_admin
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Audit details */}
        <div className="space-y-4">
          {!selectedUser && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Selecione um usuário à esquerda para ver a auditoria de acesso.
              </CardContent>
            </Card>
          )}

          {selectedUser && audit && (
            <>
              {/* Identity */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Identidade & Flags
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div>
                      <span className="text-muted-foreground">Nome: </span>
                      <span className="font-medium">{selectedUser.full_name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email: </span>
                      <span className="font-medium">{selectedUser.email || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">role: </span>
                      <Badge variant="outline">{selectedUser.role || "—"}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">is_also_admin: </span>
                      <Badge variant={audit.isAlsoAdmin ? "default" : "outline"}>
                        {String(!!audit.isAlsoAdmin)}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">team_roles: </span>
                      {teamRoles.length === 0 ? (
                        <span className="text-muted-foreground italic">nenhum</span>
                      ) : (
                        teamRoles.map((r) => (
                          <Badge key={r.id} variant="secondary" className="ml-1">
                            {r.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  {audit.isAdmin && (
                    <div className="flex items-center gap-2 mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span className="text-xs">
                        Este usuário tem <strong>bypass total</strong> de permissões (admin) — qualquer
                        rota é liberada independente das configurações de setor.
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sectors */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Setores
                  </CardTitle>
                  <CardDescription>
                    Origem: <code>user_sector_access</code> (toggle do painel Admin → Permissões)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {sectors.map((sector) => {
                      const active = audit.activeSectorIds.has(sector.id);
                      return (
                        <div
                          key={sector.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded border text-sm",
                            active
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : "border-border bg-muted/30 opacity-70"
                          )}
                        >
                          {active ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="truncate">{sector.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Permissions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Permissões Efetivas
                  </CardTitle>
                  <CardDescription>
                    União de permissões vindas de team_roles e dos setores ativos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Vindas de team_roles ({audit.fromRoles.size})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {audit.fromRoles.size === 0 ? (
                        <span className="text-xs text-muted-foreground italic">nenhuma</span>
                      ) : (
                        [...audit.fromRoles].map((p) => (
                          <Badge key={p} variant="secondary" className="text-[10px]">
                            {p}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Vindas dos setores ativos ({audit.fromSectors.size})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {audit.fromSectors.size === 0 ? (
                        <span className="text-xs text-muted-foreground italic">nenhuma</span>
                      ) : (
                        [...audit.fromSectors].map((p) => (
                          <Badge key={p} variant="outline" className="text-[10px]">
                            {p}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Per-route verdict */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Veredito por rota</CardTitle>
                  <CardDescription>
                    Avaliação exata feita pelo guarda em <code>AppLayout.tsx</code> para cada nav item
                    de cada setor.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Status</TableHead>
                        <TableHead>Rota</TableHead>
                        <TableHead>Setor</TableHead>
                        <TableHead>Permissão exigida</TableHead>
                        <TableHead>Regra que decidiu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audit.routeVerdicts.map((v, idx) => (
                        <TableRow key={`${v.sectorId}-${v.to}-${idx}`}>
                          <TableCell>
                            {v.allowed ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 border-emerald-500/30">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                LIBERADO
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="bg-destructive/15 text-destructive hover:bg-destructive/15 border-destructive/30">
                                <XCircle className="h-3 w-3 mr-1" />
                                BLOQUEADO
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs">{v.to}</code>
                            <div className="text-xs text-muted-foreground">{v.label}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {v.sectorName}
                            {v.sectorActive ? (
                              <Badge variant="outline" className="ml-1 text-[10px] border-emerald-500/40">
                                ativo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="ml-1 text-[10px]">
                                inativo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {v.requiredPerms.length === 0 ? (
                              <span className="text-muted-foreground italic">nenhuma</span>
                            ) : (
                              v.requiredPerms.map((p) => (
                                <Badge key={p} variant="secondary" className="text-[10px] mr-1">
                                  {p}
                                </Badge>
                              ))
                            )}
                          </TableCell>
                          <TableCell className="text-xs max-w-[300px]">
                            <div>{v.rule}</div>
                            {v.blockedReason && (
                              <div className="text-destructive mt-1">{v.blockedReason}</div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
