import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface Message {
  id: string;
  content: string | null;
  is_from_client: boolean;
  sender_name?: string | null;
}

interface Suggestion {
  id: string;
  text: string;
  type: string;
  feedbackGiven?: "positive" | "negative";
}

interface UseMessageAssistantProps {
  messageInput: string;
  lastMessages: Message[];
  clientName?: string;
  sectorId: string;
  conversationId?: string;
  spellingEnabled?: boolean;
  suggestionsEnabled?: boolean;
  autoLearningEnabled?: boolean;
}

interface UseMessageAssistantReturn {
  // Correction
  correction: string | null;
  isCheckingSpelling: boolean;
  applyCorrection: () => void;
  dismissCorrection: () => void;
  
  // Suggestions
  suggestions: Suggestion[];
  isLoadingSuggestions: boolean;
  refreshSuggestions: () => void;
  selectSuggestion: (suggestion: Suggestion) => void;
  currentSpinPhase: string | null;
  
  // Feedback
  sendFeedback: (suggestionId: string, feedback: "positive" | "negative") => Promise<void>;
}

// ====== LOCAL CACHE FOR AI SUGGESTIONS ======
// Stores last 10 responses by conversation_id to avoid duplicate API calls
interface CachedSuggestion {
  messagesSignature: string;
  suggestions: Suggestion[];
  currentSpinPhase: string | null;
  timestamp: number;
}

const suggestionsCache = new Map<string, CachedSuggestion[]>();
const MAX_CACHE_ENTRIES_PER_CONVERSATION = 10;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

function getCachedSuggestions(conversationId: string, messagesSignature: string): CachedSuggestion | null {
  const cache = suggestionsCache.get(conversationId);
  if (!cache) return null;
  
  const now = Date.now();
  const entry = cache.find(c => c.messagesSignature === messagesSignature && (now - c.timestamp) < CACHE_TTL_MS);
  return entry || null;
}

function setCachedSuggestions(conversationId: string, messagesSignature: string, suggestions: Suggestion[], currentSpinPhase: string | null) {
  let cache = suggestionsCache.get(conversationId);
  if (!cache) {
    cache = [];
    suggestionsCache.set(conversationId, cache);
  }
  
  // Remove expired entries
  const now = Date.now();
  cache = cache.filter(c => (now - c.timestamp) < CACHE_TTL_MS);
  
  // Add new entry
  cache.push({ messagesSignature, suggestions, currentSpinPhase, timestamp: now });
  
  // Keep only last N entries
  if (cache.length > MAX_CACHE_ENTRIES_PER_CONVERSATION) {
    cache = cache.slice(-MAX_CACHE_ENTRIES_PER_CONVERSATION);
  }
  
  suggestionsCache.set(conversationId, cache);
}

// ====== RATE LIMITING AFTER 402 ERROR ======
let rateLimitedUntil = 0;
const RATE_LIMIT_DURATION_MS = 5 * 60 * 1000; // 5 minutes pause after 402

function isRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}

function setRateLimited() {
  rateLimitedUntil = Date.now() + RATE_LIMIT_DURATION_MS;
  console.warn("[AI] Rate limited due to 402 error. Pausing AI calls for 5 minutes.");
}

