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
  const authSentRef = useRef(false);

  const authenticate = useCallback(async () => {
    if (!currentUser) return;

    setStatus("loading");
    setErrorMsg("");

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

      // Send tokens to iframe via postMessage
      const sendAuth = () => {
        const iframe = iframeRef.current;
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage(
            {
              type: "EVER_AI_AUTH",
              access_token,
              refresh_token,
            },
            "https://everia.pro"
          );
          authSentRef.current = true;
        }
      };

      sendAuth();
      // Retry after a short delay in case iframe wasn't ready
      setTimeout(sendAuth, 500);

      setStatus("ready");
    } catch (err: any) {
      console.error("[EverIA] Auth error:", err);
      setErrorMsg(err.message || "Falha na autenticação");
      setStatus("error");
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      const timer = setTimeout(authenticate, 1500);
      return () => clearTimeout(timer);
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
