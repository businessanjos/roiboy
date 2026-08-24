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
      // Paginação manual: o PostgREST corta em 1000 linhas por requisição.
      const clients: any[] = [];
      const PAGE = 1000;
      for (let page = 0; page < 20; page++) {
        const from = page * PAGE;
        const { data, error } = await supabase
          .from("clients")
          .select("id, full_name, status, consultant:users!clients_responsible_user_id_fkey(name)")
          .eq("account_id", currentUser!.account_id)
          .eq("status", "active")
          .order("full_name")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        clients.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }

      if (clients.length === 0) return [];

      // Buscar check-ins por conta (não por lista de IDs: a URL estoura com
      // milhares de clientes e a requisição falha com 414).
      const { data: checkins, error: cErr } = await supabase
        .from("client_checkins")
        .select("client_id, happened_at, kind, summary")
        .eq("account_id", currentUser!.account_id)
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

export interface CheckinsReportFilters {
  from?: string | null; // yyyy-MM-dd
  to?: string | null; // yyyy-MM-dd
  channel?: string | null; // "todos" | CheckinChannel
  kind?: string | null; // "todos" | CheckinKind
  clientId?: string | null;
  enabled?: boolean;
}

export interface CheckinReportRow extends ClientCheckin {
  client_name: string | null;
  consultant_name: string | null;
}

/** Todos os check-ins da conta no período/canal escolhido (para relatório e CSV). */
export function useCheckinsReport(filters: CheckinsReportFilters) {
  const { currentUser } = useCurrentUser();
  const { from, to, channel, kind, clientId, enabled = true } = filters;

  return useQuery({
    queryKey: [
      "checkins-report",
      currentUser?.account_id,
      from || null,
      to || null,
      channel || "todos",
      kind || "todos",
      clientId || null,
    ],
    enabled: enabled && !!currentUser?.account_id,
    queryFn: async (): Promise<CheckinReportRow[]> => {
      const PAGE = 1000;
      const out: any[] = [];
      for (let page = 0; page < 20; page++) {
        let q = supabase
          .from("client_checkins")
          .select(
            "*, clients(full_name, responsible:users!clients_responsible_user_id_fkey(name)), users(name, avatar_url)"
          )
          .eq("account_id", currentUser!.account_id)
          .order("happened_at", { ascending: false })
          .range(page * PAGE, page * PAGE + PAGE - 1);

        if (from) q = q.gte("happened_at", `${from}T00:00:00`);
        if (to) q = q.lte("happened_at", `${to}T23:59:59`);
        if (channel && channel !== "todos") q = q.eq("channel", channel);
        if (kind && kind !== "todos") q = q.eq("kind", kind);
        if (clientId) q = q.eq("client_id", clientId);

        const { data, error } = await q;
        if (error) throw error;
        out.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }

      return out.map((r: any) => ({
        ...r,
        client_name: r.clients?.full_name ?? null,
        consultant_name: r.users?.name ?? r.clients?.responsible?.name ?? null,
      })) as CheckinReportRow[];
    },
  });
}
