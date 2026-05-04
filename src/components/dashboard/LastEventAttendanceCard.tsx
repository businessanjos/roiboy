import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, MapPin, Users, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ProductBreakdown = { id: string; name: string; color: string | null; count: number };
type LastEvent = {
  id: string;
  title: string;
  scheduled_at: string | null;
  address: string | null;
  attended: number;
  totalParticipants: number;
  byProduct: ProductBreakdown[];
  noProduct: number;
};

export function LastEventAttendanceCard() {
  const { user } = useCurrentUser();
  const accountId = user?.account_id;
  const [data, setData] = useState<LastEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Último evento presencial finalizado (status completed)
        const { data: evts } = await supabase
          .from("events")
          .select("id, title, scheduled_at, address")
          .eq("account_id", accountId)
          .eq("modality", "presencial")
          .eq("status", "completed")
          .order("scheduled_at", { ascending: false, nullsFirst: false })
          .limit(1);

        const evt = evts?.[0];
        if (!evt) {
          if (!cancelled) setData(null);
          return;
        }

        const { data: parts } = await supabase
          .from("event_participants")
          .select("client_id, rsvp_status")
          .eq("event_id", evt.id);

        const all = parts ?? [];
        const attendedRows = all.filter((p) => p.rsvp_status === "attended");
        const clientIds = Array.from(
          new Set(attendedRows.map((p) => p.client_id).filter(Boolean) as string[])
        );

        const eventDate = evt.scheduled_at ? new Date(evt.scheduled_at).toISOString() : null;

        const productCount: Record<string, number> = {};
        let noProduct = 0;

        if (clientIds.length > 0) {
          // Contratos ativos no momento do evento
          let cq = supabase
            .from("contracts")
            .select("client_id, product_id, start_date, end_date, status")
            .in("client_id", clientIds);
          // Não filtramos status no servidor por flexibilidade; filtramos abaixo
          const { data: contracts } = await cq;

          // Para cada cliente, escolher um contrato ativo na data do evento
          const byClient: Record<string, any[]> = {};
          for (const c of contracts ?? []) {
            if (!c.client_id) continue;
            (byClient[c.client_id] ||= []).push(c);
          }

          const activeStatuses = new Set(["ativo", "active", "suspenso", "pausado"]);

          for (const cid of clientIds) {
            const list = byClient[cid] || [];
            // Prioridade: contrato cujo período contém eventDate e status ativo
            const match =
              list.find((c) => {
                if (!eventDate) return activeStatuses.has((c.status || "").toLowerCase());
                const start = c.start_date ? new Date(c.start_date).toISOString() : null;
                const end = c.end_date ? new Date(c.end_date).toISOString() : null;
                const inRange = (!start || start <= eventDate) && (!end || end >= eventDate);
                return inRange && activeStatuses.has((c.status || "").toLowerCase());
              }) ||
              list.find((c) => activeStatuses.has((c.status || "").toLowerCase())) ||
              list[0];

            if (match?.product_id) {
              productCount[match.product_id] = (productCount[match.product_id] || 0) + 1;
            } else {
              noProduct += 1;
            }
          }
        }

        // Convidados sem cliente que compareceram
        noProduct += attendedRows.filter((p) => !p.client_id).length;

        const productIds = Object.keys(productCount);
        let products: { id: string; name: string; color: string | null }[] = [];
        if (productIds.length > 0) {
          const { data: prods } = await supabase
            .from("products")
            .select("id, name, color")
            .in("id", productIds);
          products = prods ?? [];
        }

        const byProduct: ProductBreakdown[] = products
          .map((p) => ({ ...p, count: productCount[p.id] || 0 }))
          .sort((a, b) => b.count - a.count);

        if (!cancelled) {
          setData({
            id: evt.id,
            title: evt.title,
            scheduled_at: evt.scheduled_at,
            address: evt.address,
            attended: attendedRows.length,
            totalParticipants: all.length,
            byProduct,
            noProduct,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (loading) {
    return (
      <Card className="shadow-card border-l-4 border-l-primary/40">
        <CardContent className="p-5 text-sm text-muted-foreground">Carregando comparecimento…</CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="shadow-card border-l-4 border-l-muted">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarCheck className="h-4 w-4" />
            Nenhum evento presencial finalizado ainda.
          </div>
        </CardContent>
      </Card>
    );
  }

  const presencaPct =
    data.totalParticipants > 0 ? Math.round((data.attended / data.totalParticipants) * 100) : 0;

  return (
    <Card className="shadow-card border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Último Evento Presencial
            </CardTitle>
            <CardDescription className="mt-1">
              <span className="font-medium text-foreground">{data.title}</span>
              {data.scheduled_at && (
                <span className="text-muted-foreground">
                  {" · "}
                  {format(new Date(data.scheduled_at), "dd 'de' MMM yyyy", { locale: ptBR })}
                </span>
              )}
              {data.address && (
                <span className="inline-flex items-center gap-1 text-muted-foreground ml-2">
                  <MapPin className="h-3 w-3" />
                  {data.address}
                </span>
              )}
            </CardDescription>
          </div>
          <Link
            to={`/events/${data.id}`}
            className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            Ver evento <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Users className="h-3.5 w-3.5" /> Compareceram
            </div>
            <p className="text-4xl font-bold text-primary leading-none">{data.attended}</p>
            <p className="text-xs text-muted-foreground mt-2">
              de {data.totalParticipants} convidados
            </p>
          </div>
          <div className="rounded-lg bg-success/5 border border-success/20 p-4">
            <div className="text-xs text-muted-foreground mb-1">Taxa de presença</div>
            <p className="text-4xl font-bold text-success leading-none">{presencaPct}%</p>
            <div className="mt-3 w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="h-full bg-success" style={{ width: `${presencaPct}%` }} />
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 border p-4">
            <div className="text-xs text-muted-foreground mb-1">Produtos representados</div>
            <p className="text-4xl font-bold leading-none">{data.byProduct.length}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {data.noProduct > 0 ? `${data.noProduct} sem contrato ativo` : "todos com contrato"}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Participantes por produto
          </p>
          {data.byProduct.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum participante com contrato ativo identificado.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.byProduct.map((p) => (
                <Badge
                  key={p.id}
                  className="text-white border-0 px-3 py-1.5 text-sm"
                  style={{ backgroundColor: p.color || "#6b7280" }}
                >
                  {p.name}
                  <span className="ml-2 font-bold">{p.count}</span>
                </Badge>
              ))}
              {data.noProduct > 0 && (
                <Badge variant="outline" className="px-3 py-1.5 text-sm">
                  Sem produto
                  <span className="ml-2 font-bold">{data.noProduct}</span>
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
