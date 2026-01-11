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
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  text: string;
  type: string;
  feedbackGiven?: "positive" | "negative";
}

// SPIN phase labels and colors
const spinPhaseConfig: Record<string, { label: string; icon: string; color: string }> = {
  situation: { label: "Situação", icon: "📍", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  problem: { label: "Problema", icon: "🔍", color: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  implication: { label: "Implicação", icon: "⚠️", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  need: { label: "Necessidade", icon: "✨", color: "bg-green-500/15 text-green-600 dark:text-green-400" },
  closing: { label: "Fechamento", icon: "🎯", color: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
};

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
  currentSpinPhase?: string | null;
  
  // Settings
  spellingEnabled: boolean;
  suggestionsEnabled: boolean;
  onToggleSuggestions?: () => void;
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
  currentSpinPhase,
  spellingEnabled,
  suggestionsEnabled,
  onToggleSuggestions,
}: ZappAIAssistBarProps) {
  const hasCorrection = correction && spellingEnabled;
  const hasSuggestions = suggestions.length > 0 && suggestionsEnabled;
  const isLoading = isCheckingSpelling || isLoadingSuggestions;

  // Show the bar if we have corrections, suggestions, loading state, OR if we have a toggle
  if (!hasCorrection && !hasSuggestions && !isLoading && !onToggleSuggestions) {
    return null;
  }

  return (
    <div className="bg-zapp-panel border-t border-zapp-border overflow-hidden">
      {/* Correction section */}
      {hasCorrection && (
        <div className="px-2 sm:px-3 py-2 border-b border-zapp-border bg-amber-500/5">
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
                <Check className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Usar</span>
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

      {/* Suggestions section - show toggle even when no suggestions */}
      {(hasSuggestions || isLoadingSuggestions || onToggleSuggestions) && (
        <div className="px-2 sm:px-3 py-2">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-2 overflow-x-auto">
            <Sparkles className="h-4 w-4 text-zapp-accent flex-shrink-0" />
            <span className="text-[10px] sm:text-xs text-zapp-text-muted font-medium whitespace-nowrap">
              Sugestões<span className="hidden sm:inline"> de resposta</span>
            </span>
            
            {/* Toggle button */}
            {onToggleSuggestions && (
              <button
                onClick={onToggleSuggestions}
                className={cn(
                  "flex items-center gap-1 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full transition-colors flex-shrink-0",
                  suggestionsEnabled 
                    ? "bg-zapp-accent/15 text-zapp-accent hover:bg-zapp-accent/25" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
                title={suggestionsEnabled ? "Desativar sugestões" : "Ativar sugestões"}
              >
                {suggestionsEnabled ? (
                  <ToggleRight className="h-3 w-3" />
                ) : (
                  <ToggleLeft className="h-3 w-3" />
                )}
                <span className="hidden xs:inline">{suggestionsEnabled ? "Ativado" : "Desativado"}</span>
              </button>
            )}
            
            {/* SPIN Phase indicator - hidden on very small screens */}
            {suggestionsEnabled && currentSpinPhase && spinPhaseConfig[currentSpinPhase] && (
              <span className={cn(
                "hidden xs:inline text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-medium whitespace-nowrap",
                spinPhaseConfig[currentSpinPhase].color
              )}>
                {spinPhaseConfig[currentSpinPhase].icon} {spinPhaseConfig[currentSpinPhase].label}
              </span>
            )}
            
            {suggestionsEnabled && (
              isLoadingSuggestions ? (
                <Loader2 className="h-3 w-3 animate-spin text-zapp-text-muted flex-shrink-0" />
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onRefreshSuggestions}
                  className="h-5 w-5 p-0 text-zapp-text-muted hover:text-zapp-accent flex-shrink-0"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )
            )}
          </div>
          
          {suggestionsEnabled && suggestions.length > 0 && (
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-2 px-2 sm:-mx-3 sm:px-3">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className={cn(
                    "group flex items-center gap-1 bg-zapp-bg rounded-lg border border-zapp-border transition-colors flex-shrink-0",
                    suggestion.feedbackGiven === "positive" && "border-green-500/50 bg-green-500/5",
                    suggestion.feedbackGiven === "negative" && "border-red-500/50 bg-red-500/5"
                  )}
                >
                  <button
                    onClick={() => onSelectSuggestion(suggestion)}
                    className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-zapp-text hover:text-zapp-accent transition-colors text-left max-w-[200px] sm:max-w-[280px] truncate"
                    title={suggestion.text}
                  >
                    {suggestion.text}
                  </button>
                  
                  {!suggestion.feedbackGiven ? (
                    <div className="hidden sm:flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
          )}
          
          {suggestionsEnabled && suggestions.length === 0 && !isLoadingSuggestions && (
            <p className="text-[10px] sm:text-xs text-zapp-text-muted">
              Aguardando mensagem do cliente...
            </p>
          )}
        </div>
      )}

      {/* Loading indicator when no content yet */}
      {isLoading && !hasCorrection && !hasSuggestions && (
        <div className="px-2 sm:px-3 py-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-zapp-text-muted" />
          <span className="text-[10px] sm:text-xs text-zapp-text-muted">
            {isCheckingSpelling ? "Verificando..." : "Gerando..."}
          </span>
        </div>
      )}
    </div>
  );
});
