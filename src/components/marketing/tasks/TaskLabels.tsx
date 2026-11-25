import { useId, useState } from "react";
import { ArrowLeft, Check, Loader2, Pencil, Plus, Search, Tags, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { labelColor, labelKey, type TaskLabel, type TaskLabelColor } from "@/lib/marketing/taskDetails";
import { cleanTaskLabel, mergeTaskLabelCatalog } from "@/lib/marketing/taskLabelCatalog";
import { normalizeTaskLabelHex, TASK_LABEL_PALETTE } from "@/lib/marketing/taskLabelColors";

export function TaskLabelBadge({ label }: { label: TaskLabel }) {
  const appearance = labelColor(label.color);
  return <Badge variant="outline" title={label.name} style={appearance.style} className={cn("task-label-custom-color min-h-5 max-w-full gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium leading-4", appearance.badge)}>
    <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", appearance.swatch)} />
    <span className="min-w-0 truncate">{label.name}</span>
  </Badge>;
}

interface TaskLabelPickerProps {
  catalog: TaskLabel[];
  selected: string[];
  onToggle: (label: TaskLabel) => void;
  onClear: () => void;
  onCreate?: (label: TaskLabel) => TaskLabel;
  onEdit?: (original: TaskLabel, updated: TaskLabel) => Promise<TaskLabel>;
  onDelete?: (label: TaskLabel) => Promise<void>;
  portalContainer?: HTMLElement | null;
  mode: "editor" | "filter";
  disabled?: boolean;
}

function TaskLabelPicker({ catalog, selected, onToggle, onClear, onCreate, onEdit, onDelete, portalContainer, mode, disabled }: TaskLabelPickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TaskLabel | null>(null);
  const [deleting, setDeleting] = useState<TaskLabel | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<TaskLabelColor>("blue");
  const [hexInput, setHexInput] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const options = catalog.filter((label) => labelKey(label.name).includes(labelKey(search)));
  const existing = catalog.find((label) => labelKey(label.name) === labelKey(name));
  const showForm = creating || editing !== null;
  const invalidHex = hexInput !== null && !normalizeTaskLabelHex(hexInput);
  const changeColor = (next: TaskLabelColor) => { setColor(next); setHexInput(null); setError(""); };
  const closeForm = () => { setCreating(false); setEditing(null); setDeleting(null); setHexInput(null); setError(""); };
  const deleteLabel = async () => {
    if (!deleting || !onDelete || saving) return;
    setSaving(true); setError("");
    try {
      await onDelete(deleting);
      closeForm(); setSearch(""); setName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir a etiqueta. Tente novamente.");
    } finally { setSaving(false); }
  };
  const createLabel = async () => {
    if (saving || invalidHex) return;
    try {
      if (editing && onEdit) {
        setSaving(true);
        await onEdit(editing, cleanTaskLabel({ name, color }));
        setSearch(""); closeForm(); setName("");
        return;
      }
      const label = existing ?? (onCreate ? onCreate(cleanTaskLabel({ name, color })) : cleanTaskLabel({ name, color }));
      if (mode === "editor" && !selected.includes(labelKey(label.name))) onToggle(label);
      setSearch(""); setCreating(false); setName(""); setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a etiqueta.");
    } finally { setSaving(false); }
  };
  return <Popover open={open} onOpenChange={(next) => { if (saving) return; setOpen(next); if (!next) { closeForm(); setSearch(""); } }}>
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
      align="end" collisionBoundary={portalContainer ?? undefined} collisionPadding={12}
      className="flex max-h-[min(520px,var(--radix-popover-content-available-height))] w-[336px] max-w-[min(calc(100vw-1.5rem),var(--radix-popover-content-available-width))] flex-col overflow-hidden p-0">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
        {showForm ? <Button type="button" variant="ghost" size="icon" disabled={saving} aria-label="Voltar às etiquetas" className="h-11 w-11 md:h-7 md:w-7" onClick={() => { if (deleting) { setDeleting(null); setError(""); } else closeForm(); }}><ArrowLeft className="h-3.5 w-3.5" /></Button> : <Tags className="ml-1 h-4 w-4 text-muted-foreground" />}
        <h4 className="min-w-0 flex-1 text-sm font-semibold tracking-normal">{deleting ? "Excluir etiqueta?" : editing ? "Editar etiqueta" : creating ? "Nova etiqueta" : "Etiquetas"}</h4>
        {!showForm && selected.length > 0 && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{selected.length} selecionada{selected.length > 1 ? "s" : ""}</span>}
        <Button type="button" variant="ghost" size="icon" disabled={saving} aria-label="Fechar etiquetas" className="h-11 w-11 shrink-0 md:h-7 md:w-7 text-muted-foreground" onClick={() => { setOpen(false); closeForm(); }}><X className="h-3.5 w-3.5" /></Button>
      </div>
      {deleting ? <div role="alert" className="min-h-0 space-y-4 overflow-y-auto p-4">
        <TaskLabelBadge label={deleting} />
        <p className="text-sm text-muted-foreground">Esta etiqueta será removida da lista e de todas as tarefas que a usam. As tarefas e as outras etiquetas serão mantidas.</p>
        <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita.</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div> : showForm ? <div className="min-h-0 space-y-4 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <Label htmlFor={id} className="text-xs text-muted-foreground">Nome da etiqueta</Label>
          <Input id={id} value={name} disabled={saving} autoFocus maxLength={60} className="text-base md:text-sm" placeholder="Nome da etiqueta" aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => { setName(event.target.value); setError(""); }}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); createLabel(); } }} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Cor</p>
          <div role="radiogroup" aria-label="Cor da etiqueta" className="grid grid-cols-6 gap-1">
            {TASK_LABEL_PALETTE.map((option) => <Tooltip key={option.value}><TooltipTrigger asChild>
              <Button type="button" variant="ghost" disabled={saving} role="radio" aria-checked={color === option.value} aria-label={option.name}
                className={cn("h-10 w-full p-2 md:h-9", color === option.value && "bg-muted ring-1 ring-ring ring-inset")}
                onClick={() => changeColor(option.value)}>
                <span style={labelColor(option.value).style} className={cn("task-label-custom-color h-6 w-6 rounded-full ring-1 ring-border", labelColor(option.value).swatch)} />
              </Button>
            </TooltipTrigger><TooltipContent>{option.name}</TooltipContent></Tooltip>)}
          </div>
          <div className="space-y-2 border-t pt-3">
            <Label htmlFor={`${id}-hex`} className="text-xs text-muted-foreground">Cor personalizada</Label>
            <div className="flex items-center gap-2">
              <Input type="color" aria-label="Escolher cor personalizada" value={labelColor(color).hex} disabled={saving} className="h-10 w-11 shrink-0 cursor-pointer p-1.5" onChange={event => changeColor(labelColor(event.target.value).value)} />
              <Input id={`${id}-hex`} aria-label="Código da cor personalizada" value={hexInput ?? labelColor(color).hex.toUpperCase()} disabled={saving} spellCheck={false} autoComplete="off" maxLength={7} className="h-10 min-w-0 font-mono text-base uppercase md:text-sm" aria-invalid={!!invalidHex} aria-describedby={invalidHex ? `${id}-hex-error` : undefined}
                onChange={event => { const text = event.target.value; setHexInput(text); const hex = normalizeTaskLabelHex(text); if (hex) setColor(hex); }}
                onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); createLabel(); } }} />
            </div>
            {invalidHex && <p id={`${id}-hex-error`} role="alert" className="text-xs text-destructive">Informe uma cor como #2563EB.</p>}
          </div>
        </div>
        {name.trim() && <div className="flex min-h-8 min-w-0 items-center"><TaskLabelBadge label={editing ? { name: name.trim(), color } : existing ?? { name: name.trim(), color }} /></div>}
        {editing && <p className="text-xs text-muted-foreground">A alteração será aplicada a todas as tarefas que usam esta etiqueta.</p>}
        {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
      </div> : <>
        <div className="relative mx-3 mb-1 mt-3 shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar etiquetas" autoFocus placeholder="Buscar etiquetas..." value={search} className="h-9 pl-9 pr-8" onChange={(event) => setSearch(event.target.value)} />
          {search && <Button type="button" variant="ghost" size="icon" aria-label="Limpar busca de etiquetas" className="absolute right-0 top-0 h-9 w-8" onClick={() => setSearch("")}><X className="h-3 w-3" /></Button>}
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-2 py-2">
          {options.map((label) => <div key={labelKey(label.name)} className={cn("group flex min-h-11 min-w-0 items-center rounded transition-colors hover:bg-muted", selected.includes(labelKey(label.name)) && "bg-muted/60")}>
            <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-2 py-1.5">
            <Checkbox aria-label={`${mode === "filter" ? "Filtrar" : "Selecionar"} etiqueta ${label.name}`} checked={selected.includes(labelKey(label.name))} onCheckedChange={() => onToggle(label)} />
            <span className="min-w-0 flex-1"><TaskLabelBadge label={label} /></span>
            </label>
            {onEdit && <Tooltip><TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="mr-1 h-11 w-11 shrink-0 text-muted-foreground/60 hover:text-foreground md:h-7 md:w-7 md:opacity-50 md:group-hover:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none [&_svg]:size-3" aria-label={`Editar etiqueta ${label.name}`} disabled={disabled}
                onClick={() => { setEditing(label); setCreating(false); setName(label.name); changeColor(label.color); }}><Pencil className="h-3 w-3" strokeWidth={1.5} /></Button>
            </TooltipTrigger><TooltipContent>Editar nome e cor</TooltipContent></Tooltip>}
          </div>)}
          {!options.length && <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-muted-foreground">
            <Tags className="h-6 w-6 opacity-60" />
            <p className="text-xs">{catalog.length ? "Nenhuma etiqueta encontrada" : "Nenhuma etiqueta ainda"}</p>
          </div>
          }
        </div>
      </>}
      {editing && onDelete && !deleting && <div className="shrink-0 border-t px-3 py-1.5">
        <Button type="button" variant="ghost" size="sm" className="h-11 w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive md:h-9" disabled={saving} aria-label={`Excluir etiqueta ${editing.name}`} onClick={() => { setDeleting(editing); setError(""); }}>
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />Excluir etiqueta
        </Button>
      </div>}
      <div className="mt-auto flex shrink-0 items-center gap-2 border-t p-3">
        {deleting ? <>
          <Button type="button" variant="ghost" size="sm" className="h-11 md:h-9" disabled={saving} onClick={() => { setDeleting(null); setError(""); }}>Cancelar</Button>
          <Button type="button" variant="destructive" size="sm" className="ml-auto h-11 gap-1.5 md:h-9" disabled={saving} onClick={deleteLabel}>{saving ? <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}Excluir etiqueta</Button>
        </> : showForm ? <>
          <Button type="button" variant="ghost" size="sm" className="h-11 md:h-9" disabled={saving} onClick={closeForm}>Cancelar</Button>
          <Button type="button" size="sm" className="ml-auto h-11 gap-1.5 md:h-9" disabled={!name.trim() || saving || !!invalidHex} onClick={createLabel}>{saving ? <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" /> : editing || existing ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{editing ? "Salvar etiqueta" : existing ? "Usar etiqueta" : "Criar etiqueta"}</Button>
        </> : <>
          <Button type="button" variant="ghost" size="sm" className="min-w-0 flex-1 justify-start gap-2 text-sm" onClick={() => { setName(search.trim().slice(0, 60)); changeColor("blue"); setCreating(true); }}><Plus className="h-3.5 w-3.5" />Criar etiqueta</Button>
          {selected.length > 0 && <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Limpar etiquetas" onClick={onClear}><X className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Limpar etiquetas</TooltipContent></Tooltip>}
        </>}
      </div>
    </PopoverContent>
  </Popover>;
}

export function TaskLabelEditor({ value, onChange, catalog, portalContainer, onCreate, onEdit, onDelete, disabled }: {
  value: TaskLabel[]; onChange: (labels: TaskLabel[]) => void; catalog: TaskLabel[];
  portalContainer: HTMLElement | null; onCreate?: (label: TaskLabel) => TaskLabel; onEdit?: (original: TaskLabel, input: TaskLabel) => Promise<TaskLabel>; onDelete?: (label: TaskLabel) => Promise<void>; disabled?: boolean;
}) {
  const choices = mergeTaskLabelCatalog(catalog, value);
  const edit = async (original: TaskLabel, input: TaskLabel) => {
    if (!onEdit) throw new Error("A edição de etiquetas não está disponível.");
    const label = await onEdit(original, input);
    if (value.some(item => labelKey(item.name) === labelKey(original.name))) onChange(value.map(item => labelKey(item.name) === labelKey(original.name) ? label : item));
    return label;
  };
  const toggle = (label: TaskLabel) => onChange(value.some((item) => labelKey(item.name) === labelKey(label.name))
    ? value.filter((item) => labelKey(item.name) !== labelKey(label.name)) : [...value, label]);
  const remove = async (label: TaskLabel) => {
    if (!onDelete) return;
    await onDelete(label);
    if (value.some(item => labelKey(item.name) === labelKey(label.name))) onChange(value.filter(item => labelKey(item.name) !== labelKey(label.name)));
  };
  return <div className="space-y-2">
    <Label className="flex items-center gap-2 text-xs text-muted-foreground"><Tags className="h-3.5 w-3.5" />Etiquetas</Label>
    {value.length > 0 && <div className="flex flex-wrap gap-1.5">
      {value.map((label) => <div key={labelKey(label.name)} style={labelColor(label.color).style} className={cn("task-label-custom-color inline-flex max-w-full items-center gap-1.5 rounded py-0.5 pl-2 pr-0.5 text-xs", labelColor(label.color).badge)}>
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", labelColor(label.color).swatch)} />
        <span className="min-w-0 truncate" title={label.name}>{label.name}</span>
        <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Remover etiqueta ${label.name}`} className="h-6 w-6 shrink-0 text-current hover:text-current" onClick={() => toggle(label)}><X className="h-3 w-3" /></Button></TooltipTrigger><TooltipContent>Remover etiqueta</TooltipContent></Tooltip>
      </div>)}
    </div>}
    <TaskLabelPicker mode="editor" catalog={choices} selected={value.map((label) => labelKey(label.name))} onToggle={toggle} onClear={() => onChange([])} onCreate={onCreate} onEdit={onEdit ? edit : undefined} onDelete={onDelete ? remove : undefined} portalContainer={portalContainer} disabled={disabled} />
  </div>;
}

export function TaskLabelFilter({ catalog, selected, onChange, onCreate, onEdit, onDelete }: {
  catalog: TaskLabel[]; selected: string[]; onChange: (selected: string[]) => void; onCreate: (label: TaskLabel) => TaskLabel; onEdit?: (original: TaskLabel, input: TaskLabel) => Promise<TaskLabel>; onDelete?: (label: TaskLabel) => Promise<void>;
}) {
  const edit = async (original: TaskLabel, input: TaskLabel) => {
    if (!onEdit) throw new Error("A edição de etiquetas não está disponível.");
    const label = await onEdit(original, input);
    if (selected.some(key => labelKey(key) === labelKey(original.name))) onChange(selected.map(key => labelKey(key) === labelKey(original.name) ? labelKey(label.name) : key));
    return label;
  };
  const remove = async (label: TaskLabel) => {
    if (!onDelete) return;
    await onDelete(label);
    if (selected.some(key => labelKey(key) === labelKey(label.name))) onChange(selected.filter(key => labelKey(key) !== labelKey(label.name)));
  };
  return <TaskLabelPicker mode="filter" catalog={catalog} selected={selected.map(labelKey)} onCreate={onCreate} onClear={() => onChange([])}
    onEdit={onEdit ? edit : undefined}
    onDelete={onDelete ? remove : undefined}
    onToggle={(label) => { const key = labelKey(label.name); onChange(selected.some((item) => labelKey(item) === key) ? selected.filter((item) => labelKey(item) !== key) : [...selected, key]); }} />;
}