import { useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MarketingTask } from "@/hooks/useMarketingTasks";
import type { MarketingTaskColumn } from "@/hooks/useMarketingTaskColumns";
import type { TaskSeparator } from "@/lib/marketing/taskPresentation";
import { useMarketingTaskSeparators } from "@/hooks/useMarketingTaskSeparators";
import { cn } from "@/lib/utils";

export function TaskSeparatorItem({ separator, onEdit }: { separator: TaskSeparator; onEdit: () => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: `separator:${separator.id}` });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex items-center gap-2 px-1 py-3", isDragging && "opacity-40")}>
    <div {...attributes} {...listeners} aria-label={`Mover separador ${separator.title}`} className="shrink-0 cursor-grab text-muted-foreground"><GripVertical className="h-4 w-4" /></div>
    <span className="h-px min-w-2 flex-1 bg-border" />
    <Button variant="ghost" size="sm" onClick={onEdit} title="Editar separador" className="h-auto min-h-8 min-w-0 max-w-[75%] whitespace-normal break-words px-2 text-left text-xs font-semibold text-muted-foreground">{separator.title}</Button>
    <span className="h-px min-w-2 flex-1 bg-border" />
  </div>;
}
export function TaskSeparatorDialog({ open, onOpenChange, separator, defaultColumnId, columns, tasks }: {
  open: boolean; onOpenChange: (open: boolean) => void; separator?: TaskSeparator | null;
  defaultColumnId?: string; columns: MarketingTaskColumn[]; tasks: MarketingTask[];
}) {
  const { save, remove } = useMarketingTaskSeparators();
  const [title, setTitle] = useState("");
  const [columnId, setColumnId] = useState("");
  const [beforeId, setBeforeId] = useState("end");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = save.isPending || remove.isPending;
  useEffect(() => {
    if (!open) return;
    setTitle(separator?.title || "");
    setColumnId(separator?.column_id || defaultColumnId || columns[0]?.id || "");
    setBeforeId(separator?.before_task_id || "end");
    setConfirmDelete(false);
  }, [open, separator, defaultColumnId]);
  const stageTasks = tasks.filter((task) => task.column_id === columnId || (!task.column_id && columns[0]?.id === columnId));
  return <>
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent aria-describedby={undefined} className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b p-5"><DialogTitle>{separator ? "Editar separador" : "Novo separador"}</DialogTitle></DialogHeader>
        <form className="min-h-0 overflow-y-auto p-5 space-y-4" id="task-separator-form" onSubmit={async (event) => {
          event.preventDefault(); if (!title.trim() || !columnId || busy) return;
          try { await save.mutateAsync({ id: separator?.id, title: title.trim(), column_id: columnId, before_task_id: beforeId === "end" ? null : beforeId }); onOpenChange(false); } catch { /* Keep draft on failure. */ }
        }}>
          <div className="space-y-2"><Label htmlFor="separator-title">Título do separador</Label><Input id="separator-title" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus disabled={busy} /></div>
          <div className="space-y-2"><Label htmlFor="separator-stage">Etapa</Label><Select value={columnId} onValueChange={(value) => { setColumnId(value); setBeforeId("end"); }} disabled={busy}><SelectTrigger id="separator-stage"><SelectValue /></SelectTrigger><SelectContent>{columns.map((column) => <SelectItem key={column.id} value={column.id}>{column.title}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="separator-position">Posição</Label><Select value={beforeId} onValueChange={setBeforeId} disabled={busy}><SelectTrigger id="separator-position" className="[&>span]:truncate"><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="end">No fim da etapa</SelectItem>
            {stageTasks.map((task) => <SelectItem key={task.id} value={task.id}>Antes de {task.title}</SelectItem>)}
          </SelectContent></Select></div>
        </form>
        <div className="flex flex-wrap justify-between gap-2 border-t p-4">
          <div>{separator && <Button type="button" variant="ghost" size="icon" aria-label="Excluir separador" title="Excluir separador" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div>
          <div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancelar</Button><Button form="task-separator-form" type="submit" disabled={busy || !title.trim() || !columnId}>{save.isPending && <Loader2 className="h-4 w-4 motion-safe:animate-spin" />}Salvar separador</Button></div>
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmDelete} onOpenChange={(next) => { if (!busy) setConfirmDelete(next); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir separador “{separator?.title}”?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><Button variant="destructive" disabled={busy} onClick={async () => {
      if (!separator) return; try { await remove.mutateAsync(separator.id); setConfirmDelete(false); onOpenChange(false); } catch { /* Keep confirmation on failure. */ }
    }}>Excluir separador</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}