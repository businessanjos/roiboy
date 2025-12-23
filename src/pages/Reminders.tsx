import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  FileText,
  ClipboardCheck,
  Star,
  Eye,
  RefreshCw
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

interface Campaign {
  id: string;
  name: string;
  campaign_type: "notice" | "rsvp" | "checkin" | "feedback";
  status: "draft" | "scheduled" | "sending" | "completed" | "cancelled";
  message_template: string;
  send_whatsapp: boolean;
  send_email: boolean;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  responded_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  scheduled_for: string | null;
  events?: { title: string } | null;
}

interface Recipient {
  id: string;
  recipient_name: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  whatsapp_status: "pending" | "queued" | "sending" | "sent" | "failed" | "responded";
  email_status: "pending" | "queued" | "sending" | "sent" | "failed" | "responded";
  whatsapp_sent_at: string | null;
  email_sent_at: string | null;
  whatsapp_error: string | null;
  email_error: string | null;
  responded_at: string | null;
}

const STEPS = ["event", "participants", "type", "message", "review"] as const;
type Step = typeof STEPS[number];

const CAMPAIGN_TYPES = {
  notice: { icon: Bell, label: "Aviso", description: "Apenas informar sobre o evento" },
  rsvp: { icon: FileText, label: "RSVP", description: "Solicitar confirmação de presença" },
  checkin: { icon: ClipboardCheck, label: "Check-in", description: "Enviar link para check-in no evento" },
  feedback: { icon: Star, label: "Feedback", description: "Solicitar avaliação pós-evento" },
};

