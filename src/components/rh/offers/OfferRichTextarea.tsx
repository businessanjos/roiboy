import { useRef, useCallback, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Bold, Italic, Sparkles, Highlighter } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
}

type Fmt = "bold" | "italic" | "gold" | "soft";

const MARKERS: Record<Fmt, [string, string]> = {
  bold: ["**", "**"],
  italic: ["_", "_"],
  gold: ["==", "=="],
  soft: ["~~", "~~"],
};

export function OfferRichTextarea({ value, onChange, rows = 6, placeholder, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrap = useCallback(
    (fmt: Fmt) => {
      const ta = ref.current;
      if (!ta) return;
      const [pre, suf] = MARKERS[fmt];
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const sel = value.substring(start, end) || "texto";
      const next = value.substring(0, start) + pre + sel + suf + value.substring(end);
      onChange(next);
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + pre.length, start + pre.length + sel.length);
      }, 0);
    },
    [value, onChange]
  );

  const Btn = ({ fmt, icon: Icon, label }: { fmt: Fmt; icon: any; label: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => wrap(fmt)}>
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom"><p className="text-xs">{label}</p></TooltipContent>
    </Tooltip>
  );

  return (
    <div className={className}>
      <TooltipProvider>
        <div className="flex items-center gap-1 p-1 border rounded-t-md bg-muted/30 border-b-0">
          <Btn fmt="bold" icon={Bold} label="Negrito (**texto**)" />
          <Btn fmt="italic" icon={Italic} label="Itálico (_texto_)" />
          <div className="w-px h-5 bg-border mx-1" />
          <Btn fmt="gold" icon={Sparkles} label="Destaque dourado (==texto==)" />
          <Btn fmt="soft" icon={Highlighter} label="Texto suave (~~texto~~)" />
          <span className="text-[11px] text-muted-foreground ml-2 hidden sm:inline">
            Selecione e clique, ou digite a marcação direto.
          </span>
        </div>
      </TooltipProvider>
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="rounded-t-none font-mono text-sm"
      />
    </div>
  );
}

// ---------- Renderer ----------
// Suporta **bold**, _italic_, ==gold==, ~~soft~~ em linha.
// Quebras de linha viram parágrafos.
export function renderOfferRichInline(text: string, goldColor = "#c9a84c"): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(_([^_]+)_)|(==([^=]+)==)|(~~([^~]+)~~)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={k++} style={{ fontWeight: 600 }}>{m[2]}</strong>);
    else if (m[3]) out.push(<em key={k++} style={{ fontStyle: "italic" }}>{m[4]}</em>);
    else if (m[5]) out.push(<span key={k++} style={{ color: goldColor, fontWeight: 500 }}>{m[6]}</span>);
    else if (m[7]) out.push(<span key={k++} style={{ opacity: 0.65 }}>{m[8]}</span>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
