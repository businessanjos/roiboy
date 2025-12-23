import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

interface Client {
  id: string;
  full_name: string;
  phone_e164: string;
  status: string;
  created_at: string;
  avatar_url: string | null;
  responsible_user_id: string | null;
  client_products?: {
    product_id: string;
    products: { id: string; name: string } | null;
  }[];
}

interface ClientEnrichment {
  vnps?: { vnps_score: number; vnps_class: string } | null;
  score?: { escore: number; roizometer: number; quadrant: string; trend: string } | null;
  contract?: { status: string; start_date: string | null; end_date: string | null } | null;
  whatsapp?: { hasConversation: boolean; messageCount: number; lastMessageAt: string | null } | null;
}

// Fetch clients with products
export function useClients() {
  return useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(`
          *,
          client_products (
            product_id,
            products (
              id,
              name
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Client[];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Fetch all client enrichment data in batch
export function useClientEnrichments(clientIds: string[]) {
  return useQuery({
    queryKey: ["clients-enrichments", clientIds.length],
    queryFn: async () => {
      if (clientIds.length === 0) return {};

      // Batch fetch all related data in parallel
      const [vnpsRes, scoresRes, contractsRes, conversationsRes, messagesRes] = await Promise.all([
        supabase
          .from("vnps_snapshots")
          .select("client_id, vnps_score, vnps_class, computed_at")
          .in("client_id", clientIds)
          .order("computed_at", { ascending: false }),
        supabase
          .from("score_snapshots")
          .select("client_id, escore, roizometer, quadrant, trend, computed_at")
          .in("client_id", clientIds)
          .order("computed_at", { ascending: false }),
        supabase
          .from("client_contracts")
          .select("client_id, status, start_date, end_date")
          .in("client_id", clientIds)
          .eq("status", "active")
          .order("end_date", { ascending: false }),
        supabase
          .from("conversations")
          .select("client_id")
          .in("client_id", clientIds),
        supabase
          .from("message_events")
          .select("client_id, sent_at")
          .in("client_id", clientIds)
          .order("sent_at", { ascending: false })
      ]);

      // Build maps
      const vnpsMap: Record<string, any> = {};
      (vnpsRes.data || []).forEach((v: any) => {
        if (!vnpsMap[v.client_id]) {
          vnpsMap[v.client_id] = { vnps_score: v.vnps_score, vnps_class: v.vnps_class };
        }
      });

      const scoresMap: Record<string, any> = {};
      (scoresRes.data || []).forEach((s: any) => {
        if (!scoresMap[s.client_id]) {
          scoresMap[s.client_id] = {
            escore: s.escore,
            roizometer: s.roizometer,
            quadrant: s.quadrant,
            trend: s.trend,
          };
        }
      });

      const contractsMap: Record<string, any> = {};
      (contractsRes.data || []).forEach((c: any) => {
        if (!contractsMap[c.client_id]) {
          contractsMap[c.client_id] = {
            status: c.status,
            start_date: c.start_date,
            end_date: c.end_date,
          };
        }
      });

      // WhatsApp data
      const conversationsSet = new Set(
        (conversationsRes.data || []).map((c: any) => c.client_id)
      );

      const messageCountMap = new Map<string, number>();
      const lastMessageMap = new Map<string, string>();
      (messagesRes.data || []).forEach((m: any) => {
        messageCountMap.set(m.client_id, (messageCountMap.get(m.client_id) || 0) + 1);
        if (!lastMessageMap.has(m.client_id)) {
          lastMessageMap.set(m.client_id, m.sent_at);
        }
      });

      const whatsappMap: Record<string, any> = {};
      clientIds.forEach((id) => {
        if (conversationsSet.has(id) || messageCountMap.has(id)) {
          whatsappMap[id] = {
            hasConversation: conversationsSet.has(id),
            messageCount: messageCountMap.get(id) || 0,
            lastMessageAt: lastMessageMap.get(id) || null,
          };
        }
      });

      // Return combined enrichments
      const enrichments: Record<string, ClientEnrichment> = {};
      clientIds.forEach((id) => {
        enrichments[id] = {
          vnps: vnpsMap[id] || null,
          score: scoresMap[id] || null,
          contract: contractsMap[id] || null,
          whatsapp: whatsappMap[id] || null,
        };
      });

      return enrichments;
    },
    enabled: clientIds.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Fetch custom fields
export function useCustomFields() {
  return useQuery({
    queryKey: ["custom-fields"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_fields")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Fetch field values for all clients
export function useFieldValues(clientIds: string[]) {
  return useQuery({
    queryKey: ["field-values", clientIds.length],
    queryFn: async () => {
      if (clientIds.length === 0) return {};

      const { data, error } = await supabase
        .from("client_field_values")
        .select("*")
        .in("client_id", clientIds);

      if (error) throw error;

      // Group by client_id
      const grouped: Record<string, Record<string, any>> = {};
      (data || []).forEach((fv: any) => {
        if (!grouped[fv.client_id]) {
          grouped[fv.client_id] = {};
        }
        // Determine which value to use based on what's populated
        const value = fv.value_text ?? fv.value_number ?? fv.value_boolean ?? fv.value_date ?? fv.value_json;
        grouped[fv.client_id][fv.field_id] = value;
      });

      return grouped;
    },
    enabled: clientIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Fetch products
export function useProducts() {
  return useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, is_active")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Fetch team users
export function useTeamUsers() {
  return useQuery({
    queryKey: ["team-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email")
        .order("name");

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Fetch pending form sends
export function usePendingFormSends(clientIds: string[]) {
  return useQuery({
    queryKey: ["pending-form-sends", clientIds.length],
    queryFn: async () => {
      if (clientIds.length === 0) return {};

      const { data, error } = await supabase
        .from("client_form_sends")
        .select("client_id, form_id, sent_at, forms(title)")
        .in("client_id", clientIds)
        .is("responded_at", null)
        .order("sent_at", { ascending: false });

      if (error) throw error;

      // Group by client_id
      const grouped: Record<string, { formId: string; formTitle: string; sentAt: string }[]> = {};
      (data || []).forEach((fs: any) => {
        if (!grouped[fs.client_id]) {
          grouped[fs.client_id] = [];
        }
        grouped[fs.client_id].push({
          formId: fs.form_id,
          formTitle: fs.forms?.title || "Formulário",
          sentAt: fs.sent_at,
        });
      });

      return grouped;
    },
    enabled: clientIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Combined hook for clients page
export function useClientsPageData() {
  const clientsQuery = useClients();
  const customFieldsQuery = useCustomFields();
  const productsQuery = useProducts();
  const teamUsersQuery = useTeamUsers();

  const clientIds = useMemo(() => 
    (clientsQuery.data || []).map(c => c.id),
    [clientsQuery.data]
  );

  const enrichmentsQuery = useClientEnrichments(clientIds);
  const fieldValuesQuery = useFieldValues(clientIds);
  const pendingFormSendsQuery = usePendingFormSends(clientIds);

  const isLoading = 
    clientsQuery.isLoading || 
    customFieldsQuery.isLoading || 
    productsQuery.isLoading;

  const refetchAll = () => {
    clientsQuery.refetch();
    enrichmentsQuery.refetch();
    fieldValuesQuery.refetch();
    pendingFormSendsQuery.refetch();
  };

  return {
    clients: clientsQuery.data || [],
    enrichments: enrichmentsQuery.data || {},
    customFields: customFieldsQuery.data || [],
    fieldValues: fieldValuesQuery.data || {},
    products: productsQuery.data || [],
    teamUsers: teamUsersQuery.data || [],
    pendingFormSends: pendingFormSendsQuery.data || {},
    isLoading,
    refetchAll,
  };
}
