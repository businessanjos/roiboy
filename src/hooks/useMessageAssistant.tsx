import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AssistantMessage {
  content: string | null;
  is_from_client: boolean;
  sender_name?: string | null;
}

interface UseMessageAssistantProps {
  messageInput: string;
  sectorId: string;
  spellingEnabled?: boolean;
  suggestionsEnabled?: boolean;
  messages?: AssistantMessage[];
  conversationId?: string | null;
}

interface UseMessageAssistantReturn {
  correction: string | null;
  isCheckingSpelling: boolean;
  applyCorrection: () => void;
  dismissCorrection: () => void;
  suggestions: string[];
  isLoadingSuggestions: boolean;
  refreshSuggestions: () => void;
  dismissSuggestions: () => void;
  suggestionsAvailable: boolean;
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

const SUGGESTION_SECTOR = "vendas";

export function useMessageAssistant({
  messageInput,
  sectorId,
  spellingEnabled = true,
  suggestionsEnabled = true,
  messages = [],
  conversationId = null,
}: UseMessageAssistantProps): UseMessageAssistantReturn {
  const [correction, setCorrection] = useState<string | null>(null);
  const [isCheckingSpelling, setIsCheckingSpelling] = useState(false);
  const correctionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckedTextRef = useRef<string>("");

  // Suggestions state (only used for commercial sector)
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const lastSignatureRef = useRef<string>("");

  const suggestionsAvailable = sectorId === SUGGESTION_SECTOR;

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

  // Reset dismissed / suggestions when conversation changes
  useEffect(() => {
    setDismissed(false);
    setSuggestions([]);
    lastSignatureRef.current = "";
  }, [conversationId]);

  // Fetch reply suggestions when the last message is from the client (commercial only)
  const fetchSuggestions = useCallback(async (force = false) => {
    if (!suggestionsAvailable || !suggestionsEnabled) return;
    if (isRateLimited()) return;
    if (!messages || messages.length === 0) return;

    const last = messages[messages.length - 1];
    if (!last?.is_from_client || !last.content?.trim()) {
      setSuggestions([]);
      return;
    }

    // Signature avoids re-fetching for the same context repeatedly
    const signature = messages
      .slice(-5)
      .map((m) => `${m.is_from_client ? "c" : "a"}:${(m.content ?? "").slice(0, 80)}`)
      .join("|");

    if (!force && signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    setIsLoadingSuggestions(true);
    try {
      const payload = messages.slice(-10).map((m) => ({
        content: m.content,
        is_from_client: m.is_from_client,
        sender_name: m.sender_name ?? null,
      }));

      const { data, error } = await supabase.functions.invoke("suggest-replies", {
        body: { messages: payload, draft: messageInput, sectorId },
      });

      if (error) {
        if (error.message?.includes("402") || error.message?.includes("Payment")) {
          setRateLimited();
        }
        console.error("[useMessageAssistant] suggest-replies error:", error);
        return;
      }

      if (Array.isArray(data?.suggestions)) {
        setSuggestions(data.suggestions);
        setDismissed(false);
      }
    } catch (err) {
      console.error("[useMessageAssistant] suggest-replies exception:", err);
    } finally {
      setIsLoadingSuggestions(false);
    }
    // messageInput intentionally excluded — user typing shouldn't refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, suggestionsAvailable, suggestionsEnabled, sectorId]);

  // Debounced auto-fetch when new client message arrives
  useEffect(() => {
    if (!suggestionsAvailable || !suggestionsEnabled) return;
    const t = setTimeout(() => fetchSuggestions(false), 800);
    return () => clearTimeout(t);
  }, [fetchSuggestions, suggestionsAvailable, suggestionsEnabled]);

  const applyCorrection = useCallback(() => {
    const correctedText = correction;
    setCorrection(null);
    lastCheckedTextRef.current = correctedText || "";
    return correctedText;
  }, [correction]);

  const dismissCorrection = useCallback(() => {
    setCorrection(null);
  }, []);

  const dismissSuggestions = useCallback(() => {
    setDismissed(true);
    setSuggestions([]);
  }, []);

  const refreshSuggestions = useCallback(() => {
    fetchSuggestions(true);
  }, [fetchSuggestions]);

  return {
    correction,
    isCheckingSpelling,
    applyCorrection,
    dismissCorrection,
    suggestions: dismissed ? [] : suggestions,
    isLoadingSuggestions,
    refreshSuggestions,
    dismissSuggestions,
    suggestionsAvailable,
  };
}
