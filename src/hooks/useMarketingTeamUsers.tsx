import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

export interface MarketingTeamUser {
  /** users.id */
  id: string;
  /** auth.users id (quando existir) */
  auth_user_id: string | null;
  name: string;
  email: string;
  avatar_url: string | null;
}

/**
 * Pessoas com acesso ao setor de Marketing.
 * Fonte da verdade: user_sector_access (sector_id = 'marketing').
 * Usar em TODO seletor de pessoas dentro da área de Marketing.
 */
export function useMarketingTeamUsers() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  return useQuery({
    queryKey: ["marketing-team-users", accountId],
    enabled: !!accountId,
    staleTime: 300000,
    queryFn: async (): Promise<MarketingTeamUser[]> => {
      const { data, error } = await supabase
        .from("user_sector_access")
        .select(
          `user_id, is_active, user:users!user_sector_access_user_id_fkey(id, name, email, avatar_url, auth_user_id, is_active)`,
        )
        .eq("sector_id", "marketing")
        .eq("account_id", accountId!)
        .eq("is_active", true);

      if (error) throw error;

      const users = (data || [])
        .map((row: any) => row.user)
        .filter((u: any) => u && u.is_active !== false)
        .map((u: any) => ({
          id: u.id,
          auth_user_id: u.auth_user_id ?? null,
          name: u.name || u.email || "Sem nome",
          email: u.email || "",
          avatar_url: u.avatar_url ?? null,
        })) as MarketingTeamUser[];

      const unique = new Map(users.map((u) => [u.id, u]));
      return Array.from(unique.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      );
    },
  });
}

/** Mesma lista no formato de useTeamUsers (id = auth_user_id quando existir). */
export function useMarketingTeamUsersAuthIds() {
  const query = useMarketingTeamUsers();
  return {
    ...query,
    data: (query.data || []).map((u) => ({
      id: u.auth_user_id || u.id,
      name: u.name,
      email: u.email,
      avatar_url: u.avatar_url,
    })),
  };
}
