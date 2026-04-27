import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[]; // empty array = "Todos"
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  width?: string; // e.g. "w-full sm:w-[180px]"
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = "Todos",
  className,
  width = "w-full sm:w-[180px]",
}: MultiSelectFilterProps) {
  const triggerLabel = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const opt = options.find((o) => o.value === selected[0]);
      return opt?.label ?? selected[0];
    }
    return `${selected.length} selecionados`;
  }, [selected, options, placeholder]);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-xs font-medium text-muted-foreground px-1">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-between font-normal",
              width,
              selected.length === 0 && "text-muted-foreground",
            )}
          >
            <span className="truncate">{triggerLabel}</span>
            <span className="flex items-center gap-1 ml-2 shrink-0">
              {selected.length > 0 && (
                <X
                  className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
                  onClick={clearAll}
                />
              )}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[240px]" align="start">
          <div className="max-h-[280px] overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
            >
              <Checkbox checked={selected.length === 0} className="pointer-events-none" />
              <span>Todos</span>
            </button>
            <div className="h-px bg-border my-1" />
            {options.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => toggle(opt.value)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                >
                  <Checkbox checked={checked} className="pointer-events-none" />
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
