import { memo } from "react";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface PipelineTrackStage {
  id: string;
  name: string;
  color: string;
  display_order: number;
}

interface ZappDealPipelineTrackProps {
  stages: PipelineTrackStage[];
  currentStageId: string;
  onSelectStage: (stageId: string) => void;
  /** Etapa aguardando confirmação do servidor (feedback imediato). */
  pendingStageId?: string | null;
  disabled?: boolean;
}

/**
 * Trilha visual do pipeline dentro do CRM do RoyZapp.
 * Mostra a jornada completa do negócio e permite mover entre etapas
 * com um clique, refletindo o novo status na hora.
 */
export const ZappDealPipelineTrack = memo(function ZappDealPipelineTrack({
  stages,
  currentStageId,
  onSelectStage,
  pendingStageId,
  disabled,
}: ZappDealPipelineTrackProps) {
  if (stages.length === 0) return null;

  const currentIndex = stages.findIndex((s) => s.id === currentStageId);
  const currentStage = currentIndex >= 0 ? stages[currentIndex] : null;
  const progress =
    currentIndex >= 0 ? ((currentIndex + 1) / stages.length) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zapp-text-muted">Etapa do pipeline</span>
        <span className="text-[10px] text-zapp-text-muted tabular-nums">
          {currentIndex >= 0 ? currentIndex + 1 : 0}/{stages.length}
        </span>
      </div>

      {/* Barra de progresso da jornada */}
      <div className="h-1.5 w-full rounded-full bg-zapp-input overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${progress}%`,
            backgroundColor: currentStage?.color || undefined,
          }}
        />
      </div>

      {/* Trilha de etapas clicável */}
      <div className="flex items-center gap-0.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {stages.map((stage, index) => {
          const isCurrent = stage.id === currentStageId;
          const isDone = currentIndex >= 0 && index < currentIndex;
          const isPending = pendingStageId === stage.id;

          return (
            <div key={stage.id} className="flex items-center shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-current={isCurrent ? "step" : undefined}
                    disabled={disabled || isCurrent}
                    onClick={() => onSelectStage(stage.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 h-7 text-xs whitespace-nowrap transition-all",
                      isCurrent
                        ? "font-medium text-white shadow-sm cursor-default"
                        : isDone
                          ? "bg-zapp-input/60 text-zapp-text"
                          : "bg-transparent text-zapp-text-muted hover:bg-zapp-input",
                      disabled && !isCurrent && "opacity-60 cursor-not-allowed"
                    )}
                    style={
                      isCurrent
                        ? { backgroundColor: stage.color, borderColor: stage.color }
                        : { borderColor: `${stage.color}66` }
                    }
                  >
                    {isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isDone ? (
                      <Check className="h-3 w-3" style={{ color: stage.color }} />
                    ) : (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                    )}
                    {stage.name}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isCurrent ? `Etapa atual: ${stage.name}` : `Mover para ${stage.name}`}
                </TooltipContent>
              </Tooltip>

              {index < stages.length - 1 && (
                <ChevronRight className="h-3 w-3 text-zapp-text-muted/50 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
