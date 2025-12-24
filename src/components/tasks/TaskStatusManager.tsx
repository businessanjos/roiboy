import { useState } from "react";
import { useTaskStatuses, TaskStatus } from "@/hooks/useTaskStatuses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Plus, 
  Settings, 
  GripVertical, 
  MoreVertical, 
  Pencil, 
  Trash2,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Circle,
  AlertTriangle,
  Star,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const AVAILABLE_ICONS = [
  { name: "clock", icon: Clock, label: "Relógio" },
  { name: "arrow-right", icon: ArrowRight, label: "Seta" },
  { name: "check-circle-2", icon: CheckCircle2, label: "Check" },
  { name: "x-circle", icon: XCircle, label: "X" },
  { name: "circle", icon: Circle, label: "Círculo" },
  { name: "alert-triangle", icon: AlertTriangle, label: "Alerta" },
  { name: "star", icon: Star, label: "Estrela" },
];

const AVAILABLE_COLORS = [
  "#6b7280", // gray
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
];

interface TaskStatusManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskStatusManager({ open, onOpenChange }: TaskStatusManagerProps) {
  const { statuses, isLoading, createStatus, updateStatus, deleteStatus } = useTaskStatuses();
  const [editingStatus, setEditingStatus] = useState<TaskStatus | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusToDelete, setStatusToDelete] = useState<TaskStatus | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    color: "#6b7280",
    icon: "circle",
    is_completed_status: false,
  });

  const getIconComponent = (iconName: string) => {
    const found = AVAILABLE_ICONS.find(i => i.name === iconName);
    return found ? found.icon : Circle;
  };

  const handleOpenEdit = (status: TaskStatus) => {
    setEditingStatus(status);
    setFormData({
      name: status.name,
      color: status.color,
      icon: status.icon,
      is_completed_status: status.is_completed_status,
    });
  };

  const handleOpenNew = () => {
    setEditingStatus(null);
    setFormData({
      name: "",
      color: "#6b7280",
      icon: "circle",
      is_completed_status: false,
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    if (editingStatus) {
      await updateStatus.mutateAsync({
        id: editingStatus.id,
        ...formData,
      });
    } else {
      const maxOrder = Math.max(...statuses.map(s => s.display_order), 0);
      await createStatus.mutateAsync({
        ...formData,
        display_order: maxOrder + 1,
        is_default: false,
      });
    }

    setEditingStatus(null);
    setFormData({ name: "", color: "#6b7280", icon: "circle", is_completed_status: false });
  };

  const handleDelete = async () => {
    if (!statusToDelete) return;
    await deleteStatus.mutateAsync(statusToDelete.id);
    setDeleteDialogOpen(false);
    setStatusToDelete(null);
  };

  const openDeleteDialog = (status: TaskStatus) => {
    setStatusToDelete(status);
    setDeleteDialogOpen(true);
  };

  const isEditing = editingStatus !== null;
  const isFormOpen = isEditing || formData.name !== "" || editingStatus === null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Personalizar Status
            </DialogTitle>
            <DialogDescription>
              Adicione, edite ou remova os status das suas tarefas.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status List */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {statuses.map((status) => {
                  const IconComponent = getIconComponent(status.icon);
                  return (
                    <div
                      key={status.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border bg-card",
                        editingStatus?.id === status.id && "ring-2 ring-primary"
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: status.color }}
                      />
                      <IconComponent className="h-4 w-4 shrink-0" style={{ color: status.color }} />
                      <span className="flex-1 font-medium text-sm truncate">{status.name}</span>
                      {status.is_completed_status && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Final
                        </span>
                      )}
                      {status.is_default && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          Padrão
                        </span>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(status)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(status)}
                            className="text-destructive"
                            disabled={statuses.length <= 1}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>

              {/* Add/Edit Form */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    {editingStatus ? "Editar status" : "Novo status"}
                  </Label>
                  {editingStatus && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleOpenNew}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  <Input
                    placeholder="Nome do status"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-12">Cor:</Label>
                    <div className="flex gap-1.5">
                      {AVAILABLE_COLORS.map((color) => (
                        <button
                          key={color}
                          className={cn(
                            "w-6 h-6 rounded-full border-2 transition-all",
                            formData.color === color ? "border-foreground scale-110" : "border-transparent"
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => setFormData({ ...formData, color })}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-12">Ícone:</Label>
                    <div className="flex gap-1.5">
                      {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
                        <button
                          key={name}
                          className={cn(
                            "w-7 h-7 rounded-md flex items-center justify-center border transition-all",
                            formData.icon === name 
                              ? "border-foreground bg-muted" 
                              : "border-transparent hover:bg-muted/50"
                          )}
                          onClick={() => setFormData({ ...formData, icon: name })}
                        >
                          <Icon className="h-4 w-4" style={{ color: formData.color }} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Status de conclusão</Label>
                      <p className="text-xs text-muted-foreground">
                        Tarefas neste status são consideradas finalizadas
                      </p>
                    </div>
                    <Switch
                      checked={formData.is_completed_status}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, is_completed_status: checked })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.name.trim() || createStatus.isPending || updateStatus.isPending}
            >
              {(createStatus.isPending || updateStatus.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingStatus ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir status?</AlertDialogTitle>
            <AlertDialogDescription>
              O status "{statusToDelete?.name}" será removido. Tarefas com este status 
              serão movidas para o status padrão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
