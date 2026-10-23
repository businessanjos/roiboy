import { useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { PlaybookItem } from "@/hooks/usePlaybook";

const TYPE_LABEL: Record<string, string> = {
  text: "texto",
  image: "imagem",
  video: "vídeo",
  audio: "áudio",
  document: "documento",
  list: "lista",
  template: "template",
};

interface Props {
  items: PlaybookItem[];
  value: string;
  onChange: (id: string) => void;
  onCreate: () => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Lista de mensagens do Playbook com barra de busca própria.
 * O popover é portalado para dentro do diálogo que o envolve, senão o
 * bloqueio de rolagem do diálogo impede rolar a lista no celular.
 */
export function PlaybookItemSelect({
  items, value, onChange, onCreate,
  placeholder = "Selecione uma mensagem", className, ariaLabel = "Mensagem do Playbook",
}: Props) {
  const [open, setOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = items.find((it) => it.id === value) || null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setPortalContainer(triggerRef.current?.closest<HTMLElement>('[role="dialog"]') ?? null);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          className={cn("justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="min-w-0 truncate text-left">{selected ? selected.name : placeholder}</span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        portalContainer={portalContainer}
        align="start"
        className="w-[min(520px,calc(100vw-1rem))] p-0"
      >
        <Command>
          <CommandInput placeholder="Buscar mensagem..." />
          <CommandList>
            <CommandEmpty>Nenhuma mensagem encontrada.</CommandEmpty>
            <CommandGroup>
              {items.map((it) => (
                <CommandItem
                  key={it.id}
                  value={it.id}
                  keywords={[it.name, TYPE_LABEL[it.content_type] || ""]}
                  onSelect={() => { onChange(it.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === it.id ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate">{it.name}</span>
                  {TYPE_LABEL[it.content_type] && (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">{TYPE_LABEL[it.content_type]}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <div className="border-t p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setOpen(false); onCreate(); }}
              >
                <Plus className="mr-2 h-4 w-4" /> Nova mensagem…
              </Button>
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
