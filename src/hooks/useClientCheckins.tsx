import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type {
  ClientCheckin,
  CheckinChannel,
  CheckinInitiatedBy,
  CheckinKind,
} from "@/lib/cs/checkins";

export interface NewCheckinInput {
  clientId: string;
  happenedAt: string; // ISO
  initiatedBy: CheckinInitiatedBy;
  channel: CheckinChannel;
  kind: CheckinKind;
  summary: string;
}

export function useClientCheckins(clientId?: string) {
  return useQuery({
    queryKey: ["client-checkins", clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<ClientCheckin[]> => {
      const { data, error } = await supabase
        .from("client_checkins")
        .select("*, users(name, avatar_url)")
        .eq("client_id", clientId!)
        .order("happened_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as ClientCheckin[];
    },
  });
}

export function useCreateCheckin() {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewCheckinInput) => {
      if (!currentUser?.account_id || !currentUser?.id) {
        throw new Error("Sessão sem contexto de usuário");
      }
      const { error } = await supabase.from("client_checkins").insert({
        account_id: currentUser.account_id,
        client_id: input.clientId,
        user_id: currentUser.id,
        happened_at: input.happenedAt,
        initiated_by: input.initiatedBy,
        channel: input.channel,
        kind: input.kind,
        summary: input.summary.trim(),
        source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: ["client-checkins", input.clientId] });
      qc.invalidateQueries({ queryKey: ["checkpoints-panel"] });
    },
  });
}

export interface CheckpointRow {
  client_id: string;
  full_name: string;
  consultant_name: string | null;
  status: string | null;
  last_checkpoint_at: string | null;
  last_contact_at: string | null;
  last_summary: string | null;
}

/** Lista clientes ativos com a data do último checkpoint/contato. */
export function useCheckpointsPanel() {
  const { currentUser } = useCurrentUser();

  return useQuery({
    queryKey: ["checkpoints-panel", currentUser?.account_id],
    enabled: !!currentUser?.account_id,
    queryFn: async (): Promise<CheckpointRow[]> => {
      const { data: clients, error } = await supabase
        .from("clients")
        .select("id, full_name, status, consultant:users!clients_responsible_user_id_fkey(name)")
        .eq("account_id", currentUser!.account_id)
        .in("status", ["active", "churn_risk", "paused"])
        .order("full_name");
      if (error) throw error;

      const ids = (clients || []).map((c: any) => c.id);
      if (ids.length === 0) return [];

      const { data: checkins, error: cErr } = await supabase
        .from("client_checkins")
        .select("client_id, happened_at, kind, summary")
        .in("client_id", ids)
        .order("happened_at", { ascending: false })
        .limit(5000);
      if (cErr) throw cErr;

      const lastCheckpoint = new Map<string, string>();
      const lastContact = new Map<string, { at: string; summary: string }>();
      for (const row of (checkins || []) as any[]) {
        if (!lastContact.has(row.client_id)) {
          lastContact.set(row.client_id, { at: row.happened_at, summary: row.summary });
        }
        if (row.kind === "checkpoint" && !lastCheckpoint.has(row.client_id)) {
          lastCheckpoint.set(row.client_id, row.happened_at);
        }
      }

      return (clients || []).map((c: any) => ({
        client_id: c.id,
        full_name: c.full_name,
        consultant_name: c.consultant?.name ?? null,
        status: c.status,
        last_checkpoint_at: lastCheckpoint.get(c.id) ?? null,
        last_contact_at: lastContact.get(c.id)?.at ?? null,
        last_summary: lastContact.get(c.id)?.summary ?? null,
      }));
    },
  });
}
