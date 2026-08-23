import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Link2, Link2Off, Wand2, AlertTriangle, CheckCircle2, Search, RefreshCw } from "lucide-react";

type Status = "ok" | "auto" | "sem_cliente" | "sem_negocio" | "incompleto";

interface Row {
  id: string;
  created_at: string;
  updated_at: string;
  is_complete: boolean;
  deal_id: string | null;
  client_id: string | null;
  dealTitle: string | null;
  dealStatus: string | null;
  dealWonAt: string | null;
  dealClientId: string | null;
  clientName: string | null;
  status: Status;
}

const STATUS_META: Record<Status, { label: string; className: string; hint: string }> = {
  ok: {
    label: "Vinculado na origem",
    className: "bg-success/10 text-success border-success/30",
    hint: "Briefing criado já com o cliente vinculado.",
  },
  auto: {
    label: "Corrigido automaticamente",
    className: "bg-info/10 text-info border-info/30",
    hint: "Vínculo negócio → cliente aplicado depois da criação (trigger/backfill).",
  },
  sem_cliente: {
    label: "Sem cliente vinculado",
    className: "bg-warning/10 text-warning border-warning/30",
    hint: "Negócio ainda não convertido em cliente — o briefing não aparece na ficha do CS.",
  },
  sem_negocio: {
    label: "Sem negócio de origem",
    className: "bg-destructive/10 text-destructive border-destructive/30",
    hint: "Briefing órfão: não há negócio vinculado para herdar o cliente.",
  },
  incompleto: {
    label: "Dados incompletos",
    className: "bg-warning/10 text-warning border-warning/30",
    hint: "Briefing vinculado, porém não finalizado pelo Comercial.",
  },
};

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function BriefingLinkAudit() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["briefing-link-audit"],
    queryFn: async (): Promise<Row[]> => {
      const { data: briefings, error } = await supabase
        .from("deal_operation_briefings")
        .select("id, created_at, updated_at, is_complete, deal_id, client_id")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const dealIds = [...new Set((briefings ?? []).map((b) => b.deal_id).filter(Boolean))] as string[];
      const clientIds = [...new Set((briefings ?? []).map((b) => b.client_id).filter(Boolean))] as string[];

      const dealMap = new Map<string, { title: string; status: string; won_at: string | null; client_id: string | null }>();
      if (dealIds.length) {
        const { data: deals } = await supabase
          .from("deals")
          .select("id, title, status, won_at, client_id")
          .in("id", dealIds);
        (deals ?? []).forEach((d) => dealMap.set(d.id, d as any));
        (deals ?? []).forEach((d) => d.client_id && clientIds.push(d.client_id));
      }

      const clientMap = new Map<string, string>();
      const uniqueClients = [...new Set(clientIds)];
      if (uniqueClients.length) {
        const { data: clients } = await supabase.from("clients").select("id, full_name").in("id", uniqueClients);
        (clients ?? []).forEach((c) => clientMap.set(c.id, c.full_name));
      }

      return (briefings ?? []).map((b) => {
        const deal = b.deal_id ? dealMap.get(b.deal_id) : undefined;
        // Heurística: vínculo aplicado após a criação = correção automática (trigger/backfill)
        const linkedLater =
          !!b.client_id && new Date(b.updated_at).getTime() - new Date(b.created_at).getTime() > 5000;

        let status: Status;
        if (!b.deal_id && !b.client_id) status = "sem_negocio";
        else if (!b.client_id) status = "sem_cliente";
        else if (!b.is_complete) status = "incompleto";
        else if (linkedLater) status = "auto";
        else status = "ok";

        return {
          id: b.id,
          created_at: b.created_at,
          updated_at: b.updated_at,
          is_complete: b.is_complete,
          deal_id: b.deal_id,
          client_id: b.client_id,
          dealTitle: deal?.title ?? null,
          dealStatus: deal?.status ?? null,
          dealWonAt: deal?.won_at ?? null,
          dealClientId: deal?.client_id ?? null,
          clientName: b.client_id ? clientMap.get(b.client_id) ?? null : null,
          status,
        };
      });
    },
  });

  const rows = data ?? [];

  const counts = useMemo(() => {
    const c: Record<Status, number> = { ok: 0, auto: 0, sem_cliente: 0, sem_negocio: 0, incompleto: 0 };
    rows.forEach((r) => (c[r.status] += 1));
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return (
        (r.dealTitle ?? "").toLowerCase().includes(q) ||
        (r.clientName ?? "").toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search]);

  const cards: { key: Status | "all"; label: string; value: number; icon: any }[] = [
    { key: "all", label: "Total analisado", value: rows.length, icon: Search },
    { key: "ok", label: "Vinculados na origem", value: counts.ok, icon: CheckCircle2 },
    { key: "auto", label: "Corrigidos automaticamente", value: counts.auto, icon: Wand2 },
    { key: "incompleto", label: "Dados incompletos", value: counts.incompleto, icon: AlertTriangle },
    { key: "sem_cliente", label: "Sem cliente", value: counts.sem_cliente, icon: Link2Off },
    { key: "sem_negocio", label: "Sem negócio", value: counts.sem_negocio, icon: Link2Off },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Auditoria de vínculo de briefings
          </h1>
          <p className="text-sm text-muted-foreground">
            Como cada briefing do Comercial chegou (ou não) à ficha do cliente no CS.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => {
          const Icon = c.icon;
          const active = filter === c.key;
          return (
            <Card
              key={c.key}
              onClick={() => setFilter(c.key as Status | "all")}
              className={`cursor-pointer transition-colors ${active ? "border-primary ring-1 ring-primary/40" : "hover:border-primary/40"}`}
            >
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold">{isLoading ? "—" : c.value}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">
            Briefings ({filtered.length})
            {filter !== "all" && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {STATUS_META[filter as Status].hint}
              </span>
            )}
          </CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por negócio ou cliente..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum briefing nesse filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Situação</TableHead>
                    <TableHead>Negócio (origem)</TableHead>
                    <TableHead>Cliente (destino)</TableHead>
                    <TableHead>Vínculo</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead>Última atualização</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const meta = STATUS_META[r.status];
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Badge variant="outline" className={meta.className} title={meta.hint}>
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[240px]">
                          {r.deal_id ? (
                            <div className="flex flex-col">
                              <Link
                                to={`/sales-pipeline?deal=${r.deal_id}`}
                                className="truncate hover:underline font-medium"
                              >
                                {r.dealTitle ?? "Negócio"}
                              </Link>
                              <span className="text-xs text-muted-foreground">
                                {r.dealStatus === "won" ? `Ganho em ${fmt(r.dealWonAt)}` : r.dealStatus ?? "—"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">— sem negócio —</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          {r.client_id ? (
                            <Link to={`/clients/${r.client_id}`} className="truncate hover:underline">
                              {r.clientName ?? "Cliente"}
                            </Link>
                          ) : r.dealClientId ? (
                            <span className="text-warning text-sm">Cliente existe no negócio, falta vincular</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">— não convertido —</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.client_id
                            ? r.status === "auto"
                              ? "negócio → cliente (automático)"
                              : "negócio → cliente (na criação)"
                            : "não propagado"}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmt(r.created_at)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmt(r.updated_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
