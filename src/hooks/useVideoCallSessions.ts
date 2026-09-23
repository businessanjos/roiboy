import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VideoCallSession {
  id: string;
  user_id: string;
  daily_room_name: string;
  daily_room_url: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  recording_url: string | null;
  transcription: string | null;
  analysis: string | null;
  analysis_status: string;
  participant_name: string | null;
  participant_phone: string | null;
  notes: string | null;
  lead_id: string | null;
  meeting_url: string | null;
  source: string | null;
  transcript_file_name: string | null;
  is_favorite?: boolean | null;

  created_at: string;
  /** Vendedor responsável pela call (join com users) */
  seller?: { id: string; name: string | null; avatar_url: string | null } | null;
}

export function useVideoCallSessions() {
  const [sessions, setSessions] = useState<VideoCallSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("video_call_sessions")
      .select("*, seller:users!video_call_sessions_user_id_fkey(id, name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(300);

    if (!error && data) {
      setSessions(data as unknown as VideoCallSession[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, isLoading, refetch: fetchSessions };
}
