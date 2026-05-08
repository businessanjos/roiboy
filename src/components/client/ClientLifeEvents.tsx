import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLinkedClients, getLinkedClientName } from "@/hooks/useLinkedClients";
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
  ImagePlus,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FlaskConical,
  Instagram,
} from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, addYears, isBefore } from "date-fns";
import { parseLocalDate, formatLocalDate } from "@/lib/dateUtils";
import { ptBR } from "date-fns/locale";
import { ImageGalleryLightbox } from "@/components/ui/image-gallery-lightbox";

interface LifeEvent {
  id: string;
  event_type: string;
  event_date: string | null;
  title: string;
  message: string | null;
  description: string | null;
  is_recurring: boolean;
  reminder_days_before: number | null;
  source: "manual" | "conversation" | "ai_detected";
  created_at: string;
  image_url: string | null;
  // Images from related table
  images?: LifeEventImage[];
  // Scheduled send fields
  scheduled_send_at: string | null;
  send_status: "pending" | "scheduled" | "sent" | "failed" | "cancelled";
  sent_at: string | null;
  send_error: string | null;
}

interface LifeEventImage {
  id: string;
  image_url: string;
  file_name?: string;
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
  { value: "instagram_metrics", label: "Snapshot Instagram", icon: Instagram, color: "text-pink-500" },
];

