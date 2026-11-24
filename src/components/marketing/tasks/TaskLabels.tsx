import { useState } from "react";
import { Check, Plus, Tags, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { TASK_LABEL_COLORS, labelColor, labelKey, type TaskLabel, type TaskLabelColor } from "@/lib/marketing/taskDetails";

export function TaskLabelBadge({ label }: { label: TaskLabel }) {
  return <Badge variant="outline" className={cn("max-w-full rounded px-1.5 py-0.5 text-[11px] font-medium", labelColor(label.color).badge)}>
    <span className="truncate">{label.name}</span>
  </Badge>;
}

export function TaskLabelEditor({ value, onChange, catalog, portalContainer }: {
  value: TaskLabel[];
  onChange: (labels: TaskLabel[]) => void;
  catalog: TaskLabel[];
  portalContainer: HTMLElement | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<TaskLabelColor>("blue");
  const choices = catalog.filter((label) => !value.some((selected) => labelKey(selected.name) === labelKey(label.name)));
  const addLabel = () => {
    const cleaned = name.trim().replace(/\s+/g, " ");
    if (!cleaned) return;
    const next = { name: cleaned, color };
    onChange([...value.filter((label) => labelKey(label.name) !== labelKey(cleaned)), next]);
    setName("");
    setOpen(false);
  };
  return <div className="space-y-2">
    <Label>Etiquetas</Label>
    <div className="flex min-h-11 flex-wrap items-center gap-2">
      {value.map((label) => <Button key={labelKey(label.name)} type="button" variant="outline"
        className={cn("h-11 max-w-full gap-2 px-2", labelColor(label.color).badge)}
        aria-label={`Remover etiqueta ${label.name}`} onClick={() => onChange(value.filter((item) => labelKey(item.name) !== labelKey(label.name)))}>
        <span className="truncate">{label.name}</span><X className="h-3 w-3" />
      </Button>)}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button type="button" variant="outline" className="h-11 gap-2"><Plus />Etiqueta</Button></PopoverTrigger>
        <PopoverContent portalContainer={portalContainer} align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3">
          {choices.length > 0 && <div className="max-h-40 space-y-1 overflow-y-auto">
            {choices.map((label) => <Button key={labelKey(label.name)} type="button" variant="ghost" className="h-11 w-full justify-start"
              onClick={() => { onChange([...value, label]); setOpen(false); }}><TaskLabelBadge label={label} /></Button>)}
          </div>}
          <div className="space-y-2">
            <Label htmlFor="task-label-name">Nome da etiqueta</Label>
            <Input id="task-label-name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)}
              placeholder="Nova etiqueta" className="h-11" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addLabel(); } }} />
          </div>
          <div role="radiogroup" aria-label="Cor da etiqueta" className="flex flex-wrap gap-1">
            {TASK_LABEL_COLORS.map((option) => <Button key={option.value} type="button" variant="ghost" role="radio" aria-checked={color === option.value}
              aria-label={option.name} title={option.name} className={cn("h-11 w-11 p-2", color === option.value && "ring-2 ring-ring ring-inset")}
              onClick={() => setColor(option.value)}><span className={cn("flex h-6 w-6 items-center justify-center rounded", option.swatch)}>
                {color === option.value && <Check className="text-background" />}</span></Button>)}
          </div>
          <Button type="button" className="h-11 w-full" disabled={!name.trim()} onClick={addLabel}><Plus />Adicionar etiqueta</Button>
        </PopoverContent>
      </Popover>
    </div>
  </div>;
}

export function TaskLabelFilter({ catalog, selected, onChange }: {
  catalog: TaskLabel[]; selected: string[]; onChange: (selected: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const options = catalog.filter((label) => labelKey(label.name).includes(labelKey(search)));
  return <Popover>
    <PopoverTrigger asChild><Button variant={selected.length ? "secondary" : "outline"} className="h-11 gap-2" aria-label="Filtrar por etiquetas">
      <Tags />Etiquetas{selected.length > 0 && <Badge variant="secondary">{selected.length}</Badge>}
    </Button></PopoverTrigger>
    <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-3">
      <Input aria-label="Buscar etiquetas" placeholder="Buscar etiquetas..." value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="my-2 max-h-56 overflow-y-auto">
        {options.map((label) => <label key={labelKey(label.name)} className="flex h-11 cursor-pointer items-center gap-3 rounded px-2 hover:bg-muted">
          <Checkbox aria-label={`Filtrar etiqueta ${label.name}`} checked={selected.includes(labelKey(label.name))}
            onCheckedChange={(checked) => onChange(checked ? [...selected, labelKey(label.name)] : selected.filter((key) => key !== labelKey(label.name)))} />
          <TaskLabelBadge label={label} />
        </label>)}
        {!options.length && <p className="py-4 text-center text-sm text-muted-foreground">{catalog.length ? "Nenhuma etiqueta encontrada" : "Nenhuma etiqueta cadastrada"}</p>}
      </div>
      <div className="border-t pt-2"><Button variant="ghost" className="h-11 w-full" disabled={!selected.length} onClick={() => onChange([])}><X />Limpar etiquetas</Button></div>
    </PopoverContent>
  </Popover>;
}