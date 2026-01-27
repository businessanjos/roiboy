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

  // Check spelling with debounce - increased to 1500ms for cloud optimization
  useEffect(() => {
    if (!spellingEnabled || !messageInput || messageInput.length < 15) {
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
    }, 1500); // Increased from 800ms to 1500ms for cloud optimization

    return () => {
      if (correctionTimeoutRef.current) {
        clearTimeout(correctionTimeoutRef.current);
      }
    };
  }, [messageInput, spellingEnabled, sectorId]);

  // Load suggestions when messages change - ONLY when last message is from client
  // Uses local cache to avoid duplicate API calls
  useEffect(() => {
    if (!suggestionsEnabled || lastMessages.length === 0) {
      console.log("[AI Suggestions] Disabled or no messages");
      setSuggestions([]);
      return;
    }

    // Skip if rate limited due to 402 error
    if (isRateLimited()) {
      console.log("[AI Suggestions] Skipping - rate limited after 402 error");
      return;
    }

    // Wait for account_id to be available
    if (!currentUser?.account_id) {
      console.log("[AI Suggestions] Waiting for account_id...");
      return;
    }

    // CRITICAL: Only suggest replies when the LAST message is from the client
    // If the last message is from the agent (seller), there's nothing to reply to
    const lastMessage = lastMessages[lastMessages.length - 1];
    if (!lastMessage?.is_from_client) {
      console.log("[AI Suggestions] Last message is from agent, no suggestions needed");
      setSuggestions([]);
      return;
    }

    // Create a signature of messages to avoid duplicate requests
    const messagesSignature = lastMessages.map(m => m.id).join(",");
    if (messagesSignature === lastMessagesRef.current) {
      return;
    }

    // Check local cache first
    if (conversationId) {
      const cached = getCachedSuggestions(conversationId, messagesSignature);
      if (cached) {
        console.log("[AI Suggestions] Using cached suggestions for conversation:", conversationId);
        setSuggestions(cached.suggestions);
        setCurrentSpinPhase(cached.currentSpinPhase);
        lastMessagesRef.current = messagesSignature;
        return;
      }
    }

    if (suggestionsTimeoutRef.current) {
      clearTimeout(suggestionsTimeoutRef.current);
    }

    suggestionsTimeoutRef.current = setTimeout(async () => {
      console.log("[AI Suggestions] Fetching suggestions for sector:", sectorId);
      setIsLoadingSuggestions(true);
      lastMessagesRef.current = messagesSignature;

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
          // Check for 402 Payment Required
          if (error.message?.includes('402') || error.message?.includes('Payment')) {
            setRateLimited();
          }
          console.error("[AI Suggestions] Error:", error);
          setSuggestions([]);
          return;
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

        console.log("[AI Suggestions] Received:", data?.suggestions?.length || 0, "suggestions", "SPIN phase:", data?.currentSpinPhase);
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
        console.error("[AI Suggestions] Error in suggestions:", err);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 1500); // Increased from 300ms to 1500ms for cloud optimization

    return () => {
      if (suggestionsTimeoutRef.current) {
        clearTimeout(suggestionsTimeoutRef.current);
      }
    };
  }, [lastMessages, suggestionsEnabled, clientName, sectorId, currentUser?.account_id, conversationId]);

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

  const refreshSuggestions = useCallback(async () => {
    if (!suggestionsEnabled || lastMessages.length === 0) return;

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
          accountId: currentUser?.account_id,
        },
      });

      if (error) throw error;
      
      // Handle payment/quota errors gracefully
      if (data?.error) {
        console.warn("[AI Suggestions] Service error on refresh:", data.error);
        setSuggestions([]);
        return;
      }
      
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
      }
      if (data?.currentSpinPhase) {
        setCurrentSpinPhase(data.currentSpinPhase);
      } else {
        setCurrentSpinPhase(null);
      }
    } catch (err) {
      console.error("Error refreshing suggestions:", err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [lastMessages, clientName, sectorId, suggestionsEnabled, currentUser?.account_id]);

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
