import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Agent, ZappTag, Department, ConversationAssignment } from "@/components/royzapp";
import { sectors, SectorId } from "@/config/sectors";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  team_role_id: string | null;
  team_role?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export interface Message {
  id: string;
  content: string | null;
  is_from_client: boolean;
  created_at: string;
  message_type: string;
  media_url?: string | null;
  media_type?: string | null;
  media_mimetype?: string | null;
  media_filename?: string | null;
  audio_duration_sec?: number | null;
  sender_name?: string | null;
  delivery_status?: "pending" | "sent" | "delivered" | "read" | "failed" | null;
  media_download_status?: "pending" | "downloading" | "completed" | "failed" | null;
  external_message_id?: string | null;
  transcription?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  // Campos para mensagem citada (reply)
  quoted_message_id?: string | null;
  quoted_content?: string | null;
  quoted_sender_name?: string | null;
  // Status de envio local (para mensagens otimistas)
  send_status?: "sending" | "sent" | "failed";
  send_error?: string | null;
  // Campos para edição
  updated_at?: string | null;
  is_edited?: boolean;
}

const HEARTBEAT_INTERVAL_MS = 120000; // Increased from 60s to 120s for cloud optimization
const REALTIME_DEBOUNCE_MS = 3000; // Increased from 2000ms to 3000ms for cloud optimization
const MIN_FETCH_INTERVAL_MS = 3000;

export interface InboundMessageData {
  conversationId: string;
  contactName: string;
  messagePreview: string;
  avatarUrl?: string | null;
  agentId?: string | null;
  isGroup?: boolean;
}

interface UseZappDataOptions {
  sectorId?: SectorId;
  integrationId?: string;
  onNewInboundMessage?: (data: InboundMessageData) => void;
}

