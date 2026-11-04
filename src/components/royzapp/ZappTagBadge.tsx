import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Tag as TagIcon } from "lucide-react";
import { ZAPP_TAG_FALLBACK_COLOR, tagReadableText } from "@/lib/zappTagColor";

export interface ZappTagLike {
  name: string;
  color?: string | null;
}


/**
 * Etiqueta do RoyZapp em selo legível: cor cheia + nome, com a dica de mouse
 * dizendo exatamente qual é. Nunca um ponto solto.
 *
 * `tone="soft"` é a versão discreta para o topo do chat: só o ícone na cor da
 * etiqueta + o nome em texto suave, sem fundo, borda nem sombra.
 */
export function ZappTagBadge({
  tag,
  className,
  tooltip = true,
  tooltipLabel,
  size = "sm",
  variant = "badge",
  tone = "solid",
}: {
  tag: ZappTagLike;
  className?: string;
  tooltip?: boolean;
  tooltipLabel?: string;
  size?: "sm" | "md";
  variant?: "badge" | "icon";
  tone?: "solid" | "soft";
}) {
  const color = tag.color || ZAPP_TAG_FALLBACK_COLOR;
  const text = tagReadableText(color);

  const badge = variant === "icon" ? (
    <span
      data-zapp-tag="1"
      aria-label={tag.name}
      className={cn("inline-flex h-4 w-4 shrink-0 items-center justify-center", className)}
    >
      <TagIcon className="h-3.5 w-3.5" style={{ color, fill: color }} strokeWidth={2} />
    </span>
  ) : tone === "soft" ? (
    <span
      data-zapp-tag="1"
      className={cn(
        "inline-flex max-w-[10rem] items-center gap-1 leading-none text-zapp-text-muted",
        size === "sm" ? "text-[11px]" : "text-xs",
        className,
      )}
    >
      <TagIcon className="h-3 w-3 shrink-0" style={{ color, fill: color }} strokeWidth={2} />
      <span className="truncate">{tag.name}</span>
    </span>
  ) : (
    <span
      data-zapp-tag="1"
      className={cn(
        "inline-flex max-w-[9rem] items-center rounded-full border font-medium leading-none tracking-tight",
        size === "sm" ? "h-[18px] px-2 text-[10px]" : "h-5 px-2.5 text-xs",
        className,
      )}
      style={{
        backgroundColor: color,
        borderColor: color,
        color: text,
        boxShadow: "0 1px 2px rgba(0,0,0,0.28)",
      }}
    >
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
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span>{tooltipLabel ?? tag.name}</span>
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Selo "+N" das etiquetas que não couberam; a dica de mouse lista quais são. */
export function ZappTagMore({ count, tags }: { count: number; tags: ZappTagLike[] }) {
  return (
    <TooltipProvider delayDuration={120} skipDelayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-zapp-tag-more="1"
            className="inline-flex h-[18px] shrink-0 items-center rounded-full border border-zapp-border bg-zapp-panel px-1.5 text-[10px] font-medium leading-none text-zapp-text-muted"
          >
            +{count}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-[18rem] text-xs">
          <span className="flex flex-col gap-1">
            {tags.map((t, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: t.color || ZAPP_TAG_FALLBACK_COLOR }}
                />
                <span className="truncate">{t.name}</span>
              </span>
            ))}
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
  return (conversationTags || [])
    .map((ct) => ct.tag)
    .filter(Boolean) as (ZappTagLike & { id?: string })[];
}
