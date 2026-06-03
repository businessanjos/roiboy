import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { isTrafficAgencyUser } from "@/lib/agency";
import type { TrafficAgency } from "./useTrafficAgencies";

/**
 * Returns the agency the current user is bound to (if any).
 * Combined with isTrafficAgencyUser() to gate the portal experience.
 */
export function useCurrentAgency() {
  const { currentUser } = useCurrentUser();
  const userId = currentUser?.id;

  const query = useQuery({
    queryKey: ["current-agency", userId],
    enabled: !!userId,
    queryFn: async (): Promise<TrafficAgency | null> => {
      const sb: any = supabase;
      const { data: membership } = await sb
        .from("traffic_agency_members")
        .select("agency_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership?.agency_id) return null;
      const { data: agency } = await sb
        .from("traffic_agencies")
        .select("*")
        .eq("id", membership.agency_id)
        .maybeSingle();
      return agency as TrafficAgency | null;
    },
  });

  return {
    ...query,
    isAgencyUser: isTrafficAgencyUser(currentUser),
    agency: query.data ?? null,
  };
}
