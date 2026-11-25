import { useId, useState } from "react";
import { ArrowLeft, Check, Plus, Search, Tags, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TASK_LABEL_COLORS, labelColor, labelKey, type TaskLabel, type TaskLabelColor } from "@/lib/marketing/taskDetails";
import { cleanTaskLabel } from "@/lib/marketing/taskLabelCatalog";

export function TaskLabelBadge({ label }: { label: TaskLabel }) {
  return <Badge variant="outline" title={label.name} className={cn("min-h-5 max-w-full gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium leading-4", labelColor(label.color).badge)}>
    <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", labelColor(label.color).swatch)} />
    <span className="min-w-0 truncate">{label.name}</span>
  </Badge>;
}

interface TaskLabelPickerProps {
  catalog: TaskLabel[];
  selected: string[];
  onToggle: (label: TaskLabel) => void;
  onClear: () => void;
  onCreate?: (label: TaskLabel) => TaskLabel;
  portalContainer?: HTMLElement | null;
  mode: "editor" | "filter";
  disabled?: boolean;
}

function TaskLabelPicker({ catalog, selected, onToggle, onClear, onCreate, portalContainer, mode, disabled }: TaskLabelPickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<TaskLabelColor>("blue");
  const [error, setError] = useState("");
  const options = catalog.filter((label) => labelKey(label.name).includes(labelKey(search)));
  const existing = catalog.find((label) => labelKey(label.name) === labelKey(name));
  const createLabel = () => {
    try {
      const label = existing ?? (onCreate ? onCreate(cleanTaskLabel({ name, color })) : cleanTaskLabel({ name, color }));
      if (mode === "editor" && !selected.includes(labelKey(label.name))) onToggle(label);
      setSearch(""); setCreating(false); setName(""); setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a etiqueta.");
    }
  };
  return <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setCreating(false); setSearch(""); setError(""); } }}>
    <PopoverTrigger asChild>
      <Button type="button" disabled={disabled} variant={selected.length && mode === "filter" ? "secondary" : "outline"}
        className={cn("gap-2", mode === "filter" ? "h-9 px-3" : "h-9 w-full justify-start border-dashed text-muted-foreground")}
        aria-label={mode === "filter" ? "Filtrar por etiquetas" : "Selecionar etiquetas da tarefa"}>
        {mode === "filter" ? <Tags className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        {mode === "filter" ? "Etiquetas" : "Adicionar etiquetas"}
        {mode === "filter" && selected.length > 0 && <Badge variant="secondary" className="rounded px-1.5 py-0 text-[10px] tabular-nums">{selected.length}</Badge>}
      </Button>
    </PopoverTrigger>
    <PopoverContent aria-label={mode === "filter" ? "Etiquetas do filtro" : "Etiquetas da tarefa"} portalContainer={portalContainer}
      align={mode === "filter" ? "end" : "start"} collisionPadding={12}
      className="flex max-h-[min(520px,calc(100dvh-2rem))] w-[336px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden p-0">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
        {creating ? <Button type="button" variant="ghost" size="icon" aria-label="Voltar às etiquetas" className="h-7 w-7" onClick={() => { setCreating(false); setError(""); }}><ArrowLeft className="h-3.5 w-3.5" /></Button> : <Tags className="ml-1 h-4 w-4 text-muted-foreground" />}
        <h4 className="flex-1 text-sm font-semibold tracking-normal">{creating ? "Nova etiqueta" : "Etiquetas"}</h4>
        {!creating && selected.length > 0 && <span className="text-xs tabular-nums text-muted-foreground">{selected.length} selecionada{selected.length > 1 ? "s" : ""}</span>}
        <Button type="button" variant="ghost" size="icon" aria-label="Fechar etiquetas" className="h-7 w-7 text-muted-foreground" onClick={() => setOpen(false)}><X className="h-3.5 w-3.5" /></Button>
      </div>
      {creating ? <div className="min-h-0 space-y-4 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">Nome da etiqueta</Label>
          <Input id={id} value={name} autoFocus maxLength={60} placeholder="Nome da etiqueta" aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => { setName(event.target.value); setError(""); }}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); createLabel(); } }} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Cor</p>
          <div role="radiogroup" aria-label="Cor da etiqueta" className="flex flex-wrap gap-1">
            {TASK_LABEL_COLORS.map((option) => <Tooltip key={option.value}><TooltipTrigger asChild>
              <Button type="button" variant="ghost" role="radio" aria-checked={color === option.value} aria-label={option.name}
                className={cn("h-10 w-10 p-2", color === option.value && "bg-muted ring-1 ring-ring ring-inset")}
                onClick={() => setColor(option.value)}>
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full", option.swatch)}>
                  {color === option.value && <Check className="h-3.5 w-3.5 text-background" />}
                </span>
              </Button>
            </TooltipTrigger><TooltipContent>{option.name}</TooltipContent></Tooltip>)}
          </div>
        </div>
        {name.trim() && <div className="flex min-h-8 min-w-0 items-center"><TaskLabelBadge label={existing ?? { name: name.trim(), color }} /></div>}
        {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
      </div> : <>
        <div className="relative mx-3 mb-1 mt-3 shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar etiquetas" autoFocus placeholder="Buscar etiquetas..." value={search} className="h-9 pl-9 pr-8" onChange={(event) => setSearch(event.target.value)} />
          {search && <Button type="button" variant="ghost" size="icon" aria-label="Limpar busca de etiquetas" className="absolute right-0 top-0 h-9 w-8" onClick={() => setSearch("")}><X className="h-3 w-3" /></Button>}
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-2 py-2">
          {options.map((label) => <label key={labelKey(label.name)} className={cn("flex min-h-10 cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 transition-colors hover:bg-muted", selected.includes(labelKey(label.name)) && "bg-muted/60")}>
            <Checkbox aria-label={`${mode === "filter" ? "Filtrar" : "Selecionar"} etiqueta ${label.name}`} checked={selected.includes(labelKey(label.name))} onCheckedChange={() => onToggle(label)} />
            <TaskLabelBadge label={label} />
          </label>)}
          {!options.length && <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-muted-foreground">
            <Tags className="h-6 w-6 opacity-60" />
            <p className="text-xs">{catalog.length ? "Nenhuma etiqueta encontrada" : "Nenhuma etiqueta ainda"}</p>
          </div>
          }
        </div>
      </>}
      <div className="mt-auto flex shrink-0 items-center gap-2 border-t p-3">
        {creating ? <>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setCreating(false); setError(""); }}>Cancelar</Button>
          <Button type="button" size="sm" className="ml-auto gap-1.5" disabled={!name.trim()} onClick={createLabel}>{existing ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{existing ? "Usar etiqueta" : "Criar etiqueta"}</Button>
        </> : <>
          <Button type="button" variant="ghost" size="sm" className="min-w-0 flex-1 justify-start gap-2 text-sm" onClick={() => { setName(search.trim().slice(0, 60)); setColor("blue"); setCreating(true); setError(""); }}><Plus className="h-3.5 w-3.5" />Criar etiqueta</Button>
          {selected.length > 0 && <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Limpar etiquetas" onClick={onClear}><X className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Limpar etiquetas</TooltipContent></Tooltip>}
        </>}
      </div>
    </PopoverContent>
  </Popover>;
}

