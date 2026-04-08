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
  has_agent_token?: boolean;
}

interface AgentRuntimeState {
  logged_campaign?: boolean;
  has_active_call?: boolean;
  manual_mode?: boolean;
  webphone_registered?: boolean;
}

export function useThreeCPlus() {
  const [agentStatus, _setAgentStatus] = useState<AgentStatus>("offline");
  const [currentCall, _setCurrentCall] = useState<CallInfo | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [workBreaks, setWorkBreaks] = useState<WorkBreak[]>([]);
  const [selectedCampaign, _setSelectedCampaign] = useState<Campaign | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);
  const [isConnected, _setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [callTimer, _setCallTimer] = useState(0);
  const [savedExtension, _setSavedExtension] = useState<string | null>(null);
  const [savedExtensionPassword, _setSavedExtensionPassword] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartRef = useRef<Date | null>(null);
  const agentStatusRef = useRef<AgentStatus>("offline");
  const mountedRef = useRef(true);

  // Safe setters that guard against updates after unmount
  const setAgentStatus = useCallback((v: AgentStatus | ((prev: AgentStatus) => AgentStatus)) => { if (mountedRef.current) _setAgentStatus(v); }, []);
  const setCurrentCall = useCallback((v: CallInfo | null | ((prev: CallInfo | null) => CallInfo | null)) => { if (mountedRef.current) _setCurrentCall(v); }, []);
  const setSelectedCampaign = useCallback((v: Campaign | null | ((prev: Campaign | null) => Campaign | null)) => { if (mountedRef.current) _setSelectedCampaign(v); }, []);
  const setIsConnected = useCallback((v: boolean) => { if (mountedRef.current) _setIsConnected(v); }, []);
  const setCallTimer = useCallback((v: number) => { if (mountedRef.current) _setCallTimer(v); }, []);
  const setSavedExtension = useCallback((v: string | null) => { if (mountedRef.current) _setSavedExtension(v); }, []);
  const setSavedExtensionPassword = useCallback((v: string | null) => { if (mountedRef.current) _setSavedExtensionPassword(v); }, []);

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

  const reconcileTelephonyState = useCallback(
    (runtime?: AgentRuntimeState | null, mode: "call_ended" | "manual_exit" | "logout" = "call_ended") => {
      setCurrentCall(null);
      stopCallTimer();

      if (mode === "logout") {
        setSelectedCampaign(null);
        setAgentStatus("offline");
        return;
      }

      const loggedCampaign = runtime?.logged_campaign ?? Boolean(selectedCampaign);
      const manualMode = Boolean(runtime?.manual_mode);

      if (!loggedCampaign) {
        setSelectedCampaign(null);
        setAgentStatus("offline");
        return;
      }

      setAgentStatus(mode === "manual_exit" ? "idle" : manualMode ? "manual_mode" : "idle");
    },
    [selectedCampaign, stopCallTimer]
  );

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

        if (agentStatusRef.current !== "connecting") {
          console.warn("[useThreeCPlus] Ignorando agent-login-failed fora do fluxo ativo de login.");
          return;
        }

        toast.error("Falha no login", {
          description: "O ramal não aceitou a conexão da campanha. Aguarde o WebRTC estabilizar e tente de novo.",
        });
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
    if (!isConnected) {
      toast.error("Ramal ainda conectando", {
        description: "Aguarde o socket da 3C Plus conectar antes de entrar na campanha.",
      });
      return;
    }

    if (!connectionInfo?.has_agent_token) {
      toast.error("Token do agente obrigatório", {
        description: "Configure o token de API do agente para usar o ramal WebRTC e entrar na campanha.",
      });
      return;
    }

    setLoading(true);
    setAgentStatus("connecting");
    setCurrentCall(null);

    try {
      const data = await invokeAgent("login", { campaign_id: campaign.id });
      if (data?.success) {
        setSelectedCampaign(campaign);
        setAgentStatus("connecting");

        const campData = await invokeAgent("get_logged_campaign");
        if (campData?.success && campData.campaign?.work_breaks) {
          setWorkBreaks(campData.campaign.work_breaks);
        }

        toast.info("Login enviado para a campanha", {
          description: "Agora aguarde o evento de agente ocioso para liberar a discagem.",
        });

        if (socketRef.current?.connected) {
          waitForAgentStatus(["idle", "manual_mode"], 15000).then((becameReady) => {
            if (!becameReady) {
              console.warn("[useThreeCPlus] 3C Plus não confirmou estado pronto após login; mantendo status de preparação.");
            }
          });
        } else {
          console.log("[useThreeCPlus] Login confirmado pela API; aguardando agente ficar pronto para discagem.");
        }
      } else {
        toast.error(
          data?.code === "WEBPHONE_NOT_READY" ? "Ramal ainda não registrado" : "Falha ao entrar na campanha",
          { description: data?.error }
        );
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
  }, [connectionInfo?.has_agent_token, invokeAgent, isConnected, waitForAgentStatus]);

  // Logout
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      // Best-effort: if there may be a call, try hangup first but don't block logout
      try {
        await invokeAgent("hangup", currentCall?.id ? { call_id: currentCall.id } : {});
      } catch {}

      const data = await invokeAgent("logout");
      if (!data?.success) {
        toast.error("Não foi possível sair da campanha", {
          description: data?.error || "A 3C Plus recusou a saída. Tente novamente em alguns segundos.",
        });
        return false;
      }

      reconcileTelephonyState(data?.runtime, "logout");
      toast.success(data?.method === "already_logged_out" ? "Sessão liberada" : "Saiu da campanha");
      return true;
    } catch (err) {
      console.error("[useThreeCPlus] logout error:", err);
      toast.error("Erro ao sair da campanha");
      return false;
    } finally {
      setLoading(false);
    }
  }, [invokeAgent, currentCall?.id, reconcileTelephonyState]);

  // Manual call - use the same direct backend flow used by the sales call button
  const manualCall = useCallback(async (phone: string) => {
    const currentStatus = agentStatusRef.current;

    if (currentStatus === "on_call" || currentStatus === "manual_call_connected") {
      toast.error("Já existe uma chamada ativa");
      return false;
    }

    if (!isConnected) {
      toast.error("Ramal ainda conectando", {
        description: "Aguarde o socket da 3C Plus conectar antes de discar.",
      });
      return false;
    }

    // Agent token check removed - backend handles auto-selection of campaigns and tokens

    // Campaign is optional - backend auto-selects one if not provided

    if (currentStatus === "connecting") {
      toast.error("Aguarde a conexão", {
        description: "Aguarde a 3C Plus confirmar a conexão antes de discar.",
      });
      return false;
    }
    // For other statuses (not idle/manual_mode), let the backend handle via ensureAgentReadyForDial

    setLoading(true);
    try {
      const normalizedPhone = phone.replace(/\D/g, "");
      const payload: Record<string, string> = { phone: normalizedPhone };
      if (selectedCampaign?.id) payload.campaign_id = String(selectedCampaign.id);
      const dialData = await invokeAgent("place_call", payload);

      console.log("[useThreeCPlus] place_call result", dialData);

      if (!dialData?.success) {
        toast.error("Não foi possível discar", {
          description: dialData?.error || "A 3C Plus recusou a chamada.",
        });

        if (dialData?.code === "WEBPHONE_NOT_READY") {
          setAgentStatus("offline");
        }

        return false;
      }

      setCurrentCall({
        id: dialData?.call?.id,
        phone: dialData?.call?.phone || normalizedPhone,
        contact_name: dialData?.call?.contact_name,
      });
      setAgentStatus("connecting");

      toast.success("Chamada iniciada", {
        description: dialData?.mode === "manual_mode"
          ? "Ligação enviada pelo modo manual do agente."
          : "Ligação enviada pelo fluxo direto da 3C Plus.",
      });
      return true;
    } catch (err) {
      console.error("[useThreeCPlus] manualCall error:", err);
      toast.error("Erro ao realizar chamada");
      return false;
    } finally {
      setLoading(false);
    }
  }, [connectionInfo?.has_agent_token, invokeAgent, isConnected, selectedCampaign, setAgentStatus, setCurrentCall]);

  // Hangup
  const hangup = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invokeAgent("hangup", currentCall?.id ? { call_id: currentCall.id } : {});
      if (!data?.success) {
        toast.error("Não foi possível desligar", {
          description: data?.error || "A 3C Plus não confirmou o encerramento da chamada.",
        });
        return false;
      }

      reconcileTelephonyState(data?.runtime, "call_ended");
      toast.success(
        data?.method === "already_hung_up"
          ? "Chamada já estava encerrada"
          : currentCall?.id
            ? "Chamada encerrada"
            : "Tentativa de ligação cancelada"
      );
      return true;
    } catch (err) {
      console.error("[useThreeCPlus] hangup error:", err);
      toast.error("Erro ao encerrar chamada");
      return false;
    } finally {
      setLoading(false);
    }
  }, [invokeAgent, currentCall?.id, reconcileTelephonyState]);

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
    setLoading(true);
    try {
      const data = await invokeAgent("manual_call_exit");
      if (!data?.success) {
        toast.error("Não foi possível sair do modo manual", {
          description: data?.error || "A 3C Plus não confirmou a saída do discador manual.",
        });
        return false;
      }

      reconcileTelephonyState(data?.runtime, "manual_exit");
      toast.success("Saiu do discador manual");
      return true;
    } catch (err) {
      console.error("[useThreeCPlus] exitManualMode error:", err);
      toast.error("Erro ao sair do discador manual");
      return false;
    } finally {
      setLoading(false);
    }
  }, [invokeAgent, reconcileTelephonyState]);

  // Save extension (ramal) to backend
  const saveExtension = useCallback(async (ext: string, password?: string) => {
    try {
      const data = await invokeAgent("save_extension", { extension: ext, extension_password: password || undefined });
      if (data?.success) {
        setSavedExtension(data.extension);
        if (password) setSavedExtensionPassword(password);
        toast.success("Ramal salvo com sucesso");
        return true;
      }
      toast.error("Erro ao salvar ramal", { description: data?.error });
      return false;
    } catch (err) {
      console.error("[useThreeCPlus] saveExtension error:", err);
      toast.error("Erro ao salvar ramal");
      return false;
    }
  }, [invokeAgent]);

  // Load saved extension from backend
  const loadExtension = useCallback(async () => {
    try {
      const data = await invokeAgent("get_extension");
      if (data?.success && data.extension) {
        setSavedExtension(data.extension);
        if (data.has_password) setSavedExtensionPassword("configured");
      } else if (data?.success) {
        setSavedExtension(null);
        setSavedExtensionPassword(null);
      }
    } catch (err) {
      console.error("[useThreeCPlus] loadExtension error:", err);
    }
  }, [invokeAgent, setSavedExtension, setSavedExtensionPassword]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      socketRef.current?.removeAllListeners();
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
    savedExtension,
    savedExtensionPassword,
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
    saveExtension,
    loadExtension,
  };
}
