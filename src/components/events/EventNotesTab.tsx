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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
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
import { Plus, Pencil, Trash2, FileText, Pin, PinOff } from "lucide-react";

interface NoteItem {
  id: string;
  title: string | null;
  content: string;
  note_type: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  users?: {
    name: string;
    avatar_url: string | null;
  };
}

interface Props {
  eventId: string;
  accountId: string | null;
}

const NOTE_TYPE_LABELS: Record<string, string> = {
  general: "Geral",
  experience: "Experiência",
  feedback: "Feedback",
  improvement: "Melhoria",
};

export default function EventNotesTab({ eventId, accountId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NoteItem | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    note_type: "general",
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
      .from("event_notes")
      .select(`
        *,
        users (name, avatar_url)
      `)
      .eq("event_id", eventId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notes:", error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      note_type: "general",
    });
    setEditingItem(null);
  };

  const openEditDialog = (item: NoteItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title || "",
      content: item.content,
      note_type: item.note_type || "general",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.content.trim() || !accountId || !userId) {
      toast({
        title: "Erro",
        description: "Conteúdo é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const itemData = {
      event_id: eventId,
      account_id: accountId,
      user_id: userId,
      title: formData.title.trim() || null,
      content: formData.content.trim(),
      note_type: formData.note_type,
    };

    if (editingItem) {
      const { error } = await supabase
        .from("event_notes")
        .update({
          title: itemData.title,
          content: itemData.content,
          note_type: itemData.note_type,
        })
        .eq("id", editingItem.id);

      if (error) {
        toast({ title: "Erro", description: "Não foi possível atualizar", variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase.from("event_notes").insert(itemData);
      if (error) {
        toast({ title: "Erro", description: "Não foi possível criar", variant: "destructive" });
        return;
      }
    }

    toast({ title: "Sucesso", description: editingItem ? "Nota atualizada" : "Nota adicionada" });
    setDialogOpen(false);
    resetForm();
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("event_notes").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível excluir", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Nota excluída" });
      fetchItems();
    }
  };

  const togglePin = async (item: NoteItem) => {
    const { error } = await supabase
      .from("event_notes")
      .update({ is_pinned: !item.is_pinned })
      .eq("id", item.id);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível atualizar", variant: "destructive" });
    } else {
      fetchItems();
    }
  };

  const getNoteTypeBadge = (type: string | null) => {
    const config: Record<string, { className: string }> = {
      general: { className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
      experience: { className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
      feedback: { className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
      improvement: { className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    };
    const { className } = config[type || "general"] || config.general;
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${className}`}>
        {NOTE_TYPE_LABELS[type || "general"]}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Notas e Observações</CardTitle>
          <CardDescription>Registro de experiências e melhorias</CardDescription>
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
            icon={FileText}
            title="Nenhuma nota cadastrada"
            description="Registre observações sobre o evento"
            action={
              <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Nota
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border ${item.is_pinned ? 'border-primary/50 bg-primary/5' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={item.users?.avatar_url || undefined} />
                      <AvatarFallback>{item.users?.name?.charAt(0) || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.title && <span className="font-medium">{item.title}</span>}
                        {getNoteTypeBadge(item.note_type)}
                        {item.is_pinned && (
                          <Pin className="h-3 w-3 text-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.content}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{item.users?.name}</span>
                        <span>•</span>
                        <span>{format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePin(item)}>
                      {item.is_pinned ? (
                        <PinOff className="h-3 w-3" />
                      ) : (
                        <Pin className="h-3 w-3" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(item)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Nota" : "Nova Nota"}</DialogTitle>
            <DialogDescription>Registre uma observação sobre o evento</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Título opcional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note_type">Tipo</Label>
                <Select
                  value={formData.note_type}
                  onValueChange={(value) => setFormData({ ...formData, note_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Geral</SelectItem>
                    <SelectItem value="experience">Experiência</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                    <SelectItem value="improvement">Melhoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Escreva sua observação..."
                rows={4}
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
