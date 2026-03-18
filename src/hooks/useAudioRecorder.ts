import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UseAudioRecorderOptions {
  sessionId: string;
}

export function useAudioRecorder({ sessionId }: UseAudioRecorderOptions) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadPromiseRef = useRef<Promise<void> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      let stream: MediaStream;

      try {
        // getDisplayMedia requires video: true in most browsers
        // We request both, then immediately discard the video track
        stream = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: true,
        });

        // Stop video tracks immediately — we only need audio
        stream.getVideoTracks().forEach((track) => track.stop());

        // Verify we actually got audio tracks
        if (stream.getAudioTracks().length === 0) {
          throw new Error("No audio track from display media");
        }
      } catch {
        // Fallback: if user cancels tab share or no audio, try mic-only
        console.warn("[AudioRecorder] getDisplayMedia failed, falling back to getUserMedia");
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        toast({
          title: "⚠️ Gravação parcial",
          description: "Apenas seu microfone será gravado. Para capturar ambos os lados, permita o compartilhamento da aba.",
        });
      }

      streamRef.current = stream;
      chunksRef.current = [];

      // Pick best audio codec available
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        // Stop all remaining tracks
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        if (blob.size > 0) {
          // Store the upload promise so handleEndCall can await it
          uploadPromiseRef.current = uploadAndProcess(blob, mimeType);
        }
      };

      // Listen for track ended (user stops sharing tab)
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
          }
        };
      });

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);

      toast({ title: "🔴 Gravação iniciada" });
    } catch (err) {
      console.error("[AudioRecorder] Error starting recording:", err);
      toast({
        title: "Erro ao iniciar gravação",
        description: "Verifique as permissões do navegador.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast({ title: "⏹️ Gravação finalizada", description: "Processando áudio..." });
    }
  }, [toast]);

  /**
   * Wait for any in-progress upload to complete.
   * Called by EmbeddedVideoCall before ending the call to avoid race conditions.
   */
  const waitForUpload = useCallback(async () => {
    if (uploadPromiseRef.current) {
      await uploadPromiseRef.current;
      uploadPromiseRef.current = null;
    }
  }, []);

  const uploadAndProcess = useCallback(
    async (blob: Blob, mimeType: string) => {
      setIsUploading(true);
      try {
        // Whisper has a 25MB limit — warn if file is too large
        const MAX_SIZE_MB = 25;
        if (blob.size > MAX_SIZE_MB * 1024 * 1024) {
          toast({
            title: "⚠️ Arquivo muito grande",
            description: `A gravação tem ${(blob.size / (1024 * 1024)).toFixed(1)}MB. O limite para transcrição é ${MAX_SIZE_MB}MB. A gravação será salva mas a transcrição pode falhar.`,
          });
        }

        const ext = mimeType.includes("webm") ? "webm" : "mp4";
        const filePath = `${sessionId}/recording.${ext}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("call-recordings")
          .upload(filePath, blob, {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) {
          console.error("[AudioRecorder] Upload error:", uploadError);
          throw uploadError;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("call-recordings")
          .getPublicUrl(filePath);

        // Update session with recording URL
        await supabase
          .from("video_call_sessions")
          .update({
            recording_url: urlData.publicUrl,
            analysis_status: "transcribing",
          })
          .eq("id", sessionId);

        // Trigger transcription + analysis pipeline
        const { error: processError } = await supabase.functions.invoke(
          "process-video-call",
          { body: { session_id: sessionId } }
        );

        if (processError) {
          console.error("[AudioRecorder] Process error:", processError);
        }

        toast({
          title: "✅ Áudio enviado!",
          description: "A transcrição e análise estão sendo processadas.",
        });
      } catch (err) {
        console.error("[AudioRecorder] Upload/process error:", err);
        toast({
          title: "Erro ao processar gravação",
          description: err instanceof Error ? err.message : "Tente novamente",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [sessionId, toast]
  );

  return {
    isRecording,
    isUploading,
    startRecording,
    stopRecording,
    waitForUpload,
  };
}
