import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localDateTimeToUTC, utcToLocalDateTime } from "@/lib/dateUtils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Video,
  FileText,
  Users,
  Monitor,
  MapPin,
  Clock,
  Calendar,
  CalendarOff,
} from "lucide-react";
import { eachDayOfInterval, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";

export type EventType = "live" | "material" | "mentoria" | "workshop" | "masterclass" | "webinar" | "imersao" | "plantao" | "launch" | "campaign" | "content" | "partnership" | "fair" | "movimento" | "viagem" | "autoridade" | "other";

interface EventProduct {
  product_id: string;
  products: { id: string; name: string };
}

export interface EventData {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  modality: "online" | "presencial";
  address: string | null;
  scheduled_at: string | null;
  ends_at: string | null;
  duration_minutes: number | null;
  meeting_url: string | null;
  material_url: string | null;
  is_recurring: boolean;
  event_products: EventProduct[];
  rsvp_closed?: boolean;
  rsvp_deadline?: string | null;
  rsvp_closure_message?: string | null;
  client_id?: string | null;
}

interface EventEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventData | null;
  onSuccess?: () => void;
}

export function EventEditDialog({ open, onOpenChange, event, onSuccess }: EventEditDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("live");
  const [modality, setModality] = useState<"online" | "presencial">("online");
  const [address, setAddress] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [daySchedules, setDaySchedules] = useState<Record<string, { startTime: string; endTime: string }>>({});
  const [rsvpClosed, setRsvpClosed] = useState(false);
  const [rsvpDeadline, setRsvpDeadline] = useState("");
  const [rsvpClosureMessage, setRsvpClosureMessage] = useState("");
  const [mentorUserId, setMentorUserId] = useState("");
  
  // Everton Pieri's user ID
  const EVERTON_PIERI_ID = 'de43a643-0109-4afb-ac35-be768dbf4090';

  // Fetch account ID
  const { data: accountId } = useQuery({
    queryKey: ["user-account-id", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", user?.id)
        .single();
      return data?.account_id || null;
    },
    enabled: !!user?.id,
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["active-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Populate form when event changes
  useEffect(() => {
    if (event && open) {
      setTitle(event.title);
      setDescription(event.description || "");
      setEventType(event.event_type);
      setModality(event.modality || "online");
      setAddress(event.address || "");
      setScheduledAt(utcToLocalDateTime(event.scheduled_at));
      setEndsAt(utcToLocalDateTime(event.ends_at));
      setIsMultiDay(!!event.ends_at);
      setDurationMinutes(event.duration_minutes?.toString() || "");
      setMeetingUrl(event.meeting_url || "");
      setMaterialUrl(event.material_url || "");
      setIsRecurring(event.is_recurring);
      setSelectedProducts(event.event_products.map(ep => ep.product_id));
      setDaySchedules({});
      setRsvpClosed(event.rsvp_closed ?? false);
      setRsvpDeadline(utcToLocalDateTime(event.rsvp_deadline));
      setRsvpClosureMessage(event.rsvp_closure_message || "");
      setMentorUserId((event as any).mentor_user_id || "");
    }
  }, [event, open]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!event || !accountId) throw new Error("Dados inválidos");

      const eventData: any = {
        title: title.trim(),
        description: description.trim() || null,
        event_type: eventType,
        modality: modality,
        address: modality === "presencial" ? address.trim() || null : null,
        scheduled_at: scheduledAt ? localDateTimeToUTC(scheduledAt) : null,
        ends_at: isMultiDay && endsAt ? localDateTimeToUTC(endsAt) : null,
        duration_minutes: !isMultiDay && durationMinutes ? parseInt(durationMinutes) : null,
        meeting_url: meetingUrl.trim() || null,
        material_url: materialUrl.trim() || null,
        is_recurring: isRecurring,
        rsvp_closed: rsvpClosed,
        rsvp_deadline: rsvpDeadline ? localDateTimeToUTC(rsvpDeadline) : null,
        rsvp_closure_message: rsvpClosureMessage.trim() || null,
        mentor_user_id: mentorUserId || null,
        client_id: event.client_id ?? null,
      };

      const { error } = await supabase
        .from("events")
        .update(eventData)
        .eq("id", event.id);

      if (error) throw error;

      // Update product links
      await supabase.from("event_products").delete().eq("event_id", event.id);
      
      if (selectedProducts.length > 0) {
        const productLinks = selectedProducts.map(productId => ({
          event_id: event.id,
          product_id: productId,
          account_id: accountId,
        }));
        await supabase.from("event_products").insert(productLinks);
      }
    },
    onSuccess: () => {
      toast({ title: "Evento atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["events-with-products"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["mentor-events"] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar evento", variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!event) throw new Error("Evento não encontrado");
      
      await supabase.from("event_products").delete().eq("event_id", event.id);
      const { error } = await supabase.from("events").delete().eq("id", event.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Evento excluído com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["events-with-products"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["mentor-events"] });
      setDeleteDialogOpen(false);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => {
      toast({ title: "Erro ao excluir evento", variant: "destructive" });
    },
  });

  const toggleProductSelection = useCallback((productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  }, []);

  const handleSubmit = () => {
    if (!title.trim()) {
      toast({ title: "Título é obrigatório", variant: "destructive" });
      return;
    }
    updateMutation.mutate();
  };

  if (!event) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Evento</DialogTitle>
            <DialogDescription>
              Atualize as informações do evento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Mentoria ao Vivo - Módulo 1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o evento..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Evento</Label>
                <Select value={eventType} onValueChange={(v: EventType) => setEventType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        Live / Encontro
                      </div>
                    </SelectItem>
                    <SelectItem value="mentoria">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Mentoria
                      </div>
                    </SelectItem>
                    <SelectItem value="workshop">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        Workshop
                      </div>
                    </SelectItem>
                    <SelectItem value="masterclass">
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        Masterclass
                      </div>
                    </SelectItem>
                    <SelectItem value="webinar">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        Webinar
                      </div>
                    </SelectItem>
                    <SelectItem value="imersao">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Imersão
                      </div>
                    </SelectItem>
                    <SelectItem value="plantao">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Plantão de Dúvidas
                      </div>
                    </SelectItem>
                    <SelectItem value="material">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Material / Download
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Modalidade</Label>
                <Select value={modality} onValueChange={(v: "online" | "presencial") => setModality(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        Online
                      </div>
                    </SelectItem>
                    <SelectItem value="presencial">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Presencial
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {modality === "presencial" && (
              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, bairro, cidade..."
                />
              </div>
            )}

            {eventType !== "material" && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="multi_day"
                    checked={isMultiDay}
                    onCheckedChange={(checked) => setIsMultiDay(!!checked)}
                  />
                  <Label htmlFor="multi_day" className="text-sm font-normal">
                    Evento de múltiplos dias
                  </Label>
                </div>

                {isMultiDay ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Data de Início</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={scheduledAt ? scheduledAt.slice(0, 10) : ""}
                        onChange={(e) => {
                          setScheduledAt(e.target.value ? `${e.target.value}T00:00` : "");
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date">Data de Término</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={endsAt ? endsAt.slice(0, 10) : ""}
                        onChange={(e) => {
                          setEndsAt(e.target.value ? `${e.target.value}T23:59` : "");
                        }}
                        min={scheduledAt ? scheduledAt.slice(0, 10) : undefined}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scheduled_at">Data e Hora</Label>
                      <Input
                        id="scheduled_at"
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duração (min)</Label>
                      <Input
                        id="duration"
                        type="number"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        placeholder="60"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="meeting_url">Link da Reunião</Label>
                  <Input
                    id="meeting_url"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="https://zoom.us/j/..."
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="recurring"
                    checked={isRecurring}
                    onCheckedChange={(checked) => setIsRecurring(!!checked)}
                  />
                  <Label htmlFor="recurring" className="text-sm font-normal">
                    Evento recorrente (semanal)
                  </Label>
                </div>
              </>
            )}

            {eventType === "material" && (
              <div className="space-y-2">
                <Label htmlFor="material_url">Link do Material</Label>
                <Input
                  id="material_url"
                  value={materialUrl}
                  onChange={(e) => setMaterialUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Produtos que incluem este evento</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                {products.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum produto cadastrado
                  </p>
                ) : (
                  products.map((product) => (
                    <div key={product.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`product-${product.id}`}
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={() => toggleProductSelection(product.id)}
                      />
                      <Label
                        htmlFor={`product-${product.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {product.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Mentor Linking Section */}
            <div className="space-y-2">
              <Label>Vincular Mentor</Label>
              <Select
                value={mentorUserId || "none"}
                onValueChange={(v) => setMentorUserId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um mentor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value={EVERTON_PIERI_ID}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Everton Pieri
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ao vincular, o mentor receberá notificações 1 dia antes e no dia do evento
              </p>
            </div>
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center gap-2">
                <CalendarOff className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">Confirmações de Presença</Label>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="rsvp_closed" className="text-sm">Encerrar confirmações manualmente</Label>
                  <p className="text-xs text-muted-foreground">
                    {rsvpClosed ? "Confirmações encerradas" : "Confirmações abertas"}
                  </p>
                </div>
                <Switch
                  id="rsvp_closed"
                  checked={rsvpClosed}
                  onCheckedChange={setRsvpClosed}
                />
              </div>

              {!rsvpClosed && (
                <div className="space-y-2">
                  <Label htmlFor="rsvp_deadline">Encerramento automático (opcional)</Label>
                  <Input
                    id="rsvp_deadline"
                    type="datetime-local"
                    value={rsvpDeadline}
                    onChange={(e) => setRsvpDeadline(e.target.value)}
                    placeholder="Definir prazo limite"
                  />
                  <p className="text-xs text-muted-foreground">
                    Após essa data/hora, novas confirmações serão bloqueadas automaticamente
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="rsvp_closure_message">Mensagem ao encerrar (opcional)</Label>
                <Textarea
                  id="rsvp_closure_message"
                  value={rsvpClosureMessage}
                  onChange={(e) => setRsvpClosureMessage(e.target.value)}
                  placeholder="Ex: As confirmações foram encerradas. Para dúvidas, entre em contato pelo WhatsApp..."
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={updateMutation.isPending || deleteMutation.isPending}
              className="w-full sm:w-auto"
            >
              Excluir
            </Button>
            <div className="flex gap-2 flex-1 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O evento "{event?.title}" será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
