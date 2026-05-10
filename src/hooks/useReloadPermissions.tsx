import { useCallback, useContext, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissionsContextSafe } from "@/hooks/usePermissions";
import { toast } from "sonner";

/**
 * Forces a fresh fetch of the user's sectors, permissions and related caches
 * without requiring a logout or full page reload.
 */
export function useReloadPermissions() {
  const queryClient = useQueryClient();
  const { refetchPermissions } = usePermissions();
  const [reloading, setReloading] = useState(false);

  const reload = useCallback(async () => {
    setReloading(true);
    try {
      // Invalidate every cache that drives access decisions.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-sector-access"] }),
        queryClient.invalidateQueries({ queryKey: ["sector-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["current-user"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin"] }),
        queryClient.invalidateQueries({ queryKey: ["external-access-check"] }),
        queryClient.invalidateQueries({ queryKey: ["subscription-status"] }),
      ]);
      // Re-run the permissions resolver (team_roles + sector access merge).
      await refetchPermissions();
      toast.success("Permissões atualizadas", {
        description: "Setores e acessos foram recarregados.",
      });
    } catch (err) {
      console.error("Failed to reload permissions:", err);
      toast.error("Não foi possível recarregar as permissões", {
        description: "Tente novamente em alguns segundos.",
      });
    } finally {
      setReloading(false);
    }
  }, [queryClient, refetchPermissions]);

  return { reload, reloading };
}
