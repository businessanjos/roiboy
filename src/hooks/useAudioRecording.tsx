import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

interface AudioRecordingState {
  isRecording: boolean;
  recordingDuration: number;
  audioPreview: { blob: Blob; url: string; duration: number } | null;
}

interface UseAudioRecordingReturn extends AudioRecordingState {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  discardAudioPreview: () => void;
  getAudioBlob: () => Blob | null;
}

export function useAudioRecording(): UseAudioRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioPreview, setAudioPreview] = useState<{ blob: Blob; url: string; duration: number } | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Helper function to detect best audio format for WhatsApp compatibility
  const getBestAudioMimeType = (): { mimeType: string; extension: string } => {
    // Priority: OGG formats (best WhatsApp compatibility) > MP4 > WebM (fallback)
    const preferredFormats = [
      { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
      { mimeType: 'audio/ogg', extension: 'ogg' },
      { mimeType: 'audio/mp4', extension: 'mp4' },
      { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
      { mimeType: 'audio/webm', extension: 'webm' },
    ];
    
    for (const format of preferredFormats) {
      if (MediaRecorder.isTypeSupported(format.mimeType)) {
        console.log(`[AudioRecording] Using format: ${format.mimeType}`);
        return format;
      }
    }
    
    // Ultimate fallback
    console.warn('[AudioRecording] No preferred format supported, using default webm');
    return { mimeType: 'audio/webm', extension: 'webm' };
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      const { mimeType, extension } = getBestAudioMimeType();
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Create audio blob with correct MIME type (matches recording format)
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        console.log(`[AudioRecording] Recording complete: ${mimeType}, size: ${audioBlob.size} bytes`);
        
        // Set preview state with extension info
        setAudioPreview({
          blob: audioBlob,
          url: audioUrl,
          duration: recordingDuration
        });
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start duration counter
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error: any) {
      console.error("Error starting recording:", error);
      if (error.name === "NotAllowedError") {
        toast.error("Permissão de microfone negada");
      } else {
        toast.error("Erro ao iniciar gravação");
      }
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    setIsRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      // Stop the recorder without processing
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
    setAudioPreview(null);
  }, []);

  const discardAudioPreview = useCallback(() => {
    if (audioPreview?.url) {
      URL.revokeObjectURL(audioPreview.url);
    }
    setAudioPreview(null);
  }, [audioPreview?.url]);

  const getAudioBlob = useCallback(() => {
    return audioPreview?.blob || null;
  }, [audioPreview?.blob]);

  return {
    isRecording,
    recordingDuration,
    audioPreview,
    startRecording,
    stopRecording,
    cancelRecording,
    discardAudioPreview,
    getAudioBlob,
  };
}
