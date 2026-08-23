import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Department } from "../types";
import { sectors, SectorId } from "@/config/sectors";

interface DepartmentForm {
  name: string;
  description: string;
  color: string;
  auto_distribution: boolean;
  sector_id: string;
}

interface ZappDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingDepartment: Department | null;
  form: DepartmentForm;
  onFormChange: (form: DepartmentForm) => void;
  onSave: () => void;
  saving: boolean;
  // Delete confirmation
  deletingId: string | null;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
}

export const ZappDepartmentDialog = memo(function ZappDepartmentDialog({
  open,
  onOpenChange,
  editingDepartment,
  form,
  onFormChange,
  onSave,
  saving,
  deletingId,
  onDeleteConfirm,
  onDeleteCancel,
}: ZappDepartmentDialogProps) {
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-zapp-input border-zapp-border text-zapp-text">
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? "Editar Departamento" : "Novo Departamento"}
            </DialogTitle>
            <DialogDescription className="text-zapp-text-muted">
              Departamentos organizam as conversas por área
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dept-name" className="text-zapp-text-muted">Nome</Label>
              <Input
                id="dept-name"
                value={form.name}
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                placeholder="Ex: Vendas, Suporte"
                className="bg-zapp-panel border-zapp-border text-zapp-text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-description" className="text-zapp-text-muted">Descrição</Label>
              <Textarea
                id="dept-description"
                value={form.description}
                onChange={(e) => onFormChange({ ...form, description: e.target.value })}
                placeholder="Descreva a função"
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
            <div className="space-y-2">
              <Label className="text-zapp-text-muted">Setor Vinculado</Label>
              <Select
                value={form.sector_id}
                onValueChange={(value) => onFormChange({ ...form, sector_id: value === "none" ? "" : value })}
              >
                <SelectTrigger className="bg-zapp-panel border-zapp-border text-zapp-text">
                  <SelectValue placeholder="Selecione um setor (opcional)" />
                </SelectTrigger>
                <SelectContent className="bg-zapp-input border-zapp-border">
                  <SelectItem value="none" className="text-zapp-text-muted">Nenhum setor</SelectItem>
                  {sectors.filter(s => !s.comingSoon).map((sector) => {
                    const Icon = sector.icon;
                    return (
                      <SelectItem key={sector.id} value={sector.id} className="text-zapp-text">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${sector.color}`} />
                          {sector.name}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-zapp-text-muted">Vincule este departamento a um setor do sistema</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-zapp-text">Distribuição Automática</Label>
                <p className="text-xs text-zapp-text-muted">Atribuir conversas automaticamente</p>
              </div>
              <Switch
                checked={form.auto_distribution}
                onCheckedChange={(checked) => onFormChange({ ...form, auto_distribution: checked })}
                className="data-[state=checked]:bg-zapp-accent"
              />
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
            <AlertDialogTitle className="text-zapp-text">Excluir departamento?</AlertDialogTitle>
            <AlertDialogDescription className="text-zapp-text-muted">
              Esta ação não pode ser desfeita.
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
