import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseMessageAssistantProps {
  messageInput: string;
  sectorId: string;
  spellingEnabled?: boolean;
}

interface UseMessageAssistantReturn {
  correction: string | null;
  isCheckingSpelling: boolean;
  applyCorrection: () => void;
  dismissCorrection: () => void;
}

// ====== RATE LIMITING AFTER 402 ERROR ======
let rateLimitedUntil = 0;
const RATE_LIMIT_DURATION_MS = 5 * 60 * 1000;

function isRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}

function setRateLimited() {
  rateLimitedUntil = Date.now() + RATE_LIMIT_DURATION_MS;
  console.warn("[AI] Rate limited due to 402 error. Pausing AI calls for 5 minutes.");
}

export function useMessageAssistant({
  messageInput,
  sectorId,
  spellingEnabled = true,
}: UseMessageAssistantProps): UseMessageAssistantReturn {
  const [correction, setCorrection] = useState<string | null>(null);
  const [isCheckingSpelling, setIsCheckingSpelling] = useState(false);
  const correctionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckedTextRef = useRef<string>("");

  // Check spelling with debounce
  useEffect(() => {
    if (!spellingEnabled || !messageInput || messageInput.length < 50) {
      setCorrection(null);
      return;
    }

    if (isRateLimited()) return;

    if (messageInput === lastCheckedTextRef.current) return;

    if (correctionTimeoutRef.current) {
      clearTimeout(correctionTimeoutRef.current);
    }

    correctionTimeoutRef.current = setTimeout(async () => {
      setIsCheckingSpelling(true);
      lastCheckedTextRef.current = messageInput;

      try {
        const { data, error } = await supabase.functions.invoke("correct-message", {
          body: { text: messageInput, sectorId },
        });

        if (error) {
          if (error.message?.includes('402') || error.message?.includes('Payment')) {
            setRateLimited();
          }
          console.error("Error checking spelling:", error);
          return;
        }

        if (data?.correction && data.correction !== messageInput) {
          setCorrection(data.correction);
        } else {
          setCorrection(null);
        }
      } catch (err) {
        console.error("Error in spelling check:", err);
      } finally {
        setIsCheckingSpelling(false);
      }
    }, 3000);

    return () => {
      if (correctionTimeoutRef.current) {
        clearTimeout(correctionTimeoutRef.current);
      }
    };
  }, [messageInput, spellingEnabled, sectorId]);

  const applyCorrection = useCallback(() => {
    const correctedText = correction;
    setCorrection(null);
    lastCheckedTextRef.current = correctedText || "";
    return correctedText;
  }, [correction]);

  const dismissCorrection = useCallback(() => {
    setCorrection(null);
  }, []);

  return {
    correction,
    isCheckingSpelling,
    applyCorrection,
    dismissCorrection,
  };
}
