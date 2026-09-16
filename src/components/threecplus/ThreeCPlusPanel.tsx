import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Headphones, Loader2, Maximize2, Minimize2, Phone, PhoneCall, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { setThreeCPlusOpen } from "@/hooks/useThreeCPlusOpen";

type DialerStatus = "offline" | "idle" | "on_call" | "pause";

interface AgentRuntime {
  logged_campaign?: boolean;
  has_active_call?: boolean;
  manual_mode?: boolean;
  agent_status?: string | null;
  normalized_status?: "offline" | "idle" | "on_call" | "break" | "manual" | "unknown";
  campaign_id?: string | null;
  campaign_name?: string | null;
  manual_campaign?: boolean;
}

declare global {
  interface Window {
    __threeCPlusRuntime?: { runtime: AgentRuntime; polledAt: number; proof: string };
  }
}

interface ConnectionInfo {
  success?: boolean;
  domain?: string;
}

const STATUS_INFO: Record<DialerStatus, { label: string; dot: string; icon: typeof Phone }> = {
  offline: { label: "Offline", dot: "bg-muted-foreground", icon: Headphones },
  idle: { label: "Ocioso", dot: "bg-success", icon: Headphones },
  on_call: { label: "Em chamada", dot: "bg-destructive", icon: PhoneCall },
  pause: { label: "Intervalo", dot: "bg-warning", icon: Headphones },
};

function normalizeDomain(value?: string) {
  const fallback = "https://eternumentoringclub1.3c.plus";
  return (value || fallback)
    .trim()
    .replace(/\/login\/?$/, "")
    .replace(/\/agent\/?(?:.*)?$/, "")
    .replace(/\/$/, "");
}

function mapRuntimeStatus(runtime?: AgentRuntime | null): DialerStatus {
  if (runtime?.normalized_status === "on_call") return "on_call";
  if (runtime?.normalized_status === "break") return "pause";
  if (runtime?.normalized_status === "idle" || runtime?.normalized_status === "manual") return "idle";
  return "offline";
}

const MIN_PANEL_WIDTH = 340;
const MIN_PANEL_HEIGHT = 320;
const DEFAULT_PANEL_WIDTH = 540;
const DEFAULT_PANEL_HEIGHT = 460;
const MARGIN = 16;
// Mantém a faixa de composição do RoyZapp livre para texto, áudio e anexos.
const COMPOSER_CLEARANCE = 112;
// v3 descarta geometrias antigas que cobriam quase toda a conversa.
const GEOMETRY_STORAGE_KEY = "roy_threec_panel_geometry_v3";
const LAUNCHER_POSITION_STORAGE_KEY = "roy_threec_launcher_position_v1";
const OPEN_STORAGE_KEY = "roy_threec_panel_open";
const DIAL_RUNTIME_GRACE_MS = 5_000;

interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Position {
  x: number;
  y: number;
}

function clampLauncherPosition(position: Position, width = 330, height = 52): Position {
  if (typeof window === "undefined") return position;
  return {
    x: Math.min(Math.max(MARGIN, position.x), Math.max(MARGIN, window.innerWidth - width - MARGIN)),
    y: Math.min(Math.max(MARGIN, position.y), Math.max(MARGIN, window.innerHeight - height - MARGIN)),
  };
}

