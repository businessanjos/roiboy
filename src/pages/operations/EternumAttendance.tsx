import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Search, Users, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ETERNUM_CLUB_PRODUCT_IDS = [
  "b8c50eca-6fd9-41ac-a1d3-f78086daaea7", // Eternum Club
  "6f74bb43-a1be-410f-a708-6abab066bb38", // Ren. Eternum Club
];

interface EventRow {
  id: string;
  title: string;
  scheduled_at: string | null;
  modality: string;
  status: string | null;
}

interface ClientRow {
  id: string;
  full_name: string;
  logo_url: string | null;
}

export default function EternumAttendance() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const [events, setEvents] = useState<EventRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [attendanceSet, setAttendanceSet] = useState<Set<string>>(new Set());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingClients, setLoadingClients] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");

  // Load Eternum events
  useEffect(() => {
    if (!accountId) return;
    (async () => {
      setLoadingEvents(true);
      const { data, error } = await supabase
        .from("events")
        .select("id, title, scheduled_at, modality, status")
        .or("title.ilike.%eternum%,title.ilike.EC -%,title.ilike.EC-%,title.ilike.EC %")
        .order("scheduled_at", { ascending: false });
      if (error) {
        toast.error("Erro ao carregar eventos");
      } else {
        setEvents((data ?? []) as EventRow[]);
        if (data && data.length > 0 && !selectedEventId) {
          setSelectedEventId(data[0].id);
        }
      }
      setLoadingEvents(false);
    })();
     
  }, [accountId]);

  // Load active Eternum Club clients
  useEffect(() => {
    if (!accountId) return;
    (async () => {
      setLoadingClients(true);
      const { data: contracts, error } = await supabase
        .from("client_contracts")
        .select("client_id, clients!inner(id, full_name, logo_url)")
        .in("product_id", ETERNUM_CLUB_PRODUCT_IDS)
        .eq("status", "active");

      if (error) {
        toast.error("Erro ao carregar clientes");
        setLoadingClients(false);
        return;
      }

      const uniq = new Map<string, ClientRow>();
      (contracts ?? []).forEach((row: any) => {
        const c = row.clients;
        if (c && !uniq.has(c.id)) uniq.set(c.id, c);
      });
      const list = Array.from(uniq.values()).sort((a, b) =>
        a.full_name.localeCompare(b.full_name, "pt-BR"),
      );
      setClients(list);
      setLoadingClients(false);
    })();
  }, [accountId]);

  // Load attendance for selected event
  useEffect(() => {
    if (!selectedEventId) {
      setAttendanceSet(new Set());
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("client_id")
        .eq("event_id", selectedEventId);
      if (error) {
        toast.error("Erro ao carregar presenças");
        return;
      }
      setAttendanceSet(new Set((data ?? []).map((r: any) => r.client_id)));
    })();
  }, [selectedEventId]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const [modalityFilter, setModalityFilter] = useState<"all" | "online" | "presencial">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "completed">("all");

  const STATUS_LABEL: Record<string, string> = {
    planned: "Planejado",
    draft: "Rascunho",
    scheduled: "Agendado",
    confirmed: "Confirmado",
    in_progress: "Em andamento",
    ongoing: "Em andamento",
    completed: "Concluído",
    done: "Concluído",
    finished: "Concluído",
    cancelled: "Cancelado",
    canceled: "Cancelado",
    postponed: "Adiado",
  };

  const MODALITY_LABEL: Record<string, string> = {
    online: "Online",
    presencial: "Presencial",
    hibrido: "Híbrido",
    "híbrido": "Híbrido",
  };

  const isCompletedStatus = (s: string | null) => {
    const v = (s || "").toLowerCase();
    return v === "completed" || v === "done" || v === "finished";
  };

  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    return events.filter((e) => {
      if (q && !e.title.toLowerCase().includes(q)) return false;
      if (modalityFilter !== "all") {
        const m = (e.modality || "").toLowerCase();
        if (modalityFilter === "online" && m !== "online") return false;
        if (
          modalityFilter === "presencial" &&
          !(m === "presencial" || m === "hibrido" || m === "híbrido")
        )
          return false;
      }
      if (statusFilter !== "all") {
        const done = isCompletedStatus(e.status);
        if (statusFilter === "completed" && !done) return false;
        if (statusFilter === "open" && done) return false;
      }
      return true;
    });
  }, [events, eventSearch, modalityFilter, statusFilter]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.full_name.toLowerCase().includes(q));
  }, [clients, search]);

  const presentCount = attendanceSet.size;

  const toggleAttendance = async (clientId: string, present: boolean) => {
    if (!selectedEvent || !accountId) return;
    setSavingId(clientId);
    if (present) {
      const joinTime = selectedEvent.scheduled_at ?? new Date().toISOString();
      const { error } = await supabase.from("attendance").insert({
        account_id: accountId,
        client_id: clientId,
        event_id: selectedEvent.id,
        join_time: joinTime,
      });
      if (error) {
        toast.error("Erro ao marcar presença");
      } else {
        setAttendanceSet((prev) => new Set(prev).add(clientId));
      }
    } else {
      const { error } = await supabase
        .from("attendance")
        .delete()
        .eq("event_id", selectedEvent.id)
        .eq("client_id", clientId);
      if (error) {
        toast.error("Erro ao remover presença");
      } else {
        setAttendanceSet((prev) => {
          const next = new Set(prev);
          next.delete(clientId);
          return next;
        });
      }
    }
    setSavingId(null);
  };

  const markAllVisible = async () => {
    if (!selectedEvent || !accountId) return;
    const toAdd = filteredClients.filter((c) => !attendanceSet.has(c.id));
    if (toAdd.length === 0) return;
    const joinTime = selectedEvent.scheduled_at ?? new Date().toISOString();
    const rows = toAdd.map((c) => ({
      account_id: accountId,
      client_id: c.id,
      event_id: selectedEvent.id,
      join_time: joinTime,
    }));
    const { error } = await supabase.from("attendance").insert(rows);
    if (error) {
      toast.error("Erro ao marcar todos");
      return;
    }
    setAttendanceSet((prev) => {
      const next = new Set(prev);
      toAdd.forEach((c) => next.add(c.id));
      return next;
    });
    toast.success(`${toAdd.length} presença(s) marcada(s)`);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Presença em Eventos — Eternum Club</h1>
        <p className="text-sm text-muted-foreground">
          Marque a presença dos clientes ativos do Eternum Club nos eventos.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* Events list */}
        <Card className="h-[calc(100vh-200px)] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" /> Eventos
            </CardTitle>
            <Input
              placeholder="Buscar evento..."
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
              className="h-8"
            />
            <div className="flex gap-1 mt-1">
              {([
                { id: "all", label: "Todos" },
                { id: "online", label: "Online" },
                { id: "presencial", label: "Presencial" },
              ] as const).map((opt) => (
                <Button
                  key={opt.id}
                  size="sm"
                  variant={modalityFilter === opt.id ? "default" : "outline"}
                  className="h-7 px-2 text-xs flex-1"
                  onClick={() => setModalityFilter(opt.id)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-1 mt-1">
              {([
                { id: "all", label: "Todos" },
                { id: "open", label: "Em aberto" },
                { id: "completed", label: "Concluídos" },
              ] as const).map((opt) => (
                <Button
                  key={opt.id}
                  size="sm"
                  variant={statusFilter === opt.id ? "default" : "outline"}
                  className="h-7 px-2 text-xs flex-1"
                  onClick={() => setStatusFilter(opt.id)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-1">
                {loadingEvents ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))
                ) : filteredEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">
                    Nenhum evento encontrado.
                  </p>
                ) : (
                  filteredEvents.map((event) => {
                    const isActive = event.id === selectedEventId;
                    return (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEventId(event.id)}
                        className={cn(
                          "w-full text-left rounded-lg border p-3 transition-all hover:bg-muted",
                          isActive && "border-primary bg-primary/5",
                        )}
                      >
                        <div className="font-medium text-sm line-clamp-2">
                          {event.title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {event.scheduled_at
                            ? format(new Date(event.scheduled_at), "dd MMM yyyy 'às' HH:mm", {
                                locale: ptBR,
                              })
                            : "Sem data"}
                        </div>
                        <div className="flex gap-1 mt-2">
                          <Badge variant="outline" className="text-[10px] py-0">
                            {MODALITY_LABEL[(event.modality || "").toLowerCase()] || event.modality}
                          </Badge>
                          {event.status && (
                            <Badge variant="secondary" className="text-[10px] py-0">
                              {STATUS_LABEL[event.status.toLowerCase()] || event.status}
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Clients list */}
        <Card className="h-[calc(100vh-200px)] flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" /> Clientes ativos — Eternum Club
                </CardTitle>
                {selectedEvent && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedEvent.title} · {presentCount} de {clients.length} presentes
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={markAllVisible}
                disabled={!selectedEvent || filteredClients.length === 0}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Marcar todos visíveis
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="p-3">
                {!selectedEvent ? (
                  <p className="text-sm text-muted-foreground p-8 text-center">
                    Selecione um evento à esquerda para marcar presenças.
                  </p>
                ) : loadingClients ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : filteredClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-8 text-center">
                    Nenhum cliente ativo encontrado.
                  </p>
                ) : (
                  <div className="divide-y">
                    {filteredClients.map((client) => {
                      const present = attendanceSet.has(client.id);
                      const isSaving = savingId === client.id;
                      return (
                        <label
                          key={client.id}
                          className={cn(
                            "flex items-center gap-3 py-2.5 px-2 cursor-pointer rounded-md hover:bg-muted",
                            present && "bg-primary/5",
                            isSaving && "opacity-60",
                          )}
                        >
                          <Checkbox
                            checked={present}
                            disabled={isSaving}
                            onCheckedChange={(checked) =>
                              toggleAttendance(client.id, checked === true)
                            }
                          />
                          {client.logo_url ? (
                            <img
                              src={client.logo_url}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {client.full_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-medium flex-1">
                            {client.full_name}
                          </span>
                          {present && (
                            <Badge variant="default" className="text-[10px]">
                              Presente
                            </Badge>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
