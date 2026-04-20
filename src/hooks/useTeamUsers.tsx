import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

export function useTeamUsers() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  return useQuery({
    queryKey: ["team-users", accountId],
    queryFn: async (): Promise<TeamUser[]> => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, avatar_url, auth_user_id")
        .eq("account_id", accountId)
        .order("name");
      if (error) throw error;
      return (data || []).map((u: any) => ({
        id: u.auth_user_id || u.id,
        name: u.name,
        email: u.email,
        avatar_url: u.avatar_url,
      }));
    },
    enabled: !!accountId,
  });
}
