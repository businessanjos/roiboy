import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateRoomParams {
  participant_name?: string;
  participant_phone?: string;
  lead_id?: string;
  client_id?: string;
  deal_id?: string;
}

interface VideoCallState {
  isActive: boolean;
  isRecording: boolean;
  sessionId: string | null;
  roomUrl: string | null;
  roomName: string | null;
  token: string | null;
  guestLink: string | null;
}

export function useVideoCall() {
  const { toast } = useToast();
  const [state, setState] = useState<VideoCallState>({
    isActive: false,
    isRecording: false,
    sessionId: null,
    roomUrl: null,
    roomName: null,
    token: null,
    guestLink: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  const createRoom = useCallback(async (params: CreateRoomParams) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-video-call", {
        body: { action: "create-room", ...params },
      });

      if (error) throw error;

      setState({
        isActive: true,
        isRecording: false,
        sessionId: data.session_id,
        roomUrl: data.room_url,
        roomName: data.room_name,
        token: data.token,
        guestLink: null,
      });

      toast({
        title: "Sala criada!",
        description: "A videochamada está pronta para começar.",
      });

      return data;
    } catch (err) {
      console.error("Error creating room:", err);
      toast({
        title: "Erro ao criar sala",
        description: err instanceof Error ? err.message : "Tente novamente",
        variant: "destructive",
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const startRecording = useCallback(async () => {
    if (!state.roomName || !state.sessionId) return;
    try {
      const { data, error } = await supabase.functions.invoke("daily-video-call", {
        body: {
          action: "start-recording",
          room_name: state.roomName,
          session_id: state.sessionId,
        },
      });

      if (error) throw error;

      if (data.success) {
        setState((s) => ({ ...s, isRecording: true }));
        toast({ title: "🔴 Gravação iniciada" });
      } else {
        toast({
          title: "Gravação indisponível",
          description: "O plano do Daily.co pode não suportar gravação em nuvem.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error starting recording:", err);
      toast({
        title: "Erro ao iniciar gravação",
        variant: "destructive",
      });
    }
  }, [state.roomName, state.sessionId, toast]);

  const stopRecording = useCallback(async () => {
    if (!state.roomName || !state.sessionId) return;
    try {
      await supabase.functions.invoke("daily-video-call", {
        body: {
          action: "stop-recording",
          room_name: state.roomName,
          session_id: state.sessionId,
        },
      });
      setState((s) => ({ ...s, isRecording: false }));
      toast({ title: "Gravação parada" });
    } catch (err) {
      console.error("Error stopping recording:", err);
    }
  }, [state.roomName, state.sessionId, toast]);

  const endCall = useCallback(async () => {
    if (!state.sessionId || !state.roomName) return;
    setIsLoading(true);
    try {
      const { data } = await supabase.functions.invoke("daily-video-call", {
        body: {
          action: "end-call",
          session_id: state.sessionId,
          room_name: state.roomName,
        },
      });

      setState({
        isActive: false,
        isRecording: false,
        sessionId: null,
        roomUrl: null,
        roomName: null,
        token: null,
        guestLink: null,
      });

      toast({
        title: "Chamada encerrada",
        description: data?.duration
          ? `Duração: ${Math.floor(data.duration / 60)}min ${data.duration % 60}s`
          : undefined,
      });
    } catch (err) {
      console.error("Error ending call:", err);
    } finally {
      setIsLoading(false);
    }
  }, [state.sessionId, state.roomName, toast]);

  const getGuestLink = useCallback(async (guestName?: string) => {
    if (!state.roomName || !state.roomUrl) return null;
    try {
      const { data, error } = await supabase.functions.invoke("daily-video-call", {
        body: {
          action: "get-guest-link",
          room_name: state.roomName,
          guest_name: guestName || "Convidado",
        },
      });

      if (error) throw error;

      const link = `${state.roomUrl}?t=${data.token}`;
      setState((s) => ({ ...s, guestLink: link }));
      return link;
    } catch (err) {
      console.error("Error getting guest link:", err);
      return null;
    }
  }, [state.roomName, state.roomUrl]);

  return {
    ...state,
    isLoading,
    createRoom,
    startRecording,
    stopRecording,
    endCall,
    getGuestLink,
  };
}