export function TaskLabelEditor({ value, onChange, catalog, portalContainer, onCreate, disabled }: {
  value: TaskLabel[]; onChange: (labels: TaskLabel[]) => void; catalog: TaskLabel[];
  portalContainer: HTMLElement | null; onCreate?: (label: TaskLabel) => TaskLabel; disabled?: boolean;
}) {
  const choices = [...catalog, ...value.filter((label) => !catalog.some((item) => labelKey(item.name) === labelKey(label.name)))];
  const toggle = (label: TaskLabel) => onChange(value.some((item) => labelKey(item.name) === labelKey(label.name))
    ? value.filter((item) => labelKey(item.name) !== labelKey(label.name)) : [...value, label]);
  return <div className="space-y-2">
    <Label className="flex items-center gap-2 text-xs text-muted-foreground"><Tags className="h-3.5 w-3.5" />Etiquetas</Label>
    {value.length > 0 && <div className="flex flex-wrap gap-1.5">
      {value.map((label) => <div key={labelKey(label.name)} className={cn("inline-flex max-w-full items-center gap-1.5 rounded py-0.5 pl-2 pr-0.5 text-xs", labelColor(label.color).badge)}>
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", labelColor(label.color).swatch)} />
        <span className="min-w-0 truncate" title={label.name}>{label.name}</span>
        <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Remover etiqueta ${label.name}`} className="h-6 w-6 shrink-0 text-current hover:text-current" onClick={() => toggle(label)}><X className="h-3 w-3" /></Button></TooltipTrigger><TooltipContent>Remover etiqueta</TooltipContent></Tooltip>
      </div>)}
    </div>}
    <TaskLabelPicker mode="editor" catalog={choices} selected={value.map((label) => labelKey(label.name))} onToggle={toggle} onClear={() => onChange([])} onCreate={onCreate} portalContainer={portalContainer} disabled={disabled} />
  </div>;
}

export function TaskLabelFilter({ catalog, selected, onChange, onCreate }: {
  catalog: TaskLabel[]; selected: string[]; onChange: (selected: string[]) => void; onCreate: (label: TaskLabel) => TaskLabel;
}) {
  return <TaskLabelPicker mode="filter" catalog={catalog} selected={selected.map(labelKey)} onCreate={onCreate} onClear={() => onChange([])}
    onToggle={(label) => { const key = labelKey(label.name); onChange(selected.some((item) => labelKey(item) === key) ? selected.filter((item) => labelKey(item) !== key) : [...selected, key]); }} />;
}