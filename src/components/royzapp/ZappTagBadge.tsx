import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ZappTagLike {
  name: string;
  color?: string | null;
}

/**
 * Etiqueta do RoyZapp em selo legível: cor + nome, com a dica de mouse
 * dizendo exatamente qual é a etiqueta. Nunca um ponto solto.
 */
export function ZappTagBadge({
  tag,
  className,
  tooltip = true,
  tooltipLabel,
  size = "sm",
}: {
  tag: ZappTagLike;
  className?: string;
  tooltip?: boolean;
  tooltipLabel?: string;
  size?: "sm" | "md";
}) {
  const color = tag.color || "#6b7c85";

  const badge = (
    <span
      className={cn(
        "inline-flex max-w-[9rem] items-center gap-1.5 rounded-full border font-medium leading-none tracking-tight",
        size === "sm" ? "h-[18px] px-1.5 text-[10px]" : "h-5 px-2 text-xs",
        className,
      )}
      style={{
        backgroundColor: `${color}26`,
        borderColor: `${color}66`,
        color,
        boxShadow: `inset 0 1px 0 ${color}1a`,
      }}
    >
      <span
        aria-hidden
        className={cn("shrink-0 rounded-full", size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2")}
        style={{ backgroundColor: color, boxShadow: `0 0 0 2px ${color}33` }}
      />
      <span className="truncate">{tag.name}</span>
    </span>
  );

  if (!tooltip) return badge;

  return (
    <TooltipProvider delayDuration={120} skipDelayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex min-w-0 max-w-full">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[18rem] text-xs">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span>
              {tooltipLabel ?? `Etiqueta: ${tag.name}`}
            </span>
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Lista de etiquetas da conversa, já filtrada e pronta para exibir. */
export function getConversationTags(
  conversationTags?: { tag_id: string; tag: ZappTagLike & { id?: string } | null }[] | null,
) {
  return (conversationTags || []).map((ct) => ct.tag).filter(Boolean) as (ZappTagLike & {
    id?: string;
  })[];
}