export function useMessageAssistant({
  messageInput,
  lastMessages,
  clientName,
  sectorId,
  conversationId,
  spellingEnabled = true,
  suggestionsEnabled = true,
  autoLearningEnabled = true,
}: UseMessageAssistantProps): UseMessageAssistantReturn {
  const { currentUser } = useCurrentUser();
  
  // Correction state
  const [correction, setCorrection] = useState<string | null>(null);
  const [isCheckingSpelling, setIsCheckingSpelling] = useState(false);
  const correctionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckedTextRef = useRef<string>("");
  
  // Suggestions state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [currentSpinPhase, setCurrentSpinPhase] = useState<string | null>(null);
  const suggestionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessagesRef = useRef<string>("");

  // Check spelling with debounce - OPTIMIZED: 3000ms debounce, 50 char minimum
  useEffect(() => {
    // OPTIMIZATION: Increased minimum text length from 20 to 50 chars
    if (!spellingEnabled || !messageInput || messageInput.length < 50) {
      setCorrection(null);
      return;
    }

    // Skip if rate limited due to 402 error
    if (isRateLimited()) {
      return;
    }

    // Don't re-check if text hasn't changed significantly
    if (messageInput === lastCheckedTextRef.current) {
      return;
    }

    if (correctionTimeoutRef.current) {
      clearTimeout(correctionTimeoutRef.current);
    }

    // OPTIMIZATION: Increased debounce from 1500ms to 3000ms
    correctionTimeoutRef.current = setTimeout(async () => {
      setIsCheckingSpelling(true);
      lastCheckedTextRef.current = messageInput;

      try {
        const { data, error } = await supabase.functions.invoke("correct-message", {
          body: { text: messageInput, sectorId },
        });

        if (error) {
          // Check for 402 Payment Required
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
    }, 3000); // OPTIMIZED: 3s debounce for cloud cost reduction

    return () => {
      if (correctionTimeoutRef.current) {
        clearTimeout(correctionTimeoutRef.current);
      }
    };
  }, [messageInput, spellingEnabled, sectorId]);

  // OPTIMIZATION V2: Suggestions are now ON-DEMAND ONLY
  // Auto-suggestions were consuming too much AI credits
  // Users must click "Sugerir respostas" button to get suggestions
  // This dramatically reduces cloud costs while keeping functionality available
  
  // Clear suggestions when conversation changes
  useEffect(() => {
    if (!suggestionsEnabled || lastMessages.length === 0) {
      setSuggestions([]);
      return;
    }
    
    // Clear suggestions when messages change (user will request new ones if needed)
    const lastMessage = lastMessages[lastMessages.length - 1];
    if (!lastMessage?.is_from_client) {
      setSuggestions([]);
    }
  }, [lastMessages, suggestionsEnabled]);

  const applyCorrection = useCallback(() => {
    // The parent component should handle applying the correction to the input
    // We just clear the correction state here
    const correctedText = correction;
    setCorrection(null);
    lastCheckedTextRef.current = correctedText || "";
    return correctedText;
  }, [correction]);

  const dismissCorrection = useCallback(() => {
    setCorrection(null);
  }, []);

  // ON-DEMAND suggestion fetching - this is now the primary way to get suggestions
  const refreshSuggestions = useCallback(async () => {
    if (!suggestionsEnabled || lastMessages.length === 0 || !currentUser?.account_id) return;

    // Skip if rate limited
    if (isRateLimited()) {
      console.warn("[AI Suggestions] Skipped - rate limited");
      return;
    }

    // CRITICAL: Only suggest when last message is from client
    const lastMessage = lastMessages[lastMessages.length - 1];
    if (!lastMessage?.is_from_client) {
      console.log("[AI Suggestions] Skipped - last message is from agent");
      return;
    }

    // Check cache first
    const messagesSignature = lastMessages.map(m => m.id).join(",");
    if (conversationId) {
      const cached = getCachedSuggestions(conversationId, messagesSignature);
      if (cached) {
        console.log("[AI Suggestions] Using cached suggestions");
        setSuggestions(cached.suggestions);
        setCurrentSpinPhase(cached.currentSpinPhase);
        return;
      }
    }

    setIsLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-replies", {
        body: {
          messages: lastMessages.slice(-5).map(m => ({
            content: m.content,
            is_from_client: m.is_from_client,
          })),
          clientName,
          sectorId,
          accountId: currentUser.account_id,
        },
      });

      if (error) {
        if (error.message?.includes('402') || error.message?.includes('Payment')) {
          setRateLimited();
        }
        throw error;
      }
      
      // Handle payment/quota errors gracefully
      if (data?.error) {
        if (data.error.includes('402') || data.error.includes('Payment')) {
          setRateLimited();
        }
        console.warn("[AI Suggestions] Service error:", data.error);
        setSuggestions([]);
        return;
      }
      
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
        // Cache the response
        if (conversationId) {
          setCachedSuggestions(conversationId, messagesSignature, data.suggestions, data.currentSpinPhase || null);
        }
      }
      if (data?.currentSpinPhase) {
        setCurrentSpinPhase(data.currentSpinPhase);
      } else {
        setCurrentSpinPhase(null);
      }
    } catch (err) {
      console.error("Error fetching suggestions:", err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [lastMessages, clientName, sectorId, suggestionsEnabled, currentUser?.account_id, conversationId]);

  const selectSuggestion = useCallback((suggestion: Suggestion) => {
    // Mark as used in feedback
    if (autoLearningEnabled && currentUser?.account_id) {
      supabase.functions.invoke("save-suggestion-feedback", {
        body: {
          accountId: currentUser.account_id,
          sectorId,
          userId: currentUser.id,
          conversationId,
          suggestionType: "reply",
          suggestedText: suggestion.text,
          contextMessages: lastMessages.slice(-5),
          feedback: "positive",
          wasUsed: true,
        },
      }).catch(err => console.error("Error saving feedback:", err));
    }
  }, [sectorId, conversationId, lastMessages, autoLearningEnabled, currentUser]);

  const sendFeedback = useCallback(async (suggestionId: string, feedback: "positive" | "negative") => {
    const suggestion = suggestions.find(s => s.id === suggestionId);
    if (!suggestion || !currentUser?.account_id) return;

    // Update local state
    setSuggestions(prev => 
      prev.map(s => s.id === suggestionId ? { ...s, feedbackGiven: feedback } : s)
    );

    // Save to database
    try {
      await supabase.functions.invoke("save-suggestion-feedback", {
        body: {
          accountId: currentUser.account_id,
          sectorId,
          userId: currentUser.id,
          conversationId,
          suggestionType: "reply",
          suggestedText: suggestion.text,
          contextMessages: lastMessages.slice(-5),
          feedback,
          wasUsed: false,
        },
      });
    } catch (err) {
      console.error("Error saving feedback:", err);
    }
  }, [suggestions, sectorId, conversationId, lastMessages, currentUser]);

  return {
    // Correction
    correction,
    isCheckingSpelling,
    applyCorrection,
    dismissCorrection,
    
    // Suggestions
    suggestions,
    isLoadingSuggestions,
    refreshSuggestions,
    selectSuggestion,
    currentSpinPhase,
    
    // Feedback
    sendFeedback,
  };
}
