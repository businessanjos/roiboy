import { isEventLocked, resolveEventStatus } from "@/lib/events/eventStatus";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Copy } from "lucide-react";
import DuplicateEventDialog from "@/components/events/DuplicateEventDialog";
import {
  EVENT_PHASES,
  phaseOfTab,
  sanitizeEventTab,
  tabsOfPhase,
  type EventPhaseId,
} from "@/lib/events/eventPhases";
import EventRoiTab from "@/components/events/EventRoiTab";
import EventRemindersTab from "@/components/events/EventRemindersTab";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  Users,
  Users2,
  UserX,
  Video,
  DollarSign,
  Gift,
  CheckSquare,
  FileText,
  ListOrdered,
  Settings,
  QrCode,
  ExternalLink,
  Image,
  Palette,

  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Check
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

import EventScheduleTab from "@/components/events/EventScheduleTab";
import EventChecklistTab from "@/components/events/EventChecklistTab";
import EventGiftsTab from "@/components/events/EventGiftsTab";
import EventCostsTab from "@/components/events/EventCostsTab";
import EventNotesTab from "@/components/events/EventNotesTab";
import EventOverviewTab from "@/components/events/EventOverviewTab";
import EventParticipantsTab from "@/components/events/EventParticipantsTab";
import EventTeamTab from "@/components/events/EventTeamTab";
import EventMediaTab from "@/components/events/EventMediaTab";
import EventFeedbackTab from "@/components/events/EventFeedbackTab";
import EventDesignTab from "@/components/events/EventDesignTab";
import EventBriefingTab from "@/components/events/EventBriefingTab";
import EventGalleryShareBar from "@/components/events/EventGalleryShareBar";
import EventSummariesTab from "@/components/events/summary/EventSummariesTab";


interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  modality: "online" | "presencial";
  address: string | null;
  scheduled_at: string | null;
  ends_at: string | null;
  duration_minutes: number | null;
  meeting_url: string | null;
  material_url: string | null;
  is_recurring: boolean;
  checkin_code: string | null;
  budget: number | null;
  expected_attendees: number | null;
  max_capacity: number | null;
  cover_image_url: string | null;
  status: string | null;
  created_at: string;
  account_id: string;
  public_registration_code: string | null;
  invitation_file_url: string | null;
  rsvp_closed: boolean;
  rsvp_deadline: string | null;
  rsvp_closure_message: string | null;
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = sanitizeEventTab(searchParams.get("tab"));
  const [activePhase, setActivePhase] = useState<EventPhaseId>(() => phaseOfTab(activeTab));

  // Mantém a fase em sincronia com a aba vinda da URL (links compartilháveis).
  useEffect(() => {
    setActivePhase(phaseOfTab(activeTab));
  }, [activeTab]);

  const handleTabChange = useCallback(
    (tab: string) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tab);
      setSearchParams(next, { replace: true });
      setActivePhase(phaseOfTab(tab));
    },
    [searchParams, setSearchParams],
  );

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  // Stats for the overview
  const [stats, setStats] = useState({
    totalCosts: 0,
    paidCosts: 0,
    checklistTotal: 0,
    checklistDone: 0,
    giftsTotal: 0,
    attendeesCount: 0,
    noShowCount: 0,
    scheduleItems: 0
  });

  useEffect(() => {
    if (user && id) {
      fetchAccountId();
      fetchEvent();
      fetchStats();
    }
  }, [user, id]);

  const fetchAccountId = async () => {
    const { data } = await supabase
      .from("users")
      .select("account_id")
      .eq("auth_user_id", user?.id)
      .single();
    
    if (data) {
      setAccountId(data.account_id);
    }
  };

  const fetchEvent = async () => {
    if (!id) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching event:", error);
      toast({
        title: "Erro",
        description: "Evento não encontrado",
        variant: "destructive",
      });
      navigate("/events");
    } else {
      setEvent(data as Event);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    if (!id) return;

    // Fetch costs summary
    const { data: costs } = await supabase
      .from("event_costs")
      .select("estimated_value, actual_value, status")
      .eq("event_id", id);

    const totalCosts = costs?.reduce((sum, c) => sum + (Number(c.actual_value) || Number(c.estimated_value) || 0), 0) || 0;
    const paidCosts = costs?.filter(c => c.status === 'paid').reduce((sum, c) => sum + (Number(c.actual_value) || 0), 0) || 0;

    // Fetch checklist summary
    const { data: checklist } = await supabase
      .from("event_checklist")
      .select("status")
      .eq("event_id", id);

    const checklistTotal = checklist?.length || 0;
    const checklistDone = checklist?.filter(c => c.status === 'done').length || 0;

    // Fetch gifts count
    const { count: giftsTotal } = await supabase
      .from("event_gifts")
      .select("*", { count: 'exact', head: true })
      .eq("event_id", id);

    // Fetch participants count (from event_participants, not attendance)
    const { count: attendeesCount } = await supabase
      .from("event_participants")
      .select("*", { count: 'exact', head: true })
      .eq("event_id", id);

    // Fetch schedule items count
    const { count: scheduleItems } = await supabase
      .from("event_schedule")
      .select("*", { count: 'exact', head: true })
      .eq("event_id", id);

    // Fetch no-show count
    const { count: noShowCount } = await supabase
      .from("event_participants")
      .select("*", { count: 'exact', head: true })
      .eq("event_id", id)
      .eq("rsvp_status", "no_show");

    setStats({
      totalCosts,
      paidCosts,
      checklistTotal,
      checklistDone,
      giftsTotal: giftsTotal || 0,
      attendeesCount: attendeesCount || 0,
      noShowCount: noShowCount || 0,
      scheduleItems: scheduleItems || 0
    });
  };

  const isLocked = event ? isEventLocked(event) : false;
  /**
   * Participantes continuam editáveis após o evento: a presença (e quem faltou)
   * só é registrada depois que o evento acontece. Apenas eventos cancelados
   * bloqueiam a inclusão/importação de participantes.
   */
  const isParticipantsLocked = event?.status === "cancelled";


  /**
   * Prontidão do evento: média ponderada dos quatro sinais operacionais que
   * indicam que o evento está pronto para acontecer.
   */
  const readiness = useMemo(() => {
    const checklistScore = stats.checklistTotal > 0 ? stats.checklistDone / stats.checklistTotal : 0;
    const scheduleScore = stats.scheduleItems > 0 ? 1 : 0;
    const participantsScore = stats.attendeesCount > 0 ? 1 : 0;
    const costsScore = stats.totalCosts > 0 ? 1 : 0;
    return Math.round(
      ((checklistScore * 0.4 + scheduleScore * 0.25 + participantsScore * 0.25 + costsScore * 0.1) as number) * 100,
    );
  }, [stats]);


  const handleChangeStatus = async (newStatus: string) => {
    if (!id) return;
    const { error } = await supabase
      .from("events")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível alterar o status", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Status do evento atualizado" });
      fetchEvent();
      fetchStats();
    }
  };

  const confirmStatusChange = (status: string) => {
    setPendingStatus(status);
    setStatusDialogOpen(true);
  };

  const getStatusDialogContent = () => {
    if (pendingStatus === 'completed') {
      return { title: "Concluir Evento", description: "Tem certeza que deseja marcar este evento como concluído? Não será possível fazer alterações ou convidar participantes enquanto estiver concluído." };
    }
    if (pendingStatus === 'cancelled') {
      return { title: "Cancelar Evento", description: "Tem certeza que deseja cancelar este evento? Não será possível fazer alterações ou convidar participantes enquanto estiver cancelado." };
    }
    return { title: "Reabrir Evento", description: "Deseja reabrir este evento? Ele voltará ao status 'Planejado' e poderá ser editado novamente." };
  };

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      live: "Live",
      material: "Material",
      mentoria: "Mentoria",
      workshop: "Workshop",
      masterclass: "Masterclass",
      webinar: "Webinar",
      imersao: "Imersão",
      plantao: "Plantão"
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string | null) => {
    const effective = event ? resolveEventStatus({ ...event, status }) : (status === "cancelled" ? "cancelled" : "open");
    if (effective === "completed") {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20">
          <Check className="h-3 w-3 mr-1" />
          Concluído
        </Badge>
      );
    }
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: "Rascunho", variant: "outline" },
      planned: { label: "Planejado", variant: "secondary" },
      confirmed: { label: "Confirmado", variant: "default" },
      in_progress: { label: "Em andamento", variant: "default" },
      cancelled: { label: "Cancelado", variant: "destructive" }
    };
    const { label, variant } = config[(effective === "cancelled" ? "cancelled" : status) || 'draft'] || config.draft;
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          className="w-fit gap-2"
          onClick={() => navigate("/events")}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Eventos
        </Button>
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{event.title}</h1>
              {(!event.status || (event.status !== "completed" && event.status !== "cancelled")) && event.scheduled_at && new Date(event.scheduled_at) < new Date()
                ? <Badge variant="secondary">Concluído</Badge>
                : getStatusBadge(event.status)}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
              <Badge variant="outline">{getEventTypeLabel(event.event_type)}</Badge>
              <Badge variant={event.modality === "online" ? "secondary" : "default"}>
                {event.modality === "online" ? (
                  <><Video className="h-3 w-3 mr-1" /> Online</>
                ) : (
                  <><MapPin className="h-3 w-3 mr-1" /> Presencial</>
                )}
              </Badge>
              {event.scheduled_at && (
                <span className="flex items-center gap-1 text-sm">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(event.scheduled_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
              {event.duration_minutes && (
                <span className="flex items-center gap-1 text-sm">
                  <Clock className="h-4 w-4" />
                  {event.duration_minutes} min
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {event.meeting_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={event.meeting_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Link da Reunião
                </a>
              </Button>
            )}
            {event.checkin_code && (
              <Button variant="outline" size="sm">
                <QrCode className="h-4 w-4 mr-2" />
                {event.checkin_code}
              </Button>
            )}
            {!isLocked ? (
              <Button size="sm" onClick={() => confirmStatusChange("completed")}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Concluir evento
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => confirmStatusChange("planned")}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reabrir evento
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Mais ações do evento">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDuplicateOpen(true)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar como nova edição
                </DropdownMenuItem>
                {!isLocked && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => confirmStatusChange("cancelled")}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Cancelar evento
                  </DropdownMenuItem>
                )}
                {isLocked && (
                  <DropdownMenuItem onClick={() => confirmStatusChange("planned")}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reabrir evento
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* KPIs primários + prontidão */}
      <div className="grid grid-cols-1 gap-2 sm:gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.attendeesCount}</p>
              <p className="text-xs text-muted-foreground">
                Participantes{stats.noShowCount > 0 ? ` · ${stats.noShowCount} no-show` : ""}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-2xl font-bold">{readiness}%</p>
              <p className="text-xs text-muted-foreground">Prontidão do evento</p>
            </div>
            <Badge variant={readiness >= 80 ? "default" : readiness >= 40 ? "secondary" : "outline"}>
              {readiness >= 80 ? "Pronto" : readiness >= 40 ? "Em andamento" : "Início"}
            </Badge>
          </div>
          <Progress value={readiness} className="h-1.5 mt-3" />
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(stats.totalCosts)}
              </p>
              <p className="text-xs text-muted-foreground">
                Custo total ·{" "}
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(stats.paidCosts)}{" "}
                pago
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Detalhes secundários */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CheckSquare className="h-3.5 w-3.5" />
          Checklist {stats.checklistDone}/{stats.checklistTotal}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ListOrdered className="h-3.5 w-3.5" />
          {stats.scheduleItems} item(ns) de programação
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Gift className="h-3.5 w-3.5" />
          {stats.giftsTotal} brinde(s)
        </span>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 sm:space-y-6">
        <div className="space-y-2">
          <div className="inline-flex rounded-lg bg-muted p-1 gap-1">
            {EVENT_PHASES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleTabChange(tabsOfPhase(p.id)[0].value)}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                  activePhase === p.id
                    ? "bg-background text-foreground shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <TabsList className="inline-flex h-auto gap-1 p-1 min-w-max">
              {tabsOfPhase(activePhase).map((t) => {
                const Icon = t.icon;
                return (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="gap-2 text-xs sm:text-sm px-3 py-2"
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </div>


        <TabsContent value="overview">
          <EventOverviewTab 
            event={event} 
            accountId={accountId} 
            onUpdate={() => {
              fetchEvent();
              fetchStats();
            }}
            isLocked={isLocked}
          />
        </TabsContent>

        <TabsContent value="briefing">
          <EventBriefingTab eventId={event.id} accountId={accountId} />
        </TabsContent>

        <TabsContent value="schedule">
          <EventScheduleTab eventId={event.id} accountId={accountId} />
        </TabsContent>

        <TabsContent value="checklist">
          <EventChecklistTab 
            eventId={event.id} 
            accountId={accountId}
            onUpdate={fetchStats}
          />
        </TabsContent>

        <TabsContent value="gifts">
          <EventGiftsTab 
            eventId={event.id} 
            accountId={accountId}
            onUpdate={fetchStats}
          />
        </TabsContent>

        <TabsContent value="costs">
          <EventCostsTab 
            eventId={event.id} 
            accountId={accountId}
            budget={event.budget}
            onUpdate={fetchStats}
          />
        </TabsContent>

        <TabsContent value="notes">
          <EventNotesTab eventId={event.id} accountId={accountId} />
        </TabsContent>

        <TabsContent value="participants">
          <EventParticipantsTab 
            eventId={event.id} 
            accountId={accountId}
            maxCapacity={event.max_capacity}
            eventScheduledAt={event.scheduled_at}
            onUpdate={fetchStats}
            isLocked={isParticipantsLocked}

          />
        </TabsContent>

        <TabsContent value="team">
          <EventTeamTab eventId={event.id} accountId={accountId} />
        </TabsContent>

        <TabsContent value="media" className="space-y-4">
          <EventGalleryShareBar eventId={event.id} accountId={accountId} eventName={event.title} />
          <EventMediaTab eventId={event.id} accountId={accountId} />
        </TabsContent>

        <TabsContent value="reminders">
          <EventRemindersTab eventId={event.id} accountId={accountId} />
        </TabsContent>

        <TabsContent value="design">
          <EventDesignTab eventId={event.id} accountId={accountId} />
        </TabsContent>


        <TabsContent value="feedback">
          <EventFeedbackTab eventId={event.id} accountId={accountId} />
        </TabsContent>

        <TabsContent value="roi">
          <EventRoiTab
            eventId={event.id}
            accountId={accountId}
            eventTitle={event.title}
            eventType={event.event_type}
            scheduledAt={event.scheduled_at}
          />
        </TabsContent>

        <TabsContent value="summaries">

          <EventSummariesTab
            eventId={event.id}
            accountId={accountId}
            eventCoverUrl={event.cover_image_url}
            eventTitle={event.title}
          />
        </TabsContent>
      </Tabs>

      {/* Status Change Confirmation Dialog */}
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getStatusDialogContent().title}</AlertDialogTitle>
            <AlertDialogDescription>{getStatusDialogContent().description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingStatus) handleChangeStatus(pendingStatus);
              setStatusDialogOpen(false);
            }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DuplicateEventDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        eventId={id ?? null}
      />
    </div>
  );
}
