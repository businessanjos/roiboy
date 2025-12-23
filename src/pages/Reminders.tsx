import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Bell, 
  Send,
  Mail,
  MessageSquare,
  Calendar,
  Users,
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
  History,
  AlertCircle
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

interface ReminderLog {
  id: string;
  reminder_id: string;
  client_id: string | null;
  event_id: string | null;
  channel: "whatsapp" | "email" | "notification";
  status: "pending" | "sent" | "failed" | "cancelled";
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  reminders?: { name: string } | null;
  clients?: { full_name: string } | null;
  events?: { title: string } | null;
}

const channelIcons = {
  whatsapp: MessageSquare,
  email: Mail,
  notification: Bell,
};

const statusConfig = {
  pending: { icon: Clock, color: "text-yellow-500", label: "Pendente" },
  sent: { icon: CheckCircle2, color: "text-green-500", label: "Enviado" },
  failed: { icon: XCircle, color: "text-red-500", label: "Falhou" },
  cancelled: { icon: AlertCircle, color: "text-muted-foreground", label: "Cancelado" },
};

export default function Reminders() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState("send");
  const [lastResults, setLastResults] = useState<{
    whatsapp_sent: number;
    whatsapp_failed: number;
    email_sent: number;
    email_failed: number;
    logs: Array<{ participant: string; channel: string; status: string; error?: string }>;
  } | null>(null);

  // Fetch events
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["events-for-reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, scheduled_at, modality")
        .order("scheduled_at", { ascending: false, nullsFirst: false })
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

  // Fetch reminder logs
  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["reminder-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminder_logs")
        .select(`
          *,
          reminders:reminder_id(name),
          clients:client_id(full_name),
          events:event_id(title)
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as ReminderLog[];
    },
  });

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    setSelectedParticipants([]);
    setLastResults(null);
    const event = events.find(e => e.id === eventId);
    if (event) {
      const dateText = event.scheduled_at 
        ? format(new Date(event.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
        : "em breve";
      setMessage(`Olá {nome}! Lembrando que o evento "${event.title}" acontece ${dateText}. Confirme sua presença!`);
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
    setLastResults(null);
    
    try {
      const selectedParticipantData = participants
        .filter(p => selectedParticipants.includes(p.id))
        .map(p => ({
          id: p.id,
          name: getParticipantName(p),
          phone: getParticipantPhone(p),
          email: getParticipantEmail(p),
          client_id: p.client_id,
        }));

      const { data, error } = await supabase.functions.invoke("send-reminder", {
        body: {
          event_id: selectedEventId,
          participants: selectedParticipantData,
          message: message,
          send_whatsapp: sendWhatsapp,
          send_email: sendEmail,
        },
      });

      if (error) throw error;

      setLastResults(data);
      
      // Invalidate logs query to refresh
      queryClient.invalidateQueries({ queryKey: ["reminder-logs"] });

      const totalSent = (data.whatsapp_sent || 0) + (data.email_sent || 0);
      const totalFailed = (data.whatsapp_failed || 0) + (data.email_failed || 0);

      if (totalFailed > 0 && totalSent > 0) {
        toast.warning(`${totalSent} enviados, ${totalFailed} falharam`);
      } else if (totalFailed > 0) {
        toast.error(`${totalFailed} lembretes falharam`);
      } else {
        toast.success(`${totalSent} lembretes enviados!`);
      }

      setSelectedParticipants([]);
    } catch (error: any) {
      console.error("Send reminder error:", error);
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
          Lembretes
        </h1>
        <p className="text-muted-foreground">
          Envie lembretes para os participantes dos seus eventos
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="send" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Enviar
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-6 space-y-6">
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
                    <SelectItem value="none" disabled>Nenhum evento</SelectItem>
                  ) : (
                    events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        <div className="flex items-center gap-2">
                          <span>{event.title}</span>
                          {event.scheduled_at && (
                            <span className="text-muted-foreground text-sm">
                              - {format(new Date(event.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          )}
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

                {/* Last Results */}
                {lastResults && (
                  <div className="border rounded-lg p-4 mt-4 bg-muted/50">
                    <h4 className="font-medium mb-2">Resultado do Envio</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {sendWhatsapp && (
                        <>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            WhatsApp enviados: {lastResults.whatsapp_sent}
                          </div>
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            WhatsApp falhas: {lastResults.whatsapp_failed}
                          </div>
                        </>
                      )}
                      {sendEmail && (
                        <>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Emails enviados: {lastResults.email_sent}
                          </div>
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            Email falhas: {lastResults.email_failed}
                          </div>
                        </>
                      )}
                    </div>
                    {lastResults.logs.some(l => l.error) && (
                      <div className="mt-3 text-sm">
                        <p className="font-medium text-destructive">Erros:</p>
                        {lastResults.logs
                          .filter(l => l.error)
                          .map((log, i) => (
                            <p key={i} className="text-muted-foreground">
                              • {log.participant} ({log.channel}): {log.error}
                            </p>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {loadingLogs ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : logs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <History className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Nenhum envio registrado</h3>
                <p className="text-muted-foreground text-sm">
                  O histórico de envios aparecerá aqui
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const ChannelIcon = channelIcons[log.channel];
                    const statusInfo = statusConfig[log.status];
                    const StatusIcon = statusInfo.icon;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {log.events?.title || "-"}
                        </TableCell>
                        <TableCell>{log.clients?.full_name || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <ChannelIcon className="h-4 w-4" />
                            <span className="capitalize">{log.channel}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-1 ${statusInfo.color}`}>
                            <StatusIcon className="h-4 w-4" />
                            <span>{statusInfo.label}</span>
                          </div>
                          {log.error_message && (
                            <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">
                              {log.error_message}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
