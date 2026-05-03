import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Video, Users, MapPin, ExternalLink, RefreshCw, AlertCircle, CheckCircle2, Phone, ClipboardList } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks,
  parseISO, isValid, addHours, isWithinInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

type CalEvent = {
  id: string;
  source: "task" | "meeting" | "google";
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color: string; // tailwind class fragment for badge bg
  meta?: {
    clientName?: string;
    leadName?: string;
    dealTitle?: string;
    location?: string;
    description?: string;
    htmlLink?: string;
    meetingUrl?: string;
    status?: string;
    dealId?: string;
    leadId?: string;
    activityType?: string;
  };
};

const SOURCE_STYLES: Record<CalEvent["source"], { dot: string; bg: string; text: string; label: string; icon: any }> = {
  task: { dot: "bg-blue-500", bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-500/40", text: "text-blue-700 dark:text-blue-300", label: "Tarefa", icon: ClipboardList },
  meeting: { dot: "bg-violet-500", bg: "bg-violet-50 dark:bg-violet-950/40 border-violet-500/40", text: "text-violet-700 dark:text-violet-300", label: "Reunião", icon: Video },
  google: { dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/40", text: "text-emerald-700 dark:text-emerald-300", label: "Google Agenda", icon: CalendarIcon },
};

function combineDateTime(date: string, time: string | null): Date {
  // date "YYYY-MM-DD", time "HH:MM:SS" | null
  const [y, m, d] = date.split("-").map(Number);
  if (!time) return new Date(y, m - 1, d, 9, 0, 0);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh || 9, mm || 0, 0);
}

export default function SalesCalendar() {
  const { currentUser } = useCurrentUser();
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [filterMine, setFilterMine] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

  const range = useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
      const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
      return { start, end };
    }
    return {
      start: startOfWeek(cursor, { weekStartsOn: 0 }),
      end: endOfWeek(cursor, { weekStartsOn: 0 }),
    };
  }, [cursor, view]);

  // Tasks com data
  const tasksQuery = useQuery({
    queryKey: ["sales-calendar-tasks", range.start.toISOString(), range.end.toISOString(), filterMine, currentUser?.id],
    enabled: !!currentUser?.id,
    queryFn: async () => {
      let q = supabase
        .from("internal_tasks")
        .select(`
          id, title, description, due_date, due_time, status, meeting_url, meeting_platform,
          assigned_to, deal_id, lead_id, client_id,
          clients:client_id(id, full_name),
          leads:lead_id(id, full_name),
          deals:deal_id(id, title),
          activity_type:activity_types!internal_tasks_activity_type_id_fkey(id, name)
        `)
        .not("due_date", "is", null)
        .gte("due_date", format(range.start, "yyyy-MM-dd"))
        .lte("due_date", format(range.end, "yyyy-MM-dd"));

      if (filterMine && currentUser?.id) q = q.eq("assigned_to", currentUser.id);

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Reuniões de vendas
  const meetingsQuery = useQuery({
    queryKey: ["sales-calendar-meetings", range.start.toISOString(), range.end.toISOString(), filterMine, currentUser?.id],
    enabled: !!currentUser?.id,
    queryFn: async () => {
      let q = supabase
        .from("sales_meetings")
        .select(`
          id, title, scheduled_at, duration_minutes, meeting_url, meeting_type, status, notes,
          deal_id, lead_id, client_id, responsible_user_id,
          clients:client_id(id, full_name),
          leads:lead_id(id, full_name),
          deals:deal_id(id, title)
        `)
        .gte("scheduled_at", range.start.toISOString())
        .lte("scheduled_at", range.end.toISOString());

      if (filterMine && currentUser?.id) q = q.eq("responsible_user_id", currentUser.id);

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Google Calendar
  const googleQuery = useQuery({
    queryKey: ["sales-calendar-google", range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-google-calendar-events", {
        body: {
          timeMin: range.start.toISOString(),
          timeMax: range.end.toISOString(),
        },
      });
      if (error) throw error;
      return data as { events: any[]; connected: boolean; message?: string };
    },
    staleTime: 60_000,
  });

  const events: CalEvent[] = useMemo(() => {
    const list: CalEvent[] = [];

    (tasksQuery.data || []).forEach((t: any) => {
      const start = combineDateTime(t.due_date, t.due_time);
      const end = t.due_time ? addHours(start, 1) : start;
      list.push({
        id: `task-${t.id}`,
        source: "task",
        title: t.title,
        start,
        end,
        allDay: !t.due_time,
        color: "blue",
        meta: {
          description: t.description,
          clientName: t.clients?.full_name,
          leadName: t.leads?.full_name,
          dealTitle: t.deals?.title,
          dealId: t.deal_id,
          leadId: t.lead_id,
          meetingUrl: t.meeting_url,
          status: t.status,
          activityType: t.activity_type?.name,
        },
      });
    });

    (meetingsQuery.data || []).forEach((m: any) => {
      const start = parseISO(m.scheduled_at);
      const end = addHours(start, (m.duration_minutes || 60) / 60);
      if (!isValid(start)) return;
      list.push({
        id: `meeting-${m.id}`,
        source: "meeting",
        title: m.title || "Reunião",
        start,
        end,
        allDay: false,
        color: "violet",
        meta: {
          clientName: m.clients?.full_name,
          leadName: m.leads?.full_name,
          dealTitle: m.deals?.title,
          dealId: m.deal_id,
          leadId: m.lead_id,
          meetingUrl: m.meeting_url,
          status: m.status,
          description: m.notes,
        },
      });
    });

    (googleQuery.data?.events || []).forEach((e: any) => {
      const start = e.start ? new Date(e.start) : null;
      const end = e.end ? new Date(e.end) : null;
      if (!start || !isValid(start)) return;
      list.push({
        id: `google-${e.id}`,
        source: "google",
        title: e.title,
        start,
        end: end && isValid(end) ? end : addHours(start, 1),
        allDay: !!e.allDay,
        color: "emerald",
        meta: {
          description: e.description,
          location: e.location,
          htmlLink: e.htmlLink,
          meetingUrl: e.hangoutLink,
        },
      });
    });

    return list.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [tasksQuery.data, meetingsQuery.data, googleQuery.data]);

  const days = useMemo(() => eachDayOfInterval({ start: range.start, end: range.end }), [range]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    events.forEach((e) => {
      const key = format(e.start, "yyyy-MM-dd");
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    });
    return map;
  }, [events]);

  const navigate = (dir: -1 | 1) => {
    setCursor((c) => (view === "month" ? (dir === 1 ? addMonths(c, 1) : subMonths(c, 1)) : dir === 1 ? addWeeks(c, 1) : subWeeks(c, 1)));
  };

  const refreshAll = () => {
    tasksQuery.refetch();
    meetingsQuery.refetch();
    googleQuery.refetch();
  };

  const isLoading = tasksQuery.isLoading || meetingsQuery.isLoading || googleQuery.isLoading;
  const googleConnected = googleQuery.data?.connected;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Calendário</h1>
          <p className="text-muted-foreground text-xs">
            Tarefas, reuniões e compromissos do Google Agenda em uma visão única
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {googleConnected === false && (
            <Badge
              variant="outline"
              className="gap-1.5 cursor-pointer hover:bg-accent"
              onClick={async () => {
                try {
                  const { data, error } = await supabase.functions.invoke("oauth-init", {
                    body: { provider: "google", redirect_path: "/sales-calendar" },
                  });
                  if (error) throw error;
                  if (data?.auth_url) {
                    window.location.href = data.auth_url;
                  } else {
                    throw new Error("URL de autenticação não retornada");
                  }
                } catch (e: any) {
                  toast({
                    title: "Erro ao conectar",
                    description: e.message || "Não foi possível iniciar a conexão com o Google.",
                    variant: "destructive",
                  });
                }
              }}
            >
              <AlertCircle className="h-3 w-3" />
              Conectar Google Agenda
            </Badge>
          )}
          {googleConnected === true && (
            <Badge variant="outline" className="gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              Google Agenda conectado
            </Badge>
          )}
          <Button
            variant={filterMine ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterMine((v) => !v)}
            className="h-8"
          >
            {filterMine ? "Apenas meus" : "Toda equipe"}
          </Button>
          <Button variant="outline" size="sm" onClick={refreshAll} className="h-8 gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setCursor(new Date())}>
              Hoje
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-base font-semibold ml-2 capitalize">
              {view === "month"
                ? format(cursor, "MMMM yyyy", { locale: ptBR })
                : `${format(range.start, "d MMM", { locale: ptBR })} – ${format(range.end, "d MMM yyyy", { locale: ptBR })}`}
            </h2>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
              {(["task", "meeting", "google"] as const).map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", SOURCE_STYLES[s].dot)} />
                  {SOURCE_STYLES[s].label}
                </div>
              ))}
            </div>
            <Tabs value={view} onValueChange={(v) => setView(v as any)}>
              <TabsList className="h-8">
                <TabsTrigger value="month" className="text-xs h-6">Mês</TabsTrigger>
                <TabsTrigger value="week" className="text-xs h-6">Semana</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </Card>

      {view === "month" ? (
        <MonthGrid days={days} cursor={cursor} eventsByDay={eventsByDay} onSelect={setSelectedEvent} />
      ) : (
        <WeekGrid days={days} eventsByDay={eventsByDay} onSelect={setSelectedEvent} />
      )}

      <EventDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}

/* ---------- Month Grid ---------- */
function MonthGrid({
  days,
  cursor,
  eventsByDay,
  onSelect,
}: {
  days: Date[];
  cursor: Date;
  eventsByDay: Map<string, CalEvent[]>;
  onSelect: (e: CalEvent) => void;
}) {
  const today = new Date();
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {weekDays.map((d) => (
          <div key={d} className="px-2 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(key) || [];
          const isCurrentMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          const visible = dayEvents.slice(0, 3);
          const more = dayEvents.length - visible.length;

          return (
            <div
              key={key}
              className={cn(
                "min-h-[112px] border-r border-b p-1.5 flex flex-col gap-1 last:border-r-0 transition-colors",
                !isCurrentMonth && "bg-muted/20",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    !isCurrentMonth && "text-muted-foreground/60",
                    isToday && "h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center",
                  )}
                >
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{dayEvents.length}</span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {visible.map((e) => (
                  <EventChip key={e.id} event={e} onSelect={onSelect} />
                ))}
                {more > 0 && (
                  <div className="text-[10px] text-muted-foreground px-1">+{more} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- Week Grid ---------- */
function WeekGrid({
  days,
  eventsByDay,
  onSelect,
}: {
  days: Date[];
  eventsByDay: Map<string, CalEvent[]>;
  onSelect: (e: CalEvent) => void;
}) {
  const today = new Date();
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 divide-x">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(key) || [];
          const isToday = isSameDay(day, today);
          return (
            <div key={key} className="flex flex-col min-h-[480px]">
              <div className={cn("p-2 border-b text-center", isToday && "bg-primary/5")}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {format(day, "EEE", { locale: ptBR })}
                </div>
                <div
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    isToday && "text-primary",
                  )}
                >
                  {format(day, "d")}
                </div>
              </div>
              <div className="flex-1 p-1.5 flex flex-col gap-1">
                {dayEvents.length === 0 && (
                  <div className="text-[10px] text-muted-foreground/60 text-center mt-2">—</div>
                )}
                {dayEvents.map((e) => (
                  <EventChip key={e.id} event={e} onSelect={onSelect} expanded />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- Event Chip ---------- */
function EventChip({ event, onSelect, expanded }: { event: CalEvent; onSelect: (e: CalEvent) => void; expanded?: boolean }) {
  const style = SOURCE_STYLES[event.source];
  const Icon = style.icon;
  const time = !event.allDay ? format(event.start, "HH:mm") : null;
  const ctxLabel = event.meta?.clientName || event.meta?.leadName || event.meta?.dealTitle;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onSelect(event)}
            className={cn(
              "w-full text-left rounded-sm border-l-2 px-1.5 py-0.5 text-[11px] truncate transition-colors hover:opacity-80",
              style.bg,
              style.text,
              expanded && "py-1",
            )}
          >
            <div className="flex items-center gap-1 min-w-0">
              <Icon className="h-2.5 w-2.5 shrink-0" />
              {time && <span className="font-medium tabular-nums shrink-0">{time}</span>}
              <span className="truncate font-medium">{event.title}</span>
            </div>
            {expanded && ctxLabel && (
              <div className="truncate text-[10px] opacity-75 mt-0.5">{ctxLabel}</div>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px]">
          <div className="font-medium">{event.title}</div>
          <div className="text-xs text-muted-foreground">
            {style.label} · {event.allDay ? "Dia inteiro" : `${format(event.start, "HH:mm")} – ${format(event.end, "HH:mm")}`}
          </div>
          {ctxLabel && <div className="text-xs mt-1">{ctxLabel}</div>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ---------- Event Dialog ---------- */
function EventDialog({ event, onClose }: { event: CalEvent | null; onClose: () => void }) {
  if (!event) return null;
  const style = SOURCE_STYLES[event.source];
  const Icon = style.icon;

  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("h-2 w-2 rounded-full", style.dot)} />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">{style.label}</span>
          </div>
          <DialogTitle className="flex items-start gap-2">
            <Icon className="h-4 w-4 mt-1 shrink-0" />
            <span>{event.title}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {event.allDay
              ? `${format(event.start, "PPP", { locale: ptBR })} · Dia inteiro`
              : `${format(event.start, "PPP 'às' HH:mm", { locale: ptBR })} – ${format(event.end, "HH:mm")}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 text-sm">
          {event.meta?.activityType && (
            <Badge variant="secondary" className="text-xs">{event.meta.activityType}</Badge>
          )}
          {event.meta?.clientName && (
            <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-muted-foreground" />{event.meta.clientName}</div>
          )}
          {event.meta?.leadName && !event.meta?.clientName && (
            <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-muted-foreground" />{event.meta.leadName}</div>
          )}
          {event.meta?.dealTitle && (
            <div className="text-xs text-muted-foreground">Negociação: {event.meta.dealTitle}</div>
          )}
          {event.meta?.location && (
            <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{event.meta.location}</div>
          )}
          {event.meta?.description && (
            <div className="text-xs text-muted-foreground whitespace-pre-wrap border-l-2 pl-2 mt-2">
              {event.meta.description.slice(0, 400)}
              {event.meta.description.length > 400 && "…"}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {event.meta?.meetingUrl && (
              <Button variant="default" size="sm" asChild className="h-8">
                <a href={event.meta.meetingUrl} target="_blank" rel="noreferrer">
                  <Video className="h-3.5 w-3.5 mr-1.5" /> Entrar na reunião
                </a>
              </Button>
            )}
            {event.meta?.htmlLink && (
              <Button variant="outline" size="sm" asChild className="h-8">
                <a href={event.meta.htmlLink} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir no Google
                </a>
              </Button>
            )}
            {event.meta?.dealId && (
              <Button variant="outline" size="sm" asChild className="h-8">
                <Link to={`/pipeline?deal=${event.meta.dealId}`}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Ver negociação
                </Link>
              </Button>
            )}
            {event.meta?.leadId && !event.meta?.dealId && (
              <Button variant="outline" size="sm" asChild className="h-8">
                <Link to={`/leads?lead=${event.meta.leadId}`}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Ver lead
                </Link>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
