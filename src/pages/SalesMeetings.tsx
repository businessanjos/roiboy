import { useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Video,
  Plus,
  Loader2,
  Calendar,
  Clock,
  ExternalLink,
  User,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday, isTomorrow, addHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface SalesMeeting {
  id: string;
  account_id: string;
  deal_id: string | null;
  client_id: string | null;
  lead_id: string | null;
  title: string;
  scheduled_at: string;
  duration_minutes: number | null;
  meeting_url: string | null;
  meeting_type: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  responsible_user_id: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  scheduled: { label: "Agendada", color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: Calendar },
  completed: { label: "Realizada", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  cancelled: { label: "Cancelada", color: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
  no_show: { label: "Não compareceu", color: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: AlertCircle },
};

export default function SalesMeetings() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const accountId = currentUser?.account_id;
  const isAdmin = currentUser?.role === "admin" || currentUser?.is_also_admin || currentUser?.team_role_name === "Admin";
  const isSalesRep = (() => {
    const role = currentUser?.team_role_name;
    return !!role && ["SDR", "Closer", "Vendas", "Vendedor"].includes(role) && !isAdmin;
  })();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SalesMeeting | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<SalesMeeting | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({
    title: "",
    scheduled_at: "",
    duration_minutes: "30",
    meeting_url: "",
    meeting_type: "scheduled",
    notes: "",
    use_daily: true,
  });
  const [creatingRoom, setCreatingRoom] = useState(false);

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["sales-meetings", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_meetings")
        .select("*")
        .eq("account_id", accountId!)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data as SalesMeeting[];
    },
    enabled: !!accountId,
  });

  const { data: teamUsers = [] } = useQuery({
    queryKey: ["team-users-meetings", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .eq("account_id", accountId!);
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      let meetingUrl = form.meeting_url || null;

      // Create Daily.co room if use_daily is enabled and it's a new meeting
      if (form.use_daily && !editing) {
        setCreatingRoom(true);
        try {
          const { data: roomData, error: roomError } = await supabase.functions.invoke("daily-video-call", {
            body: {
              action: "create-room",
              participant_name: form.title,
            },
          });
          if (roomError) throw new Error("Erro ao criar sala de vídeo");
          if (roomData?.room_url) {
            meetingUrl = roomData.room_url;
          }
        } finally {
          setCreatingRoom(false);
        }
      }

      const payload = {
        account_id: accountId!,
        title: form.title,
        scheduled_at: form.scheduled_at,
        duration_minutes: parseInt(form.duration_minutes) || 30,
        meeting_url: meetingUrl,
        meeting_type: form.meeting_type,
        notes: form.notes || null,
        created_by: editing ? undefined : currentUser?.id,
      };
      if (editing) {
        const { error } = await supabase
          .from("sales_meetings")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sales_meetings")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-meetings"] });
      toast.success(editing ? "Reunião atualizada!" : "Reunião criada com sala de vídeo!");
      setDialogOpen(false);
      setEditing(null);
      resetForm();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-meetings"] });
      toast.success("Reunião excluída!");
      setDeleteDialog(null);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // Get the meeting to check if it has a deal_id
      const { data: meeting } = await supabase
        .from("sales_meetings")
        .select("deal_id")
        .eq("id", id)
        .single();

      const { error } = await supabase
        .from("sales_meetings")
        .update({ status })
        .eq("id", id);
      if (error) throw error;

      // If cancelled and has a deal, move deal back to "Em Qualificação"
      if (status === "cancelled" && meeting?.deal_id) {
        // Find the deal to get its pipeline_id
        const { data: deal } = await supabase
          .from("deals")
          .select("pipeline_id")
          .eq("id", meeting.deal_id)
          .single();

        if (deal?.pipeline_id) {
          // Find the "Em Qualificação" stage in the same pipeline
          const { data: qualStage } = await supabase
            .from("deal_stages")
            .select("id")
            .eq("pipeline_id", deal.pipeline_id)
            .eq("name", "Em Qualificação")
            .single();

          if (qualStage) {
            await supabase
              .from("deals")
              .update({ stage_id: qualStage.id })
              .eq("id", meeting.deal_id);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-meetings"] });
      toast.success("Status atualizado!");
    },
  });

  const resetForm = () => {
    setForm({ title: "", scheduled_at: "", duration_minutes: "30", meeting_url: "", meeting_type: "scheduled", notes: "", use_daily: true });
  };

  const openAdd = () => {
    resetForm();
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (m: SalesMeeting) => {
    setEditing(m);
    setForm({
      title: m.title,
      scheduled_at: m.scheduled_at ? format(new Date(m.scheduled_at), "yyyy-MM-dd'T'HH:mm") : "",
      duration_minutes: String(m.duration_minutes || 30),
      meeting_url: m.meeting_url || "",
      meeting_type: m.meeting_type || "scheduled",
      notes: m.notes || "",
      use_daily: !m.meeting_url,
    });
    setDialogOpen(true);
  };

  const getUserName = (id: string | null) => {
    if (!id) return null;
    return teamUsers.find((u) => u.id === id)?.name || null;
  };

  const getTimeLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Hoje";
    if (isTomorrow(date)) return "Amanhã";
    if (isPast(date)) return "Passada";
    return format(date, "dd/MM", { locale: ptBR });
  };

  const filtered = meetings.filter((m) => {
    if (filterStatus !== "all" && m.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return m.title.toLowerCase().includes(q) || (m.notes || "").toLowerCase().includes(q);
    }
    return true;
  });

  const upcoming = filtered.filter((m) => m.status === "scheduled" && !isPast(new Date(m.scheduled_at)));
  const past = filtered.filter((m) => m.status !== "scheduled" || isPast(new Date(m.scheduled_at)));

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto pb-20 md:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Video className="w-7 h-7 text-primary" />
            <h1 className="text-xl font-bold">Reuniões</h1>
          </div>
          <p className="text-muted-foreground text-xs">Gerencie suas reuniões de vendas</p>
        </div>
        {!isSalesRep && (
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Reunião
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar reuniões..."
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="scheduled">Agendadas</SelectItem>
            <SelectItem value="completed">Realizadas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
            <SelectItem value="no_show">Não compareceu</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : meetings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Video className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma reunião</h3>
            <p className="text-muted-foreground mb-4">Agende sua primeira reunião de vendas</p>
            {!isSalesRep && (
              <Button onClick={openAdd}>
                <Plus className="w-4 h-4 mr-2" />
                Agendar Reunião
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Próximas ({upcoming.length})
              </h2>
              <div className="space-y-3">
                {upcoming.map((m) => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    getUserName={getUserName}
                    getTimeLabel={getTimeLabel}
                    onEdit={() => openEdit(m)}
                    onDelete={() => setDeleteDialog(m)}
                    onStatusChange={(status) => updateStatusMutation.mutate({ id: m.id, status })}
                    canEdit={!isSalesRep}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past / Other */}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Anteriores ({past.length})
              </h2>
              <div className="space-y-3">
                {past.map((m) => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    getUserName={getUserName}
                    getTimeLabel={getTimeLabel}
                    onEdit={() => openEdit(m)}
                    onDelete={() => setDeleteDialog(m)}
                    onStatusChange={(status) => updateStatusMutation.mutate({ id: m.id, status })}
                    canEdit={!isSalesRep}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              {editing ? "Editar Reunião" : "Nova Reunião"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ex: Apresentação para empresa X"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data e Hora *</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm((p) => ({ ...p, scheduled_at: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Duração (min)</Label>
                <Input
                  type="number"
                  value={form.duration_minutes}
                  onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                />
              </div>
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>Sala de Vídeo</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={form.use_daily ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setForm((p) => ({ ...p, use_daily: true, meeting_url: "" }))}
                  >
                    <Video className="w-4 h-4 mr-1.5" />
                    Criar sala automática
                  </Button>
                  <Button
                    type="button"
                    variant={!form.use_daily ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setForm((p) => ({ ...p, use_daily: false }))}
                  >
                    <ExternalLink className="w-4 h-4 mr-1.5" />
                    Link externo
                  </Button>
                </div>
                {!form.use_daily && (
                  <Input
                    value={form.meeting_url}
                    onChange={(e) => setForm((p) => ({ ...p, meeting_url: e.target.value }))}
                    placeholder="https://meet.google.com/..."
                    className="mt-2"
                  />
                )}
                {form.use_daily && (
                  <p className="text-xs text-muted-foreground">
                    Uma sala de vídeo será criada automaticamente via Daily.co ao salvar.
                  </p>
                )}
              </div>
            )}
            {editing && (
              <div className="space-y-2">
                <Label>Link da Reunião</Label>
                <Input
                  value={form.meeting_url}
                  onChange={(e) => setForm((p) => ({ ...p, meeting_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.meeting_type} onValueChange={(v) => setForm((p) => ({ ...p, meeting_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Agendada</SelectItem>
                  <SelectItem value="cold">Cold Call</SelectItem>
                  <SelectItem value="followup">Follow-up</SelectItem>
                  <SelectItem value="demo">Demonstração</SelectItem>
                  <SelectItem value="closing">Fechamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Pontos a discutir, contexto..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.title.trim() || !form.scheduled_at || saveMutation.isPending || creatingRoom}
            >
              {(saveMutation.isPending || creatingRoom) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {creatingRoom ? "Criando sala..." : editing ? "Salvar" : form.use_daily ? "Criar com sala de vídeo" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir reunião?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A reunião "{deleteDialog?.title}" será excluída permanentemente.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
              disabled={deleteMutation.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MeetingCard({
  meeting,
  getUserName,
  getTimeLabel,
  onEdit,
  onDelete,
  onStatusChange,
  canEdit,
}: {
  meeting: SalesMeeting;
  getUserName: (id: string | null) => string | null;
  getTimeLabel: (d: string) => string;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
  canEdit: boolean;
}) {
  const statusConf = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.scheduled;
  const StatusIcon = statusConf.icon;
  const date = new Date(meeting.scheduled_at);
  const timeLabel = getTimeLabel(meeting.scheduled_at);
  const isUpcoming = meeting.status === "scheduled" && !isPast(date);
  const createdBy = getUserName(meeting.created_by);

  return (
    <Card className={cn("group hover:border-primary/30 transition-colors", isUpcoming && "border-primary/20 bg-primary/[0.02]")}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn("w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0", isUpcoming ? "bg-primary/10" : "bg-muted")}>
            <span className={cn("text-lg font-bold leading-none", isUpcoming ? "text-primary" : "text-muted-foreground")}>
              {format(date, "dd")}
            </span>
            <span className={cn("text-[10px] uppercase", isUpcoming ? "text-primary/70" : "text-muted-foreground")}>
              {format(date, "MMM", { locale: ptBR })}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">{meeting.title}</h3>
              <Badge variant="outline" className={cn("text-[10px] shrink-0", statusConf.color)}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConf.label}
              </Badge>
              {timeLabel === "Hoje" && (
                <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30">Hoje</Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(date, "HH:mm")} · {meeting.duration_minutes || 30}min
              </span>
              {createdBy && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {createdBy}
                </span>
              )}
            </div>

            {meeting.notes && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{meeting.notes}</p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {meeting.meeting_url && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => window.open(meeting.meeting_url!, "_blank")}
              >
                <ExternalLink className="w-3 h-3" />
                Entrar
              </Button>
            )}
            {canEdit && (
              <>
                {meeting.status === "scheduled" && (
                  <Select onValueChange={onStatusChange}>
                    <SelectTrigger className="h-8 w-auto text-xs border-dashed">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Realizada</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                      <SelectItem value="no_show">Não compareceu</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={onEdit}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100" onClick={onDelete}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
