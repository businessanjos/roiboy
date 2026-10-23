import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, MessageSquare, Image as ImageIcon, Video, Mic, FileText, List, LayoutTemplate } from "lucide-react";
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

const TYPE_GROUPS: { key: string; title: string; types: string[]; Icon: typeof MessageSquare }[] = [
  { key: "text", title: "Mensagens", types: ["text", "link"], Icon: MessageSquare },
  { key: "document", title: "Documentos", types: ["document"], Icon: FileText },
  { key: "image", title: "Imagens", types: ["image", "sticker"], Icon: ImageIcon },
  { key: "video", title: "Vídeos", types: ["video"], Icon: Video },
  { key: "audio", title: "Áudios", types: ["audio"], Icon: Mic },
  { key: "list", title: "Listas", types: ["list"], Icon: List },
  { key: "template", title: "Templates", types: ["template"], Icon: LayoutTemplate },
];

/** Agrupa itens por bloco de tipo, mantendo a ordem original dentro de cada bloco. */
export function groupPlaybookItems<T extends { content_type: string }>(items: T[]) {
  const known = new Set(TYPE_GROUPS.flatMap((g) => g.types));
  const groups = TYPE_GROUPS.map((g) => ({ ...g, items: items.filter((it) => g.types.includes(it.content_type)) }));
  const others = items.filter((it) => !known.has(it.content_type));
  if (others.length) groups.push({ key: "other", title: "Outros", types: [], Icon: MessageSquare, items: others });
  return groups.filter((g) => g.items.length > 0);
}

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
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const groups = useMemo(() => groupPlaybookItems(items), [items]);
  const visibleGroups = typeFilter === "all" ? groups : groups.filter((g) => g.key === typeFilter);

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
        collisionPadding={8}
        className="flex w-[min(520px,calc(100vw-1rem))] max-h-[min(460px,var(--radix-popover-content-available-height))] flex-col overflow-hidden p-0"
      >
        <Command className="min-h-0 flex-1">
          <CommandInput placeholder="Buscar mensagem..." />
          {groups.length > 1 && (
            <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-1 border-b px-2 py-2">
              {[{ key: "all", title: "Todos", count: items.length }, ...groups.map((g) => ({ key: g.key, title: g.title, count: g.items.length }))].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={typeFilter === f.key}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setTypeFilter(f.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                    typeFilter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {f.title} <span className="opacity-70">{f.count}</span>
                </button>
              ))}
            </div>
          )}
          <CommandList className="max-h-none min-h-0 flex-1 overscroll-contain">
            <CommandEmpty>Nenhuma mensagem encontrada.</CommandEmpty>
            {visibleGroups.map((g) => (
              <CommandGroup
                key={g.key}
                heading={
                  <span className="flex items-center gap-1.5">
                    <g.Icon className="h-3.5 w-3.5" /> {g.title}
                    <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium">{g.items.length}</span>
                  </span> as unknown as string
                }
              >
                {g.items.map((it) => (
                  <CommandItem
                    key={it.id}
                    value={it.id}
                    keywords={[it.name, TYPE_LABEL[it.content_type] || "", g.title]}
                    onSelect={() => { onChange(it.id); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4 shrink-0", value === it.id ? "opacity-100" : "opacity-0")} />
                    <g.Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{it.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
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
