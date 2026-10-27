import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = Omit<React.ComponentProps<"input">, "type">;

function toDate(v: unknown): Date | undefined {
  if (typeof v !== "string" || !v) return undefined;
  const d = parse(v.slice(0, 10), "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

/** Calendário ROY usado no lugar do seletor nativo para campos de data. */
export const DateField = React.forwardRef<HTMLInputElement, Props>(
  ({ className, value, defaultValue, onChange, disabled, placeholder, id, min, max, required, name, ...rest }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [inner, setInner] = React.useState<string>(String(defaultValue ?? ""));
    const current = value !== undefined ? String(value ?? "") : inner;
    const selected = toDate(current);
    const minD = toDate(min);
    const maxD = toDate(max);

    const emit = (next: string) => {
      if (value === undefined) setInner(next);
      const target = { value: next, name, id, type: "date", valueAsDate: toDate(next) ?? null } as any;
      onChange?.({ target, currentTarget: target } as React.ChangeEvent<HTMLInputElement>);
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-label={rest["aria-label"]}
            className={cn(
              "group flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-base ring-offset-background transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              open && "border-primary ring-2 ring-primary/20",
              className,
            )}
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            <span className={cn("flex-1 truncate", !selected && "text-muted-foreground")}>
              {selected ? format(selected, "dd/MM/yyyy") : placeholder || "dd/mm/aaaa"}
            </span>
            {selected && !disabled && !required && (
              <span
                role="button"
                aria-label="Limpar data"
                onClick={(e) => { e.stopPropagation(); emit(""); }}
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden rounded-xl border-border p-0 shadow-lg" align="start">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selected}
            defaultMonth={selected}
            captionLayout="dropdown-buttons"
            fromYear={1930}
            toYear={new Date().getFullYear() + 10}
            disabled={(d) => (minD ? d < minD : false) || (maxD ? d > maxD : false)}
            onSelect={(d) => { emit(d ? format(d, "yyyy-MM-dd") : ""); setOpen(false); }}
            initialFocus
            className="pointer-events-auto"
          />
          <div className="flex items-center justify-between border-t border-border bg-muted/40 px-3 py-2">
            <button type="button" className="text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => { emit(""); setOpen(false); }}>
              Limpar
            </button>
            <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => { emit(format(new Date(), "yyyy-MM-dd")); setOpen(false); }}>
              Hoje
            </button>
          </div>
        </PopoverContent>
        <input ref={ref} type="hidden" name={name} value={current} readOnly />
      </Popover>
    );
  },
);
DateField.displayName = "DateField";
