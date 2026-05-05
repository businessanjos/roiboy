import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, Users, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ProductBreakdown = { id: string; name: string; color: string | null; count: number };
type EventInfo = { id: string; title: string; scheduled_at: string | null; participants: number };
type LastEventGroup = {
  events: EventInfo[];
  rangeStart: string | null;
  rangeEnd: string | null;
  attended: number;
  totalParticipants: number;
  byProduct: ProductBreakdown[];
  noProduct: number;
};

// Janela de agrupamento (±dias) ao redor do último evento com participantes
const GROUP_WINDOW_DAYS = 2;

// Produtos elegíveis para eventos presenciais (renovações mapeiam para o produto base)
const ELIGIBLE_PRODUCT_NAMES = [
  "Eternum Club",
  "Eternum Private",
  "Conselho de Anjo",
  "Eternum MVP",
];
const RENEWAL_TO_BASE: Record<string, string> = {
  "Ren. Eternum Club": "Eternum Club",
  "Ren. Eternum Private": "Eternum Private",
};

export function LastEventAttendanceCard() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [data, setData] = useState<LastEventGroup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // 1) Buscar eventos recentes (modality/title pode estar inconsistente — filtramos abaixo)
        const { data: evts } = await supabase
          .from("events")
          .select("id, title, scheduled_at, modality")
          .eq("account_id", accountId)
          .lte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: false, nullsFirst: false })
          .limit(60);

        if (!evts || evts.length === 0) {
          if (!cancelled) setData(null);
          return;
        }

        // Considera presencial quando a modality OU o título indicam (dados inconsistentes)
        const isPresencial = (e: { title: string | null; modality: string | null }) => {
          const t = (e.title || "").toUpperCase();
          const m = (e.modality || "").toLowerCase();
          return m === "presencial" || m === "hibrido" || m === "híbrido" || m === "hybrid"
            || /PRESENCIAL|HÍBRIDO|HIBRIDO/.test(t);
        };
        const presenciais = evts.filter(isPresencial);
        if (presenciais.length === 0) {
          if (!cancelled) setData(null);
          return;
        }

        // 2) Achar o último evento PRESENCIAL com participantes — vira a âncora
        const eventIds = presenciais.map((e) => e.id);
        const { data: allParts } = await supabase
          .from("event_participants")
          .select("event_id, client_id, rsvp_status")
          .in("event_id", eventIds);

        const partsByEvent = new Map<string, { client_id: string | null; rsvp_status: string | null }[]>();
        for (const p of allParts ?? []) {
          if (!p.event_id) continue;
          const arr = partsByEvent.get(p.event_id) || [];
          arr.push({ client_id: p.client_id ?? null, rsvp_status: p.rsvp_status ?? null });
          partsByEvent.set(p.event_id, arr);
        }

        const anchor = presenciais.find((e) => (partsByEvent.get(e.id)?.length ?? 0) > 0);
        if (!anchor || !anchor.scheduled_at) {
          if (!cancelled) setData(null);
          return;
        }

        // 3) Cluster: todos eventos dentro de ±N dias da âncora que tenham participantes
        const anchorMs = new Date(anchor.scheduled_at).getTime();
        const windowMs = GROUP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        const cluster = evts
          .filter((e) => {
            if (!e.scheduled_at) return false;
            if ((partsByEvent.get(e.id)?.length ?? 0) === 0) return false;
            const diff = Math.abs(new Date(e.scheduled_at).getTime() - anchorMs);
            return diff <= windowMs;
          })
          .sort(
            (a, b) =>
              new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()
          );

        const allRows = cluster.flatMap((e) => partsByEvent.get(e.id) ?? []);
        const hasAttended = allRows.some((p) => p.rsvp_status === "attended");
        const attendedRows = hasAttended
          ? allRows.filter((p) => p.rsvp_status === "attended")
          : allRows.filter((p) => p.rsvp_status === "confirmed");

        // Deduplicar clientes (mesma pessoa em vários eventos do cluster conta 1x)
        const uniqueClientIds = Array.from(
          new Set(attendedRows.map((p) => p.client_id).filter(Boolean) as string[])
        );
        const guestsNoClient = attendedRows.filter((p) => !p.client_id).length;
        const totalUniqueAttended = uniqueClientIds.length + guestsNoClient;

        const dates = cluster
          .map((e) => e.scheduled_at)
          .filter(Boolean) as string[];
        const rangeStart = dates.length ? dates[0] : null;
        const rangeEnd = dates.length ? dates[dates.length - 1] : null;

        // 4) Carregar produtos elegíveis (presenciais) + renovações que mapeiam para a base
        const eligibleNames = [
          ...ELIGIBLE_PRODUCT_NAMES,
          ...Object.keys(RENEWAL_TO_BASE),
        ];
        const { data: eligibleProds } = await supabase
          .from("products")
          .select("id, name, color")
          .in("name", eligibleNames);

        // Mapa: product_id -> { baseName, color } (renovações apontam para a base)
        const productMeta = new Map<string, { name: string; color: string | null }>();
        const baseByName = new Map<string, { name: string; color: string | null }>();
        for (const p of eligibleProds ?? []) {
          if (ELIGIBLE_PRODUCT_NAMES.includes(p.name)) {
            baseByName.set(p.name, { name: p.name, color: p.color });
          }
        }
        for (const p of eligibleProds ?? []) {
          const baseName = RENEWAL_TO_BASE[p.name] ?? p.name;
          const base = baseByName.get(baseName);
          if (base) productMeta.set(p.id, base);
        }
        const eligibleProductIds = Array.from(productMeta.keys());

        // 5) Contratos ativos por cliente — apenas dos produtos elegíveis
        const productCount: Record<string, { name: string; color: string | null; count: number }> = {};
        let noProduct = 0;

        if (uniqueClientIds.length > 0 && eligibleProductIds.length > 0) {
          const { data: contracts } = await supabase
            .from("client_contracts")
            .select("client_id, product_id, start_date, end_date, status")
            .in("client_id", uniqueClientIds)
            .in("product_id", eligibleProductIds);

          const byClient: Record<string, any[]> = {};
          for (const c of contracts ?? []) {
            if (!c.client_id) continue;
            (byClient[c.client_id] ||= []).push(c);
          }

          const activeStatuses = new Set(["ativo", "active", "suspenso", "pausado"]);
          const refIso = anchor.scheduled_at;

          for (const cid of uniqueClientIds) {
            const list = byClient[cid] || [];
            const match =
              list.find((c) => {
                const start = c.start_date ? new Date(c.start_date).toISOString() : null;
                const end = c.end_date ? new Date(c.end_date).toISOString() : null;
                const inRange = (!start || start <= refIso) && (!end || end >= refIso);
                return inRange && activeStatuses.has((c.status || "").toLowerCase());
              }) ||
              list.find((c) => activeStatuses.has((c.status || "").toLowerCase())) ||
              list[0];

            const meta = match?.product_id ? productMeta.get(match.product_id) : null;
            if (meta) {
              const key = meta.name;
              if (!productCount[key]) productCount[key] = { name: meta.name, color: meta.color, count: 0 };
              productCount[key].count += 1;
            } else {
              noProduct += 1;
            }
          }
        } else {
          noProduct += uniqueClientIds.length;
        }
        noProduct += guestsNoClient;

        const byProduct: ProductBreakdown[] = Object.entries(productCount)
          .map(([key, v]) => ({ id: key, name: v.name, color: v.color, count: v.count }))
          .sort((a, b) => b.count - a.count);

        if (!cancelled) {
          setData({
            events: cluster.map((e) => ({
              id: e.id,
              title: e.title,
              scheduled_at: e.scheduled_at,
              participants: partsByEvent.get(e.id)?.length ?? 0,
            })),
            rangeStart,
            rangeEnd,
            attended: totalUniqueAttended,
            totalParticipants: allRows.length,
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
            Nenhum evento com participantes encontrado.
          </div>
        </CardContent>
      </Card>
    );
  }

  const presencaPct =
    data.totalParticipants > 0 ? Math.round((data.attended / data.totalParticipants) * 100) : 0;

  const sameDay =
    data.rangeStart &&
    data.rangeEnd &&
    format(new Date(data.rangeStart), "yyyy-MM-dd") ===
      format(new Date(data.rangeEnd), "yyyy-MM-dd");

  const dateLabel = data.rangeStart
    ? sameDay
      ? format(new Date(data.rangeStart), "dd 'de' MMM yyyy", { locale: ptBR })
      : `${format(new Date(data.rangeStart), "dd", { locale: ptBR })}–${format(
          new Date(data.rangeEnd!),
          "dd 'de' MMM yyyy",
          { locale: ptBR }
        )}`
    : "";

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
              <span className="font-medium text-foreground">
                {data.events.length} evento{data.events.length > 1 ? "s" : ""} agrupado
                {data.events.length > 1 ? "s" : ""}
              </span>
              {dateLabel && (
                <span className="text-muted-foreground"> · {dateLabel}</span>
              )}
            </CardDescription>
          </div>
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

        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Eventos incluídos
          </p>
          <div className="flex flex-wrap gap-2">
            {data.events.map((e) => (
              <Link
                key={e.id}
                to={`/events/${e.id}`}
                className="inline-flex items-center gap-2 text-xs rounded-md border bg-muted/30 hover:bg-muted px-2.5 py-1.5 transition"
              >
                <span className="font-medium">{e.title}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{e.participants}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </Link>
            ))}
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
