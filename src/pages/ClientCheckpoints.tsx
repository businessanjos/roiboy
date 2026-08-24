import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarCheck, Download, FileText, Loader2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCheckinsReport, useCheckpointsPanel } from "@/hooks/useClientCheckins";
import { ClientCheckinDialog } from "@/components/client/ClientCheckinDialog";
import { ClientCheckinsReportDialog } from "@/components/client/ClientCheckinsReportDialog";
import {
  CHECKIN_CHANNELS,
  CHECKPOINT_STATUS_LABELS,
  CHECKPOINT_STATUS_STYLES,
  getCheckpointState,
  type CheckpointStatus,
} from "@/lib/cs/checkins";
import {
  CHECKIN_CSV_HEADERS,
  buildCsv,
  checkinToCsvRow,
  downloadCsv,
  fileStamp,
} from "@/lib/cs/checkinsExport";


type FilterKey = "todos" | CheckpointStatus;

export default function ClientCheckpoints() {
  const { data = [], isLoading, error, refetch } = useCheckpointsPanel();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [report, setReport] = useState<{ id: string; name: string } | null>(null);

  // Filtros de período/canal usados nos relatórios e exportações
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [channel, setChannel] = useState("todos");

  const detailed = useCheckinsReport({ from: from || null, to: to || null, channel, enabled: true });


  const rows = useMemo(() => {
    return data
      .map((r) => ({ ...r, state: getCheckpointState(r.last_checkpoint_at) }))
      .sort((a, b) => {
        const order: Record<CheckpointStatus, number> = {
          vencido: 0,
          sem_registro: 1,
          atencao: 2,
          em_dia: 3,
        };
        return order[a.state.status] - order[b.state.status];
      });
  }, [data]);

  const counts = useMemo(() => {
    const c: Record<CheckpointStatus, number> = { vencido: 0, sem_registro: 0, atencao: 0, em_dia: 0 };
    rows.forEach((r) => (c[r.state.status] += 1));
    return c;
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (filter !== "todos" && r.state.status !== filter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.full_name?.toLowerCase().includes(q) ||
      (r.consultant_name || "").toLowerCase().includes(q)
    );
  });

  const exportPanel = () => {
    const csv = buildCsv(
      ["Cliente", "Consultor", "Status do cliente", "Último checkpoint", "Próximo checkpoint", "Situação", "Último contato", "Resumo do último contato"],
      filtered.map((r) => [
        r.full_name,
        r.consultant_name || "",
        r.status || "",
        r.last_checkpoint_at ? format(new Date(r.last_checkpoint_at), "dd/MM/yyyy") : "",
        r.state.nextDueAt ? format(new Date(r.state.nextDueAt), "dd/MM/yyyy") : "",
        CHECKPOINT_STATUS_LABELS[r.state.status],
        r.last_contact_at ? format(new Date(r.last_contact_at), "dd/MM/yyyy") : "",
        r.last_summary || "",
      ])
    );
    downloadCsv(`checkpoints_painel_${fileStamp()}.csv`, csv);
  };

  const exportDetailed = () => {
    const visible = new Set(filtered.map((r) => r.client_id));
    const rowsToExport = (detailed.data || []).filter((r) => visible.has(r.client_id));
    const csv = buildCsv(CHECKIN_CSV_HEADERS, rowsToExport.map((r) => checkinToCsvRow(r)));
    downloadCsv(`checkpoints_registros_${fileStamp()}.csv`, csv);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Checkpoints quinzenais
          </h1>
          <p className="text-sm text-muted-foreground">
            Todo cliente precisa de um checkpoint a cada 15 dias.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportPanel} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            CSV do painel
          </Button>
          <Button
            variant="outline"
            onClick={exportDetailed}
            disabled={detailed.isLoading || (detailed.data || []).length === 0}
          >
            {detailed.isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            CSV dos registros
          </Button>
          <Button variant="outline" onClick={() => { refetch(); detailed.refetch(); }} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Vencidos" value={counts.vencido} tone="text-destructive" />
        <Kpi label="Sem registro" value={counts.sem_registro} tone="text-muted-foreground" />
        <Kpi label="Vence em breve" value={counts.atencao} tone="text-warning" />
        <Kpi label="Em dia" value={counts.em_dia} tone="text-success" />
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4 grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Canal</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os canais</SelectItem>
                {CHECKIN_CHANNELS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end text-xs text-muted-foreground">
            {detailed.isLoading
              ? "Carregando registros..."
              : `${(detailed.data || []).length} registro(s) no período/canal selecionado`}
          </div>
        </CardContent>
      </Card>


      <Card className="shadow-card">
        <CardHeader className="pb-3 space-y-3">
          <CardTitle className="text-base">Clientes ({filtered.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar cliente ou consultor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
              <TabsList>
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="vencido">Vencidos</TabsTrigger>
                <TabsTrigger value="sem_registro">Sem registro</TabsTrigger>
                <TabsTrigger value="atencao">Em breve</TabsTrigger>
                <TabsTrigger value="em_dia">Em dia</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive py-8 text-center">
              Não foi possível carregar os checkpoints: {(error as Error).message}
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum cliente encontrado com esse filtro.
            </p>

          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead>Último checkpoint</TableHead>
                    <TableHead>Próximo</TableHead>
                    <TableHead>Último contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.client_id}>
                      <TableCell className="font-medium">
                        <Link to={`/clients/${r.client_id}`} className="hover:underline">
                          {r.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.consultant_name || "—"}</TableCell>
                      <TableCell>
                        {r.last_checkpoint_at
                          ? format(new Date(r.last_checkpoint_at), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {r.state.nextDueAt
                          ? format(new Date(r.state.nextDueAt), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        {r.last_contact_at ? (
                          <div className="truncate text-sm">
                            <span className="text-muted-foreground">
                              {format(new Date(r.last_contact_at), "dd/MM", { locale: ptBR })} ·{" "}
                            </span>
                            {r.last_summary}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", CHECKPOINT_STATUS_STYLES[r.state.status])}
                        >
                          {CHECKPOINT_STATUS_LABELS[r.state.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setTarget({ id: r.client_id, name: r.full_name })}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Registrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {target && (
        <ClientCheckinDialog
          open={!!target}
          onOpenChange={(o) => !o && setTarget(null)}
          clientId={target.id}
          clientName={target.name}
          onSaved={() => refetch()}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-semibold mt-1", tone)}>{value}</p>
      </CardContent>
    </Card>
  );
}
