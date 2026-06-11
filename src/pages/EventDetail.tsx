import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  Sparkles
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
  const [activeTab, setActiveTab] = useState("overview");
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

  const isLocked = event?.status === 'completed' || event?.status === 'cancelled';

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
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: "Rascunho", variant: "outline" },
      planned: { label: "Planejado", variant: "secondary" },
      confirmed: { label: "Confirmado", variant: "default" },
      in_progress: { label: "Em andamento", variant: "default" },
      completed: { label: "Concluído", variant: "secondary" },
      cancelled: { label: "Cancelado", variant: "destructive" }
    };
    const { label, variant } = config[status || 'draft'] || config.draft;
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
              {getStatusBadge(event.status)}
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
              <>
                <Button 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => confirmStatusChange('completed')}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Evento Concluído
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => confirmStatusChange('cancelled')}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Evento Cancelado
                </Button>
              </>
            ) : (
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => confirmStatusChange('planned')}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reabrir Evento
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{stats.attendeesCount}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Participantes</p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-red-500/10">
              <UserX className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{stats.noShowCount}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Não Compareceu</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10">
              <ListOrdered className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{stats.scheduleItems}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Programação</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-green-500/10">
              <CheckSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{stats.checklistDone}/{stats.checklistTotal}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Checklist</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-purple-500/10">
              <Gift className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{stats.giftsTotal}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Brindes</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-orange-500/10">
              <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(stats.totalCosts)}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Custo Total</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/10">
              <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(stats.paidCosts)}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Pago</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <TabsList className="inline-flex h-auto gap-1 p-1 min-w-max">
            <TabsTrigger value="overview" className="gap-2 text-xs sm:text-sm px-3 py-2">
              <Settings className="h-4 w-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="briefing" className="gap-2 text-xs sm:text-sm px-3 py-2">
              <FileText className="h-4 w-4" />
              Briefing
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2 text-xs sm:text-sm px-3 py-2">
              <ListOrdered className="h-4 w-4" />
              Agenda
            </TabsTrigger>
            <TabsTrigger value="checklist" className="gap-2 text-xs sm:text-sm px-3 py-2">
              <CheckSquare className="h-4 w-4" />
              Checklist
            </TabsTrigger>
            <TabsTrigger value="gifts" className="gap-2 text-xs sm:text-sm px-3 py-2">
              <Gift className="h-4 w-4" />
              Brindes
            </TabsTrigger>
            <TabsTrigger value="costs" className="gap-2 text-xs sm:text-sm px-3 py-2">
              <DollarSign className="h-4 w-4" />
              Custos
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2 text-xs sm:text-sm px-3 py-2">
              <FileText className="h-4 w-4" />
              Notas
            </TabsTrigger>
            <TabsTrigger value="participants" className="gap-2 text-xs sm:text-sm px-3 py-2">
              <Users className="h-4 w-4" />
              Participantes
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2 text-xs sm:text-sm px-3 py-2">
              <Users2 className="h-4 w-4" />
              Equipe
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-2 text-xs sm:text-sm px-3 py-2">
              <Image className="h-4 w-4" />
              Mídia
            </TabsTrigger>
            <TabsTrigger value="design" className="gap-2 text-xs sm:text-sm px-3 py-2">
              <Palette className="h-4 w-4" />
              Design
            </TabsTrigger>
            <TabsTrigger value="feedback" className="gap-2 text-xs sm:text-sm px-3 py-2">

              <MessageSquare className="h-4 w-4" />
              Feedback
            </TabsTrigger>
            <TabsTrigger value="summaries" className="gap-2 text-xs sm:text-sm px-3 py-2">
              <Sparkles className="h-4 w-4" />
              Resumos IA
            </TabsTrigger>
          </TabsList>
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
            onUpdate={fetchStats}
            isLocked={isLocked}
          />
        </TabsContent>

        <TabsContent value="team">
          <EventTeamTab eventId={event.id} accountId={accountId} />
        </TabsContent>

        <TabsContent value="media" className="space-y-4">
          <EventGalleryShareBar eventId={event.id} accountId={accountId} eventName={event.title} />
          <EventMediaTab eventId={event.id} accountId={accountId} />
        </TabsContent>

        <TabsContent value="design">
          <EventDesignTab eventId={event.id} accountId={accountId} />
        </TabsContent>


        <TabsContent value="feedback">
          <EventFeedbackTab eventId={event.id} accountId={accountId} />
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
    </div>
  );
}
