import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { AccessLevel, AccessScope } from "@/lib/access/permissionCatalog";
import { isExplicitlyDenied } from "@/lib/access/profileGate";

interface Row { module: string; sub_item: string; access_level: AccessLevel; scope: AccessScope }

/** Permissões efetivas do Perfil (override individual > perfil). Gestores/admins podem tudo. */
export function useUserPermissions() {
  const { currentUser } = useCurrentUser();
  const { data, isLoading } = useQuery({
    queryKey: ["user-profile-permissions", currentUser?.id],
    enabled: !!currentUser?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_user_permissions");
      if (error) throw error;
      return data as { is_admin: boolean; permissions: Row[] };
    },
  });
  const isAdmin = data?.is_admin ?? false;
  const perms = data?.permissions ?? [];
  const find = (m: string, s: string) => perms.find((p) => p.module === m && p.sub_item === s);

  const can = (module: string, sub: string, level: "view" | "manage" = "view") => {
    if (isAdmin) return true;
    const p = find(module, sub);
    if (!p || p.access_level === "none") return false;
    return level === "view" ? true : p.access_level === "manage";
  };
  /** true só quando o item está configurado como "Sem acesso" (não bloqueia quem não tem perfil). */
  const denied = (module: string, sub: string) => !isAdmin && isExplicitlyDenied(perms, module, sub);
  const scopeOf = (module: string, sub: string): AccessScope => (isAdmin ? "all" : find(module, sub)?.scope ?? "own");

  return { can, denied, scopeOf, isAdmin, perms, loading: !!currentUser?.id && isLoading };
}
