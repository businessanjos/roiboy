import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Heart,
  Send,
  MessageSquare,
  Users,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Filter,
  Calendar,
  Gift,
  Cake,
  Baby,
  GraduationCap,
  Briefcase,
  Home,
  Plane,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LifeEvent {
  id: string;
  client_id: string;
  event_type: string;
  title: string;
  description: string | null;
  event_date: string | null;
  is_recurring: boolean;
  source: string;
  clients?: {
    id: string;
    full_name: string;
    phone_e164: string;
  } | null;
}

const STEPS = ["select", "message", "review"] as const;
type Step = typeof STEPS[number];

const EVENT_TYPE_ICONS: Record<string, any> = {
  birthday: Cake,
  aniversário: Cake,
  wedding: Gift,
  casamento: Gift,
  anniversary: Heart,
  aniversário_casamento: Heart,
  baby: Baby,
  nascimento: Baby,
  graduation: GraduationCap,
  formatura: GraduationCap,
  job: Briefcase,
  emprego: Briefcase,
  house: Home,
  mudança: Home,
  travel: Plane,
  viagem: Plane,
  other: Star,
  outro: Star,
};

const getEventIcon = (eventType: string) => {
  const lowerType = eventType.toLowerCase();
  for (const [key, Icon] of Object.entries(EVENT_TYPE_ICONS)) {
    if (lowerType.includes(key)) {
      return Icon;
    }
  }
  return Star;
};