function readLauncherPosition(): Position {
  if (typeof window === "undefined") return { x: MARGIN, y: 80 };
  const fallback = clampLauncherPosition({ x: window.innerWidth - 330 - MARGIN, y: 80 });
  try {
    const raw = window.localStorage.getItem(LAUNCHER_POSITION_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Position>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return fallback;
    return clampLauncherPosition(parsed as Position);
  } catch {
    return fallback;
  }
}

function clampGeometry(geo: Geometry): Geometry {
  if (typeof window === "undefined") return geo;
  const maxW = Math.max(MIN_PANEL_WIDTH, window.innerWidth - MARGIN * 2);
  const availableHeight = Math.max(240, window.innerHeight - MARGIN - COMPOSER_CLEARANCE);
  const minHeight = Math.min(MIN_PANEL_HEIGHT, availableHeight);
  const maxH = Math.max(minHeight, availableHeight);
  const width = Math.min(Math.max(MIN_PANEL_WIDTH, geo.width), maxW);
  const height = Math.min(Math.max(minHeight, geo.height), maxH);
  const x = Math.min(Math.max(MARGIN, geo.x), Math.max(MARGIN, window.innerWidth - width - MARGIN));
  const y = Math.min(
    Math.max(MARGIN, geo.y),
    Math.max(MARGIN, window.innerHeight - height - COMPOSER_CLEARANCE),
  );
  return { x, y, width, height };
}

/** Nasce embaixo, no canto direito, sobre o conteúdo da tela. */
function defaultGeometry(): Geometry {
  if (typeof window === "undefined") {
    return { x: MARGIN, y: MARGIN, width: DEFAULT_PANEL_WIDTH, height: DEFAULT_PANEL_HEIGHT };
  }
  // Sempre menor que a conversa e acima do compositor, como uma janela solta.
  const width = Math.min(DEFAULT_PANEL_WIDTH, Math.round(window.innerWidth * 0.58));
  const height = Math.min(DEFAULT_PANEL_HEIGHT, Math.round(window.innerHeight * 0.6));
  return clampGeometry({
    x: window.innerWidth - width - MARGIN,
    y: window.innerHeight - height - COMPOSER_CLEARANCE,
    width,
    height,
  });
}

function readStoredGeometry(): Geometry {
  if (typeof window === "undefined") return defaultGeometry();
  try {
    const raw = window.localStorage.getItem(GEOMETRY_STORAGE_KEY);
    if (!raw) return defaultGeometry();
    const parsed = JSON.parse(raw) as Partial<Geometry>;
    if (
      typeof parsed?.x !== "number" ||
      typeof parsed?.y !== "number" ||
      typeof parsed?.width !== "number" ||
      typeof parsed?.height !== "number"
    ) {
      return defaultGeometry();
    }
    return clampGeometry(parsed as Geometry);
  } catch {
    return defaultGeometry();
  }
}

function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

type ResizeEdge = "n" | "w" | "e" | "s" | "nw" | "ne" | "sw" | "se";

export function ThreeCPlusPanel({ visible = true }: { visible?: boolean }) {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(OPEN_STORAGE_KEY) === "1";
  });
  const [fullscreen, setFullscreen] = useState(false);
  const [geometry, setGeometry] = useState<Geometry>(() => readStoredGeometry());
  const geometryRef = useRef<Geometry>(geometry);
  const [launcherPosition, setLauncherPosition] = useState<Position>(() => readLauncherPosition());
  const launcherPositionRef = useRef<Position>(launcherPosition);
  const launcherRef = useRef<HTMLDivElement | null>(null);
  const launcherDraggedRef = useRef(false);
  const [interacting, setInteracting] = useState(false);
  const [hasExtension, setHasExtension] = useState(false);
  const [accountConnected, setAccountConnected] = useState(false);
  const [domain, setDomain] = useState("https://eternumentoringclub1.3c.plus");
  const [status, setStatus] = useState<DialerStatus>("offline");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [contact, setContact] = useState<{ name?: string | null; phone?: string | null } | null>(null);
  const [dialingSince, setDialingSince] = useState<number | null>(null);
  const [hasActiveCall, setHasActiveCall] = useState<boolean | null>(null);
  const callStartedAt = useRef<number | null>(null);
  const dialingSinceRef = useRef<number | null>(null);
  const callWasActiveRef = useRef(false);
  const noActivePollsRef = useRef(0);
  const lifecycleEpochRef = useRef(0);

  // "Em chamada" só vale com chamada ativa de fato: na qualificação a 3C mantém
  // o agente em on_call, mas a ligação já terminou.
  const inCall = status === "on_call" && hasActiveCall !== false;

  const agentIdRef = useRef<string | null>(null);

  const invokeAgent = useCallback(async (action: string) => {
    // Sem sessão ativa a função responde 401; evita erro e mantém o discador oculto.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return null;
    const { data, error } = await supabase.functions.invoke("threecplus-agent", { body: { action } });
    if (error) throw error;
    return data;
  }, []);

  const refreshStatus = useCallback(async () => {
    const requestEpoch = lifecycleEpochRef.current;
    try {
      const data = await invokeAgent("get_runtime");
      // Uma resposta iniciada durante a ligação anterior nunca pode limpar a nova.
      if (requestEpoch !== lifecycleEpochRef.current) return;
      if (data?.success) {
        const active = data.runtime?.has_active_call === true;
        setStatus(mapRuntimeStatus(data.runtime));
        setHasActiveCall(active);
        if (active) {
          callWasActiveRef.current = true;
          noActivePollsRef.current = 0;
          dialingSinceRef.current = null;
          setDialingSince(null);
        } else if (dialingSinceRef.current !== null) {
          const pastGrace = Date.now() - dialingSinceRef.current >= DIAL_RUNTIME_GRACE_MS;
          if (callWasActiveRef.current) {
            dialingSinceRef.current = null;
            callWasActiveRef.current = false;
            noActivePollsRef.current = 0;
            setDialingSince(null);
          } else if (pastGrace) {
            noActivePollsRef.current += 1;
            if (noActivePollsRef.current >= 2) {
              dialingSinceRef.current = null;
              noActivePollsRef.current = 0;
              setDialingSince(null);
            }
          }
        }
        if (data.runtime_proof) {
          window.__threeCPlusRuntime = { runtime: data.runtime, polledAt: Date.now(), proof: data.runtime_proof };
        }
      }
      else {
        setStatus("offline");
        setHasActiveCall(null);
      }
    } catch (error) {
      console.warn("[ThreeCPlusPanel] Não foi possível atualizar o status:", error);
    } finally {
      setLoadingStatus(false);
    }
  }, [invokeAgent]);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        const [extensionData, connectionData] = await Promise.all([
          invokeAgent("get_extension"),
          invokeAgent("get_connection_info") as Promise<ConnectionInfo>,
        ]);
        if (!active) return;
        const withExtension = Boolean(extensionData?.success && extensionData?.extension);
        setHasExtension(withExtension);
        setAccountConnected(Boolean(extensionData?.account_connected));
        agentIdRef.current = typeof (connectionData as ConnectionInfo & { agent_id?: string }).agent_id === "string"
          ? (connectionData as ConnectionInfo & { agent_id?: string }).agent_id ?? null
          : null;
        if (connectionData?.success) setDomain(normalizeDomain(connectionData.domain));
        if (withExtension) await refreshStatus();
        else setLoadingStatus(false);
      } catch (error) {
        console.warn("[ThreeCPlusPanel] Discador indisponível:", error);
        if (active) setLoadingStatus(false);
      }
    };

    void initialize();
    return () => { active = false; };
  }, [invokeAgent, refreshStatus]);

  const dialing = !inCall && dialingSince !== null;
  // O discador só existe para quem tem ramal na 3C (vendedores). Para os demais
  // (CS, marketing, consultoras) nada é renderizado.
  const canUseDialer = hasExtension;

  // Enquanto houver chamada ativa ou uma tentativa em andamento, o estado é
  // consultado com mais frequência para detectar atendimento e encerramento.
  useEffect(() => {
    if (!hasExtension) return;
    const interval = inCall || dialing ? 5_000 : 30_000;
    const timer = window.setInterval(() => { void refreshStatus(); }, interval);
    const onFocus = () => { void refreshStatus(); };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [hasExtension, refreshStatus, inCall, dialing]);

  // Cronômetro: conta o tempo tentando ligar e depois o tempo da ligação atendida.
  useEffect(() => {
    if (inCall) {
      if (!callStartedAt.current) callStartedAt.current = Date.now();
    } else {
      callStartedAt.current = null;
    }
    const base = inCall ? callStartedAt.current : dialingSince;
    if (!base) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed((Date.now() - base) / 1000);
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [inCall, dialingSince]);

  // Se a tentativa não virar chamada, o cartão some após 2 minutos.
  useEffect(() => {
    if (dialingSince === null || inCall) return;
    const timer = window.setTimeout(() => {
      dialingSinceRef.current = null;
      noActivePollsRef.current = 0;
      setDialingSince(null);
    }, 120_000);
    return () => window.clearTimeout(timer);
  }, [dialingSince, inCall]);

  // Ligação encerrada/qualificada: limpa contato, cronômetro e marcadores para
  // que o próximo lead comece do zero.
  useEffect(() => {
    if (inCall || dialingSince !== null) return;
    callStartedAt.current = null;
    callWasActiveRef.current = false;
    noActivePollsRef.current = 0;
    setElapsed(0);
    setContact(null);
  }, [inCall, dialingSince]);



  useEffect(() => {
    const openDrawer = (event: Event) => {
      const detail = (event as CustomEvent<{
        contact_name?: string | null;
        contactName?: string | null;
        phone?: string | null;
      }>).detail;
      const name = detail?.contact_name ?? detail?.contactName ?? null;
      if (detail && (name || detail.phone)) {
        lifecycleEpochRef.current += 1;
        const startedAt = Date.now();
        // Nova tentativa: zera o cronômetro e o contato da ligação anterior.
        callStartedAt.current = null;
        setElapsed(0);
        setContact({ name, phone: detail.phone ?? null });
        dialingSinceRef.current = startedAt;
        callWasActiveRef.current = false;
        noActivePollsRef.current = 0;
        setHasActiveCall(null);
        setDialingSince(startedAt);
      }
      setIsOpen(true);
      window.setTimeout(() => { void refreshStatus(); }, 1_500);
    };
    window.addEventListener("threecplus:open-drawer", openDrawer);
    window.addEventListener("threecplus:dial-request", openDrawer);
    const collapseForAudio = () => setIsOpen(false);
    window.addEventListener("threecplus:collapse-for-audio", collapseForAudio);
    return () => {
      window.removeEventListener("threecplus:open-drawer", openDrawer);
      window.removeEventListener("threecplus:dial-request", openDrawer);
      window.removeEventListener("threecplus:collapse-for-audio", collapseForAudio);
    };
  }, [refreshStatus]);

  // Mantém a geometria atual disponível aos eventos de ponteiro. A persistência
  // acontece ao terminar a interação, evitando gravações contínuas durante drag.
  useEffect(() => {
    geometryRef.current = geometry;
  }, [geometry]);

  useEffect(() => {
    launcherPositionRef.current = launcherPosition;
  }, [launcherPosition]);

  const persistGeometry = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(GEOMETRY_STORAGE_KEY, JSON.stringify(geometryRef.current));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(OPEN_STORAGE_KEY, isOpen ? "1" : "0");
  }, [isOpen]);

  // Mantém o popup dentro da tela quando a janela muda de tamanho.
  useEffect(() => {
    const onResize = () => {
      setGeometry((prev) => {
        const next = clampGeometry(prev);
        geometryRef.current = next;
        window.localStorage.setItem(GEOMETRY_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      const launcherRect = launcherRef.current?.getBoundingClientRect();
      setLauncherPosition((prev) => {
        const next = clampLauncherPosition(prev, launcherRect?.width, launcherRect?.height);
        launcherPositionRef.current = next;
        window.localStorage.setItem(LAUNCHER_POSITION_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // O botão recolhido também é uma janela flutuante: arrasta por qualquer área
  // e só abre o discador quando houve um clique, não após um movimento.
  const startLauncherDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    launcherDraggedRef.current = false;
    const startX = event.clientX;
    const startY = event.clientY;
    const base = launcherPositionRef.current;
    const rect = launcherRef.current?.getBoundingClientRect();

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) launcherDraggedRef.current = true;
      const next = clampLauncherPosition(
        { x: base.x + dx, y: base.y + dy },
        rect?.width,
        rect?.height,
      );
      launcherPositionRef.current = next;
      setLauncherPosition(next);
    };

    const onUp = () => {
      if (launcherDraggedRef.current) {
        window.localStorage.setItem(LAUNCHER_POSITION_STORAGE_KEY, JSON.stringify(launcherPositionRef.current));
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  // Só o modo tela cheia bloqueia a rolagem do fundo.
  useEffect(() => {
    if (!isOpen || !fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [isOpen, fullscreen]);

  // Arrastar a barra de título para mover o popup pela tela.
  const startDrag = useCallback((event: React.PointerEvent) => {
    if (fullscreen) return;
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteracting(true);
    const startX = event.clientX;
    const startY = event.clientY;
    const base = geometryRef.current;
    const onMove = (e: PointerEvent) => {
      const next = clampGeometry({
        ...base,
        x: base.x + (e.clientX - startX),
        y: base.y + (e.clientY - startY),
      });
      geometryRef.current = next;
      setGeometry(next);
    };
    const onUp = () => {
      setInteracting(false);
      persistGeometry();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [fullscreen, persistGeometry]);

  // Arrastar as bordas/cantos para redimensionar.
  const startResize = useCallback((edge: ResizeEdge) => (event: React.PointerEvent) => {
    if (fullscreen) return;
    event.preventDefault();
    event.stopPropagation();
    setInteracting(true);
    const startX = event.clientX;
    const startY = event.clientY;
    const base = geometryRef.current;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let { x, y, width, height } = base;
      if (edge.includes("e")) width = base.width + dx;
      if (edge.includes("s")) height = base.height + dy;
      if (edge.includes("w")) {
        width = base.width - dx;
        if (width >= MIN_PANEL_WIDTH) x = base.x + dx;
      }
      if (edge.includes("n")) {
        height = base.height - dy;
        if (height >= MIN_PANEL_HEIGHT) y = base.y + dy;
      }
      const next = clampGeometry({ x, y, width, height });
      geometryRef.current = next;
      setGeometry(next);
    };

    const onUp = () => {
      setInteracting(false);
      persistGeometry();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [fullscreen, persistGeometry]);

  const statusInfo = useMemo(() => STATUS_INFO[status], [status]);
  const StatusIcon = statusInfo.icon;
  const popupOpen = visible && canUseDialer && isOpen;
  const activeCall = inCall || dialing;
  const contactLabel = contact?.name || contact?.phone || null;

  // Avisa as fichas (lead/negócio) que o discador está aberto, para liberarem o clique.
  useEffect(() => {
    setThreeCPlusOpen(popupOpen);
    return () => setThreeCPlusOpen(false);
  }, [popupOpen]);

  const panelStyle = fullscreen
    ? { left: 0, top: 0, width: "100vw", height: "100vh" }
    : {
        left: Math.round(geometry.x),
        top: Math.round(geometry.y),
        width: Math.round(geometry.width),
        height: Math.round(geometry.height),
      };

  const resizeHandles: { edge: ResizeEdge; className: string }[] = [
    { edge: "n", className: "inset-x-3 top-0 h-1.5 cursor-ns-resize" },
    { edge: "s", className: "inset-x-3 bottom-0 h-1.5 cursor-ns-resize" },
    { edge: "w", className: "inset-y-3 left-0 w-1.5 cursor-ew-resize" },
    { edge: "e", className: "inset-y-3 right-0 w-1.5 cursor-ew-resize" },
    { edge: "nw", className: "left-0 top-0 h-3 w-3 cursor-nwse-resize" },
    { edge: "ne", className: "right-0 top-0 h-3 w-3 cursor-nesw-resize" },
    { edge: "sw", className: "bottom-0 left-0 h-3 w-3 cursor-nesw-resize" },
    { edge: "se", className: "bottom-0 right-0 h-3 w-3 cursor-nwse-resize" },
  ];

  return (
    <>
      {/* Botão sempre visível: fechar o popup apenas recolhe para cá. */}
      {visible && canUseDialer && !isOpen && (
        <div
          ref={launcherRef}
          style={{ left: Math.round(launcherPosition.x), top: Math.round(launcherPosition.y) }}
          onPointerDown={startLauncherDrag}
          className="pointer-events-auto fixed z-[60] flex touch-none select-none items-center rounded-md border border-border bg-card shadow-lg cursor-grab active:cursor-grabbing"
          title="Arraste para mover o Discador 3C"
        >
          <GripVertical className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Button
            type="button"
            variant="ghost"
            className="h-11 gap-2 px-3"
            onClick={() => {
              if (launcherDraggedRef.current) {
                launcherDraggedRef.current = false;
                return;
              }
              setIsOpen(true);
              void refreshStatus();
            }}
            aria-label={`Abrir Discador 3C. Status: ${statusInfo.label}`}
          >
            <Phone className={cn("h-4 w-4", activeCall ? "text-destructive" : "text-primary")} />
            <span>Discador 3C</span>
            {activeCall ? (
              <span className="flex items-center gap-1.5 text-xs text-destructive">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                </span>
                {inCall ? "Em chamada" : "Chamando"}
                <span className="font-mono">{formatElapsed(elapsed)}</span>
              </span>
            ) : loadingStatus ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full", statusInfo.dot)} />
                {statusInfo.label}
              </span>
            )}
          </Button>
        </div>
      )}

      {/* Cartão de chamada em andamento quando o popup está aberto em outro canto. */}
      {visible && canUseDialer && isOpen && activeCall && (
        <div className="pointer-events-auto fixed bottom-20 left-4 z-[70] flex items-center gap-2 rounded-md border border-destructive/40 bg-card px-3 py-2 shadow-lg lg:bottom-6 lg:left-6">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{contactLabel || (inCall ? "Em chamada" : "Chamando")}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{inCall ? "Em chamada" : "Chamando"}</span>
              <span className="font-mono">{formatElapsed(elapsed)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Fundo escurecido apenas em tela cheia. */}
      {fullscreen && popupOpen && (
        <div
          onClick={() => setFullscreen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-[55] bg-background/60 backdrop-blur-[2px]"
        />
      )}

      {/* O quadro da 3C fica sempre montado: recolher apenas esconde, a chamada
          continua ativa em segundo plano. */}
      <div
        style={panelStyle}
        className={cn(
          "fixed z-[60] flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl",
          popupOpen ? "pointer-events-auto opacity-100" : "pointer-events-none -z-10 opacity-0",
        )}
        aria-hidden={!popupOpen}
      >
        {!fullscreen &&
          resizeHandles.map((handle) => (
            <div
              key={handle.edge}
              onPointerDown={startResize(handle.edge)}
              role="separator"
              aria-label="Redimensionar discador"
              className={cn("absolute z-20 hidden sm:block", handle.className)}
            />
          ))}

        <div
          onPointerDown={startDrag}
          className={cn(
            "flex h-12 shrink-0 touch-none select-none items-center justify-between border-b border-border bg-muted/40 px-3 pl-4",
            fullscreen ? "cursor-default" : "cursor-move",
          )}
          title={fullscreen ? undefined : "Arraste para mover o discador"}
        >
          <div className="flex min-w-0 items-center gap-2">
            <StatusIcon className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold">Discador 3C</span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", statusInfo.dot)} />
              {statusInfo.label}
            </span>
            {activeCall && (
              <span className="shrink-0 font-mono text-xs text-destructive">
                {inCall ? "" : "Chamando "}
                {formatElapsed(elapsed)}
              </span>
            )}
            {activeCall && contactLabel && (
              <span className="truncate text-xs text-muted-foreground">· {contactLabel}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              onClick={() => setFullscreen((v) => !v)}
              aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
              title={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              aria-label="Recolher Discador 3C"
              title={inCall ? "Recolher (a chamada continua)" : "Recolher"}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>


        <div className="relative min-h-0 flex-1">
          <iframe
            src={`${domain}/agent`}
            title="Painel do agente 3C Plus"
            allow="microphone; autoplay"
            className="h-full w-full border-0 bg-background"
          />
          {/* Enquanto arrasta/redimensiona, o iframe não pode capturar o ponteiro. */}
          {interacting && <div className="absolute inset-0 z-10" />}
        </div>
      </div>
    </>
  );
}
