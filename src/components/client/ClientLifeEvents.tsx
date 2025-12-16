import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Cake,
  Baby,
  Heart,
  GraduationCap,
  Briefcase,
  TrendingUp,
  Plane,
  Trophy,
  Star,
  Calendar,
  Bell,
  MessageSquare,
  User,
  HeartPulse,
  CloudRain,
  Sparkles,
  Home,
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, addYears, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LifeEvent {
  id: string;
  event_type: string;
  event_date: string | null;
  title: string;
  description: string | null;
  is_recurring: boolean;
  reminder_days_before: number | null;
  source: "manual" | "conversation" | "ai_detected";
  created_at: string;
}

interface ClientLifeEventsProps {
  clientId: string;
}

const EVENT_TYPES = [
  { value: "birthday", label: "Aniversário", icon: Cake, color: "text-pink-500" },
  { value: "child_birth", label: "Nascimento de Filho", icon: Baby, color: "text-blue-500" },
  { value: "pregnancy", label: "Gravidez", icon: Baby, color: "text-purple-500" },
  { value: "wedding", label: "Casamento", icon: Heart, color: "text-red-500" },
  { value: "anniversary", label: "Aniversário de Casamento", icon: Heart, color: "text-rose-500" },
  { value: "graduation", label: "Formatura", icon: GraduationCap, color: "text-indigo-500" },
  { value: "new_job", label: "Novo Emprego", icon: Briefcase, color: "text-emerald-500" },
  { value: "promotion", label: "Promoção", icon: TrendingUp, color: "text-green-500" },
  { value: "retirement", label: "Aposentadoria", icon: Star, color: "text-amber-500" },
  { value: "health", label: "Questão de Saúde", icon: HeartPulse, color: "text-orange-500" },
  { value: "health_issue", label: "Questão de Saúde", icon: HeartPulse, color: "text-orange-500" },
  { value: "loss", label: "Perda/Luto", icon: CloudRain, color: "text-gray-500" },
  { value: "travel", label: "Viagem", icon: Plane, color: "text-cyan-500" },
  { value: "achievement", label: "Conquista", icon: Trophy, color: "text-yellow-500" },
  { value: "celebration", label: "Comemoração", icon: Star, color: "text-amber-500" },
  { value: "moving", label: "Mudança", icon: Home, color: "text-teal-500" },
  { value: "other", label: "Outro", icon: Star, color: "text-muted-foreground" },
];

