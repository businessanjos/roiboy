import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { dedupeCalls, type ConversationCall } from "@/components/telephony/CallTimelineEvent";

const CALL_SELECT =
  "id, call_id, phone, contact_name, direction, status, duration_seconds, started_at, created_at, qualification_name, user_id, agent_name, lead_id, deal_id, client_id, activity_id, recording_url, engine, metadata, threecplus_call_transcripts(status, summary, transcript, temperature, last_error, recording_url)";

/** Últimos 8 dígitos — casamento tolerante a DDI/DDD/formatação. */
function last8(phone?: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : "";
}

interface Options {
  /** Telefone da conversa (qualquer formato). */
  phone?: string | null;
  /** Data da mensagem mais antiga carregada — limita as ligações ao mesmo intervalo. */
  sinceISO?: string | null;
  /** Desliga a busca (ex.: conversa de grupo). */
  enabled?: boolean;
}

/**
 * Ligações da 3C (feitas pelo ROY ou importadas pela sync) de um contato,
 * para exibir no meio do histórico de mensagens.
 */
export function useConversationCalls({ phone, sinceISO, enabled = true }: Options) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id ?? null;
  const key = useMemo(() => last8(phone), [phone]);
  const [calls, setCalls] = useState<ConversationCall[]>([]);

  const since = useMemo(() => {
    if (sinceISO) return sinceISO;
    return new Date(Date.now() - 90 * 86400000).toISOString();
  }, [sinceISO]);

  const load = useCallback(async () => {
    if (!enabled || !accountId || !key) {
      setCalls([]);
      return;
    }
    const { data } = await supabase
      .from("threecplus_call_logs")
      .select(CALL_SELECT)
      .eq("account_id", accountId)
      .ilike("phone", `%${key}%`)
      .gte("started_at", since)
      .order("started_at", { ascending: true })
      .limit(200);

    const rows = ((data as unknown as ConversationCall[]) || []).filter(
      (c) => last8(c.phone) === key && c.status !== "failed",
    );
    setCalls(dedupeCalls(rows));
  }, [accountId, key, since, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  // Tempo real: ligação feita pelo ROY aparece assim que termina.
  useEffect(() => {
    if (!enabled || !accountId || !key) return;
    const channel = supabase
      .channel(`conv-calls-${accountId}-${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "threecplus_call_logs", filter: `account_id=eq.${accountId}` },
        (payload) => {
          const row = (payload.new || payload.old) as { phone?: string | null } | null;
          if (row && last8(row.phone) !== key) return;
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [accountId, key, enabled, load]);

  useEffect(() => {
    if (!enabled || !key) return;
    const onOptimisticCall = (event: Event) => {
      const detail = (event as CustomEvent<ConversationCall>).detail;
      if (!detail || last8(detail.phone) !== key) return;
      setCalls((previous) => dedupeCalls([...previous.filter((call) => call.id !== detail.id), detail]));
    };
    window.addEventListener("threecplus:optimistic-call", onOptimisticCall);
    return () => window.removeEventListener("threecplus:optimistic-call", onOptimisticCall);
  }, [enabled, key]);

  return { calls, reloadCalls: load };
}
