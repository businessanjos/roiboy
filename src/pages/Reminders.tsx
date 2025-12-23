import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Bell, 
  Send,
  Mail,
  MessageSquare,
  Calendar,
  Users,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Event {
  id: string;
  title: string;
  scheduled_at: string;
  modality: string;
}

interface Participant {
  id: string;
  client_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  rsvp_status: string;
  clients?: {
    full_name: string;
    phone_e164: string;
    emails: any;
  } | null;
}

export default function Reminders() {
  const { currentUser } = useCurrentUser();
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Fetch upcoming events
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["events-for-reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, scheduled_at, modality")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data as Event[];
    },
  });

  // Fetch participants when event is selected
  const { data: participants = [], isLoading: loadingParticipants } = useQuery({
    queryKey: ["event-participants", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("event_participants")
        .select(`
          id,
          client_id,
          guest_name,
          guest_phone,
          guest_email,
          rsvp_status,
          clients(full_name, phone_e164, emails)
        `)
        .eq("event_id", selectedEventId);
      if (error) throw error;
      return data as Participant[];
    },
    enabled: !!selectedEventId,
  });

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    setSelectedParticipants([]);
    // Set default message
    const event = events.find(e => e.id === eventId);
    if (event) {
      setMessage(`Olá! Lembrando que o evento "${event.title}" acontece em ${format(new Date(event.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}. Confirme sua presença!`);
    }
  };

  const toggleParticipant = (participantId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(participantId) 
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    );
  };

  const selectAll = () => {
    if (selectedParticipants.length === participants.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(participants.map(p => p.id));
    }
  };

  const getParticipantName = (p: Participant) => {
    return p.clients?.full_name || p.guest_name || "Sem nome";
  };

  const getParticipantPhone = (p: Participant) => {
    return p.clients?.phone_e164 || p.guest_phone || null;
  };

  const getParticipantEmail = (p: Participant) => {
    const emails = p.clients?.emails;
    if (Array.isArray(emails) && emails.length > 0) {
      return emails[0];
    }
    return p.guest_email || null;
  };

  const handleSendReminders = async () => {
    if (!selectedEventId || selectedParticipants.length === 0) {
      toast.error("Selecione pelo menos um participante");
      return;
    }

    if (!message.trim()) {
      toast.error("Digite uma mensagem");
      return;
    }

    if (!sendWhatsapp && !sendEmail) {
      toast.error("Selecione pelo menos um canal de envio");
      return;
    }

    setSending(true);
    
    try {
      const selectedParticipantData = participants.filter(p => 
        selectedParticipants.includes(p.id)
      );

      let sentCount = 0;
      let errorCount = 0;

      for (const participant of selectedParticipantData) {
        const name = getParticipantName(participant);
        const personalizedMessage = message.replace(/\{nome\}/g, name);

        // Send WhatsApp
        if (sendWhatsapp) {
          const phone = getParticipantPhone(participant);
          if (phone) {
            // Here you would call your WhatsApp API
            // For now, we'll just log it
            console.log(`WhatsApp para ${phone}: ${personalizedMessage}`);
            sentCount++;
          }
        }

        // Send Email
        if (sendEmail) {
          const email = getParticipantEmail(participant);
          if (email) {
            // Here you would call your email API
            console.log(`Email para ${email}: ${personalizedMessage}`);
            sentCount++;
          }
        }
      }

      toast.success(`${sentCount} lembretes enviados!`);
      setSelectedParticipants([]);
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar lembretes");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bell className="h-6 w-6" />
          Enviar Lembretes
        </h1>
        <p className="text-muted-foreground">
          Selecione um evento e envie lembretes para os participantes
        </p>
      </div>

      <div className="space-y-6">
        {/* Step 1: Select Event */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              1. Selecione o Evento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedEventId} onValueChange={handleSelectEvent}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um evento..." />
              </SelectTrigger>
              <SelectContent>
                {loadingEvents ? (
                  <SelectItem value="loading" disabled>Carregando...</SelectItem>
                ) : events.length === 0 ? (
                  <SelectItem value="none" disabled>Nenhum evento futuro</SelectItem>
                ) : (
                  events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      <div className="flex items-center gap-2">
                        <span>{event.title}</span>
                        <span className="text-muted-foreground text-sm">
                          - {format(new Date(event.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Step 2: Select Participants */}
        {selectedEventId && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  2. Selecione os Participantes
                </CardTitle>
                {participants.length > 0 && (
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    {selectedParticipants.length === participants.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                )}
              </div>
              <CardDescription>
                {selectedParticipants.length} de {participants.length} selecionados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingParticipants ? (
                <div className="text-center py-4 text-muted-foreground">Carregando...</div>
              ) : participants.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  Nenhum participante neste evento
                </div>
              ) : (
                <div className="grid gap-2 max-h-64 overflow-y-auto">
                  {participants.map((participant) => {
                    const name = getParticipantName(participant);
                    const phone = getParticipantPhone(participant);
                    const email = getParticipantEmail(participant);
                    const isSelected = selectedParticipants.includes(participant.id);
                    
                    return (
                      <div
                        key={participant.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected ? "bg-accent border-accent" : "hover:bg-muted"
                        }`}
                        onClick={() => toggleParticipant(participant.id)}
                      >
                        <Checkbox checked={isSelected} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {phone && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {phone}
                              </span>
                            )}
                            {email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {email}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant={
                          participant.rsvp_status === "confirmed" ? "default" :
                          participant.rsvp_status === "declined" ? "destructive" :
                          "secondary"
                        }>
                          {participant.rsvp_status === "confirmed" ? "Confirmado" :
                           participant.rsvp_status === "declined" ? "Recusou" :
                           "Pendente"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Message and Send */}
        {selectedEventId && selectedParticipants.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-5 w-5" />
                3. Mensagem e Envio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Channels */}
              <div>
                <Label className="mb-2 block">Canais de Envio</Label>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="whatsapp"
                      checked={sendWhatsapp}
                      onCheckedChange={(checked) => setSendWhatsapp(checked === true)}
                    />
                    <label htmlFor="whatsapp" className="text-sm flex items-center gap-1 cursor-pointer">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      WhatsApp
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="email"
                      checked={sendEmail}
                      onCheckedChange={(checked) => setSendEmail(checked === true)}
                    />
                    <label htmlFor="email" className="text-sm flex items-center gap-1 cursor-pointer">
                      <Mail className="h-4 w-4 text-blue-500" />
                      Email
                    </label>
                  </div>
                </div>
              </div>

              {/* Message */}
              <div>
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite a mensagem do lembrete..."
                  rows={4}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {"{nome}"} para personalizar com o nome do participante
                </p>
              </div>

              {/* Send Button */}
              <Button 
                onClick={handleSendReminders} 
                disabled={sending}
                className="w-full"
                size="lg"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar para {selectedParticipants.length} participante{selectedParticipants.length > 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