export function useZappData(options: UseZappDataOptions = {}) {
  const { sectorId, integrationId, onNewInboundMessage } = options;
  const { currentUser } = useCurrentUser();
  
  // Core data state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tags, setTags] = useState<ZappTag[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [teamRoles, setTeamRoles] = useState<{ id: string; name: string; color: string }[]>([]);
  const [allClients, setAllClients] = useState<{ id: string; full_name: string; phone_e164: string; avatar_url: string | null }[]>([]);
  const [assignments, setAssignments] = useState<ConversationAssignment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableProducts, setAvailableProducts] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [clientProducts, setClientProducts] = useState<Record<string, { id: string; name: string; color?: string }[]>>({});
  
  // WhatsApp connection state
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [whatsappConnecting, setWhatsappConnecting] = useState(false);
  const [whatsappInstanceName, setWhatsappInstanceName] = useState<string | null>(null);

  // Refs for heartbeat and realtime
  const agentHeartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<number>(0);
  const realtimeFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  
  // Ref for notification callback to avoid stale closures
  const onNewInboundMessageRef = useRef(onNewInboundMessage);
  onNewInboundMessageRef.current = onNewInboundMessage;

  // Current agent
  const currentAgent = useMemo(() => {
    return agents.find((a) => a.user_id === currentUser?.id);
  }, [agents, currentUser?.id]);

  // Agent heartbeat
  const updateAgentHeartbeat = useCallback(async (agentId: string) => {
    const now = Date.now();
    if (now - lastHeartbeatRef.current < HEARTBEAT_INTERVAL_MS) {
      return;
    }
    lastHeartbeatRef.current = now;
    
    try {
      await supabase
        .from("zapp_agents")
        .update({ 
          is_online: true, 
          last_activity_at: new Date().toISOString() 
        })
        .eq("id", agentId);
    } catch (error) {
      console.error("Error updating agent heartbeat:", error);
    }
  }, []);

  // Ref to store current department ID for realtime validation
  const currentDepartmentIdRef = useRef<string | null>(null);

  // Fetch assignments only (for realtime updates)
  // CRITICAL: Always filter by department_id to ensure sector isolation
  const fetchAssignmentsOnly = useCallback(async () => {
    if (!currentUser?.account_id) return;
    
    // CRITICAL: Block if no sector selected - prevents data leakage
    if (!sectorId) {
      console.log("[ZappData] No sectorId - clearing assignments for security");
      setAssignments([]);
      currentDepartmentIdRef.current = null;
      return;
    }
    
    const now = Date.now();
    if (now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL_MS) {
      return;
    }
    lastFetchTimeRef.current = now;
    
    try {
      // First, get the department for this sector
      const { data: dept, error: deptError } = await supabase
        .from("zapp_departments")
        .select("id")
        .eq("account_id", currentUser.account_id)
        .eq("sector_id", sectorId)
        .maybeSingle();
      
      if (deptError) {
        console.error("[ZappData] Error fetching department:", deptError);
        setAssignments([]);
        currentDepartmentIdRef.current = null;
        return;
      }
      
      if (!dept) {
        console.log("[ZappData] No department found for sector:", sectorId);
        setAssignments([]);
        currentDepartmentIdRef.current = null;
        return;
      }
      
      // Store current department ID for realtime validation
      currentDepartmentIdRef.current = dept.id;
      
      // CRITICAL: Filter by department_id at the database level
      // Fetch ALL assignments (including closed) - filtering done in frontend
      let assignmentsQuery = supabase
        .from("zapp_conversation_assignments")
        .select(`
          *,
          agent:zapp_agents(*, user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url, team_role_id)),
          department:zapp_departments(*),
          conversation:conversations(id, client_id, client:clients(id, full_name, phone_e164, avatar_url)),
          zapp_conversation:zapp_conversations(id, phone_e164, contact_name, client_id, lead_id, last_message_at, last_message_preview, unread_count, is_group, group_jid, is_archived, is_muted, is_pinned, is_favorite, is_blocked, avatar_url, sector_id, integration_id, client:clients(id, full_name, phone_e164, avatar_url), lead:leads(id, full_name, phone, email, status)),
          conversation_tags:zapp_conversation_tags(tag_id, tag:zapp_tags(id, name, color))
        `)
        .eq("account_id", currentUser.account_id)
        .eq("department_id", dept.id) // CRITICAL: Filter by department
        .order("updated_at", { ascending: false })
        .limit(500);
      
      // CRITICAL: Filter by integration_id for instance isolation
      // Groups are allowed to be visible cross-instance, but individual contacts must be isolated
      if (integrationId) {
        // When integrationId is provided, filter individual conversations by it
        // Groups can still appear cross-instance (handled in frontend with OR logic)
        console.log(`[ZappData] fetchAssignmentsOnly: Filtering by integrationId ${integrationId}`);
      } else {
        // SECURITY WARNING: No integrationId specified - this may leak conversations
        console.warn("[ZappData] fetchAssignmentsOnly: No integrationId - individual conversations may be visible cross-instance");
      }
      
      const { data: assignmentsData, error: assignmentsError } = await assignmentsQuery;

      if (assignmentsError) throw assignmentsError;
      
      // CROSS-SECTOR FIX: Visibility is controlled ONLY by department_id (filtered in SQL query above)
      // integration_id is used ONLY for sending messages (determines which WhatsApp instance to use)
      // Removing integration_id filter allows conversations to be accessible across instances
      const filteredAssignments = assignmentsData || [];
      console.log(`[ZappData] Fetched ${filteredAssignments.length} assignments for department ${dept.id} (sector: ${sectorId})`);
      setAssignments(filteredAssignments);
      
      // Update client products for new clients
      const clientIds = (assignmentsData || [])
        .map((a: ConversationAssignment) => a.zapp_conversation?.client_id || a.conversation?.client?.id)
        .filter((id: string | null | undefined): id is string => !!id);
      
      if (clientIds.length > 0) {
        const { data: cpData } = await supabase
          .from("client_products")
          .select("client_id, product:products(id, name, color)")
          .in("client_id", clientIds);
        
        if (cpData) {
          const productsMap: Record<string, { id: string; name: string; color?: string }[]> = {};
          cpData.forEach((cp: any) => {
            if (cp.client_id && cp.product) {
              if (!productsMap[cp.client_id]) {
                productsMap[cp.client_id] = [];
              }
              productsMap[cp.client_id].push({ 
                id: cp.product.id, 
                name: cp.product.name,
                color: cp.product.color 
              });
            }
          });
          setClientProducts(prev => ({ ...prev, ...productsMap }));
        }
      }
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  }, [currentUser?.account_id, sectorId, integrationId]);

  // Debounced fetch for realtime
  const debouncedFetchAssignments = useCallback(() => {
    if (realtimeFetchTimeoutRef.current) {
      clearTimeout(realtimeFetchTimeoutRef.current);
    }
    
    realtimeFetchTimeoutRef.current = setTimeout(() => {
      fetchAssignmentsOnly();
    }, REALTIME_DEBOUNCE_MS);
  }, [fetchAssignmentsOnly]);

  // Check WhatsApp status
  const checkWhatsAppStatus = useCallback(async () => {
    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "status", sector_id: sectorId },
      });

      if (response.data) {
        // Respect locally_disconnected flag
        if (response.data?.locally_disconnected) {
          setWhatsappConnected(false);
          setWhatsappInstanceName(null);
        } else {
          const state = response.data?.state || response.data?.data?.state;
          const connected = state === "open" || state === "connected" || response.data?.connected || response.data?.data?.connected;
          setWhatsappConnected(connected);
          setWhatsappInstanceName(response.data?.instance || response.data?.data?.instance || null);
        }
      }
    } catch (error) {
      console.log("WhatsApp status check failed:", error);
    }
  }, [sectorId]);

  // Toggle WhatsApp connection
  const toggleWhatsAppConnection = async () => {
    setWhatsappConnecting(true);
    try {
      if (whatsappConnected) {
        const response = await supabase.functions.invoke("uazapi-manager", {
          body: { action: "disconnect", sector_id: sectorId },
        });

        if (response.error) throw new Error(response.error.message);
        
        // Clear all WhatsApp state
        setWhatsappConnected(false);
        setWhatsappInstanceName(null);
        
        toast.success("WhatsApp desconectado do zAPP");
      } else {
        const statusResponse = await supabase.functions.invoke("uazapi-manager", {
          body: { action: "status", sector_id: sectorId },
        });

        const state = statusResponse.data?.state || statusResponse.data?.data?.state;
        const connected = state === "open" || statusResponse.data?.connected || statusResponse.data?.data?.connected;

        if (connected) {
          setWhatsappConnected(true);
          toast.success("WhatsApp conectado ao zAPP!");
        } else {
          toast.warning("Configure a conexão WhatsApp primeiro em Integrações");
        }
      }
    } catch (error: any) {
      console.error("WhatsApp toggle error:", error);
      toast.error(error.message || "Erro ao alterar conexão WhatsApp");
    } finally {
      setWhatsappConnecting(false);
    }
  };

  // Main data fetch
  // CRITICAL: Filter assignments by department to ensure sector isolation
  const fetchData = useCallback(async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);

    try {
      // First fetch departments to find the one for this sector
      const { data: depts, error: deptsError } = await supabase
        .from("zapp_departments")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .order("display_order");
      
      if (deptsError) throw deptsError;
      
      // Find the department for the current sector
      let targetDepartmentId: string | null = null;
      if (sectorId) {
        const sectorDept = (depts || []).find(d => d.sector_id === sectorId);
        targetDepartmentId = sectorDept?.id || null;
        currentDepartmentIdRef.current = targetDepartmentId;
      }
      
      // Build assignments query - CRITICAL: filter by department if sector is selected
      // Fetch ALL assignments (including closed) - filtering done in frontend
      let assignmentsQuery = supabase
        .from("zapp_conversation_assignments")
        .select(`
          *,
          agent:zapp_agents(*, user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url, team_role_id)),
          department:zapp_departments(*),
          conversation:conversations(id, client_id, client:clients(id, full_name, phone_e164, avatar_url)),
          zapp_conversation:zapp_conversations(id, phone_e164, contact_name, client_id, lead_id, last_message_at, last_message_preview, unread_count, is_group, group_jid, is_archived, is_muted, is_pinned, is_favorite, is_blocked, avatar_url, sector_id, integration_id, client:clients(id, full_name, phone_e164, avatar_url), lead:leads(id, full_name, phone, email, status)),
          conversation_tags:zapp_conversation_tags(tag_id, tag:zapp_tags(id, name, color))
        `)
        .eq("account_id", currentUser.account_id)
        .order("updated_at", { ascending: false })
        .limit(500);
      
      // CRITICAL: If sector is selected, ONLY fetch that department's assignments
      if (sectorId && targetDepartmentId) {
        assignmentsQuery = assignmentsQuery.eq("department_id", targetDepartmentId);
        console.log(`[ZappData] fetchData: Filtering by department ${targetDepartmentId} for sector ${sectorId}`);
      } else if (sectorId && !targetDepartmentId) {
        // Sector selected but no department exists yet - return empty
        console.log(`[ZappData] fetchData: No department for sector ${sectorId} - will sync departments first`);
      }

      const [
        { data: agentsData, error: agentsError },
        { data: usersData, error: usersError },
        { data: rolesData, error: rolesError },
        { data: assignmentsData, error: assignmentsError },
        { data: tagsData, error: tagsError },
      ] = await Promise.all([
        supabase
          .from("zapp_agents")
          .select(`
            *,
            user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url, team_role_id, role, is_also_admin),
            department:zapp_departments(*)
          `)
          .eq("account_id", currentUser.account_id)
          .order("created_at"),
        supabase
          .from("users")
          .select("id, name, email, avatar_url, role, team_role_id, is_also_admin, team_role:team_roles(id, name, color)")
          .eq("account_id", currentUser.account_id)
          .order("name"),
        supabase
          .from("team_roles")
          .select("id, name, color")
          .eq("account_id", currentUser.account_id)
          .order("display_order"),
        assignmentsQuery,
        supabase
          .from("zapp_tags")
          .select("*")
          .eq("account_id", currentUser.account_id)
          .order("display_order"),
      ]);

      if (agentsError) throw agentsError;
      if (usersError) throw usersError;
      if (rolesError) throw rolesError;
      if (assignmentsError) throw assignmentsError;
      if (tagsError) throw tagsError;

      // Sync sectors to departments (except "configuracoes")
      const sectorsToSync = sectors.filter(s => s.id !== "configuracoes" && !s.comingSoon);
      const existingDepts = depts || [];
      const existingSectorIds = existingDepts.map(d => d.sector_id).filter(Boolean);
      
      const missingSectors = sectorsToSync.filter(s => !existingSectorIds.includes(s.id));
      
      console.log("[ZappData] Syncing sectors:", { sectorsToSync: sectorsToSync.length, existingDepts: existingDepts.length, missingSectors: missingSectors.length });
      
      if (missingSectors.length > 0 && currentUser.account_id) {
        const newDepts = missingSectors.map((sector, idx) => ({
          account_id: currentUser.account_id,
          name: sector.name,
          description: sector.description,
          color: sector.color.replace("text-", "").replace("-600", ""),
          sector_id: sector.id,
          display_order: (existingDepts.length + idx + 1),
          auto_distribution: false,
        }));
        
        console.log("[ZappData] Creating departments:", newDepts);
        
        const { data: createdDepts, error: createDeptsError } = await supabase
          .from("zapp_departments")
          .insert(newDepts)
          .select("*");
        
        if (createDeptsError) {
          console.error("[ZappData] Error creating departments:", createDeptsError);
          setDepartments(existingDepts);
        } else if (createdDepts) {
          console.log("[ZappData] Created departments:", createdDepts);
          toast.success(`${createdDepts.length} departamentos criados automaticamente`);
          setDepartments([...existingDepts, ...createdDepts]);
        }
      } else {
        setDepartments(existingDepts);
      }
      
      setTeamUsers((usersData || []) as TeamUser[]);
      setTeamRoles(rolesData || []);
      
      // CROSS-SECTOR FIX: Visibility is controlled ONLY by department_id (filtered in SQL query above)
      // integration_id is used ONLY for sending messages (determines which WhatsApp instance to use)
      // This allows conversations to be accessible cross-instance within the same department
      const filteredAssignments = assignmentsData || [];
      console.log(`[ZappData] fetchData: Loaded ${filteredAssignments.length} assignments for sector ${sectorId}`);
      
      setAssignments(filteredAssignments);
      setTags(tagsData || []);
      
      // Fetch available products
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, color")
        .eq("account_id", currentUser.account_id)
        .eq("is_active", true)
        .order("name");
      
      setAvailableProducts(productsData || []);
      
      // Fetch all clients
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, full_name, phone_e164, avatar_url")
        .eq("account_id", currentUser.account_id)
        .eq("status", "active")
        .order("full_name")
        .limit(500);
      
      setAllClients(clientsData || []);
      
      // Fetch products for all clients
      const clientIds = (assignmentsData || [])
        .map((a: ConversationAssignment) => a.zapp_conversation?.client_id || a.conversation?.client?.id)
        .filter((id: string | null | undefined): id is string => !!id);
      
      if (clientIds.length > 0) {
        const { data: cpData } = await supabase
          .from("client_products")
          .select("client_id, product:products(id, name, color)")
          .in("client_id", clientIds);
        
        if (cpData) {
          const productsMap: Record<string, { id: string; name: string; color?: string }[]> = {};
          cpData.forEach((cp: any) => {
            if (cp.client_id && cp.product) {
              if (!productsMap[cp.client_id]) {
                productsMap[cp.client_id] = [];
              }
              productsMap[cp.client_id].push({ 
                id: cp.product.id, 
                name: cp.product.name,
                color: cp.product.color 
              });
            }
          });
          setClientProducts(productsMap);
        }
      }
      
      // Auto-register agent if needed
      let finalAgents = agentsData || [];
      const existingAgent = finalAgents.find((a: Agent) => a.user_id === currentUser.id);
      
      if (!existingAgent) {
        const { data: newAgent, error: createError } = await supabase
          .from("zapp_agents")
          .insert({
            account_id: currentUser.account_id,
            user_id: currentUser.id,
            is_online: true,
            last_activity_at: new Date().toISOString(),
          })
          .select(`
            *,
            user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url, team_role_id, role, is_also_admin),
            department:zapp_departments(*)
          `)
          .single();
        
        if (!createError && newAgent) {
          finalAgents = [...finalAgents, newAgent];
        } else if (createError) {
          console.error("Error auto-registering agent:", createError);
        }
      } else {
        if (agentHeartbeatRef.current) {
          clearInterval(agentHeartbeatRef.current);
        }
        
        updateAgentHeartbeat(existingAgent.id);
        
        agentHeartbeatRef.current = setInterval(() => {
          updateAgentHeartbeat(existingAgent.id);
        }, HEARTBEAT_INTERVAL_MS);
      }
      
      // Filter agents by current sector's department
      // Include: current user (always), agents assigned to this department, admins/gestores, or agents with department_id = null
      let filteredAgents = finalAgents;
      if (sectorId && targetDepartmentId) {
        filteredAgents = finalAgents.filter((a: Agent) => {
          // ALWAYS include the current user's agent record so currentAgent is correctly identified
          // This ensures the "Minhas" tab filter works regardless of which sector the user is viewing
          if (a.user_id === currentUser.id) {
            return true;
          }
          
          // Show if assigned to this specific department
          if (a.department_id === targetDepartmentId) {
            return true;
          }
          
          // Show if assigned to ALL departments (department_id is null)
          if (a.department_id === null) {
            return true;
          }
          
          // Admins/gestores appear in all departments
          const userRole = a.user?.role || usersData?.find((u: any) => u.id === a.user_id)?.role;
          const isAdmin = userRole === 'admin' || userRole === 'super_admin';
          const isGestor = userRole === 'gestor';
          
          const teamUser = usersData?.find((u: any) => u.id === a.user_id);
          const hasAdminFlag = (teamUser as any)?.is_also_admin === true;
          
          if (isAdmin || isGestor || hasAdminFlag) {
            return true;
          }
          
          return false;
        });
      }
      
      setAgents(filteredAgents);
    } catch (error: any) {
      console.error("Error fetching zapp data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [currentUser?.account_id, currentUser?.id, updateAgentHeartbeat, sectorId, integrationId]);

  // Fetch messages - using ref to avoid stale closure issues
  const fetchMessagesRef = useRef<(id: string) => Promise<void>>();
  
  const fetchMessages = useCallback(async (zappConversationId: string) => {
    try {
      // Fetch latest 100 messages (ordered descending, then reverse for display)
      // IMPORTANT: Do NOT filter out deleted messages - they should be shown with placeholder
      // The ZappMessageBubble component handles displaying "🚫 Mensagem apagada" for is_deleted=true
      const { data, error } = await supabase
        .from("zapp_messages")
        .select("id, content, direction, sent_at, message_type, media_url, media_type, media_mimetype, media_filename, audio_duration_sec, sender_name, delivery_status, media_download_status, external_message_id, is_deleted, deleted_at, quoted_message_id, quoted_content, quoted_sender_name, updated_at, is_edited")
        .eq("zapp_conversation_id", zappConversationId)
        .order("sent_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      
      // Reverse to get chronological order (oldest first for display)
      const reversedData = (data || []).reverse();
      
      const msgs = reversedData.map((m: any) => ({
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
        // Campos de mensagem citada
        quoted_message_id: m.quoted_message_id || null,
        quoted_content: m.quoted_content || null,
        quoted_sender_name: m.quoted_sender_name || null,
        // Campos de edição
        updated_at: m.updated_at || null,
        is_edited: m.is_edited || false,
      }));
      
      setMessages(msgs);
      
      // REACTIVATED: Auto-download pending media when conversation is opened
      // This triggers lazy download for media that webhook couldn't process immediately
      const pendingMediaMsgs = msgs.filter(
        (m) => m.media_download_status === "pending" 
          && m.media_type 
          && m.media_type !== "sticker"
          && !m.media_url
      );

      if (pendingMediaMsgs.length > 0) {
        // Limit to 10 to avoid timeout (edge function processes in batches of 8)
        const idsToDownload = pendingMediaMsgs.slice(0, 10).map((m) => m.id);
        console.log(`[ZappData] Triggering auto-download for ${idsToDownload.length} pending media`);
        
        // Fire-and-forget to avoid blocking UI - realtime will update when completed
        supabase.functions.invoke("download-media", {
          body: { message_ids: idsToDownload }
        }).catch((err) => console.error("[ZappData] Auto-download error:", err));
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }, []);
  
  // Keep ref updated
  fetchMessagesRef.current = fetchMessages;

  // Initial data fetch - re-fetch when sector changes
  useEffect(() => {
    if (currentUser?.account_id) {
      fetchData();
      checkWhatsAppStatus();
    }
    
    return () => {
      if (agentHeartbeatRef.current) {
        clearInterval(agentHeartbeatRef.current);
      }
    };
  }, [currentUser?.account_id, sectorId, fetchData, checkWhatsAppStatus]);

  // Realtime subscription for conversations and assignments
  useEffect(() => {
    if (!currentUser?.account_id) return;

    const conversationsChannel = supabase
      .channel('zapp-conversations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zapp_conversations',
          filter: `account_id=eq.${currentUser.account_id}`
        },
        (payload) => {
          // CRITICAL SECURITY: Validate account_id matches current user
          const payloadAccountId = (payload.new as any)?.account_id || (payload.old as any)?.account_id;
          if (payloadAccountId && payloadAccountId !== currentUser?.account_id) {
            return;
          }
          
          // CRITICAL: Only process if we have a sector selected
          if (!sectorId) {
            return;
          }
          // Fetch immediately for new conversations, debounce for updates
          if (payload.eventType === 'INSERT') {
            fetchAssignmentsOnly();
          } else {
            debouncedFetchAssignments();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zapp_conversation_assignments',
          filter: `account_id=eq.${currentUser.account_id}`
        },
        (payload) => {
          // CRITICAL: Only process if we have a sector selected
          if (!sectorId) {
            return;
          }
          
          // CRITICAL: Validate that the event belongs to the current department
          const payloadDeptId = (payload.new as any)?.department_id;
          const currentDeptId = currentDepartmentIdRef.current;
          
          if (payloadDeptId && currentDeptId && payloadDeptId !== currentDeptId) {
            return;
          }
          
          debouncedFetchAssignments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'zapp_messages',
          filter: `account_id=eq.${currentUser.account_id}`
        },
        (payload) => {
          const newMsg = payload.new as any;
          
          // CRITICAL SECURITY: Validate account_id matches current user
          const payloadAccountId = newMsg?.account_id;
          if (payloadAccountId && payloadAccountId !== currentUser?.account_id) {
            return;
          }
          
          // CRITICAL: Only process if we have a sector selected
          if (!sectorId) {
            return;
          }
          
          // NOTIFICATION: Trigger callback for INBOUND messages
          if (newMsg?.direction === 'inbound' && onNewInboundMessageRef.current) {
            // Find the conversation in assignments to get contact info and agent
            const conversationId = newMsg.zapp_conversation_id;
            const assignment = filteredAssignmentsRef.current.find(
              a => a.zapp_conversation_id === conversationId || a.zapp_conversation?.id === conversationId
            );
            
            if (assignment) {
              const contactName = assignment.zapp_conversation?.contact_name 
                || assignment.zapp_conversation?.client?.full_name 
                || assignment.zapp_conversation?.lead?.full_name 
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
          
          // CRITICAL FIX: Check if message already exists in local state before adding
          // This prevents duplicates from realtime when frontend already added the message
          if (newMsg?.id) {
            setMessages(prev => {
              const exists = prev.some(m => m.id === newMsg.id);
              if (exists) {
                return prev;
              }
              return prev;
            });
          }
          
          // When new message arrives, update the conversation list to show latest message preview
          debouncedFetchAssignments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'zapp_messages',
          filter: `account_id=eq.${currentUser.account_id}`
        },
        (payload) => {
          const newData = payload.new as any;
          
          // CRITICAL SECURITY: Validate account_id matches current user
          if (newData?.account_id && newData.account_id !== currentUser?.account_id) {
            return;
          }
          
          // Update the message in local state if it's for media download completion
          // CRITICAL FIX: Only update if message exists in current state (belongs to current conversation)
          if (newData?.media_download_status && newData?.media_url) {
            setMessages(prevMessages => {
              // If message doesn't exist in current state, it's for a different conversation
              const messageExists = prevMessages.some(msg => msg.id === newData.id);
              if (!messageExists) {
                return prevMessages;
              }
              return prevMessages.map(msg => 
                msg.id === newData.id 
                  ? { 
                      ...msg, 
                      media_url: newData.media_url, 
                      media_download_status: newData.media_download_status 
                    } 
                  : msg
              );
            });
          }
          
          // Also update delivery status changes
          // CRITICAL FIX: Only update if message exists in current state
          if (newData?.delivery_status) {
            setMessages(prevMessages => {
              const messageExists = prevMessages.some(msg => msg.id === newData.id);
              if (!messageExists) {
                return prevMessages;
              }
              return prevMessages.map(msg => 
                msg.id === newData.id 
                  ? { ...msg, delivery_status: newData.delivery_status } 
                  : msg
              );
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (realtimeFetchTimeoutRef.current) {
        clearTimeout(realtimeFetchTimeoutRef.current);
      }
      supabase.removeChannel(conversationsChannel);
    };
  }, [currentUser?.account_id, debouncedFetchAssignments, fetchAssignmentsOnly]);

  // CRITICAL: Extra security layer - filter assignments by sector AND integration
  // Data should already be filtered at query level, but this is a safety check
  const filteredAssignments = useMemo(() => {
    // CRITICAL: If no sector selected, return EMPTY array - never return all data
    if (!sectorId) {
      console.log("[ZappData] filteredAssignments: No sectorId - returning empty array for security");
      return [];
    }
    
    // Find the department that belongs to this sector
    const sectorDepartment = departments.find(d => d.sector_id === sectorId);
    
    if (!sectorDepartment) {
      // If no department for this sector, return empty
      console.log("[ZappData] filteredAssignments: No department for sector - returning empty array");
      return [];
    }
    
    // Double-check: Only return assignments that belong to this department
    // This is a safety net in case data somehow got through without proper filtering
    let filtered = assignments.filter(a => a.department_id === sectorDepartment.id);
    
    if (filtered.length !== assignments.length) {
      console.warn(`[ZappData] SECURITY: Filtered out ${assignments.length - filtered.length} assignments that didn't match department`);
    }
    
    // CRITICAL: If integrationId is specified, filter by integration_id but INCLUDE:
    // 1. Legacy conversations (no integration_id) that belong to this sector
    // 2. GROUPS - they are cross-integration by nature (user explicitly opened them)
    // This prevents missing conversations after multi-instance migration
    if (integrationId) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(a => {
        // Access integration_id, sector_id, and is_group via type assertion
        const zappConv = a.zapp_conversation as { 
          integration_id?: string; 
          sector_id?: string;
          is_group?: boolean;
        } | null;
        const convIntegrationId = zappConv?.integration_id;
        const convSectorId = zappConv?.sector_id;
        const isGroup = zappConv?.is_group === true;
        
        // Include conversation if:
        // 1. It belongs to this exact integration, OR
        // 2. It has no integration_id (legacy) but belongs to the same sector, OR
        // 3. It's a GROUP (groups are cross-integration - user explicitly opened it)
        const matchesIntegration = convIntegrationId === integrationId;
        const isLegacySameSector = !convIntegrationId && convSectorId === sectorId;
        
        return matchesIntegration || isLegacySameSector || isGroup;
      });
      
      if (filtered.length !== beforeCount) {
        console.log(`[ZappData] MULTI-INSTANCE: Filtered to ${filtered.length} assignments for integration ${integrationId} (from ${beforeCount}, includes legacy same-sector and groups)`);
      }
    }
    
    return filtered;
  }, [assignments, departments, sectorId, integrationId]);

  // Keep a ref of filtered assignments for use in realtime callbacks (avoids stale closures)
  const filteredAssignmentsRef = useRef(filteredAssignments);
  filteredAssignmentsRef.current = filteredAssignments;

  return {
    // Data
    departments,
    tags,
    agents,
    teamUsers,
    teamRoles,
    allClients,
    assignments: filteredAssignments,
    messages,
    loading,
    availableProducts,
    clientProducts,
    currentAgent,
    sectorId,
    
    // WhatsApp
    whatsappConnected,
    whatsappConnecting,
    whatsappInstanceName,
    toggleWhatsAppConnection,
    checkWhatsAppStatus,
    
    // Actions
    fetchData,
    fetchMessages,
    setMessages,
    setAssignments,
  };
}

export type { TeamUser };
