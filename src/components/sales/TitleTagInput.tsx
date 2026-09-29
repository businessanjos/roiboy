import { forwardRef, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const TITLE_TAGS = [
  "CARTEIRA-EM",
  "CARTEIRA-EC",
  "ORG-EVER",
  "ORG-EC",
  "ORG-BP",
  "TRAF-IMP-EC",
  "TRAF-STUDIO-EC",
  "IND-EM",
  "IND-EC",
];

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Termo que o usuário está digitando antes do nome (primeira palavra, sem tag). */
function currentQuery(value: string): string {
  if (/^\s*\[[^\]]*\]/.test(value)) return "";
  const first = value.trimStart().split(/\s+/)[0] ?? "";
  return first.replace(/^\[/, "");
}

function applyTag(value: string, tag: string): string {
  const withTag = `[${tag}] `;
  if (/^\s*\[[^\]]*\]/.test(value)) {
    return value.replace(/^\s*\[[^\]]*\]\s*/, withTag);
  }
  const q = currentQuery(value);
  const rest = value.trimStart().slice(q.length + (value.trimStart().startsWith("[") ? 1 : 0)).trimStart();
  // Só remove o termo digitado se ele casou com alguma tag
  if (q && TITLE_TAGS.some((t) => norm(t).includes(norm(q)))) return withTag + rest;
  return withTag + value.trimStart();
}

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onValueChange: (v: string) => void;
}

export const TitleTagInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onValueChange, className, disabled, onFocus, onBlur, ...rest }, ref) => {
    const [focused, setFocused] = useState(false);
    const v = value ?? "";
    const hasTag = /^\s*\[[^\]]*\]/.test(v);

    const suggestions = useMemo(() => {
      const q = norm(currentQuery(v));
      if (!q) return [];
      // Prefixo de qualquer parte (CART, EC, ORG, IND, TRAF, STUDIO...)
      return TITLE_TAGS.filter((t) => {
        const parts = t.split("-");
        return norm(t).startsWith(q) || parts.some((p) => p.startsWith(q)) || norm(t).includes(q);
      });
    }, [v]);

    const show = focused && !disabled && !hasTag && suggestions.length > 0;

    return (
      <div className="space-y-1.5">
        <Input
          ref={ref}
          value={v}
          disabled={disabled}
          className={className}
          onChange={(e) => onValueChange(e.target.value)}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setTimeout(() => setFocused(false), 150); onBlur?.(e); }}
          autoComplete="off"
          {...rest}
        />
        {show && (
          <div className="flex flex-wrap gap-1.5 rounded-md border bg-muted/40 p-1.5">
            {suggestions.map((t) => (
              <button
                key={t}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onValueChange(applyTag(v, t))}
                className={cn(
                  "rounded-md border bg-background px-2 py-1 text-xs font-medium text-foreground",
                  "transition-colors hover:border-primary hover:bg-primary/10"
                )}
              >
                [{t}]
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);
TitleTagInput.displayName = "TitleTagInput";
