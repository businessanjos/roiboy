import { useState, useCallback, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AgentStatus =
  | "offline"
  | "idle"
  | "on_call"
  | "acw" // After Call Work / TPA
  | "manual_mode"
  | "manual_call_connected"
  | "on_break"
  | "connecting";

interface Campaign {
  id: number | string;
  name: string;
  [key: string]: unknown;
}

interface WorkBreak {
  id: number | string;
  name: string;
  time_limit?: number;
  [key: string]: unknown;
}

interface CallInfo {
  id?: string | number;
  phone?: string;
  contact_name?: string;
  duration?: number;
  qualifications?: Array<{ id: number | string; name: string }>;
  mailing?: { data?: Record<string, unknown> };
  [key: string]: unknown;
}

interface ConnectionInfo {
  domain: string;
  api_token: string;
  extension_url: string;
  socket_url?: string;
}

export function useThreeCPlus() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("offline");
  const [currentCall, setCurrentCall] = useState<CallInfo | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [workBreaks, setWorkBreaks] = useState<WorkBreak[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [callTimer, setCallTimer] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartRef = useRef<Date | null>(null);
  const agentStatusRef = useRef<AgentStatus>("offline");

  // Start call timer
  const startCallTimer = useCallback(() => {
    callStartRef.current = new Date();
    setCallTimer(0);
    callTimerRef.current = setInterval(() => {
      if (callStartRef.current) {
        setCallTimer(Math.floor((Date.now() - callStartRef.current.getTime()) / 1000));
      }
    }, 1000);
  }, []);

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    callStartRef.current = null;
    setCallTimer(0);
  }, []);

  useEffect(() => {
    agentStatusRef.current = agentStatus;
  }, [agentStatus]);

  const waitForAgentStatus = useCallback(
    async (statuses: AgentStatus[], timeoutMs = 10000, intervalMs = 250) => {
      const startTime = Date.now();

      while (Date.now() - startTime < timeoutMs) {
        if (statuses.includes(agentStatusRef.current)) {
          return true;
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }

      return statuses.includes(agentStatusRef.current);
    },
    []
  );

  // Invoke the unified edge function
  const invokeAgent = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-agent", {
      body: { action, ...body },
    });
    if (error) throw error;
    return data;
  }, []);

  // Get connection info (domain, token, extension URL)
  const connect = useCallback(async (retries = 2) => {
    setLoading(true);
    try {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const data = await invokeAgent("get_connection_info");
          if (!data?.success) {
            toast.error("3C Plus não configurado", {
              description: "Vá em Configurações > Integrações para conectar sua conta 3C Plus.",
            });
            return false;
          }

          setConnectionInfo(data);
          return true;
        } catch (err: any) {
          console.error(`[useThreeCPlus] connect attempt ${attempt + 1} error:`, err);
          const isFetchError =
            err?.message?.includes("Failed to fetch") ||
            err?.context?.message?.includes("Failed to fetch") ||
            err?.message?.includes("Failed to send a request to the Edge Function");

          if (isFetchError && attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
            continue;
          }

          toast.error("Erro ao conectar ao 3C Plus", {
            description: isFetchError
              ? "Serviço temporariamente indisponível. Tente novamente em alguns segundos."
              : err?.message || "Erro desconhecido",
          });
          return false;
        }
      }

      return false;
    } finally {
      setLoading(false);
    }
  }, [invokeAgent]);

  // Connect Socket.io
  const connectSocket = useCallback((socketUrl: string, apiToken: string) => {
    if (socketRef.current?.connected) return;

    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();

    let fallbackTried = false;

      const markSocketUnsynced = () => {
        setIsConnected(false);
        console.warn("[useThreeCPlus] Socket desconectado; mantendo último estado conhecido do agente.");
      };

    const handleLoggedOut = () => {
      console.log("[useThreeCPlus] agent logged out");
      setAgentStatus("offline");
      setSelectedCampaign(null);
      setCurrentCall(null);
      stopCallTimer();
    };

    const handleEnteredManualMode = () => {
      console.log("[useThreeCPlus] agent entered manual mode");
      setAgentStatus("manual_mode");
    };

    const handleFailedManualMode = () => {
      toast.error("Falha ao entrar no modo manual");
    };

    const createSocket = (transports: Array<"websocket" | "polling">) => {
      console.log(
        "[useThreeCPlus] Connecting Socket.io to",
        socketUrl,
        "with transports",
        transports.join(" -> ")
      );

      const socket = io(socketUrl, {
        path: "/socket.io",
        query: { token: apiToken, api_token: apiToken },
        transports,
        upgrade: transports.includes("polling"),
        rememberUpgrade: false,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        timeout: 10000,
        forceNew: true,
        withCredentials: false,
      });

      socket.on("connect", () => {
        const activeTransport = socket.io.engine.transport.name;
        console.log("[useThreeCPlus] Socket.io connected via", activeTransport);
        setIsConnected(true);
      });

      socket.io.engine.on("upgrade", (transport: { name: string }) => {
        console.log("[useThreeCPlus] Socket.io upgraded to", transport.name);
      });

      socket.on("connect_error", (error: unknown) => {
        console.error("[useThreeCPlus] Socket.io connect_error", error);

        if (!fallbackTried && transports[0] === "websocket") {
          fallbackTried = true;
          console.warn("[useThreeCPlus] WebSocket falhou, tentando polling.");
          socket.removeAllListeners();
          socket.disconnect();
          socketRef.current = createSocket(["polling", "websocket"]);
          return;
        }

        markSocketUnsynced();
      });

      socket.on("disconnect", (reason) => {
        console.log("[useThreeCPlus] Socket.io disconnected", reason);
        markSocketUnsynced();
      });

      // Agent events
      socket.on("agent-is-idle", (data: any) => {
        console.log("[useThreeCPlus] agent-is-idle", data);
        setAgentStatus("idle");
        setCurrentCall(null);
        stopCallTimer();
      });

      socket.on("agent-in-acw", (data: any) => {
        console.log("[useThreeCPlus] agent-in-acw", data);
        setAgentStatus("acw");
        stopCallTimer();
      });

      socket.on("agent-login-failed", (data: any) => {
        console.log("[useThreeCPlus] agent-login-failed", data);
        toast.error("Falha no login", { description: "Não foi possível conectar na campanha." });
        setAgentStatus("offline");
        setSelectedCampaign(null);
      });

      socket.on("agent-was-logged-out", handleLoggedOut);
      socket.on("agent-logged-out", handleLoggedOut);
      socket.on("agent-entered-manual", handleEnteredManualMode);
      socket.on("agent-entered-manual-mode", handleEnteredManualMode);

      socket.on("agent-left-manual-mode", () => {
        console.log("[useThreeCPlus] agent-left-manual-mode");
        setAgentStatus("idle");
      });

      socket.on("agent-failed-to-enter-manual", handleFailedManualMode);
      socket.on("agent-entered-manual-mode-failed", handleFailedManualMode);

      socket.on("agent-entered-work-break", (data: any) => {
        console.log("[useThreeCPlus] agent-entered-work-break", data);
        setAgentStatus("on_break");
      });

      socket.on("agent-left-work-break", () => {
        console.log("[useThreeCPlus] agent-left-work-break");
        setAgentStatus("idle");
      });

      // Call events - Dialer
      socket.on("call-was-connected", (data: any) => {
        console.log("[useThreeCPlus] call-was-connected", data);
        setAgentStatus("on_call");
        setCurrentCall({
          id: data?.call?.id,
          phone: data?.call?.phone || data?.mailing?.data?.phone,
          contact_name: data?.mailing?.data?.name || data?.mailing?.data?.Nome,
          qualifications: data?.qualifications,
          mailing: data?.mailing,
        });
        startCallTimer();
      });

      socket.on("call-was-finished", (data: any) => {
        console.log("[useThreeCPlus] call-was-finished", data);
        // ACW handled by agent-in-acw event
      });

      socket.on("call-was-hangup", (data: any) => {
        console.log("[useThreeCPlus] call-was-hangup", data);
        stopCallTimer();
      });

      // Manual call events
      socket.on("manual-call-was-connected", (data: any) => {
        console.log("[useThreeCPlus] manual-call-was-connected", data);
        setAgentStatus("manual_call_connected");
        setCurrentCall((prev) => ({
          ...prev,
          id: data?.call?.id,
        }));
        startCallTimer();
      });

      socket.on("manual-call-was-answered", (data: any) => {
        console.log("[useThreeCPlus] manual-call-was-answered", data);
      });

      socket.on("manual-call-was-hangup", (data: any) => {
        console.log("[useThreeCPlus] manual-call-was-hangup", data);
        stopCallTimer();
      });

      socket.on("manual-call-was-finished", (data: any) => {
        console.log("[useThreeCPlus] manual-call-was-finished", data);
        setCurrentCall(null);
        stopCallTimer();
      });

      socket.on("manual-call-was-unanswered", () => {
        console.log("[useThreeCPlus] manual-call-was-unanswered");
        toast.info("Chamada não atendida");
        setCurrentCall(null);
        stopCallTimer();
      });

      socket.on("manual-call-failed", () => {
        console.log("[useThreeCPlus] manual-call-failed");
        toast.error("Falha na chamada manual");
        setCurrentCall(null);
        stopCallTimer();
      });

      // Call history event (for logging)
      socket.on("call-history-was-created", (data: any) => {
        console.log("[useThreeCPlus] call-history-was-created", data);
        logCallEvent(data);
      });

      socket.on("manual-call-history-was-created", (data: any) => {
        console.log("[useThreeCPlus] manual-call-history-was-created", data);
        logCallEvent(data);
      });

      return socket;
    };

    socketRef.current = createSocket(["websocket"]);
  }, [startCallTimer, stopCallTimer]);

  // Log call event to database
  async function logCallEvent(eventData: any) {
    try {
      const call = eventData?.call || eventData;
      const { data: userData } = await supabase
        .from("users")
        .select("id, account_id")
        .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!userData) return;

      await supabase.from("threecplus_call_logs").upsert(
        {
          account_id: userData.account_id,
          user_id: userData.id,
          call_id: String(call?.id || ""),
          call_type: call?.mode === "manual" || call?.mode === "acw_manual" ? "manual" : "dialer",
          direction: call?.direction || "outbound",
          phone: call?.phone || call?.number,
          contact_name: call?.mailing_name || call?.contact_name,
          campaign_id: String(call?.campaign_id || ""),
          campaign_name: call?.campaign_name,
          status: call?.qualification ? "finished" : "hangup",
          qualification: call?.qualification_id ? String(call.qualification_id) : null,
          qualification_name: call?.qualification_name,
          duration_seconds: call?.duration || call?.billsec || 0,
          acw_seconds: call?.acw_duration || 0,
          wait_seconds: call?.wait_duration || 0,
          started_at: call?.started_at || call?.created_at,
          connected_at: call?.answered_at,
          ended_at: call?.hangup_at || call?.finished_at,
          metadata: call,
        },
        { onConflict: "call_id" }
      );
    } catch (err) {
      console.error("[useThreeCPlus] logCallEvent error:", err);
    }
  }

  // Fetch campaigns with retry
  const fetchCampaigns = useCallback(async (retries = 2) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke("threecplus-campaigns");
        if (error) {
          console.warn(`[useThreeCPlus] fetchCampaigns attempt ${attempt + 1} failed:`, error);
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          toast.error("Erro ao buscar campanhas", {
            description: "Tente fechar e abrir o painel novamente.",
          });
          return [];
        }
        if (!data?.success) {
          toast.error("Erro ao buscar campanhas", {
            description: data?.error || "Erro desconhecido",
          });
          return [];
        }
        const list = data.campaigns || [];
        setCampaigns(list);
        return list;
      } catch (err) {
        console.warn(`[useThreeCPlus] fetchCampaigns attempt ${attempt + 1} exception:`, err);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        toast.error("Erro ao buscar campanhas");
        return [];
      }
    }
    return [];
  }, []);

  // Login to campaign
  const loginCampaign = useCallback(async (campaign: Campaign) => {
    setLoading(true);
    setAgentStatus("connecting");
    setCurrentCall(null);

    try {
      const data = await invokeAgent("login", { campaign_id: campaign.id });
      if (data?.success) {
        setSelectedCampaign(campaign);

        const campData = await invokeAgent("get_logged_campaign");
        if (campData?.success && campData.campaign?.work_breaks) {
          setWorkBreaks(campData.campaign.work_breaks);
        }

        // Try to wait for socket confirmation; if socket is not connected, trust the API response
        const socketConnected = socketRef.current?.connected;
        if (socketConnected) {
          const becameIdle = await waitForAgentStatus(["idle"], 15000);
          if (becameIdle) {
            toast.success("Conectado à campanha", { description: campaign.name });
          } else {
            // API succeeded but socket didn't confirm — assume idle anyway
            console.warn("[useThreeCPlus] Socket não confirmou idle, mas API aceitou o login.");
            setAgentStatus("idle");
            toast.success("Conectado à campanha", { description: campaign.name });
          }
        } else {
          // No socket connection — trust API and set idle
          console.log("[useThreeCPlus] Login sem socket — assumindo status idle via API.");
          setAgentStatus("idle");
          toast.success("Conectado à campanha", { description: campaign.name });
        }
      } else {
        toast.error("Falha ao entrar na campanha", { description: data?.error });
        setSelectedCampaign(null);
        setAgentStatus("offline");
      }
    } catch (err) {
      console.error("[useThreeCPlus] loginCampaign error:", err);
      toast.error("Erro ao conectar na campanha");
      setSelectedCampaign(null);
      setAgentStatus("offline");
    } finally {
      setLoading(false);
    }
  }, [invokeAgent, waitForAgentStatus]);

  // Logout
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await invokeAgent("logout");
      setAgentStatus("offline");
      setSelectedCampaign(null);
      setCurrentCall(null);
      stopCallTimer();
    } catch (err) {
      console.error("[useThreeCPlus] logout error:", err);
    } finally {
      setLoading(false);
    }
  }, [invokeAgent, stopCallTimer]);

  // Manual call
  const manualCall = useCallback(async (phone: string) => {
    const currentStatus = agentStatusRef.current;

    // Socket connection is not required for manual dialing - we trust the API

    if (currentStatus !== "idle" && currentStatus !== "manual_mode") {
      toast.error("Agente não está pronto para discar", {
        description: "Aguarde o status ficar ocioso antes de iniciar a ligação manual.",
      });
      return false;
    }

    setLoading(true);
    try {
      const campaignData = await invokeAgent("get_logged_campaign");
      if (!campaignData?.success) {
        setSelectedCampaign(null);
        setAgentStatus("offline");
        toast.error("Sua sessão da campanha caiu", {
          description: "Entre novamente na campanha antes de discar.",
        });
        return false;
      }

      if (currentStatus !== "manual_mode") {
        let entered = false;
        let enterError = "Aguarde o discador liberar ou tente novamente em alguns segundos.";

        for (let attempt = 0; attempt < 3; attempt++) {
          const enterData = await invokeAgent("manual_call_enter");
          if (enterData?.success) {
            entered = true;
            break;
          }

          if (enterData?.error) {
            enterError = enterData.error;
          }

          if (attempt < 2) {
            toast.info("Aguardando agente ficar ocioso...", { duration: 2000 });
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        if (!entered) {
          setAgentStatus("connecting");
          toast.error("Agente não está ocioso", {
            description: enterError,
          });
          return false;
        }

        const manualModeReady = await waitForAgentStatus(["manual_mode"], 5000);
        if (!manualModeReady) {
          setAgentStatus("connecting");
          toast.error("Modo manual ainda não confirmou", {
            description: "Aguarde o ramal atualizar e tente novamente.",
          });
          return false;
        }
      }

      const dialData = await invokeAgent("manual_call_dial", { phone });
      if (!dialData?.success) {
        toast.error("Não foi possível discar", {
          description: dialData?.error || "A 3C Plus recusou a chamada manual.",
        });
        await invokeAgent("manual_call_exit");
        return false;
      }

      setCurrentCall({ phone, contact_name: undefined });
      return true;
    } catch (err) {
      console.error("[useThreeCPlus] manualCall error:", err);
      toast.error("Erro ao realizar chamada");
      return false;
    } finally {
      setLoading(false);
    }
  }, [invokeAgent, isConnected, waitForAgentStatus]);

  // Hangup
  const hangup = useCallback(async () => {
    if (!currentCall?.id) return;
    try {
      await invokeAgent("hangup", { call_id: currentCall.id });
    } catch (err) {
      console.error("[useThreeCPlus] hangup error:", err);
    }
  }, [invokeAgent, currentCall]);

  // Qualify call
  const qualify = useCallback(async (qualificationId: number | string) => {
    if (!currentCall?.id) return;
    try {
      await invokeAgent("qualify", { call_id: currentCall.id, qualification_id: qualificationId });
    } catch (err) {
      console.error("[useThreeCPlus] qualify error:", err);
    }
  }, [invokeAgent, currentCall]);

  // Pause
  const enterPause = useCallback(async (workBreakId: number | string) => {
    try {
      const data = await invokeAgent("pause_enter", { work_break_id: workBreakId });
      if (!data?.success) toast.error("Falha ao entrar no intervalo");
    } catch (err) {
      console.error("[useThreeCPlus] enterPause error:", err);
    }
  }, [invokeAgent]);

  const exitPause = useCallback(async () => {
    try {
      await invokeAgent("pause_exit");
    } catch (err) {
      console.error("[useThreeCPlus] exitPause error:", err);
    }
  }, [invokeAgent]);

  // Exit manual mode
  const exitManualMode = useCallback(async () => {
    try {
      await invokeAgent("manual_call_exit");
    } catch (err) {
      console.error("[useThreeCPlus] exitManualMode error:", err);
    }
  }, [invokeAgent]);

  // Cleanup
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      stopCallTimer();
    };
  }, [stopCallTimer]);

  return {
    // State
    agentStatus,
    currentCall,
    campaigns,
    workBreaks,
    selectedCampaign,
    connectionInfo,
    isConnected,
    loading,
    callTimer,
    // Actions
    connect,
    connectSocket,
    fetchCampaigns,
    loginCampaign,
    logout,
    manualCall,
    hangup,
    qualify,
    enterPause,
    exitPause,
    exitManualMode,
  };
}
