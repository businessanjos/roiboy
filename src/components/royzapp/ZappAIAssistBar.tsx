import { memo } from "react";
import { 
  Sparkles, 
  Check, 
  X, 
  ThumbsUp, 
  ThumbsDown, 
  RefreshCw,
  Loader2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  text: string;
  type: string;
  feedbackGiven?: "positive" | "negative";
}

interface ZappAIAssistBarProps {
  // Correction
  correction: string | null;
  isCheckingSpelling: boolean;
  onApplyCorrection: () => void;
  onDismissCorrection: () => void;
  
  // Suggestions
  suggestions: Suggestion[];
  isLoadingSuggestions: boolean;
  onSelectSuggestion: (suggestion: Suggestion) => void;
  onRefreshSuggestions: () => void;
  onSendFeedback: (suggestionId: string, feedback: "positive" | "negative") => void;
  
  // Settings
  spellingEnabled: boolean;
  suggestionsEnabled: boolean;
}

export const ZappAIAssistBar = memo(function ZappAIAssistBar({
  correction,
  isCheckingSpelling,
  onApplyCorrection,
  onDismissCorrection,
  suggestions,
  isLoadingSuggestions,
  onSelectSuggestion,
  onRefreshSuggestions,
  onSendFeedback,
  spellingEnabled,
  suggestionsEnabled,
}: ZappAIAssistBarProps) {
  const hasCorrection = correction && spellingEnabled;
  const hasSuggestions = suggestions.length > 0 && suggestionsEnabled;
  const isLoading = isCheckingSpelling || isLoadingSuggestions;

  if (!hasCorrection && !hasSuggestions && !isLoading) {
    return null;
  }

  return (
    <div className="bg-zapp-panel border-t border-zapp-border">
      {/* Correction section */}
      {hasCorrection && (
        <div className="px-3 py-2 border-b border-zapp-border bg-amber-500/5">
          <div className="flex items-start gap-2">
            <Wand2 className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
                Correção sugerida
              </p>
              <p className="text-sm text-zapp-text break-words">
                {correction}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={onApplyCorrection}
                className="h-7 px-2 text-zapp-accent hover:bg-zapp-accent/10"
              >
                <Check className="h-4 w-4 mr-1" />
                Usar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismissCorrection}
                className="h-7 w-7 p-0 text-zapp-text-muted hover:bg-zapp-hover"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions section */}
      {(hasSuggestions || isLoadingSuggestions) && (
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-zapp-accent" />
            <span className="text-xs text-zapp-text-muted font-medium">
              Sugestões de resposta
            </span>
            {isLoadingSuggestions ? (
              <Loader2 className="h-3 w-3 animate-spin text-zapp-text-muted" />
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={onRefreshSuggestions}
                className="h-5 w-5 p-0 text-zapp-text-muted hover:text-zapp-accent"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={cn(
                  "group flex items-center gap-1 bg-zapp-bg rounded-lg border border-zapp-border transition-colors",
                  suggestion.feedbackGiven === "positive" && "border-green-500/50 bg-green-500/5",
                  suggestion.feedbackGiven === "negative" && "border-red-500/50 bg-red-500/5"
                )}
              >
                <button
                  onClick={() => onSelectSuggestion(suggestion)}
                  className="px-3 py-1.5 text-sm text-zapp-text hover:text-zapp-accent transition-colors text-left max-w-[280px] truncate"
                  title={suggestion.text}
                >
                  {suggestion.text}
                </button>
                
                {!suggestion.feedbackGiven ? (
                  <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onSendFeedback(suggestion.id, "positive")}
                      className="p-1 text-zapp-text-muted hover:text-green-500 transition-colors"
                      title="Boa sugestão"
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => onSendFeedback(suggestion.id, "negative")}
                      className="p-1 text-zapp-text-muted hover:text-red-500 transition-colors"
                      title="Sugestão ruim"
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="pr-2">
                    <Check className={cn(
                      "h-3 w-3",
                      suggestion.feedbackGiven === "positive" ? "text-green-500" : "text-red-500"
                    )} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading indicator when no content yet */}
      {isLoading && !hasCorrection && !hasSuggestions && (
        <div className="px-3 py-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-zapp-text-muted" />
          <span className="text-xs text-zapp-text-muted">
            {isCheckingSpelling ? "Verificando ortografia..." : "Gerando sugestões..."}
          </span>
        </div>
      )}
    </div>
  );
});
