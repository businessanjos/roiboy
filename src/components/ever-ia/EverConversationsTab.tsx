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

  const sendAuthToIframe = useCallback(() => {
    const iframeWindow = iframeRef.current?.contentWindow;
    const { access_token, refresh_token } = tokensRef.current;

    console.log("[EverIA] sendAuthToIframe check:", {
      hasIframeWindow: !!iframeWindow,
      embedReady: embedReadyRef.current,
      hasToken: !!access_token,
    });

    if (!iframeWindow || !embedReadyRef.current || !access_token) {
      return false;
    }

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
        throw new Error("Token não recebido");
      }

      tokensRef.current = {
        access_token,
        refresh_token: refresh_token ?? null,
      };

      sendAuthToIframe();
    } catch (err: any) {
      console.error("[EverIA] Auth error:", err);
      setErrorMsg(err.message || "Falha na autenticação");
      setStatus("error");
    }
  }, [currentUser, sendAuthToIframe]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log("[EverIA] postMessage received:", {
        origin: event.origin,
        expectedOrigin: EVER_AI_EMBED_ORIGIN,
        data: event.data,
        sourceMatch: event.source === iframeRef.current?.contentWindow,
      });

      if (event.origin !== EVER_AI_EMBED_ORIGIN) return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      const messageType =
        typeof event.data === "string" ? event.data : event.data?.type;

      if (messageType !== "ever-embed-ready") return;

      console.log("[EverIA] embed ready signal received!");
      embedReadyRef.current = true;
      sendAuthToIframe();
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sendAuthToIframe]);

  useEffect(() => {
    embedReadyRef.current = false;

    if (currentUser) {
      authenticate();
    }
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
      />
    </div>
  );
}
