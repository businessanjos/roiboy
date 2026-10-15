import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Leitura individual dos grupos: cada pessoa tem a sua marca de "lido".
// O contador compartilhado da conversa continua existindo para conversas
// individuais; nos grupos, a contagem exibida vem da leitura de quem está logado.
type Entry = { count: number; raw: number };

export function personalUnread(raw: number, entry?: Entry): number {
  if (!entry) return raw;
  return entry.count + Math.max(0, raw - entry.raw);
}

export function useZappPersonalGroupReads<T extends { zapp_conversation?: any }>(assignments: T[]) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});

  const groupIds = useMemo(
    () =>
      Array.from(
        new Set(
          assignments
            .filter((a) => a.zapp_conversation?.is_group && a.zapp_conversation?.id)
            .map((a) => a.zapp_conversation.id as string),
        ),
      ).sort(),
    [assignments],
  );
  const key = groupIds.join(",");

  useEffect(() => {
    if (!groupIds.length) return;
    let cancelled = false;
    const rawById = new Map<string, number>();
    assignments.forEach((a) => {
      if (a.zapp_conversation?.id) rawById.set(a.zapp_conversation.id, a.zapp_conversation.unread_count || 0);
    });
    (supabase as any).rpc("zapp_my_group_unread", { p_conv_ids: groupIds }).then(({ data, error }: any) => {
      if (cancelled || error || !data) return;
      setEntries((prev) => {
        const next = { ...prev };
        (data as { conversation_id: string; unread: number }[]).forEach((r) => {
          next[r.conversation_id] = { count: r.unread || 0, raw: rawById.get(r.conversation_id) || 0 };
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Se o contador compartilhado foi zerado (ex.: alguém respondeu), reancora a base.
  useEffect(() => {
    let changed = false;
    const next = { ...entries };
    assignments.forEach((a) => {
      const zc = a.zapp_conversation;
      const e = zc?.id ? next[zc.id] : undefined;
      if (e && (zc.unread_count || 0) < e.raw) {
        next[zc.id] = { count: e.count, raw: zc.unread_count || 0 };
        changed = true;
      }
    });
    if (changed) setEntries(next);
  }, [assignments, entries]);

  const personalAssignments = useMemo(
    () =>
      assignments.map((a) => {
        const zc = a.zapp_conversation;
        if (!zc?.is_group) return a;
        const entry = entries[zc.id];
        if (!entry) return a;
        const unread = personalUnread(zc.unread_count || 0, entry);
        if (unread === zc.unread_count) return a;
        return { ...a, zapp_conversation: { ...zc, unread_count: unread } };
      }),
    [assignments, entries],
  );

  const rawFor = useCallback(
    (id: string) => assignments.find((a) => a.zapp_conversation?.id === id)?.zapp_conversation?.unread_count || 0,
    [assignments],
  );

  const markGroupRead = useCallback(
    async (id: string) => {
      setEntries((prev) => ({ ...prev, [id]: { count: 0, raw: rawFor(id) } }));
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      await (supabase as any)
        .from("zapp_conversation_reads")
        .upsert({ user_id: auth.user.id, zapp_conversation_id: id, last_read_at: new Date().toISOString() });
    },
    [rawFor],
  );

  const markGroupUnread = useCallback(
    async (id: string, lastMessageAt?: string | null) => {
      setEntries((prev) => ({ ...prev, [id]: { count: 1, raw: rawFor(id) } }));
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const base = lastMessageAt ? new Date(lastMessageAt).getTime() : Date.now();
      await (supabase as any)
        .from("zapp_conversation_reads")
        .upsert({ user_id: auth.user.id, zapp_conversation_id: id, last_read_at: new Date(base - 1000).toISOString() });
    },
    [rawFor],
  );

  return { personalAssignments, markGroupRead, markGroupUnread };
}
