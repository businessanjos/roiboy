import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, TrendingUp, CalendarCheck, Users, DollarSign, MapPin, Monitor } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface EventRow {
  id: string;
  scheduled_at: string | null;
  modality: string;
  event_type: string;
  status: string | null;
  budget: number | null;
  expected_attendees: number | null;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6"];

export default function EventsKpis() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id ?? null;
  const [year, setYear] = useState(new Date().getFullYear());
  const [events, setEvents] = useState<EventRow[]>([]);
  const [actualCosts, setActualCosts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    (async () => {
      setLoading(true);
      const start = new Date(year, 0, 1).toISOString();
      const end = new Date(year + 1, 0, 1).toISOString();

      const { data: evs } = await supabase
        .from("events")
        .select("id,scheduled_at,modality,event_type,status,budget,expected_attendees")
        .eq("account_id", accountId)
        .gte("scheduled_at", start)
        .lt("scheduled_at", end);

      const evRows = (evs as any[]) ?? [];
      setEvents(evRows);

      // load actual costs per event
      if (evRows.length > 0) {
        const ids = evRows.map((e) => e.id);
        const { data: costs } = await supabase
          .from("event_costs")
          .select("event_id,amount")
          .in("event_id", ids);
        const sums: Record<string, number> = {};
        for (const c of (costs as any[]) ?? []) {
          sums[c.event_id] = (sums[c.event_id] || 0) + Number(c.amount || 0);
        }
        setActualCosts(sums);
      } else {
        setActualCosts({});
      }
      setLoading(false);
    })();
  }, [accountId, year]);

  const kpis = useMemo(() => {
    const realized = events.filter((e) => e.status === "completed").length;
    const totalBudget = events.reduce((s, e) => s + Number(e.budget || 0), 0);
    const totalActual = Object.values(actualCosts).reduce((s, v) => s + v, 0);
    const totalExpected = events.reduce((s, e) => s + (e.expected_attendees || 0), 0);
    return {
      total: events.length,
      realized,
      budget: totalBudget,
      actual: totalActual,
      expected: totalExpected,
    };
  }, [events, actualCosts]);

  const monthly = useMemo(() => {
    return MONTHS.map((m, i) => {
      const monthEvents = events.filter((e) => e.scheduled_at && new Date(e.scheduled_at).getMonth() === i);
      const realized = monthEvents.filter((e) => e.status === "completed").length;
      return {
        mes: m,
        total: monthEvents.length,
        realizados: realized,
        custo: monthEvents.reduce((s, e) => s + (actualCosts[e.id] || 0), 0),
      };
    });
  }, [events, actualCosts]);

  const byModality = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) counts[e.modality] = (counts[e.modality] || 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [events]);

  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) counts[e.event_type] = (counts[e.event_type] || 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [events]);

  const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="container max-w-7xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" />
            KPIs Anuais
          </h1>
          <p className="text-muted-foreground">
            Performance consolidada da operação de eventos.
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

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{kpis.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-xs text-muted-foreground">Realizados</div>
                <div className="text-2xl font-bold text-green-600">{kpis.realized}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {kpis.total > 0 ? Math.round((kpis.realized / kpis.total) * 100) : 0}% conclusão
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">Esperados</div>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{kpis.expected.toLocaleString("pt-BR")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">Orçamento</div>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-lg font-bold">{fmtBRL(kpis.budget)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-xs text-muted-foreground">Custo real</div>
                <div className="text-lg font-bold">{fmtBRL(kpis.actual)}</div>
                <div className={`text-xs mt-1 ${kpis.actual > kpis.budget ? "text-red-600" : "text-green-600"}`}>
                  {kpis.budget > 0 ? `${Math.round((kpis.actual / kpis.budget) * 100)}% do plano` : "—"}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Eventos por mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" fill="hsl(var(--primary))" name="Total" />
                    <Bar dataKey="realizados" fill="#10b981" name="Realizados" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Monitor className="h-4 w-4" /> Por modalidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={byModality} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {byModality.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Por tipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
