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
  // joined client-side
  agency?: { name: string; color: string } | null;
  requested_by?: { name: string | null; avatar_url: string | null } | null;
  assigned_to?: { name: string | null; avatar_url: string | null } | null;
}

async function hydrate(rows: any[]) {
  if (!rows.length) return rows as MaterialRequest[];
  const sb: any = supabase;
  const userIds = Array.from(
    new Set(
      rows.flatMap((r) => [r.requested_by_user_id, r.assigned_to_user_id]).filter(Boolean)
    )
  );
  const agencyIds = Array.from(new Set(rows.map((r) => r.agency_id).filter(Boolean)));

  const [usersRes, agRes] = await Promise.all([
    userIds.length
      ? sb.from("users").select("id, name, avatar_url").in("id", userIds)
      : Promise.resolve({ data: [] }),
    agencyIds.length
      ? sb.from("traffic_agencies").select("id, name, color").in("id", agencyIds)
      : Promise.resolve({ data: [] }),
  ]);

  const usersById = new Map((usersRes.data || []).map((u: any) => [u.id, u]));
  const agById = new Map((agRes.data || []).map((a: any) => [a.id, a]));

  return rows.map((r) => ({
    ...r,
    requested_by: usersById.get(r.requested_by_user_id) ?? null,
    assigned_to: r.assigned_to_user_id ? usersById.get(r.assigned_to_user_id) ?? null : null,
    agency: agById.get(r.agency_id) ?? null,
  })) as MaterialRequest[];
}

export function useMaterialRequests(agencyId?: string) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  return useQuery({
    queryKey: ["material-requests", accountId, agencyId ?? "all"],
    enabled: !!currentUser,
    queryFn: async (): Promise<MaterialRequest[]> => {
      const sb: any = supabase;
      let q = sb
        .from("marketing_material_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (agencyId) q = q.eq("agency_id", agencyId);
      const { data, error } = await q;
      if (error) throw error;
      return hydrate((data || []) as any[]);
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
      qc.invalidateQueries({ queryKey: ["traffic-agencies"] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material-requests"] });
      qc.invalidateQueries({ queryKey: ["traffic-agencies"] });
    },
  });
}

export function useRequestComments(requestId?: string) {
  return useQuery({
    queryKey: ["material-request-comments", requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const sb: any = supabase;
      const { data, error } = await sb
        .from("marketing_material_request_comments")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data || []) as any[];
      if (!rows.length) return rows;
      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      const { data: users = [] } = await sb
        .from("users")
        .select("id, name, avatar_url")
        .in("id", userIds);
      const byId = new Map((users as any[]).map((u) => [u.id, u]));
      return rows.map((r) => ({ ...r, user: byId.get(r.user_id) ?? null }));
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
