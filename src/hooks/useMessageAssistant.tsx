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
  
  // Feedback
  sendFeedback: (suggestionId: string, feedback: "positive" | "negative") => Promise<void>;
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
  const suggestionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessagesRef = useRef<string>("");

  // Check spelling with debounce
  useEffect(() => {
    if (!spellingEnabled || !messageInput || messageInput.length < 10) {
      setCorrection(null);
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
    }, 800); // 800ms debounce

    return () => {
      if (correctionTimeoutRef.current) {
        clearTimeout(correctionTimeoutRef.current);
      }
    };
  }, [messageInput, spellingEnabled, sectorId]);

  // Load suggestions when messages change
  useEffect(() => {
    if (!suggestionsEnabled || lastMessages.length === 0) {
      console.log("[AI Suggestions] Disabled or no messages");
      setSuggestions([]);
      return;
    }

    // Wait for account_id to be available
    if (!currentUser?.account_id) {
      console.log("[AI Suggestions] Waiting for account_id...");
      return;
    }

    // Check if there's ANY message from client in the conversation (more flexible)
    const hasClientMessage = lastMessages.some(m => m.is_from_client);
    if (!hasClientMessage) {
      console.log("[AI Suggestions] No client messages found");
      return;
    }

    // Create a signature of messages to avoid duplicate requests
    const messagesSignature = lastMessages.map(m => m.id).join(",");
    if (messagesSignature === lastMessagesRef.current) {
      return;
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
          console.error("[AI Suggestions] Error:", error);
          return;
        }

        console.log("[AI Suggestions] Received:", data?.suggestions?.length || 0, "suggestions");
        if (data?.suggestions) {
          setSuggestions(data.suggestions);
        }
      } catch (err) {
        console.error("[AI Suggestions] Error in suggestions:", err);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300); // Reduced debounce from 500ms to 300ms

    return () => {
      if (suggestionsTimeoutRef.current) {
        clearTimeout(suggestionsTimeoutRef.current);
      }
    };
  }, [lastMessages, suggestionsEnabled, clientName, sectorId, currentUser?.account_id]);

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
      if (data?.suggestions) {
        setSuggestions(data.suggestions);
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
    
    // Feedback
    sendFeedback,
  };
}
