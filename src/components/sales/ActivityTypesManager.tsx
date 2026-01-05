import { useState } from "react";
import { useActivityTypes, useActivityTypeMutations } from "@/hooks/useActivityTypes";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Phone, Mail, Video, Calendar, FileText, MessageSquare, Users } from "lucide-react";
import { toast } from "sonner";

const ICON_OPTIONS = [
  { value: "phone", label: "Telefone", icon: Phone },
  { value: "mail", label: "Email", icon: Mail },
  { value: "video", label: "Reunião", icon: Video },
  { value: "calendar", label: "Agendamento", icon: Calendar },
  { value: "file-text", label: "Proposta", icon: FileText },
  { value: "message-square", label: "Mensagem", icon: MessageSquare },
  { value: "users", label: "Visita", icon: Users },
];

const COLOR_OPTIONS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#14b8a6", // Teal
  "#3b82f6", // Blue
  "#6b7280", // Gray
];

export function ActivityTypesManager() {
  const { activityTypes, isLoading } = useActivityTypes();
  const { createActivityType, updateActivityType, deleteActivityType } = useActivityTypeMutations();
  const { currentUser } = useCurrentUser();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    icon: "phone",
    color: "#6366f1",
    description: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      icon: "phone",
      color: "#6366f1",
      description: "",
    });
    setEditingType(null);
  };

  const handleOpenDialog = (type?: any) => {
    if (type) {
      setEditingType(type);
      setFormData({
        name: type.name,
        icon: type.icon || "phone",
        color: type.color || "#6366f1",
        description: type.description || "",
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Informe o nome do tipo de atividade");
      return;
    }

    if (!currentUser?.account_id) {
      toast.error("Sessão expirada");
      return;
    }

    if (editingType) {
      updateActivityType.mutate({
        id: editingType.id,
        name: formData.name.trim(),
        icon: formData.icon,
        color: formData.color,
        description: formData.description.trim() || null,
      });
    } else {
      createActivityType.mutate({
        account_id: currentUser.account_id,
        name: formData.name.trim(),
        icon: formData.icon,
        color: formData.color,
        description: formData.description.trim() || null,
        is_active: true,
        display_order: activityTypes.length,
      });
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm("Excluir este tipo de atividade?")) {
      deleteActivityType.mutate(id);
    }
  };

  const getIcon = (iconName: string) => {
    const iconOption = ICON_OPTIONS.find((opt) => opt.value === iconName);
    const IconComponent = iconOption?.icon || Phone;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Tipos de Atividade</CardTitle>
          <CardDescription>
            Categorize as atividades do comercial para análise de performance
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Tipo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingType ? "Editar Tipo de Atividade" : "Novo Tipo de Atividade"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Ligação, Reunião, Proposta..."
                />
              </div>

              <div className="space-y-2">
                <Label>Ícone</Label>
                <div className="flex flex-wrap gap-2">
                  {ICON_OPTIONS.map((opt) => {
                    const IconComp = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: opt.value })}
                        className={`p-2 rounded-md border transition-colors ${
                          formData.icon === opt.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted"
                        }`}
                        title={opt.label}
                      >
                        <IconComp className="h-5 w-5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        formData.color === color
                          ? "border-foreground scale-110"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do tipo de atividade"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit}>
                  {editingType ? "Salvar" : "Criar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Carregando...</div>
        ) : activityTypes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum tipo de atividade cadastrado</p>
            <p className="text-sm mt-1">Crie tipos como: Ligação, Reunião, Proposta, etc.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activityTypes.map((type) => (
              <div
                key={type.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: type.color }}
                  >
                    {getIcon(type.icon)}
                  </div>
                  <div>
                    <p className="font-medium">{type.name}</p>
                    {type.description && (
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(type)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(type.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
