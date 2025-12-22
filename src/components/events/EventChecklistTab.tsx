import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, CheckSquare, Clock, AlertCircle } from "lucide-react";

type ChecklistStatus = "pending" | "in_progress" | "done" | "cancelled";

interface ChecklistItem {
  id: string;
  title: string;
  description: string | null;
  status: ChecklistStatus;
  due_date: string | null;
  assigned_to: string | null;
  category: string | null;
  priority: string | null;
  completed_at: string | null;
}

interface Props {
  eventId: string;
  accountId: string | null;
  onUpdate?: () => void;
}

export default function EventChecklistTab({ eventId, accountId, onUpdate }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    category: "",
    priority: "medium",
  });

  useEffect(() => {
    fetchUserId();
    fetchItems();
  }, [eventId, user]);

  const fetchUserId = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    if (data) setUserId(data.id);
  };

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_checklist")
      .select("*")
      .eq("event_id", eventId)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching checklist:", error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      due_date: "",
      category: "",
      priority: "medium",
    });
    setEditingItem(null);
  };

  const openEditDialog = (item: ChecklistItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || "",
      due_date: item.due_date?.slice(0, 16) || "",
      category: item.category || "",
      priority: item.priority || "medium",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !accountId) {
      toast({
        title: "Erro",
        description: "Título é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const itemData = {
      event_id: eventId,
      account_id: accountId,
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
      category: formData.category.trim() || null,
      priority: formData.priority,
    };

    if (editingItem) {
      const { error } = await supabase
        .from("event_checklist")
        .update(itemData)
        .eq("id", editingItem.id);

      if (error) {
        toast({ title: "Erro", description: "Não foi possível atualizar", variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase.from("event_checklist").insert(itemData);
      if (error) {
        toast({ title: "Erro", description: "Não foi possível criar", variant: "destructive" });
        return;
      }
    }

    toast({ title: "Sucesso", description: editingItem ? "Item atualizado" : "Item adicionado" });
    setDialogOpen(false);
    resetForm();
    fetchItems();
    onUpdate?.();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("event_checklist").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível excluir", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Item excluído" });
      fetchItems();
      onUpdate?.();
    }
  };

  const toggleStatus = async (item: ChecklistItem) => {
    const newStatus: ChecklistStatus = item.status === "done" ? "pending" : "done";
    
    const updateData: any = {
      status: newStatus,
    };
    
    if (newStatus === "done" && userId) {
      updateData.completed_at = new Date().toISOString();
      updateData.completed_by = userId;
    } else {
      updateData.completed_at = null;
      updateData.completed_by = null;
    }

    const { error } = await supabase
      .from("event_checklist")
      .update(updateData)
      .eq("id", item.id);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível atualizar", variant: "destructive" });
    } else {
      fetchItems();
      onUpdate?.();
    }
  };

  const getStatusBadge = (status: ChecklistStatus) => {
    const config = {
      pending: { label: "Pendente", variant: "outline" as const },
      in_progress: { label: "Em progresso", variant: "secondary" as const },
      done: { label: "Concluído", variant: "default" as const },
      cancelled: { label: "Cancelado", variant: "destructive" as const },
    };
    return <Badge variant={config[status].variant}>{config[status].label}</Badge>;
  };

  const getPriorityBadge = (priority: string | null) => {
    const config: Record<string, { label: string; className: string }> = {
      low: { label: "Baixa", className: "bg-gray-100 text-gray-700" },
      medium: { label: "Média", className: "bg-yellow-100 text-yellow-700" },
      high: { label: "Alta", className: "bg-orange-100 text-orange-700" },
      urgent: { label: "Urgente", className: "bg-red-100 text-red-700" },
    };
    const { label, className } = config[priority || "medium"] || config.medium;
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${className}`}>{label}</span>;
  };

  const completedCount = items.filter(i => i.status === "done").length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  // Group by category
  const categories = [...new Set(items.map(i => i.category || "Sem categoria"))];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex-1">
          <CardTitle>Checklist do Evento</CardTitle>
          <CardDescription>Tarefas e preparativos necessários</CardDescription>
          {items.length > 0 && (
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>{completedCount} de {items.length} concluídos</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="Nenhuma tarefa cadastrada"
            description="Adicione tarefas ao checklist do evento"
            action={
              <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Tarefa
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category} className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {category}
                </h4>
                <div className="space-y-2">
                  {items
                    .filter(i => (i.category || "Sem categoria") === category)
                    .map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                          item.status === "done" ? "bg-muted/50" : "hover:bg-muted/30"
                        }`}
                      >
                        <Checkbox
                          checked={item.status === "done"}
                          onCheckedChange={() => toggleStatus(item)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium ${item.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                              {item.title}
                            </span>
                            {getPriorityBadge(item.priority)}
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                          )}
                          {item.due_date && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(item.due_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              {new Date(item.due_date) < new Date() && item.status !== "done" && (
                                <AlertCircle className="h-3 w-3 text-destructive ml-1" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(item)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
            <DialogDescription>Adicione uma tarefa ao checklist</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Nome da tarefa"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Ex: Logística, Marketing"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Prazo</Label>
              <Input
                id="due_date"
                type="datetime-local"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalhes da tarefa"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editingItem ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