const STATUS_CONFIG = {
  pending: { color: "bg-muted text-muted-foreground", label: "Pendente" },
  queued: { color: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400", label: "Na fila" },
  sending: { color: "bg-blue-500/20 text-blue-700 dark:text-blue-400", label: "Enviando" },
  sent: { color: "bg-green-500/20 text-green-700 dark:text-green-400", label: "Enviado" },
  failed: { color: "bg-red-500/20 text-red-700 dark:text-red-400", label: "Falhou" },
  responded: { color: "bg-purple-500/20 text-purple-700 dark:text-purple-400", label: "Respondeu" },
};

const CAMPAIGN_STATUS_CONFIG = {
  draft: { color: "secondary", label: "Rascunho" },
  scheduled: { color: "outline", label: "Agendado" },
  sending: { color: "default", label: "Enviando" },
  completed: { color: "default", label: "Concluído" },
  cancelled: { color: "destructive", label: "Cancelado" },
} as const;

export default function Reminders() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState<Step>("event");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [campaignType, setCampaignType] = useState<keyof typeof CAMPAIGN_TYPES>("notice");
  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [sendEmail, setSendEmail] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<string>("");
  const [sendMode, setSendMode] = useState<"now" | "scheduled">("now");
  
  // UI state
  const [activeTab, setActiveTab] = useState("create");
  const [sending, setSending] = useState(false);
  const [viewingCampaignId, setViewingCampaignId] = useState<string | null>(null);

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

  // Fetch campaigns
  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ["reminder-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminder_campaigns")
        .select(`
          *,
          events(title)
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Campaign[];
    },
  });

  // Fetch recipients for viewing campaign
  const { data: viewingRecipients = [], isLoading: loadingRecipients } = useQuery({
    queryKey: ["campaign-recipients", viewingCampaignId],
    queryFn: async () => {
      if (!viewingCampaignId) return [];
      const { data, error } = await supabase
        .from("reminder_recipients")
        .select("*")
        .eq("campaign_id", viewingCampaignId)
        .order("send_order");
      if (error) throw error;
      return data as Recipient[];
    },
    enabled: !!viewingCampaignId,
  });

  // Generate default message based on type and event
  useEffect(() => {
    const event = events.find(e => e.id === selectedEventId);
    if (!event) return;

    const dateText = event.scheduled_at 
      ? format(new Date(event.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
      : "em breve";

    const messages: Record<string, string> = {
      notice: `Olá {nome}! 👋\n\nLembrando que o evento "${event.title}" acontece ${dateText}.\n\nNos vemos lá!`,
      rsvp: `Olá {nome}! 👋\n\nVocê está convidado(a) para "${event.title}" que acontece ${dateText}.\n\nPor favor, confirme sua presença clicando no link abaixo:\n{link_rsvp}\n\nEsperamos você!`,
      checkin: `Olá {nome}! 🎉\n\nO evento "${event.title}" está acontecendo!\n\nFaça seu check-in pelo link:\n{link_checkin}\n\nNos vemos em breve!`,
      feedback: `Olá {nome}! 🙏\n\nObrigado por participar do evento "${event.title}"!\n\nSua opinião é muito importante. Por favor, avalie o evento pelo link:\n{link_feedback}\n\nObrigado pelo feedback!`,
    };

    setMessage(messages[campaignType] || messages.notice);
    setEmailSubject(`${CAMPAIGN_TYPES[campaignType].label}: ${event.title}`);
    setCampaignName(`${CAMPAIGN_TYPES[campaignType].label} - ${event.title}`);
  }, [selectedEventId, campaignType, events]);

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    setSelectedParticipants([]);
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

  const canProceed = () => {
    switch (currentStep) {
      case "event": return !!selectedEventId;
      case "participants": return selectedParticipants.length > 0;
      case "type": return !!campaignType;
      case "message": return message.trim().length > 0 && (sendWhatsapp || sendEmail);
      case "review": return true;
      default: return false;
    }
  };

  const goToStep = (step: Step) => {
    const currentIndex = STEPS.indexOf(currentStep);
    const targetIndex = STEPS.indexOf(step);
    if (targetIndex <= currentIndex || canProceed()) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex < STEPS.length - 1 && canProceed()) {
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1]);
    }
  };

  const handleSendCampaign = async () => {
    if (!currentUser?.account_id) {
      toast.error("Usuário não autenticado");
      return;
    }

    if (sendMode === "scheduled" && !scheduledFor) {
      toast.error("Selecione a data e hora do agendamento");
      return;
    }

    setSending(true);
    
    try {
      const selectedParticipantData = participants
        .filter(p => selectedParticipants.includes(p.id))
        .map((p, index) => ({
          participant_id: p.id,
          client_id: p.client_id,
          name: getParticipantName(p),
          phone: getParticipantPhone(p),
          email: getParticipantEmail(p),
          send_order: index,
        }));

      if (sendMode === "scheduled") {
        // Create scheduled campaign directly in the database
        const { data: campaign, error: campaignError } = await supabase
          .from("reminder_campaigns")
          .insert({
            account_id: currentUser.account_id,
            event_id: selectedEventId,
            campaign_type: campaignType,
            name: campaignName,
            message_template: message,
            email_subject: emailSubject,
            send_whatsapp: sendWhatsapp,
            send_email: sendEmail,
            status: "scheduled",
            scheduled_for: new Date(scheduledFor).toISOString(),
            total_recipients: selectedParticipantData.length,
            created_by: currentUser.id,
            delay_min_seconds: 3,
            delay_max_seconds: 10,
          })
          .select("id")
          .single();

        if (campaignError) throw campaignError;

        // Create recipient records
        type RecipientStatus = "pending" | "queued" | "sending" | "sent" | "failed" | "responded";
        
        const recipientRecords = selectedParticipantData.map((p, index) => ({
          account_id: currentUser.account_id,
          campaign_id: campaign.id,
          participant_id: p.participant_id,
          client_id: p.client_id,
          recipient_name: p.name,
          recipient_phone: p.phone,
          recipient_email: p.email,
          whatsapp_status: (sendWhatsapp && p.phone ? "queued" : "pending") as RecipientStatus,
          email_status: (sendEmail && p.email ? "queued" : "pending") as RecipientStatus,
          send_order: index,
        }));

        const { error: recipientsError } = await supabase
          .from("reminder_recipients")
          .insert(recipientRecords);

        if (recipientsError) throw recipientsError;

        toast.success(`Campanha agendada para ${format(new Date(scheduledFor), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`);
      } else {
        // Send immediately using the edge function
        const { data, error } = await supabase.functions.invoke("send-reminder", {
          body: {
            event_id: selectedEventId,
            campaign_name: campaignName,
            campaign_type: campaignType,
            participants: selectedParticipantData,
            message_template: message,
            email_subject: emailSubject,
            send_whatsapp: sendWhatsapp,
            send_email: sendEmail,
          },
        });

        if (error) throw error;

        toast.success(`Campanha criada! Enviando para ${selectedParticipantData.length} participantes...`);
        
        if (data?.campaign_id) {
          setViewingCampaignId(data.campaign_id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["reminder-campaigns"] });
      
      // Reset wizard
      setCurrentStep("event");
      setSelectedEventId("");
      setSelectedParticipants([]);
      setCampaignType("notice");
      setMessage("");
      setScheduledFor("");
      setSendMode("now");
      setActiveTab("history");

    } catch (error: any) {
      console.error("Send campaign error:", error);
      toast.error(error.message || "Erro ao criar campanha");
    } finally {
      setSending(false);
    }
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bell className="h-6 w-6" />
          Lembretes
        </h1>
        <p className="text-muted-foreground">
          Crie campanhas de lembretes para os participantes dos seus eventos
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Nova Campanha
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => {
                const isActive = step === currentStep;
                const isPast = STEPS.indexOf(currentStep) > index;
                const stepLabels = {
                  event: "Evento",
                  participants: "Participantes",
                  type: "Tipo",
                  message: "Mensagem",
                  review: "Revisão",
                };
                
                return (
                  <div 
                    key={step} 
                    className="flex items-center cursor-pointer"
                    onClick={() => goToStep(step)}
                  >
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                      isActive 
                        ? "border-primary bg-primary text-primary-foreground" 
                        : isPast 
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-muted-foreground/30 text-muted-foreground"
                    }`}>
                      {isPast ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </div>
                    <span className={`ml-2 text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                      {stepLabels[step]}
                    </span>
                    {index < STEPS.length - 1 && (
                      <ChevronRight className="h-4 w-4 mx-4 text-muted-foreground/50" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <Card className="min-h-[400px]">
            {/* Step 1: Select Event */}
            {currentStep === "event" && (
              <>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Selecione o Evento
                  </CardTitle>
                  <CardDescription>
                    Escolha o evento para o qual deseja enviar lembretes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Select value={selectedEventId} onValueChange={handleSelectEvent}>
                    <SelectTrigger className="w-full">
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
              </>
            )}

            {/* Step 2: Select Participants */}
            {currentStep === "participants" && (
              <>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Selecione os Participantes
                      </CardTitle>
                      <CardDescription>
                        {selectedParticipants.length} de {participants.length} selecionados
                      </CardDescription>
                    </div>
                    {participants.length > 0 && (
                      <Button variant="outline" size="sm" onClick={selectAll}>
                        {selectedParticipants.length === participants.length ? "Desmarcar todos" : "Selecionar todos"}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingParticipants ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      Carregando participantes...
                    </div>
                  ) : participants.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      Nenhum participante neste evento
                    </div>
                  ) : (
                    <div className="grid gap-2 max-h-80 overflow-y-auto">
                      {participants.map((participant) => {
                        const name = getParticipantName(participant);
                        const phone = getParticipantPhone(participant);
                        const email = getParticipantEmail(participant);
                        const isSelected = selectedParticipants.includes(participant.id);
                        
                        return (
                          <div
                            key={participant.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected ? "bg-accent border-primary/50" : "hover:bg-muted"
                            }`}
                            onClick={() => toggleParticipant(participant.id)}
                          >
                            <Checkbox checked={isSelected} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{name}</p>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                {phone && (
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    {phone}
                                  </span>
                                )}
                                {email && (
                                  <span className="flex items-center gap-1 truncate">
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
              </>
            )}

            {/* Step 3: Campaign Type */}
            {currentStep === "type" && (
              <>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Tipo de Lembrete
                  </CardTitle>
                  <CardDescription>
                    Escolha o objetivo desta campanha
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.entries(CAMPAIGN_TYPES).map(([type, config]) => {
                      const Icon = config.icon;
                      const isSelected = campaignType === type;
                      
                      return (
                        <div
                          key={type}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected 
                              ? "border-primary bg-primary/5" 
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => setCampaignType(type as keyof typeof CAMPAIGN_TYPES)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{config.label}</h3>
                              <p className="text-sm text-muted-foreground">{config.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </>
            )}

            {/* Step 4: Message */}
            {currentStep === "message" && (
              <>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Mensagem
                  </CardTitle>
                  <CardDescription>
                    Configure a mensagem que será enviada
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="campaign-name">Nome da Campanha</Label>
                    <Input
                      id="campaign-name"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="Ex: Lembrete Evento X"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="mb-3 block">Canais de Envio</Label>
                    <div className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="whatsapp"
                          checked={sendWhatsapp}
                          onCheckedChange={(checked) => setSendWhatsapp(checked === true)}
                        />
                        <label htmlFor="whatsapp" className="text-sm flex items-center gap-2 cursor-pointer">
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
                        <label htmlFor="email" className="text-sm flex items-center gap-2 cursor-pointer">
                          <Mail className="h-4 w-4 text-blue-500" />
                          Email
                        </label>
                      </div>
                    </div>
                  </div>

                  {sendEmail && (
                    <div>
                      <Label htmlFor="email-subject">Assunto do Email</Label>
                      <Input
                        id="email-subject"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Assunto do email"
                        className="mt-1"
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="message">Mensagem</Label>
                    <Textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Digite a mensagem..."
                      rows={6}
                      className="mt-1 font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Variáveis disponíveis: <code className="bg-muted px-1 rounded">{"{nome}"}</code>, 
                      <code className="bg-muted px-1 rounded ml-1">{"{link_rsvp}"}</code>,
                      <code className="bg-muted px-1 rounded ml-1">{"{link_checkin}"}</code>,
                      <code className="bg-muted px-1 rounded ml-1">{"{link_feedback}"}</code>
                    </p>
                  </div>
                </CardContent>
              </>
            )}

            {/* Step 5: Review */}
            {currentStep === "review" && (
              <>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Revisão
                  </CardTitle>
                  <CardDescription>
                    Confirme os detalhes antes de enviar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Evento</p>
                      <p className="font-medium">{selectedEvent?.title}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Tipo</p>
                      <p className="font-medium">{CAMPAIGN_TYPES[campaignType].label}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Destinatários</p>
                      <p className="font-medium">{selectedParticipants.length} participante(s)</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Canais</p>
                      <p className="font-medium flex items-center gap-2">
                        {sendWhatsapp && <MessageSquare className="h-4 w-4 text-green-500" />}
                        {sendEmail && <Mail className="h-4 w-4 text-blue-500" />}
                        {sendWhatsapp && "WhatsApp"}
                        {sendWhatsapp && sendEmail && " + "}
                        {sendEmail && "Email"}
                      </p>
                    </div>
                  </div>

                  {/* Scheduling Options */}
                  <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                    <p className="text-sm font-medium">Quando enviar?</p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="sendMode"
                          value="now"
                          checked={sendMode === "now"}
                          onChange={() => setSendMode("now")}
                          className="accent-primary"
                        />
                        <span className="text-sm">Enviar agora</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="sendMode"
                          value="scheduled"
                          checked={sendMode === "scheduled"}
                          onChange={() => setSendMode("scheduled")}
                          className="accent-primary"
                        />
                        <span className="text-sm flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Agendar
                        </span>
                      </label>
                    </div>
                    
                    {sendMode === "scheduled" && (
                      <div className="space-y-2">
                        <Label htmlFor="scheduledFor">Data e hora do envio</Label>
                        <Input
                          id="scheduledFor"
                          type="datetime-local"
                          value={scheduledFor}
                          onChange={(e) => setScheduledFor(e.target.value)}
                          min={new Date().toISOString().slice(0, 16)}
                          className="max-w-xs"
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Prévia da Mensagem</p>
                    <pre className="whitespace-pre-wrap text-sm font-mono bg-background p-3 rounded border">
                      {message.replace(/\{nome\}/g, "João Silva")}
                    </pre>
                  </div>

                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {sendMode === "scheduled" 
                        ? `O envio será iniciado automaticamente em ${scheduledFor ? format(new Date(scheduledFor), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "data selecionada"}`
                        : "Os envios serão feitos com intervalo de 3-10 segundos entre cada mensagem para simular envio humano."
                      }
                    </p>
                  </div>
                </CardContent>
              </>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between p-6 pt-0 border-t mt-6">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === "event"}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              
              {currentStep === "review" ? (
                <Button onClick={handleSendCampaign} disabled={sending || (sendMode === "scheduled" && !scheduledFor)}>
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {sendMode === "scheduled" ? "Agendando..." : "Iniciando..."}
                    </>
                  ) : sendMode === "scheduled" ? (
                    <>
                      <Clock className="h-4 w-4 mr-2" />
                      Agendar Envio
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Iniciar Envio
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={nextStep} disabled={!canProceed()}>
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Histórico de Campanhas</CardTitle>
                  <CardDescription>
                    Veja o status e resultados das suas campanhas
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["reminder-campaigns"] })}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingCampaigns ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  Carregando campanhas...
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  Nenhuma campanha criada ainda
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => {
                      const TypeIcon = CAMPAIGN_TYPES[campaign.campaign_type]?.icon || Bell;
                      const progress = campaign.total_recipients > 0
                        ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_recipients) * 100)
                        : 0;
                      
                      return (
                        <TableRow key={campaign.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{campaign.name}</p>
                              <p className="text-sm text-muted-foreground">{campaign.events?.title}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <TypeIcon className="h-4 w-4" />
                              {CAMPAIGN_TYPES[campaign.campaign_type]?.label}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={CAMPAIGN_STATUS_CONFIG[campaign.status]?.color as any || "secondary"}>
                              {CAMPAIGN_STATUS_CONFIG[campaign.status]?.label || campaign.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="w-32">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-green-600">{campaign.sent_count} ✓</span>
                                <span className="text-red-600">{campaign.failed_count} ✗</span>
                                <span className="text-muted-foreground">/ {campaign.total_recipients}</span>
                              </div>
                              <Progress value={progress} className="h-2" />
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {campaign.status === "scheduled" && campaign.scheduled_for ? (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(campaign.scheduled_for), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </div>
                            ) : (
                              format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingCampaignId(campaign.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Campaign Details Dialog */}
      <Dialog open={!!viewingCampaignId} onOpenChange={(open) => !open && setViewingCampaignId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Campanha</DialogTitle>
            <DialogDescription>
              Status de envio para cada destinatário
            </DialogDescription>
          </DialogHeader>
          
          {loadingRecipients ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Resposta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewingRecipients.map((recipient) => (
                  <TableRow key={recipient.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{recipient.recipient_name}</p>
                        <div className="text-xs text-muted-foreground">
                          {recipient.recipient_phone && <span>{recipient.recipient_phone}</span>}
                          {recipient.recipient_phone && recipient.recipient_email && <span> • </span>}
                          {recipient.recipient_email && <span>{recipient.recipient_email}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_CONFIG[recipient.whatsapp_status]?.color}>
                          {STATUS_CONFIG[recipient.whatsapp_status]?.label}
                        </Badge>
                        {recipient.whatsapp_error && (
                          <span className="text-xs text-destructive" title={recipient.whatsapp_error}>
                            <AlertCircle className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      {recipient.whatsapp_sent_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(recipient.whatsapp_sent_at), "HH:mm:ss", { locale: ptBR })}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_CONFIG[recipient.email_status]?.color}>
                          {STATUS_CONFIG[recipient.email_status]?.label}
                        </Badge>
                        {recipient.email_error && (
                          <span className="text-xs text-destructive" title={recipient.email_error}>
                            <AlertCircle className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      {recipient.email_sent_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(recipient.email_sent_at), "HH:mm:ss", { locale: ptBR })}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {recipient.responded_at ? (
                        <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-400">
                          {format(new Date(recipient.responded_at), "dd/MM HH:mm", { locale: ptBR })}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