export function ClientLifeEvents({ clientId }: ClientLifeEventsProps) {
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<LifeEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<LifeEvent | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formType, setFormType] = useState("birthday");
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRecurring, setFormRecurring] = useState(false);
  const [formReminderDays, setFormReminderDays] = useState("7");

  useEffect(() => {
    fetchEvents();
  }, [clientId]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_life_events")
        .select("*")
        .eq("client_id", clientId)
        .order("event_date", { ascending: true, nullsFirst: false });

      if (error) throw error;
      setEvents((data || []) as LifeEvent[]);
    } catch (error: any) {
      console.error("Error fetching life events:", error);
      toast.error("Erro ao carregar momentos CX");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormType("birthday");
    setFormTitle("");
    setFormDate("");
    setFormDescription("");
    setFormRecurring(false);
    setFormReminderDays("7");
    setEditingEvent(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (event: LifeEvent) => {
    setEditingEvent(event);
    setFormType(event.event_type);
    setFormTitle(event.title);
    setFormDate(event.event_date || "");
    setFormDescription(event.description || "");
    setFormRecurring(event.is_recurring);
    setFormReminderDays(String(event.reminder_days_before || 7));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("account_id")
        .single();

      if (!userData) {
        toast.error("Usuário não encontrado");
        return;
      }

      const eventData = {
        event_type: formType,
        title: formTitle.trim(),
        event_date: formDate || null,
        description: formDescription.trim() || null,
        is_recurring: formRecurring,
        reminder_days_before: parseInt(formReminderDays) || 7,
      };

      if (editingEvent) {
        const { error } = await supabase
          .from("client_life_events")
          .update(eventData)
          .eq("id", editingEvent.id);

        if (error) throw error;
        toast.success("Momento atualizado!");
      } else {
        const { error } = await supabase
          .from("client_life_events")
          .insert({
            ...eventData,
            account_id: userData.account_id,
            client_id: clientId,
            source: "manual",
          });

        if (error) throw error;
        toast.success("Momento adicionado!");
      }

      setDialogOpen(false);
      resetForm();
      fetchEvents();
    } catch (error: any) {
      console.error("Error saving life event:", error);
      toast.error(error.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!eventToDelete) return;

    try {
      const { error } = await supabase
        .from("client_life_events")
        .delete()
        .eq("id", eventToDelete.id);

      if (error) throw error;

      toast.success("Momento excluído!");
      setDeleteDialogOpen(false);
      setEventToDelete(null);
      fetchEvents();
    } catch (error: any) {
      console.error("Error deleting life event:", error);
      toast.error(error.message || "Erro ao excluir");
    }
  };

  const getEventTypeInfo = (type: string) => {
    return EVENT_TYPES.find((t) => t.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1];
  };

  const getNextOccurrence = (event: LifeEvent) => {
    if (!event.event_date || !event.is_recurring) return null;

    const eventDate = new Date(event.event_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let nextDate = new Date(eventDate);
    nextDate.setFullYear(today.getFullYear());

    if (isBefore(nextDate, today)) {
      nextDate = addYears(nextDate, 1);
    }

    return nextDate;
  };

  const getDaysUntil = (event: LifeEvent) => {
    const nextOccurrence = getNextOccurrence(event);
    if (!nextOccurrence) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return differenceInDays(nextOccurrence, today);
  };

  const getUpcomingEvents = () => {
    return events
      .filter((e) => {
        if (!e.event_date) return false;
        const days = getDaysUntil(e);
        return days !== null && days >= 0 && days <= 30;
      })
      .sort((a, b) => (getDaysUntil(a) || 0) - (getDaysUntil(b) || 0));
  };

  const upcomingEvents = getUpcomingEvents();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upcoming Events Alert */}
      {upcomingEvents.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-5 w-5 text-primary" />
              <h3 className="font-medium">Próximos Momentos</h3>
            </div>
            <div className="space-y-2">
              {upcomingEvents.map((event) => {
                const typeInfo = getEventTypeInfo(event.event_type);
                const Icon = typeInfo.icon;
                const daysUntil = getDaysUntil(event);

                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-2 rounded-md bg-background/50"
                  >
                    <Icon className={`h-4 w-4 ${typeInfo.color}`} />
                    <span className="flex-1 text-sm">{event.title}</span>
                    <Badge variant={daysUntil === 0 ? "default" : "secondary"}>
                      {daysUntil === 0
                        ? "Hoje!"
                        : daysUntil === 1
                        ? "Amanhã"
                        : `${daysUntil} dias`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Button */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Registre momentos importantes da vida do cliente para um atendimento mais humanizado.
        </p>
        <Button onClick={openNewDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Momento
        </Button>
      </div>

      {/* Events List */}
      {events.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Heart className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhum momento CX registrado.</p>
          <p className="text-sm">Adicione aniversários, conquistas e outros momentos importantes.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((event) => {
            const typeInfo = getEventTypeInfo(event.event_type);
            const Icon = typeInfo.icon;
            const daysUntil = getDaysUntil(event);

            return (
              <Card key={event.id} className="hover:bg-muted/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg bg-muted ${typeInfo.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium truncate">{event.title}</h4>
                          {event.source === "ai_detected" && (
                            <Badge variant="outline" className="gap-1 text-xs border-primary/50 text-primary">
                              <Sparkles className="h-3 w-3" />
                              IA
                            </Badge>
                          )}
                          {event.source === "conversation" && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <MessageSquare className="h-3 w-3" />
                              Conversa
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{typeInfo.label}</p>
                        {event.event_date && (
                          <div className="flex items-center gap-2 mt-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                            {event.is_recurring && daysUntil !== null && (
                              <Badge
                                variant={daysUntil <= 7 ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {daysUntil === 0
                                  ? "Hoje!"
                                  : daysUntil === 1
                                  ? "Amanhã"
                                  : `em ${daysUntil} dias`}
                              </Badge>
                            )}
                          </div>
                        )}
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(event)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setEventToDelete(event);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? "Editar" : "Novo"} Momento CX
            </DialogTitle>
            <DialogDescription>
              Registre um momento importante da vida do cliente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Momento</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${type.color}`} />
                          {type.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                placeholder="Ex: Aniversário da Maria"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Detalhes sobre o momento..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Evento Recorrente</Label>
                <p className="text-sm text-muted-foreground">
                  Repetir anualmente (ex: aniversário)
                </p>
              </div>
              <Switch checked={formRecurring} onCheckedChange={setFormRecurring} />
            </div>

            {formRecurring && (
              <div className="space-y-2">
                <Label>Lembrar quantos dias antes?</Label>
                <Select value={formReminderDays} onValueChange={setFormReminderDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 dia</SelectItem>
                    <SelectItem value="3">3 dias</SelectItem>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="14">14 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir momento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O momento será permanentemente excluído.
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
    </div>
  );
}
