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

      // Fetch user's team roles from junction table
      const { data: userRolesData, error } = await supabase
        .from("user_team_roles")
        .select("team_role_id, team_role:team_roles(id, name)")
        .eq("user_id", currentUser.id);

      if (error || !userRolesData || userRolesData.length === 0) {
        // No roles assigned - default to seeing all (not restricted)
        return { isOperationRole: false, roleName: null };
      }

      const roleNames = userRolesData.map((ur: any) => ur.team_role?.name || "").filter(Boolean);
      const isOperationRole = roleNames.some(name => OPERATION_ROLE_NAMES.includes(name));
      const isManagement = roleNames.some(name => MANAGEMENT_ROLE_NAMES.includes(name));

      return { isOperationRole: isOperationRole && !isManagement, roleName: roleNames[0] || null };
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
