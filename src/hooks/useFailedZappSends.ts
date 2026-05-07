import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

export interface FailedSend {
  id: string;
  zapp_conversation_id: string;
  message_type: string;
  content: string | null;
  delivery_status: string | null;
  created_at: string;
  sector_id: string | null;
  contact_name: string | null;
  phone_e164: string | null;
}

const WINDOW_HOURS = 24;
const DISMISS_KEY = "zapp_failed_sends_dismissed_v1";

const loadDismissed = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch { return new Set(); }
};

const saveDismissed = (set: Set<string>) => {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(set))); } catch {}
};

export function useFailedZappSends(opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [items, setItems] = useState<FailedSend[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!accountId) return;
    const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("zapp_messages")
      .select("id, zapp_conversation_id, message_type, content, delivery_status, created_at, external_message_id, zapp_conversations!inner(sector_id, contact_name, phone_e164, account_id)")
      .eq("account_id", accountId)
      .eq("direction", "outbound")
      .is("external_message_id", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error("[useFailedZappSends] fetch error", error);
      setLoading(false);
      return;
    }
    const mapped: FailedSend[] = (data || []).map((m: any) => ({
      id: m.id,
      zapp_conversation_id: m.zapp_conversation_id,
      message_type: m.message_type,
      content: m.content,
      delivery_status: m.delivery_status,
      created_at: m.created_at,
      sector_id: m.zapp_conversations?.sector_id ?? null,
      contact_name: m.zapp_conversations?.contact_name ?? null,
      phone_e164: m.zapp_conversations?.phone_e164 ?? null,
    }));
    setItems(mapped);
    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    if (!enabled || !accountId) return;
    fetchAll();
    const channel = supabase
      .channel(`failed-zapp-sends-${accountId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zapp_messages", filter: `account_id=eq.${accountId}` },
        () => { fetchAll(); }
      )
      .subscribe();
    const interval = setInterval(fetchAll, 60_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [enabled, accountId, fetchAll]);

  const visible = items.filter(i => !dismissed.has(i.id));

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    saveDismissed(next);
  };

  const dismissAll = () => {
    const next = new Set(dismissed);
    items.forEach(i => next.add(i.id));
    setDismissed(next);
    saveDismissed(next);
  };

  // Aggregate by sector + type
  const breakdown = visible.reduce<Record<string, Record<string, number>>>((acc, m) => {
    const sector = m.sector_id || "—";
    const type = m.message_type || "unknown";
    acc[sector] = acc[sector] || {};
    acc[sector][type] = (acc[sector][type] || 0) + 1;
    return acc;
  }, {});

  return {
    items: visible,
    allItems: items,
    count: visible.length,
    breakdown,
    loading,
    refresh: fetchAll,
    dismiss,
    dismissAll,
  };
}
