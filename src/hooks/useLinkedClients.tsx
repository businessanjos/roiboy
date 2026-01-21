import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LinkedClient {
  id: string;
  full_name: string;
}

interface UseLinkedClientsResult {
  linkedClientIds: string[];
  linkedClients: LinkedClient[];
  hasLinkedClients: boolean;
  isLoading: boolean;
}

/**
 * Hook that returns an array of client IDs that share data with the given client.
 * When sync_data is enabled on a relationship, both clients share:
 * - Timeline (followups)
 * - Deals
 * - Life Events (CX Moments)
 * - Contracts
 * - Events/Agenda
 */
export function useLinkedClients(clientId: string | undefined): UseLinkedClientsResult {
  const { data, isLoading } = useQuery({
    queryKey: ["linked-clients", clientId],
    queryFn: async () => {
      if (!clientId) return { ids: [clientId], clients: [] };

      // Fetch relationships where sync_data is true
      const { data: relationships, error } = await supabase
        .from("client_relationships")
        .select(`
          primary_client_id,
          related_client_id,
          primary_client:clients!client_relationships_primary_client_id_fkey(id, full_name),
          related_client:clients!client_relationships_related_client_id_fkey(id, full_name)
        `)
        .eq("sync_data", true)
        .eq("is_active", true)
        .or(`primary_client_id.eq.${clientId},related_client_id.eq.${clientId}`);

      if (error) {
        console.error("Error fetching linked clients:", error);
        return { ids: [clientId], clients: [] };
      }

      const ids = new Set<string>([clientId]);
      const clients: LinkedClient[] = [];

      relationships?.forEach((r: any) => {
        if (r.primary_client_id === clientId && r.related_client) {
          ids.add(r.related_client_id);
          clients.push({
            id: r.related_client.id,
            full_name: r.related_client.full_name,
          });
        } else if (r.related_client_id === clientId && r.primary_client) {
          ids.add(r.primary_client_id);
          clients.push({
            id: r.primary_client.id,
            full_name: r.primary_client.full_name,
          });
        }
      });

      return { ids: Array.from(ids), clients };
    },
    enabled: !!clientId,
    staleTime: 30000, // 30 seconds
  });

  return {
    linkedClientIds: data?.ids || (clientId ? [clientId] : []),
    linkedClients: data?.clients || [],
    hasLinkedClients: (data?.ids?.length || 0) > 1,
    isLoading,
  };
}

/**
 * Returns the name of the linked client that owns a specific item.
 * Used to display "Via [Client Name]" badges.
 */
export function getLinkedClientName(
  itemClientId: string,
  currentClientId: string,
  linkedClients: LinkedClient[]
): string | null {
  if (itemClientId === currentClientId) return null;
  const linkedClient = linkedClients.find((c) => c.id === itemClientId);
  return linkedClient?.full_name || null;
}
