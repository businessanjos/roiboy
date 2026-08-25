import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ConversationAssignment } from "@/components/royzapp";
import { Department } from "@/components/royzapp";
import { SectorId } from "@/config/sectors";
import { Message, InboundMessageData } from "@/hooks/useZappData";
import { withRetry } from "@/lib/retryFetch";

const REALTIME_DEBOUNCE_MS = 5000; // Increased for high-volume (was 3s)
const MIN_FETCH_INTERVAL_MS = 5000; // Increased for high-volume (was 3s)

// Defensive dedupe: keep ONE assignment per zapp_conversation_id.
// DB has a unique index, but legacy duplicates or transitional rows can sneak in.
// Priority: active > waiting > pending > triage > open > closed; tiebreak by most recent updated_at.
const STATUS_PRIORITY: Record<string, number> = {
  active: 1, waiting: 2, pending: 3, triage: 4, open: 5, closed: 6,
};
function dedupeAssignments(rows: ConversationAssignment[]): ConversationAssignment[] {
  const byConv = new Map<string, ConversationAssignment>();
  for (const a of rows) {
    const key = (a as any).zapp_conversation_id || a.id;
    const existing = byConv.get(key);
    if (!existing) { byConv.set(key, a); continue; }
    const pNew = STATUS_PRIORITY[(a as any).status] ?? 99;
    const pOld = STATUS_PRIORITY[(existing as any).status] ?? 99;
    if (pNew < pOld) { byConv.set(key, a); continue; }
    if (pNew === pOld) {
      const tNew = new Date((a as any).updated_at || (a as any).created_at || 0).getTime();
      const tOld = new Date((existing as any).updated_at || (existing as any).created_at || 0).getTime();
      if (tNew > tOld) byConv.set(key, a);
    }
  }
  return Array.from(byConv.values());
}

interface UseZappConversationsOptions {
  accountId?: string;
  sectorId?: SectorId;
  integrationId?: string;
  departments: Department[];
  onNewInboundMessage?: (data: InboundMessageData) => void;
  hasGlobalVisibility?: boolean;
}

// Stable select string shared by all assignment fetches. Keeping it outside the
// hook is important: if this string is recreated on every render and is used in
// callback dependency arrays, the RoyZapp data-loading effect re-runs
// continuously and the screen flashes between loader and content in production.
const ASSIGNMENTS_SELECT = `
  *,
  agent:zapp_agents(*, user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url, team_role_id)),
  department:zapp_departments(*),
  conversation:conversations(id, client_id, client:clients(id, full_name, phone_e164, avatar_url, timezone, state)),
  zapp_conversation:zapp_conversations(id, phone_e164, contact_name, client_id, lead_id, last_message_at, last_message_preview, unread_count, is_group, group_jid, is_archived, is_muted, is_pinned, is_favorite, is_blocked, avatar_url, sector_id, integration_id, client:clients(id, full_name, phone_e164, avatar_url, timezone, state), lead:leads(id, full_name, phone, email, status)),
  conversation_tags:zapp_conversation_tags(tag_id, tag:zapp_tags(id, name, color))
`;

