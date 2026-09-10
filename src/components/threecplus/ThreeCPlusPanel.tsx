import { useCallback, useEffect, useMemo, useState } from "react";
import { Headphones, Loader2, Phone, PhoneCall, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type DialerStatus = "offline" | "idle" | "on_call" | "pause";

interface AgentRuntime {
  logged_campaign?: boolean;
  has_active_call?: boolean;
  manual_mode?: boolean;
  agent_status?: string | null;
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
  if (runtime?.has_active_call) return "on_call";

  const raw = (runtime?.agent_status || "").toLowerCase();
  if (/call|chamada|talk|dialing|discando/.test(raw)) return "on_call";
  if (/break|pause|pausa|intervalo|acw|tpa/.test(raw)) return "pause";
  if (/idle|ocioso|available|dispon[ií]vel/.test(raw)) return "idle";
  if (runtime?.logged_campaign && !runtime?.manual_mode) return "idle";
  return "offline";
}

export function ThreeCPlusPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [launcherHidden, setLauncherHidden] = useState(false);
  const [hasExtension, setHasExtension] = useState(false);
  const [domain, setDomain] = useState("https://eternumentoringclub1.3c.plus");
  const [status, setStatus] = useState<DialerStatus>("offline");
  const [loadingStatus, setLoadingStatus] = useState(true);

  const invokeAgent = useCallback(async (action: string) => {
    const { data, error } = await supabase.functions.invoke("threecplus-agent", { body: { action } });
    if (error) throw error;
    return data;
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await invokeAgent("get_runtime");
      if (data?.success) setStatus(mapRuntimeStatus(data.runtime));
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

  const statusInfo = useMemo(() => STATUS_INFO[status], [status]);
  const StatusIcon = statusInfo.icon;

  if (!hasExtension) return null;

  return (
    <>
      {!isOpen && !launcherHidden && (
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
        className={cn(
          "fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2">
            <StatusIcon className="h-4 w-4 text-primary" />
            <span className="font-semibold">Discador 3C</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", statusInfo.dot)} />
              {statusInfo.label}
            </span>
          </div>
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
        <iframe
          src={`${domain}/agent`}
          title="Painel do agente 3C Plus"
          allow="microphone; autoplay"
          className="min-h-0 flex-1 border-0 bg-background"
        />
      </aside>
    </>
  );
}