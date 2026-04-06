import { useEffect, useRef, useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const EVER_AI_EMBED_URL = "https://everia.pro/embed/chat";

export function EverConversationsTab() {
  const { currentUser } = useCurrentUser();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const tokensRef = useRef<{ access_token: string; refresh_token: string } | null>(null);
  const retryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authAcknowledgedRef = useRef(false);

  const sendAuthToIframe = useCallback(() => {
    const iframe = iframeRef.current;
    const tokens = tokensRef.current;
    if (iframe?.contentWindow && tokens && !authAcknowledgedRef.current) {
      iframe.contentWindow.postMessage(
        {
          type: "EVER_AI_AUTH",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        },
        "https://everia.pro"
      );
    }
  }, []);

  const authenticate = useCallback(async () => {
    if (!currentUser) return;

    setStatus("loading");
    setErrorMsg("");
    authAcknowledgedRef.current = false;

    try {
      const { data, error } = await supabase.functions.invoke("ever-ia-auth", {
        method: "POST",
      });

      if (error) {
        throw new Error(error.message || "Erro na autenticação");
      }

      const { access_token, refresh_token } = data;

      if (!access_token) {
        throw new Error("Token não recebido");
      }

      tokensRef.current = { access_token, refresh_token };

      // Send immediately
      sendAuthToIframe();

      // Keep retrying every 1s for up to 15s until acknowledged
      if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
      let attempts = 0;
      retryIntervalRef.current = setInterval(() => {
        attempts++;
        if (authAcknowledgedRef.current || attempts > 15) {
          if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
          retryIntervalRef.current = null;
          return;
        }
        sendAuthToIframe();
      }, 1000);

      setStatus("ready");
    } catch (err: any) {
      console.error("[EverIA] Auth error:", err);
      setErrorMsg(err.message || "Falha na autenticação");
      setStatus("error");
    }
  }, [currentUser, sendAuthToIframe]);

  // Listen for acknowledgment from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://everia.pro") return;
      // Accept any message from everia.pro as acknowledgment
      if (event.data?.type === "EVER_AI_AUTH_ACK" || event.data?.type === "EVER_AI_READY") {
        authAcknowledgedRef.current = true;
        if (retryIntervalRef.current) {
          clearInterval(retryIntervalRef.current);
          retryIntervalRef.current = null;
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Start auth when iframe loads
  const handleIframeLoad = useCallback(() => {
    // Wait a brief moment for the iframe JS to initialize, then send auth
    setTimeout(() => {
      sendAuthToIframe();
    }, 300);
  }, [sendAuthToIframe]);

  useEffect(() => {
    if (currentUser) {
      authenticate();
    }
    return () => {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    };
  }, [currentUser, authenticate]);

  if (status === "error") {
    return (
      <div className="flex-1 w-full h-full min-h-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <p className="font-medium text-foreground">Erro ao conectar</p>
            <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
          </div>
          <Button variant="outline" size="sm" onClick={authenticate}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full min-h-0 relative">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            <p className="text-sm text-muted-foreground">Conectando ao Ever IA...</p>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={EVER_AI_EMBED_URL}
        className="w-full h-full border-0"
        allow="microphone; clipboard-write"
        title="Ever IA Chat"
        onLoad={handleIframeLoad}
      />
    </div>
  );
}
