import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Agent, ZappTag, Department, ConversationAssignment } from "@/components/royzapp";
import { sectors } from "@/config/sectors";

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

interface Message {
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
}

const HEARTBEAT_INTERVAL_MS = 60000;
const REALTIME_DEBOUNCE_MS = 2000;
const MIN_FETCH_INTERVAL_MS = 3000;

export function useZappData() {
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

  // Fetch assignments only (for realtime updates)
  const fetchAssignmentsOnly = useCallback(async () => {
    if (!currentUser?.account_id) return;
    
    const now = Date.now();
    if (now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL_MS) {
      return;
    }
    lastFetchTimeRef.current = now;
    
    try {
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("zapp_conversation_assignments")
        .select(`
          *,
          agent:zapp_agents(*, user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url, team_role_id)),
          department:zapp_departments(*),
          conversation:conversations(id, client_id, client:clients(id, full_name, phone_e164, avatar_url)),
          zapp_conversation:zapp_conversations(id, phone_e164, contact_name, client_id, last_message_at, last_message_preview, unread_count, is_group, group_jid, is_archived, is_muted, is_pinned, is_favorite, is_blocked, avatar_url, client:clients(id, full_name, phone_e164, avatar_url))
        `)
        .eq("account_id", currentUser.account_id)
        .neq("status", "closed")
        .order("updated_at", { ascending: false })
        .limit(100);

      if (assignmentsError) throw assignmentsError;
      
      setAssignments(assignmentsData || []);
      
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
  }, [currentUser?.account_id]);

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
  const checkWhatsAppStatus = async () => {
    try {
      const response = await supabase.functions.invoke("uazapi-manager", {
        body: { action: "status" },
      });

      if (response.data) {
        const state = response.data?.state || response.data?.data?.state;
        const connected = state === "open" || response.data?.connected || response.data?.data?.connected;
        setWhatsappConnected(connected);
        setWhatsappInstanceName(response.data?.instance || response.data?.data?.instance || null);
      }
    } catch (error) {
      console.log("WhatsApp status check failed:", error);
    }
  };

  // Toggle WhatsApp connection
  const toggleWhatsAppConnection = async () => {
    setWhatsappConnecting(true);
    try {
      if (whatsappConnected) {
        const response = await supabase.functions.invoke("uazapi-manager", {
          body: { action: "disconnect" },
        });

        if (response.error) throw new Error(response.error.message);
        
        setWhatsappConnected(false);
        toast.success("WhatsApp desconectado do zAPP");
      } else {
        const statusResponse = await supabase.functions.invoke("uazapi-manager", {
          body: { action: "status" },
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
  const fetchData = useCallback(async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);

    try {
      const [
        { data: depts, error: deptsError },
        { data: agentsData, error: agentsError },
        { data: usersData, error: usersError },
        { data: rolesData, error: rolesError },
        { data: assignmentsData, error: assignmentsError },
        { data: tagsData, error: tagsError },
      ] = await Promise.all([
        supabase
          .from("zapp_departments")
          .select("*")
          .eq("account_id", currentUser.account_id)
          .order("display_order"),
        supabase
          .from("zapp_agents")
          .select(`
            *,
            user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url, team_role_id),
            department:zapp_departments(*)
          `)
          .eq("account_id", currentUser.account_id)
          .order("created_at"),
        supabase
          .from("users")
          .select("id, name, email, avatar_url, role, team_role_id, team_role:team_roles(id, name, color)")
          .eq("account_id", currentUser.account_id)
          .order("name"),
        supabase
          .from("team_roles")
          .select("id, name, color")
          .eq("account_id", currentUser.account_id)
          .order("display_order"),
        supabase
          .from("zapp_conversation_assignments")
          .select(`
            *,
            agent:zapp_agents(*, user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url, team_role_id)),
            department:zapp_departments(*),
            conversation:conversations(id, client_id, client:clients(id, full_name, phone_e164, avatar_url)),
            zapp_conversation:zapp_conversations(id, phone_e164, contact_name, client_id, last_message_at, last_message_preview, unread_count, is_group, group_jid, is_archived, is_muted, is_pinned, is_favorite, is_blocked, avatar_url, client:clients(id, full_name, phone_e164, avatar_url))
          `)
          .eq("account_id", currentUser.account_id)
          .neq("status", "closed")
          .order("updated_at", { ascending: false })
          .limit(100),
        supabase
          .from("zapp_tags")
          .select("*")
          .eq("account_id", currentUser.account_id)
          .order("display_order"),
      ]);

      if (deptsError) throw deptsError;
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
          auto_distribute: false,
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
          setDepartments([...existingDepts, ...createdDepts]);
        }
      } else {
        setDepartments(existingDepts);
      }
      
      setTeamUsers((usersData || []) as TeamUser[]);
      setTeamRoles(rolesData || []);
      setAssignments(assignmentsData || []);
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
            user:users!zapp_agents_user_id_fkey(id, name, email, avatar_url, team_role_id),
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
      
      setAgents(finalAgents);
    } catch (error: any) {
      console.error("Error fetching zapp data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [currentUser?.account_id, currentUser?.id, updateAgentHeartbeat]);

  // Fetch messages - using ref to avoid stale closure issues
  const fetchMessagesRef = useRef<(id: string) => Promise<void>>();
  
  const fetchMessages = useCallback(async (zappConversationId: string) => {
    console.log("[ZappData] fetchMessages called for:", zappConversationId);
    try {
      // Fetch latest 100 messages (ordered descending, then reverse for display)
      const { data, error } = await supabase
        .from("zapp_messages")
        .select("id, content, direction, sent_at, message_type, media_url, media_type, media_mimetype, media_filename, audio_duration_sec, sender_name, delivery_status, media_download_status")
        .eq("zapp_conversation_id", zappConversationId)
        .order("sent_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      
      // Reverse to get chronological order (oldest first for display)
      const reversedData = (data || []).reverse();
      
      console.log("[ZappData] fetched messages count:", reversedData.length);
      
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
      }));
      
      setMessages(msgs);
      console.log("[ZappData] setMessages called with", msgs.length, "messages");
      
      // Trigger lazy download for pending media
      const pendingMediaIds = (data || [])
        .filter((m: any) => m.media_download_status === "pending")
        .map((m: any) => m.id);
      
      if (pendingMediaIds.length > 0) {
        supabase.functions.invoke("download-media", {
          body: { message_ids: pendingMediaIds }
        }).then(({ data: downloadResult, error: downloadError }) => {
          if (downloadError) {
            console.error("Error triggering media download:", downloadError);
          } else if (downloadResult?.successful > 0 && fetchMessagesRef.current) {
            fetchMessagesRef.current(zappConversationId);
          }
        });
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }, []);
  
  // Keep ref updated
  fetchMessagesRef.current = fetchMessages;

  // Initial data fetch
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
  }, [currentUser?.account_id, fetchData]);

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
        () => {
          debouncedFetchAssignments();
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
        () => {
          debouncedFetchAssignments();
        }
      )
      .subscribe();

    return () => {
      if (realtimeFetchTimeoutRef.current) {
        clearTimeout(realtimeFetchTimeoutRef.current);
      }
      supabase.removeChannel(conversationsChannel);
    };
  }, [currentUser?.account_id, debouncedFetchAssignments]);

  return {
    // Data
    departments,
    tags,
    agents,
    teamUsers,
    teamRoles,
    allClients,
    assignments,
    messages,
    loading,
    availableProducts,
    clientProducts,
    currentAgent,
    
    // WhatsApp
    whatsappConnected,
    whatsappConnecting,
    whatsappInstanceName,
    toggleWhatsAppConnection,
    
    // Actions
    fetchData,
    fetchMessages,
    setMessages,
    setAssignments,
  };
}

export type { TeamUser, Message };
