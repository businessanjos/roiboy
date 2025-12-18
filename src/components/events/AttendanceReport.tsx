import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  UserCheck, 
  UserX, 
  TrendingUp, 
  Calendar,
  Download,
  Package,
  MapPin,
  QrCode
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AttendanceReportProps {
  accountId: string | null;
}

interface EventWithStats {
  id: string;
  title: string;
  scheduled_at: string | null;
  modality: "online" | "presencial";
  address: string | null;
  checkin_code: string | null;
  total_expected: number;
  total_attended: number;
  participation_rate: number;
  products: { id: string; name: string }[];
}

interface ProductStats {
  id: string;
  name: string;
  total_events: number;
  total_expected: number;
  total_attended: number;
  participation_rate: number;
}

interface AttendeeDetail {
  id: string;
  client_id: string;
  client_name: string;
  client_avatar: string | null;
  event_title: string;
  event_date: string | null;
  join_time: string;
}

export default function AttendanceReport({ accountId }: AttendanceReportProps) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [productStats, setProductStats] = useState<ProductStats[]>([]);
  const [recentAttendees, setRecentAttendees] = useState<AttendeeDetail[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);

  // Summary stats
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalExpected, setTotalExpected] = useState(0);
  const [totalAttended, setTotalAttended] = useState(0);
  const [overallRate, setOverallRate] = useState(0);

  useEffect(() => {
    if (accountId) {
      fetchData();
    }
  }, [accountId, selectedProduct]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchProducts(),
      fetchEventStats(),
      fetchProductStats(),
      fetchRecentAttendees(),
    ]);
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (data) {
      setProducts(data);
    }
  };

  const fetchEventStats = async () => {
    // Get presencial events with attendance counts
    let eventsQuery = supabase
      .from("events")
      .select(`
        id,
        title,
        scheduled_at,
        modality,
        address,
        checkin_code,
        event_products (
          product_id,
          products (id, name)
        )
      `)
      .eq("modality", "presencial")
      .not("scheduled_at", "is", null)
      .order("scheduled_at", { ascending: false })
      .limit(20);

    const { data: eventsData } = await eventsQuery;

    if (!eventsData) {
      setEvents([]);
      return;
    }

    // For each event, get expected clients (from client_event_deliveries) and actual attendance
    const eventsWithStats: EventWithStats[] = await Promise.all(
      eventsData.map(async (event: any) => {
        // Get expected clients (deliveries)
        const { count: expectedCount } = await supabase
          .from("client_event_deliveries")
          .select("*", { count: "exact", head: true })
          .eq("event_id", event.id);

        // Get actual attendance
        const { count: attendedCount } = await supabase
          .from("attendance")
          .select("*", { count: "exact", head: true })
          .eq("event_id", event.id);

        const expected = expectedCount || 0;
        const attended = attendedCount || 0;

        return {
          id: event.id,
          title: event.title,
          scheduled_at: event.scheduled_at,
          modality: event.modality,
          address: event.address,
          checkin_code: event.checkin_code,
          total_expected: expected,
          total_attended: attended,
          participation_rate: expected > 0 ? Math.round((attended / expected) * 100) : (attended > 0 ? 100 : 0),
          products: event.event_products?.map((ep: any) => ep.products).filter(Boolean) || [],
        };
      })
    );

    // Filter by selected product if needed
    let filteredEvents = eventsWithStats;
    if (selectedProduct !== "all") {
      filteredEvents = eventsWithStats.filter((e) =>
        e.products.some((p) => p.id === selectedProduct)
      );
    }

    setEvents(filteredEvents);

    // Calculate summary stats
    const total = filteredEvents.length;
    const totalExp = filteredEvents.reduce((acc, e) => acc + e.total_expected, 0);
    const totalAtt = filteredEvents.reduce((acc, e) => acc + e.total_attended, 0);

    setTotalEvents(total);
    setTotalExpected(totalExp);
    setTotalAttended(totalAtt);
    setOverallRate(totalExp > 0 ? Math.round((totalAtt / totalExp) * 100) : (totalAtt > 0 ? 100 : 0));
  };

  const fetchProductStats = async () => {
    // Get all products with their events
    const { data: productsData } = await supabase
      .from("products")
      .select(`
        id,
        name,
        event_products (
          event_id,
          events (
            id,
            modality,
            scheduled_at
          )
        )
      `)
      .eq("is_active", true);

    if (!productsData) {
      setProductStats([]);
      return;
    }

    const stats: ProductStats[] = await Promise.all(
      productsData.map(async (product: any) => {
        const presencialEvents = product.event_products
          ?.filter((ep: any) => ep.events?.modality === "presencial" && ep.events?.scheduled_at)
          .map((ep: any) => ep.event_id) || [];

        if (presencialEvents.length === 0) {
          return {
            id: product.id,
            name: product.name,
            total_events: 0,
            total_expected: 0,
            total_attended: 0,
            participation_rate: 0,
          };
        }

        // Get expected and attended for all events of this product
        let totalExpected = 0;
        let totalAttended = 0;

        for (const eventId of presencialEvents) {
          const { count: expectedCount } = await supabase
            .from("client_event_deliveries")
            .select("*", { count: "exact", head: true })
            .eq("event_id", eventId);

          const { count: attendedCount } = await supabase
            .from("attendance")
            .select("*", { count: "exact", head: true })
            .eq("event_id", eventId);

          totalExpected += expectedCount || 0;
          totalAttended += attendedCount || 0;
        }

        return {
          id: product.id,
          name: product.name,
          total_events: presencialEvents.length,
          total_expected: totalExpected,
          total_attended: totalAttended,
          participation_rate: totalExpected > 0 ? Math.round((totalAttended / totalExpected) * 100) : (totalAttended > 0 ? 100 : 0),
        };
      })
    );

    // Filter out products with no presencial events
    setProductStats(stats.filter((s) => s.total_events > 0));
  };

  const fetchRecentAttendees = async () => {
    const { data } = await supabase
      .from("attendance")
      .select(`
        id,
        client_id,
        join_time,
        event_id,
        clients (id, full_name, avatar_url),
        events (id, title, scheduled_at)
      `)
      .not("event_id", "is", null)
      .order("join_time", { ascending: false })
      .limit(10);

    if (data) {
      const attendees: AttendeeDetail[] = data.map((a: any) => ({
        id: a.id,
        client_id: a.client_id,
        client_name: a.clients?.full_name || "Cliente",
        client_avatar: a.clients?.avatar_url,
        event_title: a.events?.title || "Evento",
        event_date: a.events?.scheduled_at,
        join_time: a.join_time,
      }));
      setRecentAttendees(attendees);
    }
  };

  const exportReport = () => {
    const headers = ["Evento", "Data", "Local", "Esperados", "Presentes", "Taxa"];
    const rows = events.map((e) => [
      e.title,
      e.scheduled_at ? format(new Date(e.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-",
      e.address || "-",
      e.total_expected.toString(),
      e.total_attended.toString(),
      `${e.participation_rate}%`,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-presencas-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const getRateColor = (rate: number) => {
    if (rate >= 80) return "text-green-600 dark:text-green-400";
    if (rate >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getRateBadge = (rate: number) => {
    if (rate >= 80) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (rate >= 50) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Eventos Presenciais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEvents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Esperados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExpected}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Check-ins
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{totalAttended}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Taxa de Participação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getRateColor(overallRate)}`}>
              {overallRate}%
            </div>
            <Progress value={overallRate} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Filters and Export */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-2">
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" onClick={exportReport} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Presença por Evento
            </CardTitle>
            <CardDescription>
              Taxa de participação dos últimos eventos presenciais
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum evento presencial encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead className="text-center">Esperados</TableHead>
                      <TableHead className="text-center">Presentes</TableHead>
                      <TableHead className="text-center">Taxa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{event.title}</div>
                            {event.scheduled_at && (
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(event.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </div>
                            )}
                            {event.address && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.address}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{event.total_expected}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{event.total_attended}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={getRateBadge(event.participation_rate)}>
                            {event.participation_rate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Stats & Recent Attendees */}
        <div className="space-y-6">
          {/* Product Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Presença por Produto
              </CardTitle>
              <CardDescription>
                Taxa de participação por produto
              </CardDescription>
            </CardHeader>
            <CardContent>
              {productStats.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Nenhum produto com eventos presenciais
                </div>
              ) : (
                <div className="space-y-4">
                  {productStats.map((product) => (
                    <div key={product.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate max-w-[150px]">{product.name}</span>
                        <span className={getRateColor(product.participation_rate)}>
                          {product.participation_rate}%
                        </span>
                      </div>
                      <Progress value={product.participation_rate} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{product.total_events} eventos</span>
                        <span>{product.total_attended}/{product.total_expected} presenças</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Attendees */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Últimos Check-ins
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentAttendees.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Nenhum check-in registrado
                </div>
              ) : (
                <div className="space-y-3">
                  {recentAttendees.map((attendee) => (
                    <div key={attendee.id} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={attendee.client_avatar || undefined} />
                        <AvatarFallback className="text-xs">
                          {attendee.client_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{attendee.client_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{attendee.event_title}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(attendee.join_time), "dd/MM HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
