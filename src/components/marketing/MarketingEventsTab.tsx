import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuditLog } from "@/hooks/useAuditLog";
import { QRCodeSVG } from "qrcode.react";
import { 
  Plus, 
  Calendar, 
  Video, 
  FileText, 
  Pencil, 
  Trash2, 
  Clock,
  Monitor,
  MapPin,
  QrCode,
  Copy,
  Check,
  Users,
  Download,
  BarChart3,
  Megaphone,
  Rocket,
  Handshake,
  Radio,
  Building,
  Presentation,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AttendanceReport from "@/components/events/AttendanceReport";
import { 
  EventType, 
  eventTypeConfig, 
  eventIconMap, 
  getEventTypeConfig 
} from "@/config/eventTypes";

interface Attendance {
  id: string;
  client_id: string;
  join_time: string;
  clients: {
    id: string;
    full_name: string;
    phone_e164: string;
    avatar_url: string | null;
  };
}

interface DealStage {
  id: string;
  name: string;
  color: string;
  display_order: number;
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  modality: "online" | "presencial" | "hibrido";
  address: string | null;
  scheduled_at: string | null;
  ends_at: string | null;
  duration_minutes: number | null;
  meeting_url: string | null;
  material_url: string | null;
  is_recurring: boolean;
  checkin_code: string | null;
  category: "marketing" | "operation";
  color: string | null;
  goals: string | null;
  notes: string | null;
  target_deal_stages: string[] | null;
  goal_invited: number | null;
  goal_confirmed: number | null;
  goal_present: number | null;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
}

interface EventProduct {
  product_id: string;
  products: Product;
}

interface EventWithProducts extends Event {
  event_products: EventProduct[];
}

export default function MarketingEventsTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { logAudit } = useAuditLog();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithProducts | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedEventForQr, setSelectedEventForQr] = useState<EventWithProducts | null>(null);
  const [copied, setCopied] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [selectedEventForAttendance, setSelectedEventForAttendance] = useState<EventWithProducts | null>(null);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEventType, setFilterEventType] = useState<string>("all");
  const [filterModality, setFilterModality] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [modalityTab, setModalityTab] = useState<"all" | "presencial" | "online">("all");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("campaign");
  const [modality, setModality] = useState<"online" | "presencial" | "hibrido">("online");
  const [address, setAddress] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [color, setColor] = useState("#f97316");
  const [goals, setGoals] = useState("");
  const [notes, setNotes] = useState("");
  const [isDateTbd, setIsDateTbd] = useState(false);
  const [tbdMonth, setTbdMonth] = useState<string>("");
  const [targetDealStages, setTargetDealStages] = useState<string[]>([]);
  const [goalInvited, setGoalInvited] = useState<string>("");
  const [goalConfirmed, setGoalConfirmed] = useState<string>("");
  const [goalPresent, setGoalPresent] = useState<string>("");
  
  // Multi-day schedule state
  const [daySchedules, setDaySchedules] = useState<Record<string, { startTime: string; endTime: string }>>({});

  // Fetch deal stages for the commercial dropdown
  const { data: dealStages = [] } = useQuery({
    queryKey: ["deal-stages-for-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_stages")
        .select("id, name, color, display_order")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data as DealStage[]) || [];
    },
    staleTime: 300000,
  });
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
    staleTime: 300000,
  });

  // Fetch all events (marketing and operation)
  const { data: events = [], isLoading: loading } = useQuery({
    queryKey: ["all-events-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(`
          *,
          event_products (
            product_id,
            products (id, name)
          )
        `)
        .in("category", ["marketing", "operation"])
        .order("scheduled_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data as EventWithProducts[]) || [];
    },
    staleTime: 30000,
  });

  // Fetch attendance for selected event
  const { data: attendance = [] } = useQuery({
    queryKey: ["event-attendance", selectedEventForAttendance?.id],
    queryFn: async () => {
      if (!selectedEventForAttendance?.id) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select(`
          id,
          client_id,
          join_time,
          clients (id, full_name, phone_e164, avatar_url)
        `)
        .eq("event_id", selectedEventForAttendance.id)
        .order("join_time", { ascending: true });
      if (error) throw error;
      return (data as Attendance[]) || [];
    },
    enabled: !!selectedEventForAttendance?.id,
  });

  const invalidateEvents = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["marketing-events-list"] });
    queryClient.invalidateQueries({ queryKey: ["events"] });
  }, [queryClient]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setEventType("campaign");
    setModality("online");
    setAddress("");
    setScheduledAt("");
    setEndsAt("");
    setIsMultiDay(false);
    setDurationMinutes("");
    setMeetingUrl("");
    setColor("#f97316");
    setGoals("");
    setNotes("");
    setIsDateTbd(false);
    setTbdMonth("");
    setTargetDealStages([]);
    setGoalInvited("");
    setGoalConfirmed("");
    setGoalPresent("");
    setDaySchedules({});
    setEditingEvent(null);
  };

  const openAttendanceDialog = (event: EventWithProducts) => {
    setSelectedEventForAttendance(event);
    setAttendanceDialogOpen(true);
  };

  const exportAttendanceCSV = () => {
    if (!selectedEventForAttendance || attendance.length === 0) return;

    const headers = ["Nome", "Telefone", "Hora do Check-in"];
    const rows = attendance.map((a) => [
      a.clients.full_name,
      a.clients.phone_e164,
      format(new Date(a.join_time), "dd/MM/yyyy HH:mm", { locale: ptBR })
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `presencas-${selectedEventForAttendance.title.replace(/\s+/g, "-")}.csv`;
    link.click();
  };

  const openEditDialog = (event: EventWithProducts) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description || "");
    setEventType(event.event_type as EventType);
    setModality(event.modality || "online");
    setAddress(event.address || "");
    setScheduledAt(event.scheduled_at ? event.scheduled_at.slice(0, 16) : "");
    setEndsAt(event.ends_at ? event.ends_at.slice(0, 16) : "");
    setIsMultiDay(!!event.ends_at);
    setDurationMinutes(event.duration_minutes?.toString() || "");
    setMeetingUrl(event.meeting_url || "");
    setColor(event.color || "#f97316");
    setGoals(event.goals || "");
    setNotes(event.notes || "");
    setTargetDealStages(Array.isArray(event.target_deal_stages) ? event.target_deal_stages : []);
    setGoalInvited(event.goal_invited?.toString() || "");
    setGoalConfirmed(event.goal_confirmed?.toString() || "");
    setGoalPresent(event.goal_present?.toString() || "");
    setDaySchedules({});
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    if (!isDateTbd && !scheduledAt) {
      toast.error("Data é obrigatória (ou marque 'A definir')");
      return;
    }

    if (isDateTbd && !tbdMonth) {
      toast.error("Selecione pelo menos o mês previsto");
      return;
    }

    if (!accountId) {
      toast.error("Conta não encontrada");
      return;
    }

    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    // If TBD, set scheduled_at to first day of selected month at midnight
    let computedScheduledAt: string | null = null;
    if (isDateTbd && tbdMonth) {
      // tbdMonth format: "2026-03"
      computedScheduledAt = new Date(`${tbdMonth}-01T00:00:00`).toISOString();
    } else if (scheduledAt) {
      computedScheduledAt = new Date(scheduledAt).toISOString();
    }

    const eventData: any = {
      title: title.trim(),
      description: description.trim() || null,
      event_type: eventType,
      modality: modality,
      address: modality === "presencial" ? address.trim() || null : null,
      scheduled_at: computedScheduledAt,
      ends_at: !isDateTbd && endsAt ? new Date(endsAt).toISOString() : null,
      duration_minutes: !isMultiDay && durationMinutes ? parseInt(durationMinutes) : null,
      meeting_url: meetingUrl.trim() || null,
      category: "marketing",
      color: color,
      goals: goals.trim() || null,
      notes: isDateTbd ? `[A DEFINIR - ${tbdMonth}] ${notes.trim() || ''}`.trim() : (notes.trim() || null),
      target_deal_stages: targetDealStages.length > 0 ? targetDealStages : null,
      goal_invited: goalInvited ? parseInt(goalInvited) : 0,
      goal_confirmed: goalConfirmed ? parseInt(goalConfirmed) : 0,
      goal_present: goalPresent ? parseInt(goalPresent) : 0,
      account_id: accountId,
    };

    // Add RSVP code for all new events and checkin_code for presencial
    if (!editingEvent) {
      eventData.public_registration_code = generateCode();
      if (modality === "presencial") {
        eventData.checkin_code = generateCode();
      }
    }

    let eventId: string;

    if (editingEvent) {
      const { error } = await supabase
        .from("events")
        .update(eventData)
        .eq("id", editingEvent.id);

      if (error) {
        toast.error("Não foi possível atualizar o evento");
        return;
      }
      eventId = editingEvent.id;
    } else {
      const { data, error } = await supabase
        .from("events")
        .insert(eventData)
        .select("id")
        .single();

      if (error || !data) {
        toast.error("Não foi possível criar o evento");
        return;
      }
      eventId = data.id;
    }

    logAudit({
      action: editingEvent ? "update" : "create",
      entityType: "event",
      entityId: eventId,
      entityName: title.trim(),
      details: { event_type: eventType, modality, category: "marketing" }
    });

    toast.success(editingEvent ? "Evento atualizado" : "Evento criado");

    setDialogOpen(false);
    resetForm();
    invalidateEvents();
  };

  const handleDelete = async (id: string) => {
    const eventToDelete = events.find(e => e.id === id);
    
    const { error } = await supabase.from("events").delete().eq("id", id);

    if (error) {
      toast.error("Não foi possível excluir o evento");
    } else {
      logAudit({
        action: "delete",
        entityType: "event",
        entityId: id,
        entityName: eventToDelete?.title || "Evento",
      });
      
      toast.success("Evento excluído");
      invalidateEvents();
    }
  };

  const openQrDialog = (event: EventWithProducts) => {
    setSelectedEventForQr(event);
    setQrDialogOpen(true);
  };

  const copyCheckinLink = async (code: string) => {
    const link = `${window.location.origin}/event-checkin/${code}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copiado!");
  };

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch = 
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterEventType === "all" || event.event_type === filterEventType;
      const matchesModality = filterModality === "all" || event.modality === filterModality;
      const matchesCategory = filterCategory === "all" || event.category === filterCategory;
      const matchesModalityTab = modalityTab === "all" || event.modality === modalityTab;
      
      return matchesSearch && matchesType && matchesModality && matchesCategory && matchesModalityTab;
    });
  }, [events, searchTerm, filterEventType, filterModality, filterCategory, modalityTab]);

  const presencialCount = events.filter(e => e.modality === "presencial").length;
  const onlineCount = events.filter(e => e.modality === "online").length;
  const marketingCount = events.filter(e => e.category === "marketing").length;
  const operationCount = events.filter(e => e.category === "operation").length;

  const hasActiveFilters = filterEventType !== "all" || filterModality !== "all" || filterCategory !== "all";

  const clearFilters = () => {
    setFilterEventType("all");
    setFilterModality("all");
    setFilterCategory("all");
  };

  const getTypeInfo = (type: string) => {
    return getEventTypeConfig(type);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex-1">
          <Input
            placeholder="Buscar eventos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Evento
        </Button>
      </div>

      {/* Modality tabs */}
      <Tabs value={modalityTab} onValueChange={(v) => setModalityTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">
            Todos ({events.length})
          </TabsTrigger>
          <TabsTrigger value="presencial">
            <MapPin className="h-4 w-4 mr-1" />
            Presencial ({presencialCount})
          </TabsTrigger>
          <TabsTrigger value="online">
            <Monitor className="h-4 w-4 mr-1" />
            Online ({onlineCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            <SelectItem value="marketing">Marketing ({marketingCount})</SelectItem>
            <SelectItem value="operation">Operação ({operationCount})</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEventType} onValueChange={setFilterEventType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(eventTypeConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Events table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Data</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Comercial</TableHead>
                <TableHead>Produtos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum evento encontrado</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEvents.map((event) => {
                  const typeInfo = getTypeInfo(event.event_type);
                  const IconComponent = eventIconMap[typeInfo.icon] || Calendar;
                  const eventDate = event.scheduled_at ? new Date(event.scheduled_at) : null;
                  return (
                    <TableRow key={event.id}>
                      {/* Large Date Column */}
                      <TableCell className="w-20">
                        {eventDate ? (
                          <div 
                            className="flex flex-col items-center justify-center rounded-lg px-2 py-1 min-w-[56px]"
                            style={{ backgroundColor: `${typeInfo.defaultColor}15` }}
                          >
                            <span 
                              className="text-2xl font-bold leading-none"
                              style={{ color: typeInfo.defaultColor }}
                            >
                              {format(eventDate, "dd")}
                            </span>
                            <span 
                              className="text-[10px] font-medium uppercase"
                              style={{ color: typeInfo.defaultColor }}
                            >
                              {format(eventDate, "MMM", { locale: ptBR })}
                            </span>
                            <span className="text-[9px] text-muted-foreground">
                              {format(eventDate, "HH:mm")}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center rounded-lg px-2 py-1 min-w-[56px] bg-muted/50">
                            <span className="text-lg font-medium text-muted-foreground">TBD</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-1.5 h-10 rounded-full"
                            style={{ backgroundColor: typeInfo.defaultColor }}
                          />
                          <div>
                            <p className="font-medium">{event.title}</p>
                            {event.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                                {event.description}
                              </p>
                            )}
                            {event.ends_at && (
                              <p className="text-[10px] text-muted-foreground">
                                até {format(new Date(event.ends_at), "dd/MM HH:mm", { locale: ptBR })}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={event.category === "marketing" ? "default" : "secondary"}
                          className={event.category === "marketing" 
                            ? "bg-orange-500 hover:bg-orange-600 text-white" 
                            : "bg-blue-500 hover:bg-blue-600 text-white"
                          }
                        >
                          {event.category === "marketing" ? "MARKETING" : "OPERAÇÃO"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          style={{ 
                            borderColor: typeInfo.defaultColor,
                            color: typeInfo.defaultColor 
                          }}
                        >
                          <IconComponent className="h-3 w-3 mr-1" />
                          {typeInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={event.modality === "presencial" ? "default" : event.modality === "hibrido" ? "default" : "secondary"}
                          className={event.modality === "hibrido" ? "bg-purple-500 hover:bg-purple-600" : ""}
                        >
                          {event.modality === "presencial" ? (
                            <><MapPin className="h-3 w-3 mr-1" /> Presencial</>
                          ) : event.modality === "hibrido" ? (
                            <><Users className="h-3 w-3 mr-1" /> Híbrido</>
                          ) : (
                            <><Monitor className="h-3 w-3 mr-1" /> Online</>
                          )}
                        </Badge>
                        {(event.modality === "presencial" || event.modality === "hibrido") && event.address && (
                          <p className="text-xs text-muted-foreground mt-1">{event.address}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const stages = Array.isArray(event.target_deal_stages) ? event.target_deal_stages : [];
                          if (stages.length === 0) {
                            return <span className="text-xs text-muted-foreground">—</span>;
                          }
                          const stageNames = stages
                            .map(stageId => dealStages.find(s => s.id === stageId))
                            .filter(Boolean)
                            .map(s => s!.name);
                          return (
                            <div className="flex flex-wrap gap-1">
                              {stageNames.slice(0, 2).map((name, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                                  {name}
                                </Badge>
                              ))}
                              {stageNames.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{stageNames.length - 2}
                                </Badge>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {event.event_products && event.event_products.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {event.event_products.map((ep) => (
                              <Badge key={ep.product_id} variant="outline" className="text-xs">
                                {ep.products.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Nenhum</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {event.modality === "presencial" && event.checkin_code && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openQrDialog(event)}
                                  >
                                    <QrCode className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>QR Code Check-in</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openAttendanceDialog(event)}
                                >
                                  <Users className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Presenças</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(`/events/${event.id}`)}
                                >
                                  <BarChart3 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Detalhes</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(event)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(event.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Editar Evento" : "Novo Evento de Marketing"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nome do evento"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={eventType} onValueChange={(v) => {
                  setEventType(v as EventType);
                  setColor(getEventTypeConfig(v).defaultColor);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(eventTypeConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Modalidade</Label>
                <Select value={modality} onValueChange={(v) => setModality(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="hibrido">Híbrido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(modality === "presencial" || modality === "hibrido") && (
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Local do evento"
                />
              </div>
            )}

            {(modality === "online" || modality === "hibrido") && (
              <div className="space-y-2">
                <Label>Link da Reunião</Label>
                <Input
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}

            {/* Date TBD toggle */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isDateTbd"
                checked={isDateTbd}
                onCheckedChange={(checked) => {
                  setIsDateTbd(!!checked);
                  if (checked) {
                    setScheduledAt("");
                    setEndsAt("");
                  } else {
                    setTbdMonth("");
                  }
                }}
              />
              <Label htmlFor="isDateTbd" className="text-sm font-normal cursor-pointer">
                Data a definir
              </Label>
            </div>

            {isDateTbd ? (
              <div className="space-y-2">
                <Label>Mês Previsto *</Label>
                <Input
                  type="month"
                  value={tbdMonth}
                  onChange={(e) => setTbdMonth(e.target.value)}
                  placeholder="Selecione o mês"
                />
                <p className="text-xs text-muted-foreground">
                  A data exata será definida posteriormente
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data/Hora Início *</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data/Hora Fim</Label>
                  <Input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição do evento..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Objetivos</Label>
              <Textarea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="Objetivos do evento..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Comercial - Etapas do Pipeline</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Selecione quais leads podem ser convidados para este evento
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                {dealStages.map((stage) => (
                  <div key={stage.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`stage-${stage.id}`}
                      checked={targetDealStages.includes(stage.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setTargetDealStages(prev => [...prev, stage.id]);
                        } else {
                          setTargetDealStages(prev => prev.filter(id => id !== stage.id));
                        }
                      }}
                    />
                    <Label 
                      htmlFor={`stage-${stage.id}`} 
                      className="text-sm font-normal cursor-pointer flex items-center gap-2"
                    >
                      <span 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </Label>
                  </div>
                ))}
              </div>
              {targetDealStages.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {targetDealStages.length} etapa(s) selecionada(s)
                </p>
              )}
            </div>

            {/* Goals Section */}
            <div className="space-y-2 border-t pt-4">
              <Label className="font-medium">Metas do Evento</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="goalInvited" className="text-xs text-muted-foreground">
                    Convidados
                  </Label>
                  <Input
                    id="goalInvited"
                    type="number"
                    min="0"
                    value={goalInvited}
                    onChange={(e) => setGoalInvited(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="goalConfirmed" className="text-xs text-muted-foreground">
                    Confirmados
                  </Label>
                  <Input
                    id="goalConfirmed"
                    type="number"
                    min="0"
                    value={goalConfirmed}
                    onChange={(e) => setGoalConfirmed(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="goalPresent" className="text-xs text-muted-foreground">
                    Presentes
                  </Label>
                  <Input
                    id="goalPresent"
                    type="number"
                    min="0"
                    value={goalPresent}
                    onChange={(e) => setGoalPresent(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas internas..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!title.trim()}>
              {editingEvent ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code Check-in</DialogTitle>
          </DialogHeader>
          {selectedEventForQr && (
            <div className="flex flex-col items-center gap-4">
              <QRCodeSVG
                value={`${window.location.origin}/event-checkin/${selectedEventForQr.checkin_code}`}
                size={200}
              />
              <p className="text-sm text-muted-foreground text-center">
                {selectedEventForQr.title}
              </p>
              <Button
                variant="outline"
                onClick={() => copyCheckinLink(selectedEventForQr.checkin_code!)}
              >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copiado!" : "Copiar Link"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Attendance Dialog */}
      <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Presenças - {selectedEventForAttendance?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedEventForAttendance && (
            <div className="space-y-4">
              {/* Goals Progress Bars */}
              {(selectedEventForAttendance.goal_invited || selectedEventForAttendance.goal_confirmed || selectedEventForAttendance.goal_present) ? (
                <div className="grid gap-3 p-4 bg-muted/50 rounded-lg">
                  {selectedEventForAttendance.goal_present && selectedEventForAttendance.goal_present > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Meta de Presentes</span>
                        <span className="font-medium">
                          {attendance.length} / {selectedEventForAttendance.goal_present}
                        </span>
                      </div>
                      <Progress 
                        value={Math.min(100, (attendance.length / selectedEventForAttendance.goal_present) * 100)} 
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {Math.round((attendance.length / selectedEventForAttendance.goal_present) * 100)}% da meta
                      </p>
                    </div>
                  )}
                  {selectedEventForAttendance.goal_confirmed && selectedEventForAttendance.goal_confirmed > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Meta de Confirmados</span>
                        <span className="font-medium text-blue-600">
                          Meta: {selectedEventForAttendance.goal_confirmed}
                        </span>
                      </div>
                      <Progress 
                        value={0} 
                        className="h-2 opacity-50"
                      />
                      <p className="text-xs text-muted-foreground">Confirmações não rastreadas ainda</p>
                    </div>
                  )}
                  {selectedEventForAttendance.goal_invited && selectedEventForAttendance.goal_invited > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Meta de Convidados</span>
                        <span className="font-medium text-amber-600">
                          Meta: {selectedEventForAttendance.goal_invited}
                        </span>
                      </div>
                      <Progress 
                        value={0} 
                        className="h-2 opacity-50"
                      />
                      <p className="text-xs text-muted-foreground">Convites não rastreados ainda</p>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {attendance.length} participante(s)
                </p>
                {attendance.length > 0 && (
                  <Button variant="outline" size="sm" onClick={exportAttendanceCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                )}
              </div>

              {attendance.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhuma presença registrada
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participante</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Check-in</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={a.clients.avatar_url || undefined} />
                              <AvatarFallback>
                                {a.clients.full_name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{a.clients.full_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{a.clients.phone_e164}</TableCell>
                        <TableCell>
                          {format(new Date(a.join_time), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
