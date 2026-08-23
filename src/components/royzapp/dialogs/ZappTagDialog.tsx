import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ZappTag } from "../types";

interface TagForm {
  name: string;
  description: string;
  color: string;
}

interface ZappTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTag: ZappTag | null;
  form: TagForm;
  onFormChange: (form: TagForm) => void;
  onSave: () => void;
  saving: boolean;
  // Delete confirmation
  deletingId: string | null;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
}

export const ZappTagDialog = memo(function ZappTagDialog({
  open,
  onOpenChange,
  editingTag,
  form,
  onFormChange,
  onSave,
  saving,
  deletingId,
  onDeleteConfirm,
  onDeleteCancel,
}: ZappTagDialogProps) {
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-zapp-input border-zapp-border text-zapp-text">
          <DialogHeader>
            <DialogTitle>
              {editingTag ? "Editar Tag" : "Nova Tag"}
            </DialogTitle>
            <DialogDescription className="text-zapp-text-muted">
              Tags ajudam a organizar suas conversas
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name" className="text-zapp-text-muted">Nome</Label>
              <Input
                id="tag-name"
                value={form.name}
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                placeholder="Ex: Urgente, VIP, Suporte"
                className="bg-zapp-panel border-zapp-border text-zapp-text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag-description" className="text-zapp-text-muted">Descrição</Label>
              <Textarea
                id="tag-description"
                value={form.description}
                onChange={(e) => onFormChange({ ...form, description: e.target.value })}
                placeholder="Descrição opcional"
                rows={2}
                className="bg-zapp-panel border-zapp-border text-zapp-text"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zapp-text-muted">Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => onFormChange({ ...form, color: e.target.value })}
                  className="h-10 w-10 rounded border-0 cursor-pointer"
                />
                <Input
                  value={form.color}
                  onChange={(e) => onFormChange({ ...form, color: e.target.value })}
                  className="flex-1 bg-zapp-panel border-zapp-border text-zapp-text"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-zapp-border text-zapp-text-muted">
              Cancelar
            </Button>
            <Button onClick={onSave} disabled={saving} className="bg-zapp-accent hover:bg-zapp-accent/90">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && onDeleteCancel()}>
        <AlertDialogContent className="bg-zapp-input border-zapp-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zapp-text">Excluir tag?</AlertDialogTitle>
            <AlertDialogDescription className="text-zapp-text-muted">
              A tag será removida de todas as conversas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zapp-border text-zapp-text-muted">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger"
              onClick={() => deletingId && onDeleteConfirm(deletingId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
