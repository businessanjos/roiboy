import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, CalendarDays, MapPin, Monitor } from "lucide-react";

interface EventRow {
  id: string;
  title: string;
  scheduled_at: string | null;
  ends_at: string | null;
  modality: string;
  event_type: string;
  status: string | null;
  color: string | null;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function EventsCalendar() {
  const { user } = useCurrentUser();
  const accountId = user?.account_id ?? null;
  const [year, setYear] = useState(new Date().getFullYear());
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    (async () => {
      setLoading(true);
      const start = new Date(year, 0, 1).toISOString();
      const end = new Date(year + 1, 0, 1).toISOString();
      const { data } = await supabase
        .from("events")
        .select("id,title,scheduled_at,ends_at,modality,event_type,status,color")
        .eq("account_id", accountId)
        .gte("scheduled_at", start)
        .lt("scheduled_at", end)
        .order("scheduled_at", { ascending: true });
      setEvents((data as any) ?? []);
      setLoading(false);
    })();
  }, [accountId, year]);

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
                      <Link
                        key={e.id}
                        to={`/events/${e.id}`}
                        className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <div
                          className="flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: e.color || "hsl(var(--primary))" }}
                        >
                          {day}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{e.title}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {e.modality === "online" ? (
                              <Monitor className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className="text-xs text-muted-foreground capitalize">{e.modality}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
