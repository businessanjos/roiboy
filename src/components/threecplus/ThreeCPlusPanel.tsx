import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Headphones, Loader2, Maximize2, Minimize2, Phone, PhoneCall, X } from "lucide-react";
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

const MIN_PANEL_WIDTH = 420;
const DEFAULT_PANEL_WIDTH = 1120;
const WIDTH_STORAGE_KEY = "roy_threec_panel_width";

function readStoredWidth(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= MIN_PANEL_WIDTH ? parsed : null;
}

function defaultWidth(): number {
  if (typeof window === "undefined") return DEFAULT_PANEL_WIDTH;
  return Math.min(window.innerWidth * 0.96, DEFAULT_PANEL_WIDTH);
}

function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function ThreeCPlusPanel({ visible = true }: { visible?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [panelWidth, setPanelWidth] = useState<number>(() => readStoredWidth() ?? defaultWidth());
  const [resizing, setResizing] = useState(false);
  const [launcherHidden, setLauncherHidden] = useState(false);
  const [hasExtension, setHasExtension] = useState(false);
  const [domain, setDomain] = useState("https://eternumentoringclub1.3c.plus");
  const [status, setStatus] = useState<DialerStatus>("offline");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [contact, setContact] = useState<{ name?: string | null; phone?: string | null } | null>(null);
  const [dialingSince, setDialingSince] = useState<number | null>(null);
  const callStartedAt = useRef<number | null>(null);

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
    try {
      const data = await invokeAgent("get_runtime");
      if (data?.success) {
        setStatus(mapRuntimeStatus(data.runtime));
        if (data.runtime_proof) {
          window.__threeCPlusRuntime = { runtime: data.runtime, polledAt: Date.now(), proof: data.runtime_proof };
        }
      }
      else setStatus("offline");
    } catch (error) {
      console.warn("[ThreeCPlusPanel] Não foi possível atualizar o status:", error);
      setStatus("offline");
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
        setHasExtension(Boolean(extensionData?.success && extensionData?.extension));
        agentIdRef.current = typeof (connectionData as ConnectionInfo & { agent_id?: string }).agent_id === "string"
          ? (connectionData as ConnectionInfo & { agent_id?: string }).agent_id ?? null
          : null;
        if (connectionData?.success) setDomain(normalizeDomain(connectionData.domain));
        if (extensionData?.success && extensionData?.extension) await refreshStatus();
        else setLoadingStatus(false);
      } catch (error) {
        console.warn("[ThreeCPlusPanel] Discador indisponível:", error);
        if (active) setLoadingStatus(false);
      }
    };

    void initialize();
    return () => { active = false; };
  }, [invokeAgent, refreshStatus]);

  // Enquanto houver chamada, o estado é consultado com mais frequência.
  useEffect(() => {
    if (!hasExtension) return;
    const interval = status === "on_call" ? 5_000 : 30_000;
    const timer = window.setInterval(() => { void refreshStatus(); }, interval);
    const onFocus = () => { void refreshStatus(); };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [hasExtension, refreshStatus, status]);

  // Cronômetro: conta o tempo tentando ligar e depois o tempo da ligação atendida.
  useEffect(() => {
    if (status === "on_call") {
      if (!callStartedAt.current) callStartedAt.current = Date.now();
    } else {
      callStartedAt.current = null;
    }
    const base = status === "on_call" ? callStartedAt.current : dialingSince;
    if (!base) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed((Date.now() - base) / 1000);
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [status, dialingSince]);

  // Encerrada a chamada, o cartão de discagem some.
  useEffect(() => {
    if (status !== "on_call") return;
    return () => setDialingSince(null);
  }, [status]);

  // Se a tentativa não virar chamada, o cartão some após 2 minutos.
  useEffect(() => {
    if (dialingSince === null || status === "on_call") return;
    const timer = window.setTimeout(() => setDialingSince(null), 120_000);
    return () => window.clearTimeout(timer);
  }, [dialingSince, status]);


  useEffect(() => {
    const openDrawer = (event: Event) => {
      const detail = (event as CustomEvent<{
        contact_name?: string | null;
        contactName?: string | null;
        phone?: string | null;
      }>).detail;
      const name = detail?.contact_name ?? detail?.contactName ?? null;
      if (detail && (name || detail.phone)) {
        setContact({ name, phone: detail.phone ?? null });
        setDialingSince(Date.now());
      }
      setLauncherHidden(false);
      setIsOpen(true);
      void refreshStatus();
    };
    window.addEventListener("threecplus:open-drawer", openDrawer);
    window.addEventListener("threecplus:dial-request", openDrawer);
    return () => {
      window.removeEventListener("threecplus:open-drawer", openDrawer);
      window.removeEventListener("threecplus:dial-request", openDrawer);
    };
  }, [refreshStatus]);


  // Guarda a largura escolhida pelo usuário.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(WIDTH_STORAGE_KEY, String(Math.round(panelWidth)));
  }, [panelWidth]);

  // Só o modo tela cheia bloqueia a rolagem do fundo.
  useEffect(() => {
    if (!isOpen || !fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [isOpen, fullscreen]);

  // Arrastar a alça esquerda para redimensionar.
  const startResize = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    setResizing(true);
    const onMove = (e: PointerEvent) => {
      const maxWidth = window.innerWidth * 0.96;
      const next = Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, window.innerWidth - e.clientX));
      setPanelWidth(next);
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  const statusInfo = useMemo(() => STATUS_INFO[status], [status]);
  const StatusIcon = statusInfo.icon;
  const drawerOpen = visible && hasExtension && isOpen;
  const inCall = status === "on_call";
  const dialing = !inCall && dialingSince !== null;
  const activeCall = inCall || dialing;
  const contactLabel = contact?.name || contact?.phone || null;

  // Avisa as fichas (lead/negócio) que o discador está aberto, para liberarem o clique.
  useEffect(() => {
    setThreeCPlusOpen(drawerOpen);
    return () => setThreeCPlusOpen(false);
  }, [drawerOpen]);




  return (
    <>
      {visible && hasExtension && !isOpen && launcherHidden && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className={cn(
            "fixed right-0 top-1/2 z-50 h-9 w-7 -translate-y-1/2 translate-x-1 rounded-l-md rounded-r-none border border-r-0 border-border shadow-sm transition-all hover:translate-x-0 hover:opacity-100",
            activeCall ? "border-destructive/50 opacity-100" : "opacity-40"
          )}
          onClick={() => {
            setLauncherHidden(false);
            setIsOpen(true);
            void refreshStatus();
          }}
          aria-label="Abrir Discador 3C"
          title={
            activeCall
              ? `${inCall ? "Em chamada" : "Chamando"} ${contactLabel || ""} ${formatElapsed(elapsed)}`.trim()
              : "Abrir Discador 3C"
          }
        >
          <Phone className={cn("h-4 w-4", activeCall ? "text-destructive" : "text-primary")} />
        </Button>
      )}

      {/* Em chamada ou discando, o cartão flutuante mostra o contato e o tempo. */}
      {visible && hasExtension && !launcherHidden && activeCall && (
        <div
          className={cn(
            "pointer-events-auto fixed bottom-20 z-[70] flex items-center gap-2 rounded-md border border-destructive/40 bg-card px-3 py-2 shadow-lg lg:bottom-6",
            isOpen ? "left-4 lg:left-6" : "right-4 lg:right-6"
          )}
        >
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

          {!isOpen && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8"
              onClick={() => setIsOpen(true)}
            >
              Abrir
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => setLauncherHidden(true)}
            aria-label="Minimizar discador"
            title="Minimizar"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {visible && hasExtension && !isOpen && !launcherHidden && !activeCall && (
        <div className="fixed bottom-20 right-4 z-50 flex items-center rounded-md border border-border bg-card shadow-lg lg:bottom-6 lg:right-6">
          <Button
            type="button"
            variant="ghost"
            className="h-11 gap-2 rounded-r-none px-3"
            onClick={() => {
              setIsOpen(true);
              void refreshStatus();
            }}
            aria-label={`Abrir Discador 3C. Status: ${statusInfo.label}`}
          >
            <Phone className="h-4 w-4 text-primary" />
            <span>Discador 3C</span>
            {loadingStatus ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full", statusInfo.dot)} />
                {statusInfo.label}
              </span>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-9 rounded-l-none border-l border-border text-muted-foreground"
            onClick={() => setLauncherHidden(true)}
            aria-label="Ocultar Discador 3C"
            title="Ocultar Discador 3C"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Fundo escurecido apenas em tela cheia. */}
      {fullscreen && (
        <div
          onClick={() => setFullscreen(false)}
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-[55] bg-background/60 backdrop-blur-[2px] transition-opacity duration-300",
            drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        />
      )}

      {/* O quadro da 3C fica sempre montado: fechar apenas esconde, a chamada
          continua ativa em segundo plano. */}
      <aside
        style={
          fullscreen
            ? { width: "100vw" }
            : { width: `min(96vw, ${Math.round(panelWidth)}px)` }
        }
        className={cn(
          "fixed inset-y-0 right-0 z-[60] flex flex-col border-l border-border bg-background shadow-2xl will-change-transform",
          !resizing && "transition-[transform,opacity,width] duration-300 ease-out",
          drawerOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0"
        )}
        aria-hidden={!drawerOpen}
      >
        {/* Alça para ajustar a largura do painel. */}
        {!fullscreen && (
          <div
            onPointerDown={startResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="Ajustar largura do discador"
            className="absolute inset-y-0 left-0 z-10 hidden w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-primary/30 sm:block"
          />
        )}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3 pl-4">
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
              aria-label="Fechar Discador 3C"
              title={inCall ? "Fechar (a chamada continua)" : "Fechar"}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <iframe
            src={`${domain}/agent`}
            title="Painel do agente 3C Plus"
            allow="microphone; autoplay"
            className="h-full w-full border-0 bg-background"
          />
        </div>
      </aside>
    </>
  );
}