export function useZappConversations(options: UseZappConversationsOptions) {
  const { accountId, sectorId, integrationId, departments, onNewInboundMessage, hasGlobalVisibility = false } = options;

  const [assignments, setAssignments] = useState<ConversationAssignment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const loadingOlderRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  const [clientProducts, setClientProducts] = useState<Record<string, { id: string; name: string; color?: string }[]>>({});
  const [clientResponsibles, setClientResponsibles] = useState<Record<string, { id: string; name: string }>>({});
  const [convToClientId, setConvToClientId] = useState<Record<string, string>>({});
  const [leadDealStages, setLeadDealStages] = useState<Record<string, { stageName: string; stageColor: string }>>({});

  const currentDepartmentIdRef = useRef<string | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);
  const realtimeFetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const onNewInboundMessageRef = useRef(onNewInboundMessage);
  onNewInboundMessageRef.current = onNewInboundMessage;

  // Per-conversation high-water mark for the last message. Used to reconcile
  // out-of-order realtime events (INSERT bumps vs UPDATE syncs vs debounced
  // refetches) so the list never regresses to an older message as "last".
  // key: zapp_conversation_id -> { at: epoch ms, msgId?: id/external id }
  const lastMessageHWMRef = useRef<Map<string, { at: number; msgId?: string }>>(new Map());

  const reconcileBump = useCallback(
    (convId: string, at: string | null | undefined, msgId?: string | null): boolean => {
      if (!convId || !at) return false;
      const atMs = new Date(at).getTime();
      if (!Number.isFinite(atMs)) return false;
      const prev = lastMessageHWMRef.current.get(convId);
      if (prev) {
        if (atMs < prev.at) return false;
        // Tie on timestamp: only accept if incoming has a strictly greater id.
        if (atMs === prev.at) {
          if (!msgId || !prev.msgId || String(msgId) <= String(prev.msgId)) return false;
        }
      }
      lastMessageHWMRef.current.set(convId, { at: atMs, msgId: msgId || prev?.msgId });
      return true;
    },
    []
  );

  const seedHWMFromAssignments = useCallback((rows: ConversationAssignment[]) => {
    for (const a of rows) {
      const convId = a.zapp_conversation?.id || (a as any).zapp_conversation_id;
      const at = a.zapp_conversation?.last_message_at;
      if (!convId || !at) continue;
      const atMs = new Date(at).getTime();
      if (!Number.isFinite(atMs)) continue;
      const prev = lastMessageHWMRef.current.get(convId);
      if (!prev || atMs > prev.at) {
        lastMessageHWMRef.current.set(convId, { at: atMs, msgId: prev?.msgId });
      }
    }
  }, []);

  /**
   * Aplica o "piso de recência" conhecido localmente sobre linhas vindas do banco.
   * Um refetch pode chegar antes do commit/replicação do último envio (nosso ou do
   * cliente) e faria a conversa "cair" na lista. Aqui garantimos que a lista nunca
   * regride para um horário mais antigo do que o já observado.
   */
  const applyRecencyFloor = useCallback((rows: ConversationAssignment[]): ConversationAssignment[] => {
    const maxAcceptable = Date.now() + 5000; // ignora relógios adiantados
    return rows.map((a) => {
      const convId = a.zapp_conversation?.id || (a as any).zapp_conversation_id;
      if (!convId || !a.zapp_conversation) return a;
      const hwm = lastMessageHWMRef.current.get(convId);
      if (!hwm || hwm.at > maxAcceptable) return a;
      const dbAt = a.zapp_conversation.last_message_at;
      const dbMs = dbAt ? new Date(dbAt).getTime() : 0;
      if (Number.isFinite(dbMs) && dbMs >= hwm.at) return a;
      return {
        ...a,
        zapp_conversation: {
          ...a.zapp_conversation,
          last_message_at: new Date(hwm.at).toISOString(),
        },
      } as ConversationAssignment;
    });
  }, []);

  /**
   * Bump manual (ex.: mensagem enviada pelo próprio usuário no ROY zAPP).
   * Registra no high-water mark e reordena a lista imediatamente, sem depender
   * do realtime — a conversa vai ao topo independente de quem enviou.
   */
  const noteConversationBump = useCallback(
    (convId: string, at: string, preview?: string) => {
      if (!convId || !at) return;
      const atMs = new Date(at).getTime();
      if (!Number.isFinite(atMs)) return;
      const prev = lastMessageHWMRef.current.get(convId);
      if (!prev || atMs >= prev.at) {
        lastMessageHWMRef.current.set(convId, { at: atMs, msgId: prev?.msgId });
      }
      setAssignments((rows) =>
        rows.map((a) => {
          const rowConvId = a.zapp_conversation?.id || (a as any).zapp_conversation_id;
          if (rowConvId !== convId || !a.zapp_conversation) return a;
          const currentMs = a.zapp_conversation.last_message_at
            ? new Date(a.zapp_conversation.last_message_at).getTime()
            : 0;
          if (currentMs > atMs) return a;
          return {
            ...a,
            zapp_conversation: {
              ...a.zapp_conversation,
              last_message_at: at,
              last_message_preview: preview ?? a.zapp_conversation.last_message_preview,
            },
          } as ConversationAssignment;
        })
      );
    },
    []
  );

  const fetchMessagesRef = useRef<(id: string) => Promise<void>>();

  // Fetch supplementary data (products, deal stages) for assignments
  const fetchSupplementaryData = useCallback(async (assignmentsData: ConversationAssignment[]) => {
    const linkedClientIds = new Set(
      assignmentsData
        .map((a) => a.zapp_conversation?.client_id || a.conversation?.client?.id)
        .filter((id): id is string => !!id)
    );

    // Fallback: resolve unlinked conversations to clients by phone_e164 or full_name.
    // Otherwise clients like "Larissa Ferreira Ferraz Eleodoro - RM" (which exist in CRM
    // but whose zapp_conversation has no client_id) would never show product/consultor badges.
    const unresolvedConvs = assignmentsData
      .map((a) => a.zapp_conversation)
      .filter((z: any) => z && !z.client_id && !z.is_group) as any[];

    const newConvMap: Record<string, string> = {};
    if (unresolvedConvs.length > 0) {
      const phones = [...new Set(unresolvedConvs.map((z) => z.phone_e164).filter((p) => p && p.length >= 10))] as string[];
      const rawNames = [...new Set(unresolvedConvs.map((z) => z.contact_name).filter(Boolean))] as string[];

      const [byPhoneRes, byNameRes] = await Promise.all([
        phones.length
          ? supabase.from("clients").select("id, full_name, phone_e164").in("phone_e164", phones).limit(2000)
          : Promise.resolve({ data: [] as any[] }),
        rawNames.length
          ? supabase.from("clients").select("id, full_name, phone_e164").in("full_name", rawNames).limit(2000)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const byPhone = new Map<string, string>();
      const byName = new Map<string, string>();
      ((byPhoneRes as any).data || []).forEach((c: any) => {
        if (c.phone_e164) byPhone.set(c.phone_e164, c.id);
      });
      ((byNameRes as any).data || []).forEach((c: any) => {
        if (c.full_name) byName.set(c.full_name.toLowerCase().trim(), c.id);
      });

      for (const z of unresolvedConvs) {
        let id: string | undefined = z.phone_e164 ? byPhone.get(z.phone_e164) : undefined;
        if (!id && z.contact_name) id = byName.get(z.contact_name.toLowerCase().trim());
        if (id) {
          newConvMap[z.id] = id;
          linkedClientIds.add(id);
        }
      }

      if (Object.keys(newConvMap).length) {
        setConvToClientId((prev) => ({ ...prev, ...newConvMap }));
      }
    }

    const clientIds = Array.from(linkedClientIds);

    if (clientIds.length > 0) {
      const { data: cpData } = await supabase
        .from("client_products")
        .select("client_id, product:products(id, name, color)")
        .eq("is_active", true)
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

      // Fetch responsible users for these clients
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, responsible_user_id")
        .in("id", clientIds)
        .not("responsible_user_id", "is", null);

      if (clientsData && clientsData.length > 0) {
        const userIds = [...new Set(clientsData.map((c: any) => c.responsible_user_id).filter(Boolean))];
        const { data: usersData } = await supabase
          .from("users")
          .select("id, name")
          .in("id", userIds);
        const userMap = new Map((usersData || []).map((u: any) => [u.id, u.name]));
        const respMap: Record<string, { id: string; name: string }> = {};
        clientsData.forEach((c: any) => {
          const name = userMap.get(c.responsible_user_id);
          if (name) respMap[c.id] = { id: c.responsible_user_id, name };
        });
        setClientResponsibles(prev => ({ ...prev, ...respMap }));
      }
    }

    const leadIds = assignmentsData
      .map((a) => a.zapp_conversation?.lead_id)
      .filter((id): id is string => !!id);

    if (leadIds.length > 0) {
      // Batch lead IDs in chunks of 50 to avoid URI Too Long (400) errors
      const BATCH_SIZE = 50;
      const batches = Array.from(
        { length: Math.ceil(leadIds.length / BATCH_SIZE) },
        (_, index) => leadIds.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
      );
      const dealResults = await Promise.all(
        batches.map((batch) =>
          supabase
            .from("deals")
            .select("lead_id, stage:deal_stages(name, color)")
            .in("lead_id", batch)
            .eq("status", "open")
            .order("created_at", { ascending: false }),
        ),
      );
      const allDealsData = dealResults.flatMap(({ data }) => data || []);

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
          // Ordena pela última mensagem da conversa (e não pelo updated_at do
          // assignment, que não muda quando chega/sai mensagem). Sem isso, o
          // limite abaixo recortava uma janela que ignorava conversas recentes.
          .order("last_message_at", { referencedTable: "zapp_conversation", ascending: false, nullsFirst: false })
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
      const deduped = dedupeAssignments(result.assignments);
      seedHWMFromAssignments(deduped);
      setAssignments(applyRecencyFloor(deduped));

      // Product, consultant and deal-stage badges are progressive enhancement.
      // Do not block the initial conversation list while these extra queries run.
      void fetchSupplementaryData(result.assignments).catch((error) => {
        console.error("Error fetching supplementary zapp data:", error);
      });
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  }, [accountId, sectorId, fetchSupplementaryData, seedHWMFromAssignments, applyRecencyFloor]);

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
          .order("last_message_at", { referencedTable: "zapp_conversation", ascending: false, nullsFirst: false })
          .order("updated_at", { ascending: false })
          .limit(1000);

        if (error) throw error;
        return data;
      }, 3, 1500);

      const result = applyRecencyFloor(dedupeAssignments(data || []));
      seedHWMFromAssignments(result);
      setAssignments(result);
      void fetchSupplementaryData(result).catch((error) => {
        console.error("Error fetching supplementary zapp data:", error);
      });
      return result;
    } catch (error) {
      console.error("Error fetching assignments for department:", error);
      return [];
    }
  }, [accountId, fetchSupplementaryData, seedHWMFromAssignments, applyRecencyFloor]);

  // Debounced fetch for realtime
  const debouncedFetchAssignments = useCallback(() => {
    if (realtimeFetchTimeoutRef.current) clearTimeout(realtimeFetchTimeoutRef.current);
    realtimeFetchTimeoutRef.current = setTimeout(() => {
      fetchAssignmentsOnly();
    }, REALTIME_DEBOUNCE_MS);
  }, [fetchAssignmentsOnly]);

  // Fetch messages
  const MESSAGES_PAGE_SIZE = 100;
  // Primeira leva menor: a conversa abre quase instantaneamente e o restante
  // do histórico entra sob demanda ao rolar para cima.
  const INITIAL_MESSAGES_PAGE_SIZE = 30;
  const MESSAGE_COLUMNS = "id, content, direction, sent_at, message_type, media_url, media_type, media_mimetype, media_filename, audio_duration_sec, sender_name, sender_phone, delivery_status, media_download_status, external_message_id, is_deleted, deleted_at, quoted_message_id, quoted_content, quoted_sender_name, updated_at, is_edited, transcription, mention_map";

  const mapMessageRow = (m: any): Message => ({
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
    transcription: m.transcription || null,
    mention_map: m.mention_map || null,
    sender_phone: m.sender_phone || null,
  });

  const queuePendingMediaDownloads = useCallback((msgs: Message[]) => {
    const pendingMediaMsgs = msgs.filter(
      (m) => m.media_type && (
        ((m.media_download_status === "pending" || m.media_download_status === "failed" || !m.media_download_status) && !m.media_url)
        || (m.media_url && m.media_url.includes("supabase") && m.media_download_status !== "completed")
      )
    );
    if (pendingMediaMsgs.length === 0) return;

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
  }, []);

  const fetchMessages = useCallback(async (zappConversationId: string) => {
    currentConversationIdRef.current = zappConversationId;
    setHasMoreMessages(false);
    setIsLoadingMessages(true);
    // Limpa imediatamente para não exibir a conversa anterior enquanto a nova
    // carrega — era isso que dava a sensação de "delay" ao abrir.
    setMessages([]);

    try {
      const { data, error } = await supabase
        .from("zapp_messages")
        .select(MESSAGE_COLUMNS)
        .eq("zapp_conversation_id", zappConversationId)
        .order("sent_at", { ascending: false })
        .limit(INITIAL_MESSAGES_PAGE_SIZE);

      if (error) throw error;

      // Conversa pode ter mudado durante o fetch
      if (currentConversationIdRef.current !== zappConversationId) return;

      const rows = data || [];
      const msgs: Message[] = rows.slice().reverse().map(mapMessageRow);

      setMessages(msgs);
      setIsLoadingMessages(false);
      setHasMoreMessages(rows.length === INITIAL_MESSAGES_PAGE_SIZE);
      // Downloads de mídia pendentes não devem competir com a renderização.
      setTimeout(() => queuePendingMediaDownloads(msgs), 400);
    } catch (error) {
      console.error("Error fetching messages:", error);
      if (currentConversationIdRef.current === zappConversationId) setIsLoadingMessages(false);
    }
  }, [queuePendingMediaDownloads]);

  // Carrega mensagens ANTERIORES (histórico completo, paginado para cima).
  const loadOlderMessages = useCallback(async () => {
    const conversationId = currentConversationIdRef.current;
    if (!conversationId) return;
    if (loadingOlderRef.current) return;

    const oldest = messagesRef.current[0];
    if (!oldest?.created_at) return;

    loadingOlderRef.current = true;
    setIsLoadingOlderMessages(true);
    try {
      const { data, error } = await supabase
        .from("zapp_messages")
        .select(MESSAGE_COLUMNS)
        .eq("zapp_conversation_id", conversationId)
        .lt("sent_at", oldest.created_at)
        .order("sent_at", { ascending: false })
        .limit(MESSAGES_PAGE_SIZE);

      if (error) throw error;

      // Conversa pode ter mudado durante o fetch
      if (currentConversationIdRef.current !== conversationId) return;

      const rows = data || [];
      const older: Message[] = rows.slice().reverse().map(mapMessageRow);

      if (older.length > 0) {
        setMessages((prev) => {
          const existing = new Set(prev.map((m) => m.id));
          const unique = older.filter((m) => !existing.has(m.id));
          return [...unique, ...prev];
        });
        queuePendingMediaDownloads(older);
      }
      setHasMoreMessages(rows.length === MESSAGES_PAGE_SIZE);
    } catch (error) {
      console.error("Error loading older messages:", error);
    } finally {
      loadingOlderRef.current = false;
      setIsLoadingOlderMessages(false);
    }
  }, [queuePendingMediaDownloads]);

  fetchMessagesRef.current = fetchMessages;

  const clearCurrentConversation = useCallback(() => {
    currentConversationIdRef.current = null;
    setMessages([]);
    setHasMoreMessages(false);
  }, []);



  // INSTANCE ISOLATION filter
  const filteredAssignments = useMemo(() => {
    if (!sectorId) return [];

    const sectorDepartment = departments.find(d => d.sector_id === sectorId);
    if (!sectorDepartment) return [];

    let filtered = assignments.filter(a => {
      if (a.department_id !== sectorDepartment.id) return false;
      // SECTOR ISOLATION: quando a conversa já tem sector_id definido, ele DEVE
      // bater com o setor selecionado. Isso evita vazamento de conversas de CS
      // aparecendo na triagem do Comercial quando o mesmo contato falou com dois
      // números (integrações) de setores diferentes e o assignment antigo ficou vivo.
      const zappConv = a.zapp_conversation as { sector_id?: string | null } | null;
      const convSectorId = zappConv?.sector_id ?? null;
      if (convSectorId && convSectorId !== sectorId) return false;
      return true;
    });

    if (filtered.length !== assignments.length) {
      console.warn(`[ZappConversations] SECTOR ISOLATION: Filtered out ${assignments.length - filtered.length} assignments (department/sector mismatch)`);
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
        // Legacy fallback: conversation has no integration_id at all (pre-multi-instance data)
        const isLegacySameSector = !convIntegrationId && convSectorId === sectorId;
        // Multi-sector group bypass ONLY for legacy groups without integration_id.
        // If the group already has an integration_id, it must match the selected instance —
        // otherwise UAZAPI groups would leak into the Meta Cloud instance view (and vice-versa).
        const isLegacyMultiSectorGroup =
          zappConv?.is_group &&
          !convIntegrationId &&
          currentSectorDeptId &&
          a.department_id === currentSectorDeptId;

        return matchesIntegration || isLegacySameSector || isLegacyMultiSectorGroup;
      });

      if (filtered.length !== beforeCount) {
        console.log(`[ZappConversations] INSTANCE ISOLATION: Filtered to ${filtered.length} assignments for integration ${integrationId.substring(0, 8)}...`);
      }
    }

    return filtered;
  }, [assignments, departments, sectorId, integrationId]);

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

          // Optimistically bump last_message_at/preview on the matching assignment so
          // the conversation list re-sorts to the top immediately, even before the
          // debounced/throttled refetch runs. This matches WhatsApp's behavior.
          const bumpConvId = newMsg?.zapp_conversation_id;
          const bumpAt = newMsg?.sent_at || newMsg?.created_at || new Date().toISOString();
          const bumpMsgId = newMsg?.id || newMsg?.external_message_id || null;
          const accepted = bumpConvId ? reconcileBump(bumpConvId, bumpAt, bumpMsgId) : false;
          if (bumpConvId && accepted) {
            setAssignments(prev => prev.map(a => {
              const convId = a.zapp_conversation?.id || (a as any).zapp_conversation_id;
              if (convId !== bumpConvId) return a;
              const preview = newMsg?.content
                || (newMsg?.message_type === 'audio' ? '🎤 Áudio' : '')
                || (newMsg?.message_type === 'image' ? '📷 Imagem' : '')
                || (newMsg?.message_type === 'video' ? '🎥 Vídeo' : '')
                || (newMsg?.message_type === 'document' ? '📄 Documento' : '')
                || (newMsg?.message_type === 'sticker' ? '🎭 Sticker' : '')
                || a.zapp_conversation?.last_message_preview
                || '';
              const isInbound = newMsg?.direction === 'inbound';
              const isSelected = currentConversationIdRef.current === bumpConvId;
              const nextUnread = isInbound && !isSelected
                ? (a.zapp_conversation?.unread_count || 0) + 1
                : a.zapp_conversation?.unread_count || 0;
              return {
                ...a,
                zapp_conversation: a.zapp_conversation
                  ? {
                      ...a.zapp_conversation,
                      last_message_at: bumpAt,
                      last_message_preview: preview,
                      unread_count: nextUnread,
                    }
                  : a.zapp_conversation,
              } as ConversationAssignment;
            }));
          }


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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'zapp_conversations', filter: `account_id=eq.${accountId}` },
        (payload) => {
          const next = payload.new as any;
          if (!next?.id) return;
          if (next.account_id && next.account_id !== accountId) return;

          // Reconcile against high-water mark: only accept last_message_at/preview
          // if timestamp is >= the highest one already observed for this conversation.
          // No msgId is available on the conversation payload, so ties keep current.
          const nextAt: string | null = next.last_message_at ?? null;
          const acceptLastMessage = nextAt ? reconcileBump(next.id, nextAt, null) : false;

          setAssignments(prev => prev.map(a => {
            const convId = a.zapp_conversation?.id || (a as any).zapp_conversation_id;
            if (convId !== next.id) return a;
            if (!a.zapp_conversation) return a;

            const base = {
              ...a.zapp_conversation,
              is_pinned: next.is_pinned ?? a.zapp_conversation.is_pinned,
              is_muted: next.is_muted ?? a.zapp_conversation.is_muted,
              is_favorite: next.is_favorite ?? a.zapp_conversation.is_favorite,
              is_archived: next.is_archived ?? a.zapp_conversation.is_archived,
              is_blocked: next.is_blocked ?? a.zapp_conversation.is_blocked,
              unread_count: next.unread_count ?? a.zapp_conversation.unread_count,
              contact_name: next.contact_name ?? a.zapp_conversation.contact_name,
              avatar_url: next.avatar_url ?? a.zapp_conversation.avatar_url,
            };

            if (!acceptLastMessage) {
              // Flag/metadata-only update: never regress the last message shown.
              return { ...a, zapp_conversation: base };
            }

            return {
              ...a,
              zapp_conversation: {
                ...base,
                last_message_at: nextAt ?? a.zapp_conversation.last_message_at,
                last_message_preview: next.last_message_preview ?? a.zapp_conversation.last_message_preview,
              },
            };
          }));
        }
      )
      .subscribe();


    return () => {
      if (realtimeFetchTimeoutRef.current) clearTimeout(realtimeFetchTimeoutRef.current);
      if (realtimeResetTimer) clearTimeout(realtimeResetTimer);
      supabase.removeChannel(channel);
    };
  }, [accountId, debouncedFetchAssignments, fetchAssignmentsOnly, sectorId, reconcileBump]);

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
    clientResponsibles,
    convToClientId,
    leadDealStages,
    fetchAssignmentsOnly,
    fetchAssignmentsForDepartment,
    fetchMessages,
    loadOlderMessages,
    hasMoreMessages,
    isLoadingOlderMessages,
    isLoadingMessages,
    setMessages,
    setAssignments,
    clearCurrentConversation,
    debouncedFetchAssignments,
    noteConversationBump,
  };
}
