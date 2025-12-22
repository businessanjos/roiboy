import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Clock, MapPin, User, ListOrdered } from "lucide-react";

interface ScheduleItem {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  speaker: string | null;
  notes: string | null;
  display_order: number;
}

interface Props {
  eventId: string;
  accountId: string | null;
}

export default function EventScheduleTab({ eventId, accountId }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    location: "",
    speaker: "",
    notes: "",
  });

  useEffect(() => {
    fetchItems();
  }, [eventId]);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_schedule")
      .select("*")
      .eq("event_id", eventId)
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Error fetching schedule:", error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      start_time: "",
      end_time: "",
      location: "",
      speaker: "",
      notes: "",
    });
    setEditingItem(null);
  };

  const openEditDialog = (item: ScheduleItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || "",
      start_time: item.start_time.slice(0, 16),
      end_time: item.end_time?.slice(0, 16) || "",
      location: item.location || "",
      speaker: item.speaker || "",
      notes: item.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.start_time || !accountId) {
      toast({
        title: "Erro",
        description: "Título e horário de início são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const itemData = {
      event_id: eventId,
      account_id: accountId,
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      start_time: new Date(formData.start_time).toISOString(),
      end_time: formData.end_time ? new Date(formData.end_time).toISOString() : null,
      location: formData.location.trim() || null,
      speaker: formData.speaker.trim() || null,
      notes: formData.notes.trim() || null,
    };

    if (editingItem) {
      const { error } = await supabase
        .from("event_schedule")
        .update(itemData)
        .eq("id", editingItem.id);

      if (error) {
        toast({ title: "Erro", description: "Não foi possível atualizar", variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase.from("event_schedule").insert(itemData);
      if (error) {
        toast({ title: "Erro", description: "Não foi possível criar", variant: "destructive" });
        return;
      }
    }

    toast({ title: "Sucesso", description: editingItem ? "Item atualizado" : "Item adicionado" });
    setDialogOpen(false);
    resetForm();
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("event_schedule").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível excluir", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Item excluído" });
      fetchItems();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Programação do Evento</CardTitle>
          <CardDescription>Agenda e cronograma de atividades</CardDescription>
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
            icon={ListOrdered}
            title="Nenhuma atividade cadastrada"
            description="Adicione a programação do evento"
            action={
              <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Atividade
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Horário</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead className="hidden sm:table-cell">Palestrante</TableHead>
                <TableHead className="hidden md:table-cell">Local</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {format(new Date(item.start_time), "HH:mm", { locale: ptBR })}
                      {item.end_time && (
                        <> - {format(new Date(item.end_time), "HH:mm", { locale: ptBR })}</>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {item.speaker && (
                      <div className="flex items-center gap-1 text-sm">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {item.speaker}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {item.location && (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {item.location}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Atividade" : "Nova Atividade"}</DialogTitle>
            <DialogDescription>Adicione uma atividade à programação do evento</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Nome da atividade"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Início *</Label>
                <Input
                  id="start_time"
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">Fim</Label>
                <Input
                  id="end_time"
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="speaker">Palestrante</Label>
                <Input
                  id="speaker"
                  value={formData.speaker}
                  onChange={(e) => setFormData({ ...formData, speaker: e.target.value })}
                  placeholder="Nome do palestrante"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Local</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Sala, auditório..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalhes da atividade"
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
