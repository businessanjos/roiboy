import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ZappTagLike {
  name: string;
  color?: string | null;
}

const FALLBACK_COLOR = "#6b7c85";

function toRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "").trim();
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw.slice(0, 6);
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
  const r = n(0), g = n(2), b = n(4);
  return [Number.isNaN(r) ? 107 : r, Number.isNaN(g) ? 124 : g, Number.isNaN(b) ? 133 : b];
}

/** Texto escuro ou claro conforme a cor da etiqueta, para sempre dar leitura. */
function readableText(hex: string) {
  const [r, g, b] = toRgb(hex);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.3 ? "#1c1917" : "#ffffff";
}

/**
 * Etiqueta do RoyZapp em selo legível: cor cheia + nome, com a dica de mouse
 * dizendo exatamente qual é. Nunca um ponto solto.
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
  const color = tag.color || FALLBACK_COLOR;
  const text = readableText(color);

  const badge = (
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
            <span>{tooltipLabel ?? `Etiqueta: ${tag.name}`}</span>
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
