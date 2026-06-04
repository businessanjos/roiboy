import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  Monitor,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { EventQuickFormDialog, QuickEvent } from "@/components/events/EventQuickFormDialog";

interface EventRow {
  id: string;
  title: string;
  scheduled_at: string | null;
  ends_at: string | null;
  modality: "online" | "presencial";
  event_type: string;
  status: string | null;
  color: string | null;
  address: string | null;
  description: string | null;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function EventsCalendar() {
  const { currentUser } = useCurrentUser();
  const { toast } = useToast();
  const accountId = currentUser?.account_id ?? null;
  const [year, setYear] = useState(new Date().getFullYear());
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QuickEvent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    const start = new Date(year, 0, 1).toISOString();
    const end = new Date(year + 1, 0, 1).toISOString();
    const { data } = await supabase
      .from("events")
      .select("id,title,scheduled_at,ends_at,modality,event_type,status,color,address,description")
      .eq("account_id", accountId)
      .gte("scheduled_at", start)
      .lt("scheduled_at", end)
      .order("scheduled_at", { ascending: true });
    setEvents((data as any) ?? []);
    setLoading(false);
  }, [accountId, year]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const byMonth = useMemo(() => {
    const buckets: EventRow[][] = Array.from({ length: 12 }, () => []);
    for (const e of events) {
      if (!e.scheduled_at) continue;
      const m = new Date(e.scheduled_at).getMonth();
      buckets[m].push(e);
    }
    return buckets;
  }, [events]);

  const total = events.length;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (e: EventRow) => {
    setEditing({
      id: e.id,
      title: e.title,
      event_type: e.event_type,
      modality: e.modality,
      scheduled_at: e.scheduled_at,
      ends_at: e.ends_at,
      address: e.address,
      description: e.description,
      color: e.color,
    });
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("events").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Evento excluído" });
      fetchEvents();
    }
    setDeleteId(null);
  };

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-primary" />
            Calendário Anual
          </h1>
          <p className="text-muted-foreground">
            Visão panorâmica de todos os eventos do ano.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-2xl font-semibold w-20 text-center">{year}</div>
          <Button variant="outline" size="icon" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={openCreate} className="ml-2">
            <Plus className="h-4 w-4" />
            Novo evento
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{total}</span> eventos em {year}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {byMonth.map((monthEvents, idx) => (
            <Card key={idx} className={monthEvents.length === 0 ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{MONTHS[idx]}</span>
                  <Badge variant="secondary" className="text-xs">{monthEvents.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {monthEvents.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">Nenhum evento</div>
                ) : (
                  monthEvents.map((e) => {
                    const d = e.scheduled_at ? new Date(e.scheduled_at) : null;
                    const day = d ? String(d.getDate()).padStart(2, "0") : "--";
                    return (
                      <div
                        key={e.id}
                        className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                      >
                        <button
                          onClick={() => openEdit(e)}
                          className="flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: e.color || "hsl(var(--primary))" }}
                          aria-label="Editar evento"
                        >
                          {day}
                        </button>
                        <button
                          onClick={() => openEdit(e)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="text-sm font-medium truncate">{e.title}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {e.modality === "online" ? (
                              <Monitor className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className="text-xs text-muted-foreground capitalize">{e.modality}</span>
                          </div>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(e)}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/events/${e.id}`}>
                                <ExternalLink className="h-4 w-4 mr-2" /> Abrir detalhes
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteId(e.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EventQuickFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editing}
        defaultYear={year}
        onSaved={fetchEvents}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O evento será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
