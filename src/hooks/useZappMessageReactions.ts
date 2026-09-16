import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeUazapiManager } from "@/lib/royzapp/invokeUazapiManager";
import { toast } from "sonner";

export interface ZappReaction {
  id: string;
  zapp_message_id: string | null;
  emoji: string;
  reactor_phone: string;
  reactor_name: string | null;
  from_me: boolean;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  names: string[];
  mine: boolean;
}

interface Options {
  conversationId?: string | null;
  contactPhone?: string;
  /** Em grupos o destino da reação é o identificador do grupo. */
  groupJid?: string | null;
  sectorId?: string;
  integrationId?: string | null;
}

/**
 * Carrega e mantém em tempo real as reações (emojis) das mensagens da conversa,
 * e permite reagir/remover reação pelo ROY.
 */
export function useZappMessageReactions({
  conversationId,
  contactPhone,
  groupJid,
  sectorId,
  integrationId,
}: Options) {
  const [reactions, setReactions] = useState<ZappReaction[]>([]);
  const pendingMessagesRef = useRef(new Set<string>());

  const load = useCallback(async () => {
    if (!conversationId) {
      setReactions([]);
      return;
    }
    const { data, error } = await supabase
      .from("zapp_message_reactions")
      .select("id, zapp_message_id, emoji, reactor_phone, reactor_name, from_me")
      .eq("zapp_conversation_id", conversationId);

    if (error) {
      console.error("[Reactions] load error:", error.message);
      return;
    }
    const serverReactions = (data || []) as ZappReaction[];
    setReactions((current) => {
      const pendingIds = pendingMessagesRef.current;
      if (pendingIds.size === 0) return serverReactions;
      return [
        ...serverReactions.filter((reaction) => !reaction.zapp_message_id || !pendingIds.has(reaction.zapp_message_id)),
        ...current.filter((reaction) => reaction.zapp_message_id && pendingIds.has(reaction.zapp_message_id)),
      ];
    });
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`zapp-reactions-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "zapp_message_reactions",
          filter: `zapp_conversation_id=eq.${conversationId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, load]);

  /** Reações agrupadas por mensagem e por emoji. */
  const byMessage = useMemo(() => {
    const map = new Map<string, ReactionGroup[]>();
    for (const r of reactions) {
      if (!r.zapp_message_id) continue;
      const list = map.get(r.zapp_message_id) || [];
      const existing = list.find((g) => g.emoji === r.emoji);
      const who = r.from_me ? "Você" : r.reactor_name || "Contato";
      if (existing) {
        existing.count += 1;
        existing.names.push(who);
        existing.mine = existing.mine || r.from_me;
      } else {
        list.push({ emoji: r.emoji, count: 1, names: [who], mine: r.from_me });
      }
      map.set(r.zapp_message_id, list);
    }
    return map;
  }, [reactions]);

  const react = useCallback(
    async (messageId: string, externalMessageId: string | null | undefined, emoji: string) => {
      if (pendingMessagesRef.current.has(messageId)) return;
      if (!externalMessageId) {
        toast.error("Não é possível reagir a esta mensagem");
        return;
      }
      // Em grupos não existe telefone do contato: o destino é o próprio grupo.
      if (!groupJid && !contactPhone) {
        toast.error("Esta conversa não tem um destino válido para reagir");
        return;
      }

      const current = (byMessage.get(messageId) || []).find((g) => g.mine && g.emoji === emoji);
      const nextEmoji = current ? "" : emoji;
      pendingMessagesRef.current.add(messageId);

      // Atualização otimista (guardando o estado anterior para desfazer em erro)
      let previous: ZappReaction[] = [];
      setReactions((prev) => {
        previous = prev;
        const withoutMine = prev.filter((r) => !(r.zapp_message_id === messageId && r.from_me));
        if (!nextEmoji) return withoutMine;
        return [
          ...withoutMine,
          {
            id: `optimistic-${messageId}`,
            zapp_message_id: messageId,
            emoji: nextEmoji,
            reactor_phone: "me",
            reactor_name: "Você",
            from_me: true,
          },
        ];
      });

      const { data, error } = await invokeUazapiManager<{
        reacted?: boolean;
        removed?: boolean;
        mirrored?: boolean;
        error?: string;
      }>({
        body: {
          action: "send_reaction",
          phone: contactPhone || undefined,
          group_jid: groupJid || undefined,
          conversation_id: conversationId || undefined,
          message_id: externalMessageId,
          emoji: nextEmoji,
          sector_id: sectorId,
          integration_id: integrationId || undefined,
        },
      });

      const confirmed = !error && data?.reacted === true && data?.mirrored === true && (nextEmoji !== "" || data.removed === true);
      if (!confirmed) {
        console.error("[Reactions] send error:", error);
        setReactions(previous);
        pendingMessagesRef.current.delete(messageId);
        const errorMessage = data?.error ||
          (typeof (error as { message?: unknown } | null)?.message === "string"
            ? String((error as { message: string }).message)
            : "");
        toast.error(
          errorMessage
            ? `Não foi possível enviar a reação: ${errorMessage}`
            : "Não foi possível enviar a reação",
        );
        return;
      }
      pendingMessagesRef.current.delete(messageId);
      await load();
    },
    [byMessage, contactPhone, groupJid, conversationId, sectorId, integrationId, load],
  );

  return { byMessage, react, reloadReactions: load };
}
