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
        <DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef]">
          <DialogHeader>
            <DialogTitle>
              {editingTag ? "Editar Tag" : "Nova Tag"}
            </DialogTitle>
            <DialogDescription className="text-[#8696a0]">
              Tags ajudam a organizar suas conversas
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name" className="text-[#8696a0]">Nome</Label>
              <Input
                id="tag-name"
                value={form.name}
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                placeholder="Ex: Urgente, VIP, Suporte"
                className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag-description" className="text-[#8696a0]">Descrição</Label>
              <Textarea
                id="tag-description"
                value={form.description}
                onChange={(e) => onFormChange({ ...form, description: e.target.value })}
                placeholder="Descrição opcional"
                rows={2}
                className="bg-[#202c33] border-[#3b4a54] text-[#e9edef]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#8696a0]">Cor</Label>
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
                  className="flex-1 bg-[#202c33] border-[#3b4a54] text-[#e9edef]"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#3b4a54] text-[#8696a0]">
              Cancelar
            </Button>
            <Button onClick={onSave} disabled={saving} className="bg-[#00a884] hover:bg-[#00a884]/90">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && onDeleteCancel()}>
        <AlertDialogContent className="bg-[#2a3942] border-[#3b4a54]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#e9edef]">Excluir tag?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#8696a0]">
              A tag será removida de todas as conversas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#3b4a54] text-[#8696a0]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
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
