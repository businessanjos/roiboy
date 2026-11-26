import { useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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

interface Props {
  /** Comma-separated labels (e.g. "Botox, Laser") */
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function parse(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Multi-select de Áreas de Atuação (public.practice_areas).
 * Armazena as áreas selecionadas como string separada por vírgulas
 * para manter compatibilidade com colunas TEXT existentes (ex.: clients.business_niche).
 */
export function PracticeAreaMultiSelect({
  value,
  onChange,
  placeholder = "Selecione as áreas de atuação",
  disabled,
  className,
}: Props) {
  const { data: areas = [], isLoading } = usePracticeAreas();
  const [open, setOpen] = useState(false);
  const selected = parse(value);

  const toggle = (label: string) => {
    const set = new Set(selected);
    if (set.has(label)) set.delete(label);
    else set.add(label);
    // Preserve practice_areas sort_order for known items; append unknowns.
    const order = areas.map((a) => a.label);
    const ordered = [
      ...order.filter((l) => set.has(l)),
      ...Array.from(set).filter((l) => !order.includes(l)),
    ];
    onChange(ordered.join(", "));
  };

  // Áreas já gravadas no cliente que não estão no catálogo: continuam visíveis
  // na lista para poderem ser desmarcadas.
  const knownLabels = new Set(areas.map((a) => a.label));
  const extras = isLoading ? [] : selected.filter((l) => !knownLabels.has(l));

  // Os controles ficam dentro do botão que abre a lista: o clique não pode subir.
  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const actionProps = (label: string, run: () => void) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    title: label,
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onClick: (e: React.MouseEvent) => {
      stop(e);
      run();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      stop(e);
      run();
    },
  });

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
            "w-full justify-between font-normal min-h-10 h-auto py-1.5",
            selected.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <div className="flex flex-wrap gap-1 items-center">
            {isLoading ? (
              <span>Carregando...</span>
            ) : selected.length === 0 ? (
              <span>{placeholder}</span>
            ) : (
              selected.map((l) => (
                <Badge key={l} variant="secondary" className="text-xs gap-1 pr-1">
                  {l}
                  {!isDisabled && (
                    <span
                      {...actionProps(`Remover ${l}`, () => toggle(l))}
                      className="pointer-events-auto inline-flex h-4 w-4 items-center justify-center rounded-full opacity-60 hover:opacity-100 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </Badge>
              ))
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {selected.length > 0 && !isDisabled && (
              <span
                {...actionProps("Limpar áreas de atuação", () => onChange(""))}
                className="pointer-events-auto inline-flex h-5 w-5 items-center justify-center rounded-full opacity-60 hover:opacity-100 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </span>
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
            {extras.length > 0 && (
              <CommandGroup heading="Fora da lista oficial">
                {extras.map((l) => (
                  <CommandItem key={`extra-${l}`} value={l} onSelect={() => toggle(l)}>
                    <Checkbox checked className="mr-2 pointer-events-none" tabIndex={-1} />
                    {l}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup>
              {areas.map((a) => {
                const isSelected = selected.includes(a.label);
                return (
                  <CommandItem
                    key={a.id}
                    value={`${a.label} ${a.slug}`}
                    onSelect={() => toggle(a.label)}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="mr-2 pointer-events-none"
                      tabIndex={-1}
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
