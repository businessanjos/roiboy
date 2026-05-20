import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { toast } from "@/hooks/use-toast";

export type PlatformAccount = {
  id: string;
  account_id: string;
  talent_id: string;
  platform: string;
  handle: string | null;
  external_id: string | null;
  access_token: string | null;
  status: "pending" | "connected" | "error" | "revoked";
  last_sync_at: string | null;
  last_sync_error: string | null;
  extra: any;
};

export type PlatformPost = {
  id: string;
  talent_id: string;
  platform: string;
  external_id: string;
  url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  media_type: string | null;
  published_at: string | null;
  pillar_id: string | null;
};

export type PlatformMetric = {
  id: string;
  post_id: string;
  collected_at: string;
  views: number; reach: number; impressions: number;
  likes: number; comments: number; shares: number; saves: number;
  avg_watch_seconds: number | null;
  watch_through_rate: number | null;
  engagement_rate: number | null;
};

export type PlatformSnapshot = {
  id: string; platform_account_id: string; talent_id: string; platform: string;
  snapshot_date: string; followers: number | null; total_views: number | null; total_engagement: number | null;
};

export function usePlatformAccounts(talentId?: string) {
  return useQuery({
    queryKey: ["platform-accounts", talentId],
    enabled: !!talentId,
    queryFn: async () => {
      const { data, error } = await supabase.from("content_platform_accounts").select("*").eq("talent_id", talentId!).order("platform");
      if (error) throw error;
      return (data || []) as PlatformAccount[];
    },
  });
}

export function usePlatformPosts(talentId?: string) {
  return useQuery({
    queryKey: ["platform-posts", talentId],
    enabled: !!talentId,
    queryFn: async () => {
      const { data, error } = await supabase.from("content_platform_posts").select("*").eq("talent_id", talentId!).order("published_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data || []) as PlatformPost[];
    },
  });
}

export function useLatestMetricsByPost(postIds: string[]) {
  return useQuery({
    queryKey: ["platform-metrics", postIds.sort().join(",")],
    enabled: postIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("content_platform_metrics").select("*").in("post_id", postIds).order("collected_at", { ascending: false });
      if (error) throw error;
      const latest = new Map<string, PlatformMetric>();
      for (const m of (data || []) as PlatformMetric[]) if (!latest.has(m.post_id)) latest.set(m.post_id, m);
      return latest;
    },
  });
}

export function useLatestSnapshots(talentId?: string) {
  return useQuery({
    queryKey: ["platform-snapshots", talentId],
    enabled: !!talentId,
    queryFn: async () => {
      const { data, error } = await supabase.from("content_platform_metric_snapshots").select("*").eq("talent_id", talentId!).order("snapshot_date", { ascending: false });
      if (error) throw error;
      const latest = new Map<string, PlatformSnapshot>();
      for (const s of (data || []) as PlatformSnapshot[]) if (!latest.has(s.platform)) latest.set(s.platform, s);
      return latest;
    },
  });
}

export function useUpsertPlatformAccount() {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  return useMutation({
    mutationFn: async (a: Partial<PlatformAccount> & { talent_id: string; platform: string }) => {
      const payload: any = { ...a, account_id: currentUser?.account_id, status: a.access_token ? "connected" : (a.status || "pending") };
      const { data, error } = await supabase
        .from("content_platform_accounts")
        .upsert(payload, { onConflict: "talent_id,platform" })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-accounts"] });
      toast({ title: "Conta vinculada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useDeletePlatformAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_platform_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-accounts"] });
      toast({ title: "Conta desvinculada" });
    },
  });
}

export async function syncPlatformAccount(accountIds: string[]) {
  const { data, error } = await supabase.functions.invoke("content-metrics-sync", { body: { account_ids: accountIds } });
  if (error) throw error;
  return data;
}
