import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export function useTvCanManage() {
  return useQuery({
    queryKey: ["tv-can-manage"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await db.rpc("tv_can_manage", { _uid: u.user.id });
      return !!data;
    },
    staleTime: 5 * 60_000,
  });
}

/** Só administradores adicionam TVs. */
export function useTvIsAdmin() {
  return useQuery({
    queryKey: ["tv-is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await db.from("users").select("role,is_also_admin").eq("auth_user_id", u.user.id).maybeSingle();
      return !!data && (["admin", "super_admin"].includes(data.role) || !!data.is_also_admin);
    },
    staleTime: 5 * 60_000,
  });
}

export function useTvWall(enabled: boolean) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["tv-wall"],
    enabled,
    refetchInterval: 10_000,
    queryFn: async () => {
      const [screens, settings, status, events, commands] = await Promise.all([
        db.from("tv_screens").select("*").order("slot"),
        db.from("tv_settings").select("*").eq("id", 1).maybeSingle(),
        db.from("tv_status").select("*"),
        db.from("tv_events").select("*").order("created_at", { ascending: false }).limit(300),
        db.from("tv_commands").select("*").order("created_at", { ascending: false }).limit(300),
      ]);
      const err = screens.error || settings.error || status.error || events.error || commands.error;
      if (err) throw err;
      return {
        screens: screens.data as any[],
        settings: settings.data as any,
        status: status.data as any[],
        events: events.data as any[],
        commands: commands.data as any[],
      };
    },
  });

  useEffect(() => {
    if (!enabled) return;
    const ch = supabase.channel(`tv-wall-${Math.random().toString(36).slice(2)}`);
    for (const t of ["tv_status", "tv_commands", "tv_events", "tv_screens"]) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () =>
        qc.invalidateQueries({ queryKey: ["tv-wall"] }));
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [enabled, qc]);

  return q;
}

export async function sendTvCommand(slot: number | null, command: string, payload: Record<string, unknown> = {}) {
  const { error } = await db.from("tv_commands").insert({ slot, command, payload });
  if (error) throw error;
}

export async function updateTvScreen(slot: number, patch: Record<string, unknown>) {
  const { error } = await db.from("tv_screens").update(patch).eq("slot", slot);
  if (error) throw error;
}

export async function updateTvSettings(patch: Record<string, unknown>) {
  const { error } = await db.from("tv_settings").update(patch).eq("id", 1);
  if (error) throw error;
}

export async function releaseTvs(slots: number[], until: string | null) {
  const { error } = await db.rpc("tv_release", { _slots: slots, _until: until });
  if (error) throw error;
}

export function useTvConnHistory(slot: number | null) {
  return useQuery({
    queryKey: ["tv-conn-history", slot],
    enabled: slot != null,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from("tv_conn_history").select("latency_ms,packet_loss_pct,connection,created_at")
        .eq("slot", slot).gte("created_at", new Date(Date.now() - 86400_000).toISOString()).order("created_at");
      if (error) throw error;
      return (data ?? []) as { latency_ms: number | null; packet_loss_pct: number | null; connection: string | null; created_at: string }[];
    },
  });
}