export default function MomentosCxCampaign() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState<Step>("select");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [campaignName, setCampaignName] = useState("Campanha Momentos CX");
  const [message, setMessage] = useState("");
  
  // Filter state
  const [filterEventType, setFilterEventType] = useState<string>("all");
  
  // UI state
  const [sending, setSending] = useState(false);

  // Fetch life events with client data
  const { data: lifeEvents = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["life-events-for-campaign"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_life_events")
        .select(`
          id,
          client_id,
          event_type,
          title,
          description,
          event_date,
          is_recurring,
          source,
          clients(id, full_name, phone_e164)
        `)
        .order("event_date", { ascending: true, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return data as LifeEvent[];
    },
  });

  // Get unique event types for filter
  const eventTypes = [...new Set(lifeEvents.map(e => e.event_type))];

  // Filter events
  const filteredEvents = lifeEvents.filter(e => {
    if (filterEventType !== "all" && e.event_type !== filterEventType) return false;
    return true;
  });

  // Get selected events data
  const selectedEventsData = lifeEvents.filter(e => selectedEvents.includes(e.id));

  // Default message template
  useEffect(() => {
    if (!message) {
      setMessage(`Olá {primeiro_nome}! 👋

Passando aqui para desejar tudo de bom neste momento especial! 🎉

Estamos sempre à disposição.

Um abraço!`);
    }
  }, []);

  const toggleEvent = (eventId: string) => {
    setSelectedEvents(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const selectAll = () => {
    if (selectedEvents.length === filteredEvents.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(filteredEvents.map(e => e.id));
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case "select": return selectedEvents.length > 0;
      case "message": return message.trim().length > 0;
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

    setSending(true);
    
    try {
      // Prepare recipients from selected events
      const recipients = selectedEventsData
        .filter(e => e.clients?.phone_e164) // Only include events with phone
        .map((event, index) => ({
          life_event_id: event.id,
          client_id: event.client_id,
          name: event.clients?.full_name || "Cliente",
          phone: event.clients?.phone_e164,
          event_type: event.event_type,
          event_title: event.title,
          event_date: event.event_date,
          send_order: index,
        }));

      if (recipients.length === 0) {
        toast.error("Nenhum destinatário com telefone válido encontrado");
        setSending(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("send-cx-moment-campaign", {
        body: {
          campaign_name: campaignName,
          recipients,
          message_template: message,
        },
      });

      if (error) throw error;

      toast.success(`Campanha criada! Enviando para ${recipients.length} clientes...`);
      
      // Reset wizard
      setCurrentStep("select");
      setSelectedEvents([]);
      setCampaignName("Campanha Momentos CX");
      setMessage(`Olá {primeiro_nome}! 👋

Passando aqui para desejar tudo de bom neste momento especial! 🎉

Estamos sempre à disposição.

Um abraço!`);

      queryClient.invalidateQueries({ queryKey: ["reminder-campaigns"] });

    } catch (error: any) {
      console.error("Send campaign error:", error);
      toast.error(error.message || "Erro ao criar campanha");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isActive = step === currentStep;
            const isPast = STEPS.indexOf(currentStep) > index;
            const stepLabels = {
              select: "Selecionar Momentos",
              message: "Mensagem",
              review: "Revisar e Enviar",
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

      <Card className="min-h-[400px]">
        {/* Step 1: Select Life Events */}
        {currentStep === "select" && (
          <>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Selecione os Momentos CX
                  </CardTitle>
                  <CardDescription>
                    {selectedEvents.length} de {filteredEvents.length} selecionados
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={filterEventType} onValueChange={setFilterEventType}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filtrar por tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {eventTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filteredEvents.length > 0 && (
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      {selectedEvents.length === filteredEvents.length ? "Desmarcar" : "Selecionar todos"}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingEvents ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  Carregando momentos CX...
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Heart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  Nenhum momento CX encontrado
                  <p className="text-sm mt-2">
                    Os momentos CX são criados automaticamente pela análise de IA ou manualmente no perfil do cliente.
                  </p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Momento</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEvents.map((event) => {
                        const isSelected = selectedEvents.includes(event.id);
                        const hasPhone = !!event.clients?.phone_e164;
                        const EventIcon = getEventIcon(event.event_type);
                        
                        return (
                          <TableRow
                            key={event.id}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? "bg-accent" : "hover:bg-muted/50"
                            } ${!hasPhone ? "opacity-50" : ""}`}
                            onClick={() => hasPhone && toggleEvent(event.id)}
                          >
                            <TableCell>
                              <Checkbox 
                                checked={isSelected} 
                                disabled={!hasPhone}
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{event.clients?.full_name || "Cliente"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {hasPhone ? event.clients?.phone_e164 : "Sem telefone"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <EventIcon className="h-4 w-4 text-muted-foreground" />
                                <span>{event.title}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{event.event_type}</Badge>
                            </TableCell>
                            <TableCell>
                              {event.event_date ? (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </>
        )}

        {/* Step 2: Message */}
        {currentStep === "message" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Mensagem
              </CardTitle>
              <CardDescription>
                Configure a mensagem que será enviada via WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="campaign-name">Nome da Campanha</Label>
                <Input
                  id="campaign-name"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Ex: Aniversariantes do Mês"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite a mensagem..."
                  rows={8}
                  className="mt-1 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Variáveis disponíveis: 
                  <code className="bg-muted px-1 rounded ml-1">{"{nome}"}</code>
                  <code className="bg-muted px-1 rounded ml-1">{"{primeiro_nome}"}</code>
                  <code className="bg-muted px-1 rounded ml-1">{"{sobrenome}"}</code>
                  <code className="bg-muted px-1 rounded ml-1">{"{momento_titulo}"}</code>
                  <code className="bg-muted px-1 rounded ml-1">{"{momento_tipo}"}</code>
                  <code className="bg-muted px-1 rounded ml-1">{"{momento_data}"}</code>
                </p>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3: Review */}
        {currentStep === "review" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Revisar e Enviar
              </CardTitle>
              <CardDescription>
                Confirme os detalhes antes de enviar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Campanha</p>
                  <p className="font-medium">{campaignName}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Destinatários</p>
                  <p className="font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {selectedEventsData.filter(e => e.clients?.phone_e164).length} clientes
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Canal</p>
                  <p className="font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-green-500" />
                    WhatsApp
                  </p>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Prévia da Mensagem</p>
                <pre className="whitespace-pre-wrap text-sm font-mono bg-background p-3 rounded border">
                  {message
                    .replace(/\{nome\}/gi, "João Silva")
                    .replace(/\{primeiro_nome\}/gi, "João")
                    .replace(/\{sobrenome\}/gi, "Silva")
                    .replace(/\{momento_titulo\}/gi, "Aniversário")
                    .replace(/\{momento_tipo\}/gi, "aniversário")
                    .replace(/\{momento_data\}/gi, "25/12/2024")}
                </pre>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Momentos selecionados</p>
                <div className="flex flex-wrap gap-2">
                  {selectedEventsData.slice(0, 10).map(event => (
                    <Badge key={event.id} variant="secondary" className="text-xs">
                      {event.clients?.full_name}: {event.title}
                    </Badge>
                  ))}
                  {selectedEventsData.length > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{selectedEventsData.length - 10} mais
                    </Badge>
                  )}
                </div>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Os envios serão feitos com intervalo de 3-10 segundos entre cada mensagem para simular envio humano.
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
            disabled={currentStep === "select"}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          
          {currentStep === "review" ? (
            <Button onClick={handleSendCampaign} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Iniciando...
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
    </div>
  );
}
