import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Agent, Department } from "../types";

interface AgentForm {
  user_id: string;
  department_id: string;
  max_concurrent_chats: number;
}

interface ZappAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAgent: Agent | null;
  form: AgentForm;
  onFormChange: (form: AgentForm) => void;
  onSave: () => void;
  saving: boolean;
  availableUsers: { id: string; name: string }[];
  departments: Department[];
  // Delete confirmation
  deletingId: string | null;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
}

export const ZappAgentDialog = memo(function ZappAgentDialog({
  open,
  onOpenChange,
  editingAgent,
  form,
  onFormChange,
  onSave,
  saving,
  availableUsers,
  departments,
  deletingId,
  onDeleteConfirm,
  onDeleteCancel,
}: ZappAgentDialogProps) {
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-zapp-input border-zapp-border text-zapp-text">
          <DialogHeader>
            <DialogTitle>
              {editingAgent ? "Editar Atendente" : "Adicionar Atendente"}
            </DialogTitle>
            <DialogDescription className="text-zapp-text-muted">
              Configure as permissões do atendente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-zapp-text-muted">Usuário</Label>
              <Select
                value={form.user_id}
                onValueChange={(value) => onFormChange({ ...form, user_id: value })}
                disabled={!!editingAgent}
              >
                <SelectTrigger className="bg-zapp-panel border-zapp-border text-zapp-text">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-zapp-hover border-zapp-border">
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id} className="text-zapp-text">
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-zapp-text-muted">Departamento</Label>
              <Select
                value={form.department_id || "all"}
                onValueChange={(value) => onFormChange({ ...form, department_id: value === "all" ? "" : value })}
              >
                <SelectTrigger className="bg-zapp-panel border-zapp-border text-zapp-text">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="bg-zapp-hover border-zapp-border">
                  <SelectItem value="all" className="text-zapp-text">Todos</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id} className="text-zapp-text">
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-zapp-text-muted">Máx. atendimentos simultâneos</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={form.max_concurrent_chats}
                onChange={(e) => onFormChange({ ...form, max_concurrent_chats: parseInt(e.target.value) || 5 })}
                className="bg-zapp-panel border-zapp-border text-zapp-text"
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
            <AlertDialogTitle className="text-zapp-text">Remover atendente?</AlertDialogTitle>
            <AlertDialogDescription className="text-zapp-text-muted">
              O usuário não poderá mais atender conversas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zapp-border text-zapp-text-muted">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger"
              onClick={() => deletingId && onDeleteConfirm(deletingId)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
