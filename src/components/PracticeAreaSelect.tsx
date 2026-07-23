import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { usePracticeAreas } from "@/hooks/usePracticeAreas";

interface PracticeAreaSelectProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Match by 'label' (default) or 'slug' */
  valueKey?: "label" | "slug";
  className?: string;
  /** Show a clear button when a value is selected */
  clearable?: boolean;
}

/**
 * Autocomplete de Áreas de Atuação (carregado de public.practice_areas).
 * Suporta busca por texto, teclado e limpeza da seleção.
 */
export function PracticeAreaSelect({
  value,
  onChange,
  placeholder = "Selecione a área de atuação",
  disabled,
  valueKey = "label",
  className,
  clearable = true,
}: PracticeAreaSelectProps) {
  const { data: areas = [], isLoading } = usePracticeAreas();
  const [open, setOpen] = useState(false);

  const selected = areas.find((a) =>
    valueKey === "slug" ? a.slug === value : a.label === value,
  );

  const isDisabled = disabled || isLoading;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={isDisabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {isLoading
              ? "Carregando..."
              : selected
                ? selected.label
                : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {clearable && selected && !isDisabled && (
              <X
                className="h-4 w-4 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Buscar área..." />
          <CommandList>
            <CommandEmpty>Nenhuma área encontrada.</CommandEmpty>
            <CommandGroup>
              {areas.map((a) => {
                const optValue = valueKey === "slug" ? a.slug : a.label;
                const isSelected = optValue === value;
                return (
                  <CommandItem
                    key={a.id}
                    value={`${a.label} ${a.slug}`}
                    onSelect={() => {
                      onChange(optValue);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {a.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
