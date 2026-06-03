import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { MaterialRequestCategory, MaterialRequestStatus } from "@/lib/agency";

export interface MaterialRequest {
  id: string;
  account_id: string;
  agency_id: string;
  requested_by_user_id: string;
  assigned_to_user_id: string | null;
  category: MaterialRequestCategory;
  title: string;
  description: string | null;
  payload: Record<string, any>;
  status: MaterialRequestStatus;
  priority: string;
  due_date: string | null;
  attachments: any[];
  created_at: string;
  updated_at: string;
  // joined
  agency?: { name: string; color: string } | null;
  requested_by?: { name: string; avatar_url: string | null } | null;
  assigned_to?: { name: string; avatar_url: string | null } | null;
}

export function useMaterialRequests(agencyId?: string) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  return useQuery({
    queryKey: ["material-requests", accountId, agencyId ?? "all"],
    enabled: !!accountId,
    queryFn: async (): Promise<MaterialRequest[]> => {
      const sb: any = supabase;
      let q = sb
        .from("marketing_material_requests")
        .select(
          "*, agency:traffic_agencies(name,color), requested_by:users!marketing_material_requests_requested_by_user_id_fkey(name,avatar_url), assigned_to:users!marketing_material_requests_assigned_to_user_id_fkey(name,avatar_url)"
        )
        .order("created_at", { ascending: false });
      if (agencyId) q = q.eq("agency_id", agencyId);
      const { data, error } = await q;
      // Fallback: relationships may not exist as named, try without joins
      if (error) {
        const { data: d2 } = await sb
          .from("marketing_material_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .maybeSingle?.() ?? { data: [] };
        return (Array.isArray(d2) ? d2 : []) as MaterialRequest[];
      }
      return (data || []) as MaterialRequest[];
    },
  });
}

export function useCreateMaterialRequest() {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  return useMutation({
    mutationFn: async (input: {
      agency_id: string;
      category: MaterialRequestCategory;
      title: string;
      description?: string;
      payload?: Record<string, any>;
      priority?: string;
      due_date?: string | null;
    }) => {
      const sb: any = supabase;
      const { data, error } = await sb
        .from("marketing_material_requests")
        .insert({
          account_id: currentUser!.account_id,
          requested_by_user_id: currentUser!.id,
          agency_id: input.agency_id,
          category: input.category,
          title: input.title,
          description: input.description ?? null,
          payload: input.payload ?? {},
          priority: input.priority ?? "normal",
          due_date: input.due_date ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-requests"] });
    },
  });
}

export function useUpdateMaterialRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<MaterialRequest> }) => {
      const sb: any = supabase;
      const { data, error } = await sb
        .from("marketing_material_requests")
        .update(input.patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["material-requests"] }),
  });
}

export function useRequestComments(requestId?: string) {
  return useQuery({
    queryKey: ["material-request-comments", requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const sb: any = supabase;
      const { data } = await sb
        .from("marketing_material_request_comments")
        .select("*, user:users(name,avatar_url)")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      return (data || []) as any[];
    },
  });
}

export function useAddRequestComment() {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  return useMutation({
    mutationFn: async (input: { request_id: string; body: string }) => {
      const sb: any = supabase;
      const { data, error } = await sb
        .from("marketing_material_request_comments")
        .insert({
          request_id: input.request_id,
          user_id: currentUser!.id,
          body: input.body,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["material-request-comments", v.request_id] }),
  });
}
