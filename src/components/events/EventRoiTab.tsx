import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Users, DollarSign, Target, Info, Copy } from "lucide-react";
import DuplicateEventDialog from "@/components/events/DuplicateEventDialog";

interface EventRoiTabProps {
  eventId: string;
  accountId: string | null;
  eventTitle: string;
  eventType: string;
  scheduledAt: string | null;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

/** Base do nome do evento (2 primeiras palavras) para agrupar edições. */
function titleBase(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[\s\-–|]+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
}

export default function EventRoiTab({
  eventId,
  accountId,
  eventTitle,
  eventType,
  scheduledAt,
}: EventRoiTabProps) {
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["event-roi", eventId, accountId],
    enabled: !!eventId && !!accountId,
    queryFn: async () => {
      const [{ data: costs }, { data: participants }] = await Promise.all([
        supabase.from("event_costs").select("estimated_value, actual_value").eq("event_id", eventId),
        supabase.from("event_participants").select("client_id, rsvp_status").eq("event_id", eventId),
      ]);

      const totalCost =
        (costs || []).reduce(
          (s, c: any) => s + (Number(c.actual_value) || Number(c.estimated_value) || 0),
          0,
        ) || 0;

      const clientIds = Array.from(
        new Set((participants || []).map((p: any) => p.client_id).filter(Boolean)),
      ) as string[];
      const attended = (participants || []).filter((p: any) => p.rsvp_status === "attended").length;

      let wonDeals: { id: string; title: string | null; value: number; won_at: string | null }[] = [];
      if (clientIds.length > 0) {
        const cutoff = scheduledAt ? new Date(scheduledAt).toISOString() : null;
        let q = supabase
          .from("deals")
          .select("id, title, value, won_at, client_id")
          .in("client_id", clientIds)
          .eq("status", "won");
        if (cutoff) q = q.gte("won_at", cutoff);
        const { data: deals } = await q;
        wonDeals = (deals || []).map((d: any) => ({
          id: d.id,
          title: d.title,
          value: Number(d.value) || 0,
          won_at: d.won_at,
        }));
      }

      const revenue = wonDeals.reduce((s, d) => s + d.value, 0);

      return {
        totalCost,
        revenue,
        participantsCount: (participants || []).length,
        linkedClients: clientIds.length,
        attended,
        wonDeals: wonDeals.sort((a, b) => b.value - a.value),
      };
    },
  });

  const { data: editions, isLoading: loadingEditions } = useQuery({
    queryKey: ["event-editions", eventId, accountId, eventType],
    enabled: !!eventId && !!accountId,
    queryFn: async () => {
      const base = titleBase(eventTitle);
      const { data: siblings } = await supabase
        .from("events")
        .select("id, title, scheduled_at, event_type")
        .eq("account_id", accountId!)
        .eq("event_type", eventType as any)
        .order("scheduled_at", { ascending: false })
        .limit(40);

      const matched = (siblings || []).filter((e: any) => titleBase(e.title || "") === base);
      if (matched.length === 0) return [];
      const ids = matched.map((e: any) => e.id);

      const [{ data: costs }, { data: parts }] = await Promise.all([
        supabase.from("event_costs").select("event_id, estimated_value, actual_value").in("event_id", ids),
        supabase
          .from("event_participants")
          .select("event_id, rsvp_status, client_id")
          .in("event_id", ids),
      ]);

      const allClientIds = Array.from(
        new Set((parts || []).map((p: any) => p.client_id).filter(Boolean)),
      ) as string[];

      let deals: { client_id: string; value: number; won_at: string | null }[] = [];
      if (allClientIds.length > 0) {
        const { data: d } = await supabase
          .from("deals")
          .select("client_id, value, won_at")
          .in("client_id", allClientIds)
          .eq("status", "won");
        deals = (d || []).map((x: any) => ({
          client_id: x.client_id,
          value: Number(x.value) || 0,
          won_at: x.won_at,
        }));
      }

      return matched.map((e: any) => {
        const cost = (costs || [])
          .filter((c: any) => c.event_id === e.id)
          .reduce((s, c: any) => s + (Number(c.actual_value) || Number(c.estimated_value) || 0), 0);
        const rows = (parts || []).filter((p: any) => p.event_id === e.id);
        const attended = rows.filter((p: any) => p.rsvp_status === "attended").length;
        const editionClients = new Set(
          rows.map((p: any) => p.client_id).filter(Boolean) as string[],
        );
        const cutoff = e.scheduled_at ? new Date(e.scheduled_at).getTime() : null;
        const revenue = deals
          .filter(
            (d) =>
              editionClients.has(d.client_id) &&
              (!cutoff || (d.won_at ? new Date(d.won_at).getTime() >= cutoff : false)),
          )
          .reduce((s, d) => s + d.value, 0);
        return {
          id: e.id,
          title: e.title as string,
          scheduled_at: e.scheduled_at as string | null,
          cost,
          revenue,
          roi: cost > 0 ? ((revenue - cost) / cost) * 100 : null,
          participants: rows.length,
          attended,
          attendanceRate: rows.length > 0 ? (attended / rows.length) * 100 : null,
          isCurrent: e.id === eventId,
        };
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const totalCost = data?.totalCost ?? 0;
  const revenue = data?.revenue ?? 0;
  const roi = totalCost > 0 ? ((revenue - totalCost) / totalCost) * 100 : null;
  const positive = revenue >= totalCost;
  const attendanceRate =
    data && data.participantsCount > 0 ? (data.attended / data.participantsCount) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <DollarSign className="h-3.5 w-3.5" />
              Investimento
            </div>
            <p className="text-2xl font-bold mt-1">{brl(totalCost)}</p>
            <p className="text-xs text-muted-foreground">Custos lançados no evento</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingUp className="h-3.5 w-3.5" />
              Receita atribuída
            </div>
            <p className="text-2xl font-bold mt-1">{brl(revenue)}</p>
            <p className="text-xs text-muted-foreground">
              {data?.wonDeals.length ?? 0} negócio(s) ganho(s) após o evento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Target className="h-3.5 w-3.5" />
              ROI
            </div>
            <p
              className={`text-2xl font-bold mt-1 ${positive ? "text-primary" : "text-destructive"}`}
            >
              {roi === null ? "—" : `${roi > 0 ? "+" : ""}${roi.toFixed(0)}%`}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {positive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              Resultado líquido {brl(revenue - totalCost)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Users className="h-3.5 w-3.5" />
              Comparecimento
            </div>
            <p className="text-2xl font-bold mt-1">{attendanceRate.toFixed(0)}%</p>
            <Progress value={attendanceRate} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {data?.attended ?? 0} de {data?.participantsCount ?? 0} participantes
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Negócios atribuídos ao evento</CardTitle>
          <CardDescription className="flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Negócios ganhos de clientes participantes, com data de ganho posterior ao evento.
            {data?.linkedClients === 0 && " Nenhum participante está vinculado a um cliente."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(data?.wonDeals.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum negócio ganho atribuído a este evento até agora.
            </p>
          ) : (
            <div className="divide-y">
              {data!.wonDeals.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.title || "Negócio"}</p>
                    {d.won_at && (
                      <p className="text-xs text-muted-foreground">
                        Ganho em {format(new Date(d.won_at), "dd MMM yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold shrink-0">{brl(d.value)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Comparativo entre edições</CardTitle>
            <CardDescription>
              Edições com o mesmo nome-base e tipo — presença, custo, receita atribuída e ROI.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setDuplicateOpen(true)}>
            <Copy className="h-4 w-4 mr-2" />
            Nova edição
          </Button>
        </CardHeader>
        <CardContent>
          {loadingEditions ? (
            <Skeleton className="h-32 w-full" />
          ) : (editions?.length ?? 0) <= 1 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Ainda não há outras edições deste evento para comparar. Use "Nova edição" para
              duplicar este evento e manter o histórico comparável.
            </p>
          ) : (
            <div className="space-y-4">
              {previous && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      label: "Presença vs edição anterior",
                      value: current?.attendanceRate ?? null,
                      prev: previous.attendanceRate,
                      suffix: "%",
                    },
                    {
                      label: "Custo vs edição anterior",
                      value: current?.cost ?? 0,
                      prev: previous.cost,
                      money: true,
                      invert: true,
                    },
                    {
                      label: "Receita vs edição anterior",
                      value: current?.revenue ?? 0,
                      prev: previous.revenue,
                      money: true,
                    },
                  ].map((m: any) => {
                    const delta =
                      m.value === null || m.prev === null ? null : Number(m.value) - Number(m.prev);
                    const good = delta === null ? true : m.invert ? delta <= 0 : delta >= 0;
                    return (
                      <div key={m.label} className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className="text-lg font-semibold mt-0.5">
                          {m.value === null
                            ? "—"
                            : m.money
                              ? brl(Number(m.value))
                              : `${Number(m.value).toFixed(0)}%`}
                        </p>
                        <p
                          className={`text-xs mt-0.5 ${good ? "text-primary" : "text-destructive"}`}
                        >
                          {delta === null
                            ? "sem base de comparação"
                            : `${delta > 0 ? "+" : ""}${
                                m.money ? brl(delta) : `${delta.toFixed(0)} p.p.`
                              } vs ${
                                previous.scheduled_at
                                  ? format(new Date(previous.scheduled_at), "MMM/yyyy", {
                                      locale: ptBR,
                                    })
                                  : "edição anterior"
                              }`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 pr-3 font-medium">Edição</th>
                      <th className="py-2 pr-3 font-medium">Data</th>
                      <th className="py-2 pr-3 font-medium text-right">Participantes</th>
                      <th className="py-2 pr-3 font-medium text-right">Presença</th>
                      <th className="py-2 pr-3 font-medium text-right">Custo</th>
                      <th className="py-2 pr-3 font-medium text-right">Receita</th>
                      <th className="py-2 font-medium text-right">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editions!.map((e) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <Link
                            to={`/events/${e.id}`}
                            className="hover:underline font-medium inline-flex items-center gap-2"
                          >
                            <span className="truncate max-w-[220px]">{e.title}</span>
                            {e.isCurrent && (
                              <Badge variant="secondary" className="text-[10px]">
                                atual
                              </Badge>
                            )}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {e.scheduled_at
                            ? format(new Date(e.scheduled_at), "dd/MM/yyyy", { locale: ptBR })
                            : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right">{e.participants}</td>
                        <td className="py-2 pr-3 text-right">
                          {e.attendanceRate === null ? "—" : `${Math.round(e.attendanceRate)}%`}
                        </td>
                        <td className="py-2 pr-3 text-right">{brl(e.cost)}</td>
                        <td className="py-2 pr-3 text-right">{brl(e.revenue)}</td>
                        <td
                          className={`py-2 text-right font-medium ${
                            e.roi === null
                              ? ""
                              : e.roi >= 0
                                ? "text-primary"
                                : "text-destructive"
                          }`}
                        >
                          {e.roi === null ? "—" : `${e.roi > 0 ? "+" : ""}${e.roi.toFixed(0)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DuplicateEventDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        eventId={eventId}
      />
    </div>
  );
}
