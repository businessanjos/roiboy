import { useEffect, useRef, useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const EVER_AI_EMBED_URL = "https://everia.pro/embed/chat";
const EVER_AI_EMBED_ORIGIN = new URL(EVER_AI_EMBED_URL).origin;

export function EverConversationsTab() {
  const { currentUser } = useCurrentUser();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tokensRef = useRef<{ access_token: string; refresh_token: string | null }>({
    access_token: "",
    refresh_token: null,
  });
  const embedReadyRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendAuthToIframe = useCallback(() => {
    const iframeWindow = iframeRef.current?.contentWindow;
    const { access_token, refresh_token } = tokensRef.current;

    if (!iframeWindow || !access_token) {
      return false;
    }

    console.log("[EverIA] Sending auth to iframe, embedReady:", embedReadyRef.current);

    iframeWindow.postMessage(
      {
        type: "EVER_AI_AUTH",
        access_token,
        refresh_token,
      },
      EVER_AI_EMBED_ORIGIN
    );

    setStatus("ready");
    return true;
  }, []);

  const authenticate = useCallback(async () => {
    if (!currentUser) return;

    setStatus("loading");
    setErrorMsg("");
    tokensRef.current = { access_token: "", refresh_token: null };

    try {
      const { data, error } = await supabase.functions.invoke("ever-ia-auth", {
        method: "POST",
      });

      if (error) {
        throw new Error(error.message || "Erro na autenticação");
      }

      const { access_token, refresh_token } = data ?? {};

      if (!access_token) {
        throw new Error(data?.error || "Token não recebido");
      }

      tokensRef.current = {
        access_token,
        refresh_token: refresh_token ?? null,
      };

      console.log("[EverIA] Tokens received, attempting to send to iframe");

      // Try sending immediately
      if (!sendAuthToIframe()) {
        // If iframe not ready, set up a retry
        console.log("[EverIA] Iframe not ready yet, will retry on ready signal or load");
      }
    } catch (err: any) {
      console.error("[EverIA] Auth error:", err);
      console.error("[EverIA] Auth error details:", JSON.stringify({
        message: err.message,
        status: err.status,
        statusCode: err.statusCode,
        name: err.name,
        context: err.context,
      }));
      setErrorMsg(err.message || "Falha na autenticação");
      setStatus("error");
    }
  }, [currentUser, sendAuthToIframe]);

  // Listen for ever-embed-ready from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== EVER_AI_EMBED_ORIGIN) return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      const messageType =
        typeof event.data === "string" ? event.data : event.data?.type;

      if (messageType === "ever-embed-ready") {
        console.log("[EverIA] embed ready signal received!");
        embedReadyRef.current = true;
        sendAuthToIframe();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sendAuthToIframe]);

  // Handle iframe load - try sending auth after a delay as fallback
  const handleIframeLoad = useCallback(() => {
    console.log("[EverIA] iframe loaded");
    
    // Clear any existing retry timer
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

    // If we have tokens but embed hasn't signaled ready, try sending after delays
    const tryWithDelay = (delay: number) => {
      retryTimerRef.current = setTimeout(() => {
        if (tokensRef.current.access_token && status !== "ready") {
          console.log("[EverIA] Fallback: sending auth after", delay, "ms");
          embedReadyRef.current = true; // Force it
          sendAuthToIframe();
        }
      }, delay);
    };

    // Try at 1s, 2s, 4s as fallback
    tryWithDelay(1000);
    setTimeout(() => {
      if (status !== "ready" && tokensRef.current.access_token) tryWithDelay(2000);
    }, 1000);
    setTimeout(() => {
      if (status !== "ready" && tokensRef.current.access_token) tryWithDelay(4000);
    }, 3000);
  }, [sendAuthToIframe, status]);

  useEffect(() => {
    embedReadyRef.current = false;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

    if (currentUser) {
      authenticate();
    }

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
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
