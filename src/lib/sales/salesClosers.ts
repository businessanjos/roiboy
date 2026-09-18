import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export interface SalesCloser {
  userId: string;
  name: string;
  position: string;
  /** aliases para compatibilidade com as telas existentes */
  user_id: string;
  full_name: string;
}

/**
 * Closers / Executivos Comerciais ATIVOS da conta.
 * Fonte: hr_collaborators (cargo comercial, status active, sem desligamento)
 * cruzado com users ativos. SDR / Gerente / Manager ficam de fora.
 */
export function useActiveSalesClosers(positionFilter?: string) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  return useQuery({
    queryKey: ["active-sales-closers", accountId, positionFilter ?? "default"],
    enabled: !!accountId,
    queryFn: async (): Promise<SalesCloser[]> => {
      let q = supabase
        .from("hr_collaborators")
        .select("user_id, full_name, position, status, termination_date")
        .eq("account_id", accountId!)
        .not("user_id", "is", null)
        .eq("status", "active")
        .is("termination_date", null);

      if (positionFilter) q = q.ilike("position", `%${positionFilter}%`);
      else q = q.or("position.ilike.%closer%,position.ilike.%executiv%");

      const { data, error } = await q;
      if (error) throw error;

      const collaborators = (data ?? []).filter((c: any) => {
        const pos = (c.position || "").toLowerCase();
        return !pos.includes("sdr") && !pos.includes("gerente") && !pos.includes("manager");
      });

      const userIds = collaborators.map((c: any) => c.user_id).filter(Boolean) as string[];
      if (userIds.length === 0) return [];

      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, name, is_active")
        .eq("account_id", accountId!)
        .in("id", userIds);
      if (usersError) throw usersError;

      const activeUsers = new Map(
        (users ?? [])
          .filter((u: any) => u.is_active !== false)
          .map((u: any) => [u.id, u.name as string]),
      );

      return collaborators
        .filter((c: any) => activeUsers.has(c.user_id))
        .map((c: any) => ({
          userId: c.user_id as string,
          name: (activeUsers.get(c.user_id) as string) || c.full_name || "Sem nome",
          position: c.position || "",
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    },
  });
}
