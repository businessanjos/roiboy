import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { QRCodeSVG } from "qrcode.react";
import { 
  Plus, 
  Calendar, 
  Video, 
  FileText, 
  Pencil, 
  Trash2, 
  Clock,
  Link as LinkIcon,
  Package,
  Monitor,
  MapPin,
  QrCode,
  Copy,
  Check,
  Users,
  Download,
  BarChart3,
  Lock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AttendanceReport from "@/components/events/AttendanceReport";
import { FilterBar, FilterItem } from "@/components/ui/filter-bar";
import { PlanLimitAlert } from "@/components/plan/PlanLimitAlert";

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

type EventType = "live" | "material" | "mentoria" | "workshop" | "masterclass" | "webinar" | "imersao" | "plantao";

interface Event {
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
  checkin_code: string | null;
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

export default function Events() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { canCreate } = usePlanLimits();
  const [events, setEvents] = useState<EventWithProducts[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithProducts | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedEventForQr, setSelectedEventForQr] = useState<EventWithProducts | null>(null);
  const [copied, setCopied] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [selectedEventForAttendance, setSelectedEventForAttendance] = useState<EventWithProducts | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEventType, setFilterEventType] = useState<string>("all");
  const [filterModality, setFilterModality] = useState<string>("all");
  const [modalityTab, setModalityTab] = useState<"all" | "presencial" | "online">("all");

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

  useEffect(() => {
    if (user) {
      fetchAccountId();
      fetchProducts();
      fetchEvents();
    }
  }, [user]);

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

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setProducts(data);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select(`
        *,
        event_products (
          product_id,
          products (id, name)
        )
      `)
      .order("scheduled_at", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Error fetching events:", error);
    } else {
      setEvents((data as EventWithProducts[]) || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setEventType("live");
    setModality("online");
    setAddress("");
    setScheduledAt("");
    setEndsAt("");
    setIsMultiDay(false);
    setDurationMinutes("");
    setMeetingUrl("");
    setMaterialUrl("");
    setIsRecurring(false);
    setSelectedProducts([]);
    setEditingEvent(null);
  };

  const fetchAttendance = async (eventId: string) => {
    setLoadingAttendance(true);
    const { data, error } = await supabase
      .from("attendance")
      .select(`
        id,
        client_id,
        join_time,
        clients (id, full_name, phone_e164, avatar_url)
      `)
      .eq("event_id", eventId)
      .order("join_time", { ascending: true });

    if (error) {
      console.error("Error fetching attendance:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de presenças",
        variant: "destructive",
      });
    } else {
      setAttendance((data as Attendance[]) || []);
    }
    setLoadingAttendance(false);
  };

  const openAttendanceDialog = (event: EventWithProducts) => {
    setSelectedEventForAttendance(event);
    setAttendanceDialogOpen(true);
    fetchAttendance(event.id);
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
    setEventType(event.event_type);
    setModality(event.modality || "online");
    setAddress(event.address || "");
    setScheduledAt(event.scheduled_at ? event.scheduled_at.slice(0, 16) : "");
    setEndsAt(event.ends_at ? event.ends_at.slice(0, 16) : "");
    setIsMultiDay(!!event.ends_at);
    setDurationMinutes(event.duration_minutes?.toString() || "");
    setMeetingUrl(event.meeting_url || "");
    setMaterialUrl(event.material_url || "");
    setIsRecurring(event.is_recurring);
    setSelectedProducts(event.event_products.map(ep => ep.product_id));
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: "Erro",
        description: "Título é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!accountId) {
      toast({
        title: "Erro",
        description: "Conta não encontrada",
        variant: "destructive",
      });
      return;
    }

    // Generate checkin code for presencial events
    const generateCheckinCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    const eventData: any = {
      title: title.trim(),
      description: description.trim() || null,
      event_type: eventType,
      modality: modality,
      address: modality === "presencial" ? address.trim() || null : null,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      ends_at: isMultiDay && endsAt ? new Date(endsAt).toISOString() : null,
      duration_minutes: !isMultiDay && durationMinutes ? parseInt(durationMinutes) : null,
      meeting_url: meetingUrl.trim() || null,
      material_url: materialUrl.trim() || null,
      is_recurring: isRecurring,
      account_id: accountId,
    };

    // Add checkin_code for new presencial events
    if (!editingEvent && modality === "presencial") {
      eventData.checkin_code = generateCheckinCode();
    }

    let eventId: string;

    if (editingEvent) {
      const { error } = await supabase
        .from("events")
        .update(eventData)
        .eq("id", editingEvent.id);

      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível atualizar o evento",
          variant: "destructive",
        });
        return;
      }
      eventId = editingEvent.id;

      // Remove existing product links
      await supabase
        .from("event_products")
        .delete()
        .eq("event_id", editingEvent.id);
    } else {
      const { data, error } = await supabase
        .from("events")
        .insert(eventData)
        .select("id")
        .single();

      if (error || !data) {
        toast({
          title: "Erro",
          description: "Não foi possível criar o evento",
          variant: "destructive",
        });
        return;
      }
      eventId = data.id;
    }

    // Add product links
    if (selectedProducts.length > 0) {
      const productLinks = selectedProducts.map(productId => ({
        event_id: eventId,
        product_id: productId,
        account_id: accountId,
      }));

      await supabase.from("event_products").insert(productLinks);
    }

    toast({
      title: editingEvent ? "Evento atualizado" : "Evento criado",
      description: `${title} foi ${editingEvent ? "atualizado" : "criado"} com sucesso.`,
    });

    setDialogOpen(false);
    resetForm();
    fetchEvents();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o evento",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Evento excluído",
        description: "O evento foi removido com sucesso.",
      });
      fetchEvents();
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Filter events based on search, filters, and modality tab
  const filteredEvents = events.filter((event) => {
    const matchesSearch = 
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterEventType === "all" || event.event_type === filterEventType;
    const matchesModality = filterModality === "all" || event.modality === filterModality;
    const matchesModalityTab = modalityTab === "all" || event.modality === modalityTab;
    
    return matchesSearch && matchesType && matchesModality && matchesModalityTab;
  });

  // Count events by modality
  const presencialCount = events.filter(e => e.modality === "presencial").length;
  const onlineCount = events.filter(e => e.modality === "online").length;

  const hasActiveFilters = filterEventType !== "all" || filterModality !== "all";

  const clearFilters = () => {
    setFilterEventType("all");
    setFilterModality("all");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Eventos</h1>
          <p className="text-muted-foreground">
            Gerencie entregáveis, lives e materiais dos seus produtos.
          </p>
        </div>
      </div>

      <Tabs defaultValue="eventos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="eventos" className="gap-2">
            <Calendar className="h-4 w-4" />
            Eventos
          </TabsTrigger>
          <TabsTrigger value="relatorio" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Relatório de Presença
          </TabsTrigger>
        </TabsList>

        <TabsContent value="eventos" className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <FilterBar
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Buscar por título ou descrição..."
              filtersActive={hasActiveFilters}
              onClearFilters={clearFilters}
            >
              <FilterItem>
                <Select value={filterEventType} onValueChange={setFilterEventType}>
                  <SelectTrigger className="w-full sm:w-[150px] h-10">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="mentoria">Mentoria</SelectItem>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="masterclass">Masterclass</SelectItem>
                    <SelectItem value="webinar">Webinar</SelectItem>
                    <SelectItem value="imersao">Imersão</SelectItem>
                    <SelectItem value="plantao">Plantão</SelectItem>
                    <SelectItem value="material">Material</SelectItem>
                  </SelectContent>
                </Select>
              </FilterItem>
              <FilterItem>
                <Select value={filterModality} onValueChange={setFilterModality}>
                  <SelectTrigger className="w-full sm:w-[140px] h-10">
                    <SelectValue placeholder="Modalidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                  </SelectContent>
                </Select>
              </FilterItem>
            </FilterBar>
            
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button 
                  className="gap-2 shrink-0"
                  disabled={!canCreate("events")}
                  title={!canCreate("events") ? "Limite de eventos atingido. Faça upgrade do plano." : undefined}
                >
                  {!canCreate("events") ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {!canCreate("events") ? "Limite atingido" : "Novo Evento"}
                </Button>
              </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? "Editar Evento" : "Novo Evento"}
              </DialogTitle>
              <DialogDescription>
                {editingEvent
                  ? "Atualize as informações do evento."
                  : "Cadastre um novo entregável ou evento."}
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

              {eventType === "live" && (
                <>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="multi_day"
                      checked={isMultiDay}
                      onCheckedChange={(checked) => setIsMultiDay(!!checked)}
                    />
                    <Label htmlFor="multi_day" className="text-sm font-normal">
                      Evento de múltiplos dias (ex: imersão de 3 dias)
                    </Label>
                  </div>

                  {isMultiDay ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="scheduled_at">Início</Label>
                        <Input
                          id="scheduled_at"
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ends_at">Término</Label>
                        <Input
                          id="ends_at"
                          type="datetime-local"
                          value={endsAt}
                          onChange={(e) => setEndsAt(e.target.value)}
                          min={scheduledAt}
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
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit}>
                {editingEvent ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
            </Dialog>
          </div>

      {/* Sub-tabs for modality */}
      <Tabs value={modalityTab} onValueChange={(v) => setModalityTab(v as "all" | "presencial" | "online")} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <Calendar className="h-4 w-4" />
            Todos
            <Badge variant="secondary" className="ml-1">{events.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="presencial" className="gap-2">
            <MapPin className="h-4 w-4" />
            Presenciais
            <Badge variant="secondary" className="ml-1">{presencialCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="online" className="gap-2">
            <Monitor className="h-4 w-4" />
            Online
            <Badge variant="secondary" className="ml-1">{onlineCount}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={modalityTab} className="mt-0">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {modalityTab === "presencial" ? (
              <><MapPin className="h-5 w-5" /> Eventos Presenciais</>
            ) : modalityTab === "online" ? (
              <><Monitor className="h-5 w-5" /> Eventos Online</>
            ) : (
              <><Calendar className="h-5 w-5" /> Todos os Eventos</>
            )}
          </CardTitle>
          <CardDescription>
            {modalityTab === "presencial" 
              ? "Eventos presenciais com check-in via QR Code"
              : modalityTab === "online"
              ? "Lives, webinars e eventos online"
              : "Todos os eventos e entregáveis cadastrados"}
          </CardDescription>
        </CardHeader>
        <CardContent>
            {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando eventos...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {events.length === 0 
                ? "Nenhum evento cadastrado ainda."
                : "Nenhum evento encontrado com os filtros selecionados."
              }
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Produtos</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow 
                      key={event.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/events/${event.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium">{event.title}</div>
                        {event.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {event.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={event.event_type === "live" ? "default" : "secondary"}>
                          {event.event_type === "live" ? (
                            <><Video className="h-3 w-3 mr-1" /> Live</>
                          ) : (
                            <><FileText className="h-3 w-3 mr-1" /> Material</>
                          )}
                        </Badge>
                        {event.is_recurring && (
                          <Badge variant="outline" className="ml-1">
                            Recorrente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline">
                            {event.modality === "online" ? (
                              <><Monitor className="h-3 w-3 mr-1" /> Online</>
                            ) : (
                              <><MapPin className="h-3 w-3 mr-1" /> Presencial</>
                            )}
                          </Badge>
                          {event.modality === "presencial" && event.address && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="text-xs text-muted-foreground line-clamp-1 cursor-help max-w-[150px]">
                                    {event.address}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{event.address}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {event.scheduled_at ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-3 w-3" />
                              {format(new Date(event.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </div>
                            {event.ends_at && (
                              <div className="text-xs text-muted-foreground">
                                até {format(new Date(event.ends_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </div>
                            )}
                            {!event.ends_at && event.duration_minutes && (
                              <div className="text-xs text-muted-foreground">
                                {event.duration_minutes} min
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {event.event_products.length === 0 ? (
                            <span className="text-muted-foreground text-sm">Nenhum</span>
                          ) : (
                            event.event_products.map((ep) => (
                              <Badge key={ep.product_id} variant="outline" className="text-xs">
                                <Package className="h-3 w-3 mr-1" />
                                {ep.products?.name || "Produto"}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {event.modality === "presencial" && event.checkin_code && (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setSelectedEventForQr(event);
                                        setQrDialogOpen(true);
                                      }}
                                    >
                                      <QrCode className="h-4 w-4 text-primary" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>QR Code para check-in</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
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
                                  <TooltipContent>
                                    <p>Lista de presenças</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          )}
                          {(event.meeting_url || event.material_url) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                            >
                              <a
                                href={event.meeting_url || event.material_url || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <LinkIcon className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code para Check-in
            </DialogTitle>
            <DialogDescription>
              {selectedEventForQr?.title}
            </DialogDescription>
          </DialogHeader>
          
          {selectedEventForQr?.checkin_code && (
            <div className="flex flex-col items-center space-y-4 py-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG 
                  value={`${window.location.origin}/checkin/${selectedEventForQr.checkin_code}`}
                  size={200}
                  level="H"
                />
              </div>
              
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Código do evento</p>
                <p className="text-2xl font-mono font-bold tracking-wider">
                  {selectedEventForQr.checkin_code}
                </p>
              </div>

              <div className="w-full space-y-2">
                <Label className="text-sm text-muted-foreground">Link de check-in</Label>
                <div className="flex gap-2">
                  <Input 
                    value={`${window.location.origin}/checkin/${selectedEventForQr.checkin_code}`}
                    readOnly
                    className="text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/checkin/${selectedEventForQr.checkin_code}`
                      );
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                      toast({
                        title: "Link copiado!",
                        description: "O link de check-in foi copiado para a área de transferência.",
                      });
                    }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Imprima ou exiba este QR Code no evento para que os participantes confirmem presença
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Attendance Dialog */}
      <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lista de Presenças
            </DialogTitle>
            <DialogDescription>
              {selectedEventForAttendance?.title}
              {selectedEventForAttendance?.scheduled_at && (
                <span className="block text-xs mt-1">
                  {format(new Date(selectedEventForAttendance.scheduled_at), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {loadingAttendance ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando presenças...
              </div>
            ) : attendance.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhum check-in registrado ainda</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Compartilhe o QR Code do evento para os participantes confirmarem presença
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-sm">
                    {attendance.length} {attendance.length === 1 ? 'participante' : 'participantes'}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={exportAttendanceCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>
                
                <div className="divide-y max-h-[300px] overflow-y-auto">
                  {attendance.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 py-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={a.clients.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {a.clients.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{a.clients.full_name}</p>
                        <p className="text-xs text-muted-foreground">{a.clients.phone_e164}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Check-in</p>
                        <p className="text-xs font-medium">
                          {format(new Date(a.join_time), "HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="relatorio">
          <AttendanceReport accountId={accountId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
