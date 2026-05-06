import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ConversationAssignment } from "@/components/royzapp";
import { Department } from "@/components/royzapp";
import { SectorId } from "@/config/sectors";
import { Message, InboundMessageData } from "@/hooks/useZappData";
import { withRetry } from "@/lib/retryFetch";

const REALTIME_DEBOUNCE_MS = 5000; // Increased for high-volume (was 3s)
const MIN_FETCH_INTERVAL_MS = 5000; // Increased for high-volume (was 3s)

interface UseZappConversationsOptions {
  accountId?: string;
  sectorId?: SectorId;
  integrationId?: string;
  departments: Department[];
  onNewInboundMessage?: (data: InboundMessageData) => void;
  hasGlobalVisibility?: boolean;
}

export function useZappConversations(options: UseZappConversationsOptions) {
  const { accountId, sectorId, integrationId, departments, onNewInboundMessage, hasGlobalVisibility = false } = options;

  const [assignments, setAssignments] = useState<ConversationAssignment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [clientProducts, setClientProducts] = useState<Record<string, { id: string; name: string; color?: string }[]>>({});
  const [leadDealStages, setLeadDealStages] = useState<Record<string, { stageName: string; stageColor: string }>>({});

  const currentDepartmentIdRef = useRef<string | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);
  const realtimeFetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const onNewInboundMessageRef = useRef(onNewInboundMessage);
  onNewInboundMessageRef.current = onNewInboundMessage;

  const fetchMessagesRef = useRef<(id: string) => Promise<void>>();

  // Build the assignments select query (shared between fetchAssignmentsOnly and fetchData)
  const ASSIGNMENTS_SELECT = `
    *,
    agent:zapp_agents(*, user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url, team_role_id)),
    department:zapp_departments(*),
    conversation:conversations(id, client_id, client:clients(id, full_name, phone_e164, avatar_url, timezone)),
    zapp_conversation:zapp_conversations(id, phone_e164, contact_name, client_id, lead_id, last_message_at, last_message_preview, unread_count, is_group, group_jid, is_archived, is_muted, is_pinned, is_favorite, is_blocked, avatar_url, sector_id, integration_id, client:clients(id, full_name, phone_e164, avatar_url, timezone), lead:leads(id, full_name, phone, email, status)),
    conversation_tags:zapp_conversation_tags(tag_id, tag:zapp_tags(id, name, color))
  `;

  // Fetch supplementary data (products, deal stages) for assignments
  const fetchSupplementaryData = useCallback(async (assignmentsData: ConversationAssignment[]) => {
    const clientIds = assignmentsData
      .map((a) => a.zapp_conversation?.client_id || a.conversation?.client?.id)
      .filter((id): id is string => !!id);

    if (clientIds.length > 0) {
      const { data: cpData } = await supabase
        .from("client_products")
        .select("client_id, product:products(id, name, color)")
        .in("client_id", clientIds);

      if (cpData) {
        const productsMap: Record<string, { id: string; name: string; color?: string }[]> = {};
        cpData.forEach((cp: any) => {
          if (cp.client_id && cp.product) {
            if (!productsMap[cp.client_id]) productsMap[cp.client_id] = [];
            productsMap[cp.client_id].push({ id: cp.product.id, name: cp.product.name, color: cp.product.color });
          }
        });
        setClientProducts(prev => ({ ...prev, ...productsMap }));
      }
    }

    const leadIds = assignmentsData
      .map((a) => a.zapp_conversation?.lead_id)
      .filter((id): id is string => !!id);

    if (leadIds.length > 0) {
      // Batch lead IDs in chunks of 50 to avoid URI Too Long (400) errors
      const BATCH_SIZE = 50;
      const allDealsData: any[] = [];
      for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
        const batch = leadIds.slice(i, i + BATCH_SIZE);
        const { data: dealsData } = await supabase
          .from("deals")
          .select("lead_id, stage:deal_stages(name, color)")
          .in("lead_id", batch)
          .eq("status", "open")
          .order("created_at", { ascending: false });
        if (dealsData) allDealsData.push(...dealsData);
      }

      if (allDealsData.length > 0) {
        const stagesMap: Record<string, { stageName: string; stageColor: string }> = {};
        allDealsData.forEach((deal: any) => {
          if (deal.lead_id && deal.stage && !stagesMap[deal.lead_id]) {
            stagesMap[deal.lead_id] = { stageName: deal.stage.name, stageColor: deal.stage.color };
          }
        });
        setLeadDealStages(prev => ({ ...prev, ...stagesMap }));
      }
    }
  }, []);

  // Fetch assignments only (for realtime updates)
  const fetchAssignmentsOnly = useCallback(async () => {
    if (!accountId || !sectorId) {
      setAssignments([]);
      currentDepartmentIdRef.current = null;
      return;
    }

    const now = Date.now();
    if (now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL_MS) return;
    lastFetchTimeRef.current = now;

    try {
      const result = await withRetry(async () => {
        const { data: dept } = await supabase
          .from("zapp_departments")
          .select("id")
          .eq("account_id", accountId)
          .eq("sector_id", sectorId)
          .maybeSingle();

        if (!dept) return null;

        const { data: assignmentsData, error } = await supabase
          .from("zapp_conversation_assignments")
          .select(ASSIGNMENTS_SELECT)
          .eq("account_id", accountId)
          .eq("department_id", dept.id)
          .order("updated_at", { ascending: false })
          .limit(1000);

        if (error) throw error;
        return { deptId: dept.id, assignments: assignmentsData || [] };
      }, 2, 1500);

      if (!result) {
        setAssignments([]);
        currentDepartmentIdRef.current = null;
        return;
      }

      currentDepartmentIdRef.current = result.deptId;
      console.log(`[ZappConversations] Fetched ${result.assignments.length} assignments for department ${result.deptId}`);
      setAssignments(result.assignments);

      await fetchSupplementaryData(result.assignments);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  }, [accountId, sectorId, fetchSupplementaryData, ASSIGNMENTS_SELECT]);

  // Fetch assignments as part of initial data load (with department id already known)
  const fetchAssignmentsForDepartment = useCallback(async (departmentId: string): Promise<ConversationAssignment[]> => {
    if (!accountId) return [];

    currentDepartmentIdRef.current = departmentId;

    try {
      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from("zapp_conversation_assignments")
          .select(ASSIGNMENTS_SELECT)
          .eq("account_id", accountId)
          .eq("department_id", departmentId)
          .order("updated_at", { ascending: false })
          .limit(1000);

        if (error) throw error;
        return data;
      }, 3, 1500);

      const result = data || [];
      setAssignments(result);
      await fetchSupplementaryData(result);
      return result;
    } catch (error) {
      console.error("Error fetching assignments for department:", error);
      return [];
    }
  }, [accountId, ASSIGNMENTS_SELECT, fetchSupplementaryData]);

  // Debounced fetch for realtime
  const debouncedFetchAssignments = useCallback(() => {
    if (realtimeFetchTimeoutRef.current) clearTimeout(realtimeFetchTimeoutRef.current);
    realtimeFetchTimeoutRef.current = setTimeout(() => {
      fetchAssignmentsOnly();
    }, REALTIME_DEBOUNCE_MS);
  }, [fetchAssignmentsOnly]);

  // Fetch messages
  const fetchMessages = useCallback(async (zappConversationId: string) => {
    currentConversationIdRef.current = zappConversationId;

    try {
      const { data, error } = await supabase
        .from("zapp_messages")
        .select("id, content, direction, sent_at, message_type, media_url, media_type, media_mimetype, media_filename, audio_duration_sec, sender_name, sender_phone, delivery_status, media_download_status, external_message_id, is_deleted, deleted_at, quoted_message_id, quoted_content, quoted_sender_name, updated_at, is_edited, transcription, mention_map")
        .eq("zapp_conversation_id", zappConversationId)
        .order("sent_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const reversedData = (data || []).reverse();
      const msgs: Message[] = reversedData.map((m: any) => ({
        id: m.id,
        content: m.content,
        is_from_client: m.direction === "inbound",
        created_at: m.sent_at,
        message_type: m.message_type || "text",
        media_url: m.media_url,
        media_type: m.media_type,
        media_mimetype: m.media_mimetype,
        media_filename: m.media_filename,
        audio_duration_sec: m.audio_duration_sec,
        sender_name: m.sender_name,
        delivery_status: m.delivery_status,
        media_download_status: m.media_download_status,
        external_message_id: m.external_message_id,
        is_deleted: m.is_deleted || false,
        deleted_at: m.deleted_at,
        quoted_message_id: m.quoted_message_id || null,
        quoted_content: m.quoted_content || null,
        quoted_sender_name: m.quoted_sender_name || null,
        updated_at: m.updated_at || null,
        is_edited: m.is_edited || false,
        mention_map: m.mention_map || null,
        sender_phone: m.sender_phone || null,
      }));

      setMessages(msgs);

      // Auto-download pending media (no permanent URL yet)
      // Also include messages with permanent URL but wrong status for auto-correction
      const pendingMediaMsgs = msgs.filter(
        (m) => m.media_type && (
          // Needs actual download: pending/null/failed status, no permanent URL
          ((m.media_download_status === "pending" || m.media_download_status === "failed" || !m.media_download_status) && !m.media_url)
          // Needs auto-correction: has permanent URL but wrong status
          || (m.media_url && m.media_url.includes("supabase") && m.media_download_status !== "completed")
        )
      );

      if (pendingMediaMsgs.length > 0) {
        const BATCH_SIZE = 10;
        const allIds = pendingMediaMsgs.map((m) => m.id);
        console.log(`[ZappConversations] Auto-downloading ${allIds.length} pending media in batches of ${BATCH_SIZE}`);

        supabase.functions.invoke("download-media", { body: { message_ids: allIds.slice(0, BATCH_SIZE) } })
          .catch((err) => console.error("[ZappConversations] Auto-download error:", err));

        for (let i = BATCH_SIZE; i < allIds.length; i += BATCH_SIZE) {
          const batch = allIds.slice(i, i + BATCH_SIZE);
          const delay = Math.floor(i / BATCH_SIZE) * 2000;
          setTimeout(() => {
            supabase.functions.invoke("download-media", { body: { message_ids: batch } })
              .catch((err) => console.error("[ZappConversations] Auto-download batch error:", err));
          }, delay);
        }
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }, []);

  fetchMessagesRef.current = fetchMessages;

  const clearCurrentConversation = useCallback(() => {
    currentConversationIdRef.current = null;
    setMessages([]);
  }, []);

  // INSTANCE ISOLATION filter
  const filteredAssignments = useMemo(() => {
    if (!sectorId) return [];

    const sectorDepartment = departments.find(d => d.sector_id === sectorId);
    if (!sectorDepartment) return [];

    let filtered = assignments.filter(a => a.department_id === sectorDepartment.id);

    if (filtered.length !== assignments.length) {
      console.warn(`[ZappConversations] SECURITY: Filtered out ${assignments.length - filtered.length} assignments that didn't match department`);
    }

    // Always isolate by selected instance when one is chosen — even for admins.
    // Admins still have global visibility ACROSS instances by switching the selector,
    // but a selected instance must show only its own conversations.
    if (integrationId) {
      const beforeCount = filtered.length;
      const currentSectorDeptId = sectorDepartment.id;

      filtered = filtered.filter(a => {
        const zappConv = a.zapp_conversation as { integration_id?: string; sector_id?: string; is_group?: boolean } | null;
        const convIntegrationId = zappConv?.integration_id;
        const convSectorId = zappConv?.sector_id;

        const matchesIntegration = convIntegrationId === integrationId;
        const isLegacySameSector = !convIntegrationId && convSectorId === sectorId;
        const isMultiSectorGroup = zappConv?.is_group && currentSectorDeptId && a.department_id === currentSectorDeptId;

        return matchesIntegration || isLegacySameSector || isMultiSectorGroup;
      });

      if (filtered.length !== beforeCount) {
        console.log(`[ZappConversations] INSTANCE ISOLATION: Filtered to ${filtered.length} assignments for integration ${integrationId.substring(0, 8)}...`);
      }
    }

    return filtered;
  }, [assignments, departments, sectorId, integrationId, hasGlobalVisibility]);

  const filteredAssignmentsRef = useRef(filteredAssignments);
  filteredAssignmentsRef.current = filteredAssignments;

  // Realtime subscription - OPTIMIZED for high volume
  // Only subscribe to zapp_conversation_assignments and zapp_messages (skip zapp_conversations to reduce noise)
  useEffect(() => {
    if (!accountId) return;

    // Track consecutive rapid events to auto-throttle
    let realtimeEventCount = 0;
    let realtimeResetTimer: ReturnType<typeof setTimeout> | null = null;
    const THROTTLE_THRESHOLD = 10; // events per window
    const THROTTLE_WINDOW_MS = 10000; // 10s window
    let isThrottled = false;

    const maybeThrottle = (callback: () => void) => {
      realtimeEventCount++;
      if (!realtimeResetTimer) {
        realtimeResetTimer = setTimeout(() => {
          if (realtimeEventCount > THROTTLE_THRESHOLD) {
            isThrottled = true;
            console.warn(`[ZappRT] Throttling: ${realtimeEventCount} events in ${THROTTLE_WINDOW_MS}ms window`);
            // When throttled, do one final fetch after a delay
            setTimeout(() => {
              isThrottled = false;
              fetchAssignmentsOnly();
            }, REALTIME_DEBOUNCE_MS * 2);
          }
          realtimeEventCount = 0;
          realtimeResetTimer = null;
        }, THROTTLE_WINDOW_MS);
      }
      if (!isThrottled) callback();
    };

    const channel = supabase
      .channel('zapp-conversations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'zapp_conversation_assignments', filter: `account_id=eq.${accountId}` },
        (payload) => {
          if (!sectorId) return;

          const row = ((payload.new as any) ?? (payload.old as any)) || {};
          const payloadDeptId = row.department_id;
          const currentDeptId = currentDepartmentIdRef.current;
          if (payloadDeptId && currentDeptId && payloadDeptId !== currentDeptId) return;

          if (payload.eventType === 'UPDATE' && payload.new) {
            const next = payload.new as any;
            setAssignments(prev => prev.map(assignment =>
              assignment.id === next.id
                ? {
                    ...assignment,
                    status: next.status,
                    agent_id: next.agent_id,
                    assigned_at: next.assigned_at,
                    closed_at: next.closed_at,
                    updated_at: next.updated_at,
                    department_id: next.department_id,
                  }
                : assignment
            ));
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const previous = payload.old as any;
            setAssignments(prev => prev.filter(assignment => assignment.id !== previous.id));
          }

          maybeThrottle(debouncedFetchAssignments);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'zapp_messages', filter: `account_id=eq.${accountId}` },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg?.account_id && newMsg.account_id !== accountId) return;
          if (!sectorId) return;

          // Notification for inbound messages
          if (newMsg?.direction === 'inbound' && onNewInboundMessageRef.current) {
            const conversationId = newMsg.zapp_conversation_id;
            const assignment = filteredAssignmentsRef.current.find(
              a => a.zapp_conversation_id === conversationId || a.zapp_conversation?.id === conversationId
            );

            if (assignment) {
              // Priority: client name > lead name > contact_name (skip "Desconhecido") > phone
              const rawContactName = assignment.zapp_conversation?.contact_name;
              const contactName = assignment.zapp_conversation?.client?.full_name
                || assignment.zapp_conversation?.lead?.full_name
                || (rawContactName && rawContactName !== "Desconhecido" ? rawContactName : null)
                || assignment.zapp_conversation?.phone_e164
                || "Contato";

              const messagePreview = newMsg.content
                || (newMsg.message_type === 'audio' ? '🎤 Áudio' : '')
                || (newMsg.message_type === 'image' ? '📷 Imagem' : '')
                || (newMsg.message_type === 'video' ? '🎥 Vídeo' : '')
                || (newMsg.message_type === 'document' ? '📄 Documento' : '')
                || (newMsg.message_type === 'sticker' ? '🎭 Sticker' : '')
                || 'Nova mensagem';

              onNewInboundMessageRef.current({
                conversationId,
                contactName,
                messagePreview,
                avatarUrl: assignment.zapp_conversation?.avatar_url || assignment.zapp_conversation?.client?.avatar_url,
                agentId: assignment.agent_id,
                isGroup: assignment.zapp_conversation?.is_group || false,
              });
            }
          }

          // Add message to local state ONLY if viewing the matching conversation
          if (newMsg?.id) {
            const selectedConvId = currentConversationIdRef.current;
            
            // Skip if no conversation is selected
            if (!selectedConvId) {
              maybeThrottle(debouncedFetchAssignments);
              return;
            }
            
            // Skip if message belongs to a different conversation
            if (newMsg.zapp_conversation_id !== selectedConvId) {
              maybeThrottle(debouncedFetchAssignments);
              return;
            }

            console.log(`[ZappRT] Adding realtime msg ${newMsg.id?.substring(0, 8)} to conv ${selectedConvId.substring(0, 8)}, sent_at=${newMsg.sent_at}, direction=${newMsg.direction}`);

            const newFormattedMsg: Message = {
              id: newMsg.id,
              content: newMsg.content,
              is_from_client: newMsg.direction === 'inbound',
              created_at: newMsg.sent_at || newMsg.created_at,
              message_type: newMsg.message_type || 'text',
              media_url: newMsg.media_url,
              media_type: newMsg.media_type,
              media_mimetype: newMsg.media_mimetype,
              media_filename: newMsg.media_filename,
              audio_duration_sec: newMsg.audio_duration_sec,
              sender_name: newMsg.sender_name,
              sender_phone: newMsg.sender_phone || null,
              delivery_status: newMsg.delivery_status,
              media_download_status: newMsg.media_download_status,
              external_message_id: newMsg.external_message_id,
              transcription: newMsg.transcription,
              is_deleted: newMsg.is_deleted,
              quoted_message_id: newMsg.quoted_message_id,
              quoted_content: newMsg.quoted_content,
              quoted_sender_name: newMsg.quoted_sender_name,
              is_edited: newMsg.is_edited || false,
              updated_at: newMsg.updated_at || null,
              mention_map: newMsg.mention_map || null,
            };

            setMessages(prev => {
              const exists = prev.some(m =>
                m.id === newMsg.id ||
                (m.external_message_id && newMsg.external_message_id && m.external_message_id === newMsg.external_message_id)
              );
              if (exists) return prev;
              const updated = [...prev, newFormattedMsg];
              updated.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              return updated;
            });

            // Auto-download pending inbound media as it arrives in realtime
            const needsDownload =
              newMsg.media_type &&
              newMsg.media_type !== "sticker" &&
              !newMsg.media_url &&
              (newMsg.media_download_status === "pending" || !newMsg.media_download_status);
            if (needsDownload) {
              console.log(`[ZappRT] Auto-downloading realtime media ${newMsg.id?.substring(0, 8)} (${newMsg.media_type})`);
              supabase.functions
                .invoke("download-media", { body: { message_ids: [newMsg.id] } })
                .catch((err) => console.error("[ZappRT] Realtime auto-download error:", err));
            }
          }

          maybeThrottle(debouncedFetchAssignments);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'zapp_messages', filter: `account_id=eq.${accountId}` },
        (payload) => {
          const newData = payload.new as any;
          if (newData?.account_id && newData.account_id !== accountId) return;

          if (newData?.media_download_status) {
            setMessages(prev => {
              if (!prev.some(msg => msg.id === newData.id)) return prev;
              return prev.map(msg =>
                msg.id === newData.id
                  ? { 
                      ...msg, 
                      media_url: newData.media_url || msg.media_url, 
                      media_download_status: newData.media_download_status 
                    }
                  : msg
              );
            });
          }

          if (newData?.delivery_status) {
            setMessages(prev => {
              if (!prev.some(msg => msg.id === newData.id)) return prev;
              return prev.map(msg =>
                msg.id === newData.id ? { ...msg, delivery_status: newData.delivery_status } : msg
              );
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (realtimeFetchTimeoutRef.current) clearTimeout(realtimeFetchTimeoutRef.current);
      if (realtimeResetTimer) clearTimeout(realtimeResetTimer);
      supabase.removeChannel(channel);
    };
  }, [accountId, debouncedFetchAssignments, fetchAssignmentsOnly, sectorId]);

  // Fallback polling
  useEffect(() => {
    const conversationId = currentConversationIdRef.current;
    if (!conversationId) return;

    const pollInterval = setInterval(() => {
      const currentConvId = currentConversationIdRef.current;
      if (!currentConvId) return;

      setMessages(currentMessages => {
        if (currentMessages.length === 0) {
          fetchMessagesRef.current?.(currentConvId);
          return currentMessages;
        }

        const lastLocalMsg = currentMessages[currentMessages.length - 1];
        if (lastLocalMsg) {
          const lastMsgTime = new Date(lastLocalMsg.created_at).getTime();
          if (Date.now() - lastMsgTime > 30000) {
            fetchMessagesRef.current?.(currentConvId);
          }
        }
        return currentMessages;
      });
    }, 45000); // Increased from 30s to 45s for high volume

    return () => clearInterval(pollInterval);
  }, []);

  return {
    assignments: filteredAssignments,
    rawAssignments: assignments,
    messages,
    clientProducts,
    leadDealStages,
    fetchAssignmentsOnly,
    fetchAssignmentsForDepartment,
    fetchMessages,
    setMessages,
    setAssignments,
    clearCurrentConversation,
    debouncedFetchAssignments,
  };
}
