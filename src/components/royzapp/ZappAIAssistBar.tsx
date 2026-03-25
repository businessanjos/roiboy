import { memo } from "react";
import { 
  Check, 
  X, 
  Loader2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ZappAIAssistBarProps {
  correction: string | null;
  isCheckingSpelling: boolean;
  onApplyCorrection: () => void;
  onDismissCorrection: () => void;
  spellingEnabled: boolean;
}

export const ZappAIAssistBar = memo(function ZappAIAssistBar({
  correction,
  isCheckingSpelling,
  onApplyCorrection,
  onDismissCorrection,
  spellingEnabled,
}: ZappAIAssistBarProps) {
  const hasCorrection = correction && spellingEnabled;

  if (!hasCorrection && !isCheckingSpelling) {
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

      {/* Loading indicator */}
      {isCheckingSpelling && !hasCorrection && (
        <div className="px-2 sm:px-3 py-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-zapp-text-muted" />
          <span className="text-[10px] sm:text-xs text-zapp-text-muted">
            Verificando...
          </span>
        </div>
      )}
    </div>
  );
});
