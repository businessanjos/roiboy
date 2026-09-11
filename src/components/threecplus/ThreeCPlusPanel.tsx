import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Headphones, Loader2, Maximize2, Minimize2, Phone, PhoneCall, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
    __threeCPlusRuntime?: { runtime: AgentRuntime; polledAt: number; agentId: string };
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

const BASE_WIDTH = 1120;

export function ThreeCPlusPanel({ visible = true }: { visible?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [scale, setScale] = useState(1);
  const panelRef = useRef<HTMLElement | null>(null);
  const [launcherHidden, setLauncherHidden] = useState(false);
  const [hasExtension, setHasExtension] = useState(false);
  const [domain, setDomain] = useState("https://eternumentoringclub1.3c.plus");
  const [status, setStatus] = useState<DialerStatus>("offline");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const agentIdRef = useRef<string | null>(null);

  const invokeAgent = useCallback(async (action: string) => {
    const { data, error } = await supabase.functions.invoke("threecplus-agent", { body: { action } });
    if (error) throw error;
    return data;
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await invokeAgent("get_runtime");
      if (data?.success) {
        setStatus(mapRuntimeStatus(data.runtime));
        if (agentIdRef.current) {
          window.__threeCPlusRuntime = { runtime: data.runtime, polledAt: Date.now(), agentId: agentIdRef.current };
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

  useEffect(() => {
    if (!hasExtension) return;
    const timer = window.setInterval(() => { void refreshStatus(); }, 30_000);
    const onFocus = () => { void refreshStatus(); };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [hasExtension, refreshStatus]);

  useEffect(() => {
    const openDrawer = () => {
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

  // Escala o conteúdo da 3C para caber na largura atual do painel.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      if (!width) return;
      setScale(Math.min(1, Math.max(0.4, width / BASE_WIDTH)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen, expanded]);

  const statusInfo = useMemo(() => STATUS_INFO[status], [status]);
  const StatusIcon = statusInfo.icon;

  return (
    <>
      {visible && hasExtension && !isOpen && !launcherHidden && (
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

      <aside
        ref={panelRef}
        className={cn(
          "fixed inset-y-0 right-0 z-[60] flex w-full flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300",
          expanded
            ? "sm:w-[min(96vw,72rem)]"
            : "sm:w-[min(96vw,34rem)]",
          visible && hasExtension && isOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
          <div className="flex min-w-0 items-center gap-2">
            <StatusIcon className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold">Discador 3C</span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", statusInfo.dot)} />
              {statusInfo.label}
            </span>
          </div>
          <div className="flex shrink-0 items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Reduzir painel" : "Ampliar painel"}
              title={expanded ? "Reduzir painel" : "Ampliar painel"}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              aria-label="Fechar Discador 3C"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* O iframe é renderizado numa largura fixa e reduzido por escala,
            para caber inteiro em painéis estreitos sem cortes laterais. */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <iframe
            src={`${domain}/agent`}
            title="Painel do agente 3C Plus"
            allow="microphone; autoplay"
            style={{
              width: `${BASE_WIDTH}px`,
              height: scale < 1 ? `${100 / scale}%` : "100%",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            className="absolute left-0 top-0 border-0 bg-background"
          />
        </div>
      </aside>
    </>
  );
}