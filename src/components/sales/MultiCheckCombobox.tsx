import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface ComboOption {
  value: string;
  label: string;
}

interface MultiCheckComboboxProps {
  options: ComboOption[];
  /** Selected values. Accepts string (single legacy value) or string[]. */
  value: string | string[] | null | undefined;
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  emptyText?: string;
}

/**
 * Popover-based multi-select with search + checkboxes.
 * Backwards-compatible: accepts a single string value (legacy filters) and outputs string[].
 */
export function MultiCheckCombobox({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  className,
  emptyText = "Nenhuma opção",
}: MultiCheckComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo<string[]>(() => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string" && value) return [value];
    return [];
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const labelFor = (val: string) => options.find((o) => o.value === val)?.label ?? val;

  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
      ? labelFor(selected[0])
      : `${selected.length} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 justify-between font-normal",
            selected.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="h-8 pl-8 pr-7"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {selected.length > 0 && (
          <div className="px-2 pt-2 pb-1 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {selected.length} selecionado{selected.length > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => onChange([])}
            >
              Limpar
            </button>
          </div>
        )}
        <ScrollArea className="max-h-[240px]">
          <div className="p-1">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">{emptyText}</p>
            )}
            {filtered.map((opt) => {
              const isOn = selected.includes(opt.value);
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => toggle(opt.value)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm hover:bg-accent transition-colors",
                    isOn && "bg-accent/60",
                  )}
                >
                  <span
                    className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                      isOn ? "bg-primary border-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {isOn && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
