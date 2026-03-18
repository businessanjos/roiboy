import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  X,
  Maximize2,
  Minimize2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  Loader2,
} from "lucide-react";

interface EmbeddedVideoCallProps {
  roomUrl: string;
  token?: string | null;
  sessionId: string;
  participantName?: string;
  onCallEnded?: () => void;
}

export function EmbeddedVideoCall({
  roomUrl,
  token,
  sessionId,
  participantName,
  onCallEnded,
}: EmbeddedVideoCallProps) {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [callActive, setCallActive] = useState(true);

  // Build iframe URL with token
  const iframeUrl = token ? `${roomUrl}?t=${token}` : roomUrl;

  // Listen for Daily.co postMessage events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Daily.co sends postMessage events
      if (event.data?.action === "left-meeting" || event.data?.action === "meeting-ended") {
        handleEndCall();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sessionId]);

  const handleEndCall = useCallback(async () => {
    if (isEnding || !callActive) return;
    setIsEnding(true);
    setCallActive(false);

    try {
      // Try to find video_call_session by ID or by room URL
      const { data: session } = await supabase
        .from("video_call_sessions")
        .select("id, daily_room_name")
        .or(`id.eq.${sessionId},daily_room_url.eq.${roomUrl}`)
        .limit(1)
        .maybeSingle();

      if (session?.daily_room_name) {
        const { data, error } = await supabase.functions.invoke("daily-video-call", {
          body: {
            action: "end-call",
            session_id: session.id,
            room_name: session.daily_room_name,
          },
        });

        if (error) {
          console.error("Error ending call:", error);
        } else {
          const duration = data?.duration;
          toast({
            title: "Chamada encerrada",
            description: duration
              ? `Duração: ${Math.floor(duration / 60)}min ${duration % 60}s`
              : "Processando gravação e análise...",
          });
        }
      } else {
        toast({ title: "Chamada encerrada" });
      }
    } catch (err) {
      console.error("Error ending call:", err);
      toast({ title: "Chamada encerrada" });
    } finally {
      setIsEnding(false);
      onCallEnded?.();
    }
  }, [sessionId, roomUrl, isEnding, callActive, toast, onCallEnded]);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  if (!callActive) return null;

  return (
    <div
      className={`${
        isFullscreen
          ? "fixed inset-0 z-50 bg-background"
          : "relative w-full rounded-lg overflow-hidden border border-border bg-black"
      } flex flex-col`}
      style={!isFullscreen ? { height: "500px" } : undefined}
    >
      {/* Controls bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-2 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/90 text-white text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Ao Vivo
          </div>
          {participantName && (
            <span className="text-white/80 text-xs">{participantName}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-400 hover:bg-red-500/20 hover:text-red-300"
            onClick={handleEndCall}
            disabled={isEnding}
          >
            {isEnding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Phone className="h-4 w-4 rotate-[135deg]" />
            )}
          </Button>
        </div>
      </div>

      {/* Daily.co iframe */}
      <iframe
        ref={iframeRef}
        src={iframeUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="flex-1 w-full h-full border-0"
        style={{ minHeight: isFullscreen ? "100vh" : "450px" }}
      />
    </div>
  );
}