export function ClientLifeEvents({ clientId }: ClientLifeEventsProps) {
  const { currentUser } = useCurrentUser();
  const { linkedClientIds, linkedClients, hasLinkedClients } = useLinkedClients(clientId);
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
  const [formMessage, setFormMessage] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRecurring, setFormRecurring] = useState(false);
  const [formReminderDays, setFormReminderDays] = useState("7");
  const [formAutoSend, setFormAutoSend] = useState(false);
  const [formSendTime, setFormSendTime] = useState("09:00");

  // Image upload state - now supports multiple images
  const [formImageFiles, setFormImageFiles] = useState<File[]>([]);
  const [formImagePreviews, setFormImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<LifeEventImage[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Test send state
  const [testPopoverOpen, setTestPopoverOpen] = useState(false);
  const [testPhone, setTestPhone] = useState("+55");
  const [sendingTest, setSendingTest] = useState(false);

  // Gallery lightbox state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ url: string; alt?: string }[]>([]);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);

  const openGallery = (event: LifeEvent, imageIndex: number = 0) => {
    const images: { url: string; alt?: string }[] = [];
    
    // Collect images from related table
    if (event.images && event.images.length > 0) {
      event.images.forEach(img => {
        images.push({ url: img.image_url, alt: img.file_name || event.title });
      });
    }
    
    // Include legacy image_url if exists and not already in images
    if (event.image_url && !images.some(i => i.url === event.image_url)) {
      images.push({ url: event.image_url, alt: event.title });
    }
    
    if (images.length > 0) {
      setGalleryImages(images);
      setGalleryInitialIndex(imageIndex);
      setGalleryOpen(true);
    }
  };

  useEffect(() => {
    if (linkedClientIds.length > 0) {
      fetchEvents();
    }
  }, [clientId, linkedClientIds]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_life_events")
        .select(`
          *,
          images:client_life_event_images(id, image_url, file_name)
        `)
        .in("client_id", linkedClientIds)
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
    setFormMessage("");
    setFormDescription("");
    setFormRecurring(false);
    setFormReminderDays("7");
    setFormAutoSend(false);
    setFormSendTime("09:00");
    setEditingEvent(null);
    setFormImageFiles([]);
    setFormImagePreviews([]);
    setExistingImages([]);
    setImagesToDelete([]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = async (event: LifeEvent) => {
    setEditingEvent(event);
    setFormType(event.event_type);
    setFormTitle(event.title);
    setFormDate(event.event_date || "");
    setFormMessage(event.message || "");
    setFormDescription(event.description || "");
    setFormRecurring(event.is_recurring);
    setFormReminderDays(String(event.reminder_days_before || 7));
    
    // Set auto-send fields
    const hasSchedule = !!event.scheduled_send_at;
    setFormAutoSend(hasSchedule);
    if (hasSchedule && event.scheduled_send_at) {
      const scheduledDate = new Date(event.scheduled_send_at);
      const hours = String(scheduledDate.getHours()).padStart(2, '0');
      const minutes = String(scheduledDate.getMinutes()).padStart(2, '0');
      setFormSendTime(`${hours}:${minutes}`);
    } else {
      setFormSendTime("09:00");
    }
    
    setFormImageFiles([]);
    setFormImagePreviews([]);
    setImagesToDelete([]);
    setDialogOpen(true);
    
    // Fetch existing images from the new table
    const { data: images } = await supabase
      .from("client_life_event_images")
      .select("id, image_url, file_name")
      .eq("life_event_id", event.id);
    
    setExistingImages((images as LifeEventImage[]) || []);
  };

  // Image upload handlers - now supports multiple images
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} não é uma imagem válida`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} é muito grande (máx 5MB)`);
        continue;
      }
      
      setFormImageFiles(prev => [...prev, file]);
      setFormImagePreviews(prev => [...prev, URL.createObjectURL(file)]);
    }
    
    // Reset the input so the same file can be selected again
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${clientId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("event-media")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("event-media").getPublicUrl(fileName);
    return data.publicUrl;
  };

  const removeNewImage = (index: number) => {
    setFormImageFiles(prev => prev.filter((_, i) => i !== index));
    setFormImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (imageId: string) => {
    setImagesToDelete(prev => [...prev, imageId]);
    setExistingImages(prev => prev.filter(img => img.id !== imageId));
  };

  // Calculate scheduled_send_at based on date, time and recurrence
  const calculateScheduledSendAt = (): string | null => {
    if (!formAutoSend || !formDate) return null;
    
    const [year, month, day] = formDate.split('-').map(Number);
    const [hours, minutes] = formSendTime.split(':').map(Number);
    
    let sendDate = new Date(year, month - 1, day, hours, minutes);
    
    // Para eventos recorrentes, calcular próxima ocorrência
    if (formRecurring) {
      const today = new Date();
      sendDate.setFullYear(today.getFullYear());
      if (sendDate < today) {
        sendDate.setFullYear(today.getFullYear() + 1);
      }
    }
    
    return sendDate.toISOString();
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    if (!formMessage.trim()) {
      toast.error("Mensagem é obrigatória");
      return;
    }

    if (formAutoSend && !formDate) {
      toast.error("Data é obrigatória para envio automático");
      return;
    }

    if (formAutoSend && !formSendTime) {
      toast.error("Horário é obrigatório para envio automático");
      return;
    }

    if (!currentUser?.account_id) {
      toast.error("Usuário não encontrado");
      return;
    }

    setSaving(true);
    try {
      const scheduledSendAt = calculateScheduledSendAt();
      
      const eventData = {
        event_type: formType,
        title: formTitle.trim(),
        message: formMessage.trim(),
        event_date: formDate || null,
        description: formDescription.trim() || null,
        is_recurring: formRecurring,
        reminder_days_before: parseInt(formReminderDays) || 7,
        scheduled_send_at: scheduledSendAt,
        send_status: scheduledSendAt ? 'scheduled' : 'pending',
      };

      let eventId: string;

      if (editingEvent) {
        const { error } = await supabase
          .from("client_life_events")
          .update(eventData)
          .eq("id", editingEvent.id);

        if (error) throw error;
        eventId = editingEvent.id;
      } else {
        const { data: newEvent, error } = await supabase
          .from("client_life_events")
          .insert({
            ...eventData,
            account_id: currentUser.account_id,
            client_id: clientId,
            source: "manual",
          })
          .select("id")
          .single();

        if (error) throw error;
        eventId = newEvent.id;
      }

      // Delete images marked for deletion
      if (imagesToDelete.length > 0) {
        await supabase
          .from("client_life_event_images")
          .delete()
          .in("id", imagesToDelete);
      }

      // Upload and save new images
      if (formImageFiles.length > 0) {
        setUploadingImage(true);
        try {
          for (const file of formImageFiles) {
            const imageUrl = await uploadImage(file);
            await supabase.from("client_life_event_images").insert({
              account_id: currentUser.account_id,
              life_event_id: eventId,
              image_url: imageUrl,
              file_name: file.name,
              file_size: file.size,
            });
          }
        } finally {
          setUploadingImage(false);
        }
      }

      toast.success(editingEvent ? "Momento atualizado!" : "Momento adicionado!");
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

    const eventDate = parseLocalDate(event.event_date);
    if (!eventDate) return null;
    
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
                  {(event.images && event.images.length > 0) || event.image_url ? (
                    <div 
                      className="relative flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        openGallery(event, 0);
                      }}
                    >
                      <img
                        src={event.images?.[0]?.image_url || event.image_url || ''}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                      {event.images && event.images.length > 1 && (
                        <span className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-medium">
                          +{event.images.length - 1}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className={`p-2 rounded-lg bg-muted/50 ${typeInfo.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  )}
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
                          <span>{formatLocalDate(event.event_date)}</span>
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
                      {/* Send status badges */}
                      {event.send_status === "scheduled" && event.scheduled_send_at && (
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="gap-1 text-[10px] h-5 border-blue-500/50 text-blue-600 bg-blue-50">
                                <Clock className="h-2.5 w-2.5" />
                                Agendado
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {new Date(event.scheduled_send_at).toLocaleString("pt-BR")}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {event.send_status === "sent" && (
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="gap-1 text-[10px] h-5 border-green-500/50 text-green-600 bg-green-50">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Enviado
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {event.sent_at ? new Date(event.sent_at).toLocaleString("pt-BR") : "Enviado"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {event.send_status === "failed" && (
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="gap-1 text-[10px] h-5 border-red-500/50 text-red-600 bg-red-50">
                                <XCircle className="h-2.5 w-2.5" />
                                Falhou
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              {event.send_error || "Erro no envio"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              <Label>Mensagem *</Label>
              <Textarea
                placeholder="Mensagem que será enviada ao cliente..."
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: <code className="bg-muted px-1 rounded">{"{nome}"}</code>, <code className="bg-muted px-1 rounded">{"{primeiro_nome}"}</code>, <code className="bg-muted px-1 rounded">{"{momento_titulo}"}</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional - uso interno)</Label>
              <Textarea
                placeholder="Detalhes sobre o momento..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Image Upload Field - Multiple Images */}
            <div className="space-y-2">
              <Label>Imagens (opcional)</Label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />

              {/* Grid of images */}
              {(existingImages.length > 0 || formImagePreviews.length > 0) && (
                <div className="grid grid-cols-3 gap-2">
                  {/* Existing images */}
                  {existingImages.map((img) => (
                    <div key={img.id} className="relative group aspect-square">
                      <img
                        src={img.image_url}
                        alt=""
                        className="w-full h-full object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(img.id)}
                        className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  
                  {/* New images (previews) */}
                  {formImagePreviews.map((preview, index) => (
                    <div key={index} className="relative group aspect-square">
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-full object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewImage(index)}
                        className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {uploadingImage && (
                        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add images button */}
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed"
                onClick={() => imageInputRef.current?.click()}
              >
                <ImagePlus className="h-5 w-5 mr-2 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {existingImages.length + formImagePreviews.length > 0 
                    ? "Adicionar mais imagens" 
                    : "Adicionar imagens"}
                </span>
              </Button>
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

            {/* Auto-send toggle */}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  Enviar automaticamente
                </Label>
                <p className="text-sm text-muted-foreground">
                  Dispara a mensagem via WhatsApp na data selecionada
                </p>
              </div>
              <Switch checked={formAutoSend} onCheckedChange={setFormAutoSend} />
            </div>

            {formAutoSend && (
              <div className="space-y-2 bg-primary/5 p-3 rounded-lg border border-primary/20">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Horário de envio
                </Label>
                <Input
                  type="time"
                  value={formSendTime}
                  onChange={(e) => setFormSendTime(e.target.value)}
                  className="w-32"
                />
                {formDate && (
                  <p className="text-xs text-muted-foreground">
                    {formRecurring ? (
                      <>Próximo envio: {(() => {
                        const [year, month, day] = formDate.split('-').map(Number);
                        const [hours, minutes] = formSendTime.split(':').map(Number);
                        let sendDate = new Date(year, month - 1, day, hours, minutes);
                        const today = new Date();
                        sendDate.setFullYear(today.getFullYear());
                        if (sendDate < today) {
                          sendDate.setFullYear(today.getFullYear() + 1);
                        }
                        return sendDate.toLocaleString("pt-BR");
                      })()}</>
                    ) : (
                      <>Envio em: {new Date(`${formDate}T${formSendTime}`).toLocaleString("pt-BR")}</>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {/* Test send button - show when editing any existing event */}
            {editingEvent && (
              <Popover open={testPopoverOpen} onOpenChange={setTestPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-muted-foreground hover:text-foreground mr-auto"
                  >
                    <FlaskConical className="h-4 w-4 mr-1.5" />
                    Testar envio
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="start">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Número para teste</Label>
                      <p className="text-xs text-muted-foreground">
                        Envie o momento para um número de teste (não altera o status original)
                      </p>
                    </div>
                    <Input
                      placeholder="+5531999999999"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                    />
                    <Button 
                      className="w-full" 
                      size="sm"
                      disabled={sendingTest || !testPhone.trim()}
                      onClick={async () => {
                        if (!editingEvent || !testPhone.trim()) return;
                        
                        setSendingTest(true);
                        try {
                          const { data, error } = await supabase.functions.invoke("test-cx-moment-send", {
                            body: {
                              life_event_id: editingEvent.id,
                              test_phone: testPhone,
                            },
                          });
                          
                          if (error) throw error;
                          if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
                          
                          toast.success(data.message || "Teste enviado com sucesso!");
                          setTestPopoverOpen(false);
                        } catch (error: unknown) {
                          const errMsg = error instanceof Error ? error.message : "Erro ao enviar teste";
                          toast.error(errMsg);
                        } finally {
                          setSendingTest(false);
                        }
                      }}
                    >
                      {sendingTest && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Send className="h-4 w-4 mr-1.5" />
                      Enviar Teste
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
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
      {/* Image Gallery Lightbox */}
      <ImageGalleryLightbox
        images={galleryImages}
        initialIndex={galleryInitialIndex}
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
      />
    </div>
  );
}
