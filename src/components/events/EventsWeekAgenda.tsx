import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, MapPin, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AgendaEvent {
  id: string;
  title: string;
  modality: "online" | "presencial";
  scheduled_at: string | null;
  ends_at: string | null;
  status: string | null;
  [key: string]: unknown;
}

interface Props {
  events: AgendaEvent[];
}

/**
 * Agenda semanal (seg → dom) dos eventos filtrados. Serve para o time enxergar
 * carga da semana e conflitos de data, que a lista ordenada não evidencia.
 */
export function EventsWeekAgenda({ events }: Props) {
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 }),
    [weekOffset],
  );
  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);
  const days = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd],
  );

  const dated = useMemo(
    () =>
      events
        .filter((e) => !!e.scheduled_at && !Number.isNaN(new Date(e.scheduled_at!).getTime()))
        .map((e) => ({ ...e, date: new Date(e.scheduled_at!) }))
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [events],
  );

  const undated = useMemo(() => events.filter((e) => !e.scheduled_at), [events]);
  const weekCount = dated.filter((e) => e.date >= weekStart && e.date <= weekEnd).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((v) => v - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setWeekOffset(0)}>
            Semana atual
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((v) => v + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {format(weekStart, "dd MMM", { locale: ptBR })} — {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
          </span>
          <Badge variant="secondary" className="h-5 text-[11px]">
            {weekCount} evento{weekCount === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="grid grid-cols-7 gap-2 min-w-[900px] px-4 sm:px-0">
          {days.map((day) => {
            const dayEvents = dated.filter((e) => isSameDay(e.date, day));
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "rounded-lg border bg-background",
                  isToday(day) && "border-primary/60 bg-primary/5",
                )}
              >
                <div className="border-b px-2 py-1.5">
                  <p className="text-[11px] uppercase text-muted-foreground">
                    {format(day, "EEE", { locale: ptBR })}
                  </p>
                  <p className={cn("text-sm font-semibold", isToday(day) && "text-primary")}>
                    {format(day, "dd/MM")}
                  </p>
                </div>
                <div className="min-h-[160px] space-y-1.5 p-2">
                  {dayEvents.length === 0 ? (
                    <p className="pt-6 text-center text-[11px] text-muted-foreground">—</p>
                  ) : (
                    dayEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => navigate(`/events/${event.id}`)}
                        className={cn(
                          "w-full rounded-md border px-2 py-1.5 text-left transition-colors hover:bg-muted/60",
                          event.status === "cancelled" && "opacity-60 line-through",
                        )}
                      >
                        <p className="text-xs font-medium leading-snug line-clamp-2">{event.title}</p>
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(event.date, "HH:mm")}
                          {event.modality === "presencial" ? (
                            <MapPin className="h-3 w-3" />
                          ) : (
                            <Monitor className="h-3 w-3" />
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {undated.length > 0 && (
        <div className="rounded-lg border border-dashed p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Sem data definida ({undated.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {undated.map((event) => (
              <Badge
                key={event.id}
                variant="outline"
                className="cursor-pointer hover:bg-muted"
                onClick={() => navigate(`/events/${event.id}`)}
              >
                {event.title}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default EventsWeekAgenda;
