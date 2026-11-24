import { useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowDownUp, ArrowUp, GitBranch, GripVertical, Loader2, Save } from "lucide-react";
import type { Pipeline } from "@/hooks/usePipelines";
import { movePipelineInOrder } from "@/lib/sales/pipelineOrder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface PipelineOrderDialogProps {
  pipelines: Pipeline[];
  activePipelineId: string | null;
  onClose: () => void;
  onSave: (ids: string[]) => Promise<boolean>;
}

// Mounted only while open: cancelling discards the draft, reopening starts from saved order.
export function PipelineOrderDialog({ pipelines, activePipelineId, onClose, onSave }: PipelineOrderDialogProps) {
  const [orderedIds, setOrderedIds] = useState(() => pipelines.map(pipeline => pipeline.id));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const changed = orderedIds.some((id, index) => id !== pipelines[index]?.id);
  const catalogueChanged = pipelines.length !== orderedIds.length || pipelines.some(pipeline => !orderedIds.includes(pipeline.id));
  const move = (id: string, offset: -1 | 1) => setOrderedIds(ids => movePipelineInOrder(ids, id, offset));
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (saving || !over || active.id === over.id) return;
    setOrderedIds(ids => {
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      return from < 0 || to < 0 ? ids : arrayMove(ids, from, to);
    });
  };
  const save = async () => {
    if (saving || !changed || catalogueChanged) return;
    setSaving(true);
    setSaveError(false);
    try {
      if (await onSave(orderedIds)) onClose();
      else setSaveError(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
      <DialogContent className="flex max-h-[86dvh] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-lg p-0">
        <DialogHeader className="shrink-0 border-b p-5 pr-16 text-left">
          <DialogTitle className="flex items-center gap-2 tracking-normal"><ArrowDownUp className="h-5 w-5 text-primary" />Reorganizar funis</DialogTitle>
          <DialogDescription>{pipelines.length} funis</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[({ transform }) => ({ ...transform, x: 0 })]} accessibility={{
            screenReaderInstructions: { draggable: "Pressione espaço para mover o funil, use as setas e pressione espaço para confirmar. Escape cancela." },
            announcements: {
              onDragStart: ({ active }) => `Movendo ${pipelines.find(pipeline => pipeline.id === active.id)?.name || "funil"}.`,
              onDragOver: ({ over }) => over ? `Posição ${orderedIds.indexOf(String(over.id)) + 1}.` : undefined,
              onDragEnd: ({ over }) => over ? `Funil colocado na posição ${orderedIds.indexOf(String(over.id)) + 1}.` : "Movimentação cancelada.",
              onDragCancel: () => "Movimentação cancelada.",
            },
          }}>
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
              <ol aria-label="Ordem dos funis" className="divide-y divide-border/60">
                {orderedIds.map((id, index) => {
                  const pipeline = pipelines.find(item => item.id === id);
                  if (!pipeline) return null;
                  return <PipelineOrderRow key={id} pipeline={pipeline} index={index} total={orderedIds.length} active={id === activePipelineId} disabled={saving || catalogueChanged} onMove={offset => move(id, offset)} />;
                })}
              </ol>
            </SortableContext>
          </DndContext>
        </div>
        {(saveError || catalogueChanged) && <p role="alert" className="shrink-0 px-5 pb-3 text-sm text-destructive">{catalogueChanged ? "A lista de funis mudou. Feche e abra novamente." : "A ordem não foi salva por completo. Confira a lista e tente novamente."}</p>}
        <DialogFooter className="shrink-0 flex-row justify-end gap-2 border-t bg-muted/20 p-4 sm:space-x-0">
          <Button variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button>
          <Button className="gap-2" disabled={!changed || saving || catalogueChanged} onClick={save}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "Salvando…" : "Salvar ordem"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PipelineOrderRow({ pipeline, index, total, active, disabled, onMove }: { pipeline: Pipeline; index: number; total: number; active: boolean; disabled: boolean; onMove: (offset: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: pipeline.id, disabled });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("relative grid h-16 grid-cols-[40px_24px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1", isDragging && "z-10 bg-accent shadow-md")}>
      <Button ref={setActivatorNodeRef} variant="ghost" size="icon" className="h-11 w-10 touch-none cursor-grab text-muted-foreground active:cursor-grabbing" disabled={disabled} {...attributes} {...listeners} aria-label={`Arrastar ${pipeline.name}`} title={`Arrastar ${pipeline.name}`}><GripVertical className="h-4 w-4" /></Button>
      <span className="text-center text-xs tabular-nums text-muted-foreground">{index + 1}</span>
      <div className="min-w-0">
        <span className="flex min-w-0 items-center gap-2"><GitBranch className="h-4 w-4 shrink-0 text-primary" /><span className="truncate text-sm font-medium" title={pipeline.name}>{pipeline.name}</span></span>
        {active && <span className="ml-6 text-xs text-muted-foreground">Atual</span>}
      </div>
      <div className="flex items-center">
        <Button variant="ghost" size="icon" className="h-11 w-9 text-muted-foreground" disabled={disabled || index === 0} onClick={() => onMove(-1)} aria-label={`Subir ${pipeline.name}`} title="Subir"><ArrowUp className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-11 w-9 text-muted-foreground" disabled={disabled || index === total - 1} onClick={() => onMove(1)} aria-label={`Descer ${pipeline.name}`} title="Descer"><ArrowDown className="h-4 w-4" /></Button>
      </div>
    </li>
  );
}