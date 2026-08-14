import { resolveEventStatus } from "@/lib/events/eventStatus";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Clock, MapPin, Monitor, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type KanbanColumnId = "planejar" | "executar" | "pos" | "cancelados";

export interface KanbanEvent {
  id: string;
  title: string;
  description?: string | null;
  modality: "online" | "presencial";
  scheduled_at: string | null;
  ends_at: string | null;
  status: string | null;
  [key: string]: unknown;
}

const COLUMNS: { id: KanbanColumnId; label: string; hint: string; accent: string }[] = [
  {
    id: "planejar",
    label: "Planejar",
    hint: "Ainda vão acontecer",
    accent: "border-t-blue-500/60",
  },
  {
    id: "executar",
    label: "Executar",
    hint: "Acontecendo hoje / em andamento",
    accent: "border-t-amber-500/70",
  },
  {
    id: "pos",
    label: "Pós-evento",
    hint: "Já aconteceram — fechar ROI e mídia",
    accent: "border-t-emerald-500/60",
  },
  {
    id: "cancelados",
    label: "Cancelados",
    hint: "Fora do fluxo",
    accent: "border-t-destructive/60",
  },
];

/**
 * Classifica o evento na fase real de trabalho (mesma taxonomia das abas do
 * detalhe do evento): planejar → executar → pós. Datas ausentes ficam em
 * "Planejar" porque ainda dependem de definição de agenda (TBD).
 */
export function kanbanColumnOfEvent(event: KanbanEvent, now = new Date()): KanbanColumnId {
  const effective = resolveEventStatus(event, now);
  if (effective === "cancelled") return "cancelados";
  if (effective === "completed") return "pos";

  const start = event.scheduled_at ? new Date(event.scheduled_at) : null;
  const end = event.ends_at ? new Date(event.ends_at) : null;
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
  const validEnd = end && !Number.isNaN(end.getTime()) ? end : null;

  if (!validStart) return "planejar";

  const finish = validEnd ?? validStart;
  if (finish.getTime() < now.getTime() && !isSameDay(finish, now)) return "pos";
  if (isSameDay(validStart, now) || (validStart <= now && finish >= now)) return "executar";
  if (validStart.getTime() > now.getTime()) return "planejar";
  return "pos";
}

interface Props {
  events: KanbanEvent[];
}

export function EventsPhaseKanban({ events }: Props) {
  const navigate = useNavigate();

  const grouped = useMemo(() => {
    const now = new Date();
    const base: Record<KanbanColumnId, KanbanEvent[]> = {
      planejar: [],
      executar: [],
      pos: [],
      cancelados: [],
    };
    for (const event of events) {
      base[kanbanColumnOfEvent(event, now)].push(event);
    }
    const time = (e: KanbanEvent) =>
      e.scheduled_at ? new Date(e.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;
    base.planejar.sort((a, b) => time(a) - time(b));
    base.executar.sort((a, b) => time(a) - time(b));
    base.pos.sort((a, b) => time(b) - time(a));
    base.cancelados.sort((a, b) => time(b) - time(a));
    return base;
  }, [events]);

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 pb-2">
      <div className="flex gap-4 min-w-[900px] px-4 sm:px-0">
        {COLUMNS.map((column) => {
          const items = grouped[column.id];
          return (
            <div key={column.id} className="flex-1 min-w-[240px]">
              <div className={cn("rounded-t-lg border-t-4 bg-muted/40 px-3 py-2", column.accent)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{column.label}</span>
                  <Badge variant="secondary" className="h-5 text-[11px]">
                    {items.length}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{column.hint}</p>
              </div>

              <ScrollArea className="h-[520px] rounded-b-lg border border-t-0 bg-background">
                <div className="space-y-2 p-2">
                  {items.length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                      Nenhum evento nesta fase.
                    </p>
                  ) : (
                    items.map((event) => (
                      <Card
                        key={event.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/events/${event.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/events/${event.id}`);
                          }
                        }}
                        className="cursor-pointer p-3 transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <p className="text-sm font-medium leading-snug line-clamp-2">{event.title}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            {event.modality === "presencial" ? (
                              <MapPin className="h-3 w-3" />
                            ) : (
                              <Monitor className="h-3 w-3" />
                            )}
                            {event.modality === "presencial" ? "Presencial" : "Online"}
                          </span>

                          {event.scheduled_at ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(event.scheduled_at), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Data a definir
                            </span>
                          )}

                          {typeof (event as any).confirmed_count === "number" &&
                            (event as any).confirmed_count > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {(event as any).confirmed_count}
                              </span>
                            )}
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EventsPhaseKanban;
