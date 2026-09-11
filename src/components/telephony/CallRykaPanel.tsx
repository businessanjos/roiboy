import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Minus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { RykaOpenDetail } from "@/lib/telephony/callEngines";

interface RykaEvent {
  source?: string;
  type?: string;
  payload?: {
    call_id?: string;
    phone?: string;
    status?: string;
    direction?: string;
    started_at?: string;
    duration_seconds?: number;
    end_reason?: string;
    message?: string;
  };
}

/**
 * Discador Call Ryka: mesmo padrão do Discador 3C, em drawer lateral com o
 * iframe do Call Ryka (400x720, microfone liberado). O iframe permanece
 * montado enquanto houver chamada ativa; fechar apenas oculta.
 */
export function CallRykaPanel() {
  const [session, setSession] = useState<RykaOpenDetail | null>(null);
  const [visible, setVisible] = useState(false);
  const [inCall, setInCall] = useState(false);
  const activeRef = useRef(false);

  useEffect(() => {
    const onOpen = (event: WindowEventMap["rykacall:open"]) => {
      setSession(event.detail);
      setVisible(true);
      setInCall(false);
      activeRef.current = false;
    };
    window.addEventListener("rykacall:open", onOpen);
    return () => window.removeEventListener("rykacall:open", onOpen);
  }, []);

  const emitTimelineCall = useCallback(
    (detail: RykaOpenDetail, payload: RykaEvent["payload"], ended: boolean) => {
      window.dispatchEvent(
        new CustomEvent("threecplus:optimistic-call", {
          detail: {
            id: detail.call_log_id,
            call_id: payload?.call_id || "",
            phone: payload?.phone || detail.phone,
            contact_name: detail.contact_name || null,
            direction: payload?.direction || "outbound",
            status: ended ? (payload?.duration_seconds ? "answered" : "not_answered") : "in_progress",
            duration_seconds: payload?.duration_seconds ?? 0,
            started_at: payload?.started_at || new Date().toISOString(),
            qualification_name: null,
            user_id: null,
            agent_name: null,
            lead_id: detail.lead_id || null,
            deal_id: detail.deal_id || null,
            client_id: detail.client_id || null,
            recording_url: null,
            engine: "ryka_call",
          },
        }),
      );
    },
    [],
  );

  useEffect(() => {
    if (!session) return;
    const onMessage = (event: MessageEvent<RykaEvent>) => {
      const data = event.data;
      if (!data || data.source !== "ryka-call") return;

      if (data.type === "call.started") {
        activeRef.current = true;
        setInCall(true);
        emitTimelineCall(session, data.payload, false);
        return;
      }
      if (data.type === "call.ended") {
        activeRef.current = false;
        setInCall(false);
        emitTimelineCall(session, data.payload, true);
        // Rede de segurança: se o webhook não chegar, buscamos os dados finais.
        window.setTimeout(() => {
          void supabase.functions.invoke("ryka-call-sync", {
            body: { call_log_id: session.call_log_id },
          });
        }, 20_000);
        return;
      }
      if (data.type === "error") {
        toast.error(data.payload?.message || "Erro no Call Ryka.");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [session, emitTimelineCall]);

  if (!session) return null;

  return (
    <>
      {!visible && (
        <div className="fixed bottom-24 right-4 z-40">
          <Button size="sm" className="gap-2 shadow-lg" onClick={() => setVisible(true)}>
            <MessageCircle className="h-4 w-4" />
            Discador Call Ryka
            {inCall && <span className="ml-1 h-2 w-2 rounded-full bg-emerald-400" />}
          </Button>
        </div>
      )}

      <div
        className={cn(
          "fixed bottom-0 right-0 z-50 flex h-[100dvh] w-[420px] max-w-[95vw] flex-col border-l border-border bg-background shadow-2xl transition-transform",
          visible ? "translate-x-0" : "pointer-events-none translate-x-full",
        )}
        aria-hidden={!visible}
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageCircle className="h-4 w-4 text-emerald-500" />
            Discador Call Ryka
            <span className="text-xs text-muted-foreground">{inCall ? "Em chamada" : "Pronto"}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setVisible(false)} title="Ocultar">
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Fechar"
              onClick={() => {
                if (activeRef.current) {
                  setVisible(false);
                  toast.info("Chamada em andamento — o discador continua ativo em segundo plano.");
                  return;
                }
                setVisible(false);
                setSession(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <iframe
          title="Discador Call Ryka"
          src={session.embed_url}
          allow="microphone"
          className="h-full w-full flex-1 border-0"
        />
      </div>
    </>
  );
}
