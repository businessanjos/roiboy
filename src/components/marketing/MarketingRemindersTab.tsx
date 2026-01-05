import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { 
  Bell, 
  Send,
  Calendar,
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
  History,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Trash2,
} from "lucide-react";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const REMINDER_TYPES = [
  { value: "notice", label: "Aviso", description: "Lembrete geral sobre o evento" },
  { value: "rsvp", label: "Confirmação RSVP", description: "Solicitar confirmação de presença" },
  { value: "checkin", label: "Check-in", description: "Instruções de check-in" },
  { value: "feedback", label: "Feedback", description: "Solicitar feedback após o evento" },
];

export default function MarketingRemindersTab() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  
  // Wizard state
  const [step, setStep] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [reminderType, setReminderType] = useState<string>("notice");
  const [messageBody, setMessageBody] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [scheduledFor, setScheduledFor] = useState("");
  
  // History state
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Fetch marketing events
  const { data: events = [] } = useQuery({
    queryKey: ["marketing-events-for-reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, scheduled_at, modality, category")
        .eq("category", "marketing")
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch participants for selected event
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
          clients (full_name, phone_e164, emails)
        `)
        .eq("event_id", selectedEventId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedEventId,
  });

  // Fetch campaign history
  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ["marketing-reminder-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminder_campaigns")
        .select(`
          *,
          events!inner (id, title, scheduled_at, modality, category)
        `)
        .eq("events.category", "marketing")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recipients for selected campaign
  const { data: recipients = [] } = useQuery({
    queryKey: ["reminder-recipients", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const { data, error } = await supabase
        .from("reminder_recipients")
        .select("*")
        .eq("campaign_id", selectedCampaignId)
        .order("send_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCampaignId,
  });

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

  const getParticipantName = (p: any) => {
    return p.clients?.full_name || p.guest_name || "Sem nome";
  };

  const getParticipantPhone = (p: any) => {
    return p.clients?.phone_e164 || p.guest_phone || "";
  };

  const toggleParticipant = (participantId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    );
  };

  const selectAllParticipants = () => {
    if (selectedParticipants.length === participants.length) {
      setSelectedParticipants([]);
    } else {
      setSelectedParticipants(participants.map((p: any) => p.id));
    }
  };

  const handleSendCampaign = async () => {
    if (!selectedEventId || selectedParticipants.length === 0 || !messageBody.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsSending(true);

    try {
      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("reminder_campaigns")
        .insert([{
          event_id: selectedEventId,
          account_id: currentUser?.account_id,
          campaign_type: reminderType,
          message_template: messageBody,
          scheduled_for: sendNow ? null : scheduledFor || null,
          status: sendNow ? "sending" : "scheduled",
          send_whatsapp: true,
          send_email: false,
        }] as any)
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create recipients
      const recipientRecords = selectedParticipants.map((pId, index) => {
        const participant = participants.find((p: any) => p.id === pId);
        return {
          campaign_id: campaign.id,
          account_id: currentUser?.account_id,
          participant_id: pId,
          client_id: participant?.client_id || null,
          recipient_name: getParticipantName(participant),
          recipient_phone: getParticipantPhone(participant),
          whatsapp_status: "pending" as const,
          send_order: index + 1,
        };
      });

      const { error: recipientsError } = await supabase
        .from("reminder_recipients")
        .insert(recipientRecords);

      if (recipientsError) throw recipientsError;

      if (sendNow) {
        // Trigger send function
        const { error: sendError } = await supabase.functions.invoke("send-reminder", {
          body: { campaign_id: campaign.id },
        });

        if (sendError) {
          console.error("Send error:", sendError);
          toast.error("Campanha criada, mas houve erro no envio");
        } else {
          toast.success("Lembretes enviados com sucesso!");
        }
      } else {
        toast.success("Campanha agendada com sucesso!");
      }

      // Reset wizard
      setStep(1);
      setSelectedEventId(null);
      setSelectedParticipants([]);
      setReminderType("notice");
      setMessageBody("");
      setSendNow(true);
      setScheduledFor("");
      
      queryClient.invalidateQueries({ queryKey: ["marketing-reminder-campaigns"] });
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast.error("Erro ao criar campanha");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;

    const { error } = await supabase
      .from("reminder_campaigns")
      .delete()
      .eq("id", campaignToDelete);

    if (error) {
      toast.error("Erro ao excluir campanha");
    } else {
      toast.success("Campanha excluída");
      queryClient.invalidateQueries({ queryKey: ["marketing-reminder-campaigns"] });
    }

    setDeleteDialogOpen(false);
    setCampaignToDelete(null);
  };

  const handleRetryFailed = async (campaignId: string) => {
    try {
      const { error } = await supabase.functions.invoke("retry-failed-reminders", {
        body: { campaign_id: campaignId },
      });

      if (error) throw error;
      toast.success("Reenvio iniciado!");
      queryClient.invalidateQueries({ queryKey: ["reminder-recipients", campaignId] });
    } catch (error) {
      toast.error("Erro ao reenviar");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Enviado</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falha</Badge>;
      case "sending":
        return <Badge><Loader2 className="h-3 w-3 mr-1 animate-spin" />Enviando</Badge>;
      case "scheduled":
        return <Badge variant="outline"><Calendar className="h-3 w-3 mr-1" />Agendado</Badge>;
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Tabs defaultValue="create" className="space-y-4">
      <TabsList>
        <TabsTrigger value="create">
          <Send className="h-4 w-4 mr-2" />
          Novo Lembrete
        </TabsTrigger>
        <TabsTrigger value="history">
          <History className="h-4 w-4 mr-2" />
          Histórico
        </TabsTrigger>
      </TabsList>

      <TabsContent value="create" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Criar Lembrete
            </CardTitle>
            <CardDescription>
              Envie lembretes para participantes de eventos de marketing
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Progress indicator */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className={step >= 1 ? "text-primary font-medium" : "text-muted-foreground"}>
                  1. Evento
                </span>
                <span className={step >= 2 ? "text-primary font-medium" : "text-muted-foreground"}>
                  2. Participantes
                </span>
                <span className={step >= 3 ? "text-primary font-medium" : "text-muted-foreground"}>
                  3. Tipo
                </span>
                <span className={step >= 4 ? "text-primary font-medium" : "text-muted-foreground"}>
                  4. Mensagem
                </span>
                <span className={step >= 5 ? "text-primary font-medium" : "text-muted-foreground"}>
                  5. Enviar
                </span>
              </div>
              <Progress value={(step / 5) * 100} />
            </div>

            {/* Step 1: Select Event */}
            {step === 1 && (
              <div className="space-y-4">
                <Label>Selecione o evento</Label>
                {events.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum evento de marketing encontrado
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedEventId === event.id
                            ? "border-primary bg-primary/5"
                            : "hover:border-muted-foreground/50"
                        }`}
                        onClick={() => setSelectedEventId(event.id)}
                      >
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {event.scheduled_at
                            ? format(new Date(event.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : "Data não definida"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button
                    onClick={() => setStep(2)}
                    disabled={!selectedEventId}
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Select Participants */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Selecione os participantes</Label>
                  <Button variant="outline" size="sm" onClick={selectAllParticipants}>
                    {selectedParticipants.length === participants.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>

                {loadingParticipants ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : participants.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum participante inscrito neste evento
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {participants.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 border rounded-lg"
                      >
                        <Checkbox
                          checked={selectedParticipants.includes(p.id)}
                          onCheckedChange={() => toggleParticipant(p.id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{getParticipantName(p)}</p>
                          <p className="text-sm text-muted-foreground">{getParticipantPhone(p)}</p>
                        </div>
                        <Badge variant="outline">{p.rsvp_status}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={selectedParticipants.length === 0}
                  >
                    Próximo ({selectedParticipants.length} selecionados)
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Select Reminder Type */}
            {step === 3 && (
              <div className="space-y-4">
                <Label>Tipo de lembrete</Label>
                <div className="grid grid-cols-2 gap-3">
                  {REMINDER_TYPES.map((type) => (
                    <div
                      key={type.value}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        reminderType === type.value
                          ? "border-primary bg-primary/5"
                          : "hover:border-muted-foreground/50"
                      }`}
                      onClick={() => setReminderType(type.value)}
                    >
                      <p className="font-medium">{type.label}</p>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                  <Button onClick={() => setStep(4)}>
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Compose Message */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <p className="text-xs text-muted-foreground">
                    Use {"{nome}"} e {"{sobrenome}"} para personalizar
                  </p>
                  <Textarea
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    placeholder="Olá {nome}, lembrando que..."
                    rows={6}
                  />
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                  <Button
                    onClick={() => setStep(5)}
                    disabled={!messageBody.trim()}
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5: Send or Schedule */}
            {step === 5 && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p><strong>Evento:</strong> {selectedEvent?.title}</p>
                  <p><strong>Participantes:</strong> {selectedParticipants.length}</p>
                  <p><strong>Tipo:</strong> {REMINDER_TYPES.find(t => t.value === reminderType)?.label}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="sendNow"
                      checked={sendNow}
                      onCheckedChange={(checked) => setSendNow(checked as boolean)}
                    />
                    <Label htmlFor="sendNow">Enviar agora</Label>
                  </div>

                  {!sendNow && (
                    <div className="space-y-2">
                      <Label>Agendar para</Label>
                      <Input
                        type="datetime-local"
                        value={scheduledFor}
                        onChange={(e) => setScheduledFor(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(4)}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                  <Button
                    onClick={handleSendCampaign}
                    disabled={isSending || (!sendNow && !scheduledFor)}
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {sendNow ? "Enviar Agora" : "Agendar"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="history" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Campanhas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCampaigns ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma campanha de lembrete encontrada
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign: any) => (
                    <TableRow key={campaign.id}>
                      <TableCell>{campaign.events?.title}</TableCell>
                      <TableCell>
                        {REMINDER_TYPES.find(t => t.value === campaign.campaign_type)?.label || campaign.campaign_type}
                      </TableCell>
                      <TableCell>
                        {format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCampaignId(campaign.id);
                            setDetailsDialogOpen(true);
                          }}
                        >
                          Ver detalhes
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setCampaignToDelete(campaign.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Campaign Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Campanha</DialogTitle>
          </DialogHeader>
          {selectedCampaign && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Evento</Label>
                  <p className="font-medium">{(selectedCampaign as any).events?.title}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div>{getStatusBadge(selectedCampaign.status)}</div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Mensagem</Label>
                <p className="whitespace-pre-wrap bg-muted p-3 rounded-lg text-sm">
                  {selectedCampaign.message_template}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground">Destinatários ({recipients.length})</Label>
                {recipients.some((r: any) => r.whatsapp_status === "failed") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRetryFailed(selectedCampaign.id)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reenviar Falhas
                  </Button>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.recipient_name}</TableCell>
                      <TableCell>{r.recipient_phone}</TableCell>
                      <TableCell>{getStatusBadge(r.whatsapp_status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCampaign}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  );
}
