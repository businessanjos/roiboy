import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Send,
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
  const { currentUser } = useCurrentUser();
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<LifeEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<LifeEvent | null>(null);
  const [saving, setSaving] = useState(false);

  // Quick add state
  const [quickTitle, setQuickTitle] = useState("");
  const [quickType, setQuickType] = useState("birthday");
  const [quickPopoverOpen, setQuickPopoverOpen] = useState(false);

  // Form state
  const [formType, setFormType] = useState("birthday");
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRecurring, setFormRecurring] = useState(false);
  const [formReminderDays, setFormReminderDays] = useState("7");

  useEffect(() => {
    fetchEvents();

    // Realtime subscription for automatic updates when AI detects new events
    const channel = supabase
      .channel(`life-events-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_life_events',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          console.log('Life event realtime update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newEvent = payload.new as LifeEvent;
            setEvents((prev) => {
              // Check if already exists to avoid duplicates
              if (prev.some((e) => e.id === newEvent.id)) return prev;
              // Show toast for AI-detected events
              if (newEvent.source === 'ai_detected') {
                toast.success(`Momento CX detectado pela IA: ${newEvent.title}`, {
                  icon: '✨',
                });
              }
              return [...prev, newEvent].sort((a, b) => {
                if (!a.event_date) return 1;
                if (!b.event_date) return -1;
                return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
              });
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedEvent = payload.new as LifeEvent;
            setEvents((prev) =>
              prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedEvent = payload.old as { id: string };
            setEvents((prev) => prev.filter((e) => e.id !== deletedEvent.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const handleQuickAdd = async () => {
    if (!quickTitle.trim() || !currentUser?.account_id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("client_life_events")
        .insert({
          account_id: currentUser.account_id,
          client_id: clientId,
          event_type: quickType,
          title: quickTitle.trim(),
          source: "manual",
          is_recurring: quickType === "birthday" || quickType === "anniversary",
        });

      if (error) throw error;
      toast.success("Momento adicionado!");
      setQuickTitle("");
      setQuickType("birthday");
      setQuickPopoverOpen(false);
      fetchEvents();
    } catch (error: any) {
      console.error("Error saving quick event:", error);
      toast.error("Erro ao salvar momento");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuickAdd();
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

    if (!currentUser?.account_id) {
      toast.error("Usuário não encontrado");
      return;
    }

    setSaving(true);
    try {
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
            account_id: currentUser.account_id,
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
    <div className="flex flex-col h-full">
      {/* Upcoming Events Alert */}
      {upcomingEvents.length > 0 && (
        <Card className="border-primary/30 bg-primary/5 mb-4">
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

      {/* Events List */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Heart className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum momento CX registrado.</p>
            <p className="text-sm">Adicione aniversários, conquistas e outros momentos importantes.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {events.map((event) => {
              const typeInfo = getEventTypeInfo(event.event_type);
              const Icon = typeInfo.icon;
              const daysUntil = getDaysUntil(event);

              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 py-3 px-2 hover:bg-muted/30 rounded-lg transition-colors group"
                >
                  <div className={`p-2 rounded-lg bg-muted/50 ${typeInfo.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{event.title}</span>
                      {event.source === "ai_detected" && (
                        <Badge variant="outline" className="gap-1 text-[10px] h-5 border-primary/50 text-primary">
                          <Sparkles className="h-2.5 w-2.5" />
                          IA
                        </Badge>
                      )}
                      {event.source === "conversation" && (
                        <Badge variant="outline" className="gap-1 text-[10px] h-5">
                          <MessageSquare className="h-2.5 w-2.5" />
                          Conversa
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{typeInfo.label}</span>
                      {event.event_date && (
                        <>
                          <span>•</span>
                          <span>{format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                        </>
                      )}
                      {event.is_recurring && daysUntil !== null && daysUntil <= 30 && (
                        <Badge
                          variant={daysUntil <= 7 ? "default" : "secondary"}
                          className="text-[10px] h-4 px-1.5"
                        >
                          {daysUntil === 0
                            ? "Hoje!"
                            : daysUntil === 1
                            ? "Amanhã"
                            : `em ${daysUntil}d`}
                        </Badge>
                      )}
                    </div>
                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {event.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditDialog(event)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        setEventToDelete(event);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Social Media Style Input - BOTTOM */}
      {currentUser && (
        <div className="flex gap-3 pt-4 mt-4 border-t">
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarImage src={currentUser.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {currentUser.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 relative">
            <Input
              placeholder="Adicionar momento (ex: Aniversário do João)..."
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={handleQuickKeyDown}
              className="pr-24 bg-muted/50 border-0 rounded-full h-9 text-sm placeholder:text-muted-foreground/60"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <TooltipProvider delayDuration={300}>
                <Popover open={quickPopoverOpen} onOpenChange={setQuickPopoverOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          {(() => {
                            const typeInfo = EVENT_TYPES.find(t => t.value === quickType);
                            const Icon = typeInfo?.icon || Star;
                            return <Icon className={`h-4 w-4 ${typeInfo?.color || ''}`} />;
                          })()}
                        </button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Tipo de momento</TooltipContent>
                  </Tooltip>
                  <PopoverContent align="end" className="w-48 p-1">
                    <div className="space-y-0.5 max-h-64 overflow-y-auto">
                      {EVENT_TYPES.map((type) => {
                        const Icon = type.icon;
                        return (
                          <button
                            key={type.value}
                            onClick={() => {
                              setQuickType(type.value);
                              setQuickPopoverOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors ${
                              quickType === type.value ? 'bg-muted' : ''
                            }`}
                          >
                            <Icon className={`h-4 w-4 ${type.color}`} />
                            <span className="truncate">{type.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={openNewDialog}
                      className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Formulário completo</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {quickTitle.trim() && (
                <button
                  type="button"
                  onClick={handleQuickAdd}
                  disabled={saving}
                  className="p-1.5 rounded-full text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
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
