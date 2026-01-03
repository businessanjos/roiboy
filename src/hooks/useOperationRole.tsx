import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

// Operation roles that should only see clients with active/pending contracts
const OPERATION_ROLE_NAMES = ["CX", "CS", "Consultor"];

// Management roles that can see all clients
const MANAGEMENT_ROLE_NAMES = ["Admin", "Gestor", "Head"];

export function useOperationRole() {
  const { currentUser, loading: userLoading } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ["user-team-role", currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return null;

      // Admin role always sees everything
      if (currentUser.role === "admin") {
        return { isOperationRole: false, roleName: "Admin" };
      }

      // Fetch user's team role
      const { data: userData, error } = await supabase
        .from("users")
        .select("team_role_id, team_role:team_roles(id, name)")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (error || !userData?.team_role) {
        // No role assigned - default to seeing all (not restricted)
        return { isOperationRole: false, roleName: null };
      }

      const roleName = (userData.team_role as any)?.name || "";
      const isOperationRole = OPERATION_ROLE_NAMES.includes(roleName);

      return { isOperationRole, roleName };
    },
    enabled: !!currentUser && !userLoading,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  return {
    isOperationRole: data?.isOperationRole ?? false,
    roleName: data?.roleName ?? null,
    loading: userLoading || isLoading,
  };
}
