import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { isManagementUser } from "@/lib/access/managementRoles";

/** The editor control mirrors the same server authorization used by content RLS. */
export function useCsProcessAccess() {
  const { currentUser } = useCurrentUser();
  const { perms, loading: permissionsLoading } = useUserPermissions();
  const editorQuery = useQuery({
    queryKey: ["cs-process-editor", currentUser?.account_id, currentUser?.auth_user_id],
    enabled: !!currentUser?.auth_user_id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_cs_process_editor");
      if (error) throw error;
      return data === true;
    },
  });
  const canEdit = !!currentUser && editorQuery.data === true;
  const canSeeAll = !!currentUser && (
    canEdit || isManagementUser(currentUser) ||
    perms.some((p) => p.module === "cs" && p.sub_item === "processos_ver_todas" && p.access_level !== "none")
  );

  return {
    canEdit,
    canSeeAll,
    defaultOwner: canSeeAll ? "all" : "mine",
    loading: permissionsLoading || (!!currentUser?.auth_user_id && editorQuery.isLoading),
  };
}