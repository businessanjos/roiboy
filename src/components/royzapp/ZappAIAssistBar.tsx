import { memo } from "react";
import {
  Check,
  X,
  Loader2,
  Wand2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ZappAIAssistBarProps {
  correction: string | null;
  isCheckingSpelling: boolean;
  onApplyCorrection: () => void;
  onDismissCorrection: () => void;
  spellingEnabled: boolean;
  // Reply suggestions (commercial only)
  suggestions?: string[];
  isLoadingSuggestions?: boolean;
  suggestionsAvailable?: boolean;
  onSelectSuggestion?: (text: string) => void;
  onRefreshSuggestions?: () => void;
  onDismissSuggestions?: () => void;
}

export const ZappAIAssistBar = memo(function ZappAIAssistBar({
  correction,
  isCheckingSpelling,
  onApplyCorrection,
  onDismissCorrection,
  spellingEnabled,
  suggestions = [],
  isLoadingSuggestions = false,
  suggestionsAvailable = false,
  onSelectSuggestion,
  onRefreshSuggestions,
  onDismissSuggestions,
}: ZappAIAssistBarProps) {
  const hasCorrection = !!(correction && spellingEnabled);
  const hasSuggestions = suggestionsAvailable && suggestions.length > 0;
  const showSuggestionsLoader = suggestionsAvailable && isLoadingSuggestions && !hasSuggestions;

  if (!hasCorrection && !isCheckingSpelling && !hasSuggestions && !showSuggestionsLoader) {
    return null;
  }

  return (
    <div className="bg-zapp-panel border-t border-zapp-border overflow-hidden">
      {/* Correction section */}
      {hasCorrection && (
        <div className="px-2 sm:px-3 py-2 border-b border-zapp-border bg-warning/5">
          <div className="flex items-start gap-2">
            <Wand2 className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-warning dark:text-warning font-medium mb-1">
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

      {/* Loading (spelling) */}
      {isCheckingSpelling && !hasCorrection && (
        <div className="px-2 sm:px-3 py-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-zapp-text-muted" />
          <span className="text-[10px] sm:text-xs text-zapp-text-muted">
            Verificando ortografia...
          </span>
        </div>
      )}

      {/* Reply suggestions (commercial only) */}
      {(hasSuggestions || showSuggestionsLoader) && (
        <div className="px-2 sm:px-3 py-2 bg-violet-500/5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
              <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400 truncate">
                Sugestões de resposta
              </span>
              {isLoadingSuggestions && hasSuggestions && (
                <Loader2 className="h-3 w-3 animate-spin text-violet-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {onRefreshSuggestions && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onRefreshSuggestions}
                  disabled={isLoadingSuggestions}
                  className="h-6 w-6 p-0 text-zapp-text-muted hover:bg-zapp-hover"
                  title="Gerar novas sugestões"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingSuggestions ? "animate-spin" : ""}`} />
                </Button>
              )}
              {onDismissSuggestions && hasSuggestions && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDismissSuggestions}
                  className="h-6 w-6 p-0 text-zapp-text-muted hover:bg-zapp-hover"
                  title="Fechar sugestões"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {showSuggestionsLoader ? (
            <div className="flex items-center gap-2 py-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
              <span className="text-[11px] text-zapp-text-muted">
                Gerando sugestões com base na conversa...
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {suggestions.map((s, idx) => (
                <button
                  key={`${idx}-${s.slice(0, 20)}`}
                  type="button"
                  onClick={() => onSelectSuggestion?.(s)}
                  className="text-left text-sm text-zapp-text bg-zapp-hover/60 hover:bg-violet-500/10 border border-transparent hover:border-violet-500/30 rounded-md px-2.5 py-1.5 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
