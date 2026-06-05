import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { useMarketingTaskColumns, MarketingTaskColumn } from "@/hooks/useMarketingTaskColumns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PRESET_COLORS = ["#94a3b8", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#14b8a6"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarketingColumnsManagerDialog({ open, onOpenChange }: Props) {
  const { columns, createColumn, updateColumn, deleteColumn, reorderColumns } = useMarketingTaskColumns();
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [confirmDelete, setConfirmDelete] = useState<MarketingTaskColumn | null>(null);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createColumn.mutateAsync({ title: newTitle.trim(), color: newColor });
    setNewTitle("");
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= columns.length) return;
    const reordered = [...columns];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    reorderColumns.mutate(reordered.map((c, i) => ({ id: c.id, display_order: i })));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Etapas do Kanban</DialogTitle>
            <DialogDescription>
              Crie, renomeie, reordene ou exclua as colunas do quadro de tarefas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {columns.map((col, idx) => (
              <div key={col.id} className="flex items-center gap-2 p-2 border rounded-md bg-card">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <input
                  type="color"
                  value={col.color}
                  onChange={(e) => updateColumn.mutate({ id: col.id, color: e.target.value })}
                  className="h-8 w-8 rounded cursor-pointer border bg-transparent"
                  title="Cor"
                />
                <Input
                  value={col.title}
                  onChange={(e) => updateColumn.mutate({ id: col.id, title: e.target.value })}
                  className="flex-1"
                />
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Checkbox
                    id={`done-${col.id}`}
                    checked={col.is_done}
                    onCheckedChange={(v) => updateColumn.mutate({ id: col.id, is_done: !!v })}
                  />
                  <label htmlFor={`done-${col.id}`} className="cursor-pointer select-none">Concluído</label>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(idx, -1)} disabled={idx === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(idx, 1)} disabled={idx === columns.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => setConfirmDelete(col)}
                  disabled={columns.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="border-t pt-3 mt-2 space-y-2">
              <Label className="text-sm">Nova etapa</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="h-9 w-9 rounded cursor-pointer border bg-transparent"
                />
                <Input
                  placeholder="Ex: Em revisão"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <Button onClick={handleCreate} disabled={!newTitle.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etapa "{confirmDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              As tarefas nesta etapa não serão excluídas — elas voltarão para "sem etapa" e
              aparecerão na primeira coluna. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={async () => {
                if (confirmDelete) {
                  await deleteColumn.mutateAsync(confirmDelete.id);
                  setConfirmDelete(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
