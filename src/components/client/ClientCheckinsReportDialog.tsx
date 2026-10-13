import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2, ClipboardCheck, MessageCircle, SlidersHorizontal } from "lucide-react";
import { useCheckinsReport } from "@/hooks/useClientCheckins";
import {
  CHECKIN_CHANNELS,
  CHECKPOINT_STATUS_LABELS,
  CHECKPOINT_STATUS_STYLES,
  getChannelLabel,
  getCheckpointState,
  getKindLabel,
} from "@/lib/cs/checkins";
import {
  CHECKIN_CSV_HEADERS,
  buildCsv,
  checkinToCsvRow,
  downloadCsv,
  fileStamp,
} from "@/lib/cs/checkinsExport";
import { cn } from "@/lib/utils";
import { usePagedList } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClientHistoryTimeline } from "./ClientHistoryTimeline";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  defaultFrom?: string | null;
  defaultTo?: string | null;
  defaultChannel?: string;
}

export function ClientCheckinsReportDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  defaultFrom,
  defaultTo,
  defaultChannel = "todos",
}: Props) {
  const [from, setFrom] = useState(defaultFrom || "");
  const [to, setTo] = useState(defaultTo || "");
  const [channel, setChannel] = useState(defaultChannel);
  const [kind, setKind] = useState("todos");

  const { data = [], isLoading, error } = useCheckinsReport({
    clientId,
    from: from || null,
    to: to || null,
    channel,
    kind,
    enabled: open,
  });

  const pg = usePagedList(data, { resetKey: { from, to, channel, kind, clientId }, defaultPageSize: 20, isLoading });

  const stats = useMemo(() => {
    const checkpoints = data.filter((d) => d.kind === "checkpoint");
    const byClient = data.filter((d) => d.initiated_by === "cliente").length;
    const state = getCheckpointState(checkpoints[0]?.happened_at ?? null);
    return { total: data.length, checkpoints: checkpoints.length, byClient, state };
  }, [data]);

  const handleExport = () => {
    const csv = buildCsv(
      CHECKIN_CSV_HEADERS,
      data.map((r) => checkinToCsvRow({ ...r, client_name: clientName }))
    );
    downloadCsv(
      `checkpoints_${clientName.replace(/[^\w]+/g, "-").toLowerCase()}_${fileStamp()}.csv`,
      csv
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto min-w-0">
        <DialogHeader>
          <DialogTitle className="pr-6 break-words">Histórico de checkpoints — {clientName}</DialogTitle>
          <DialogDescription>
            Checkpoints e contatos registrados · Horário de Brasília
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span><strong className="text-foreground">{stats.total}</strong> registros</span>
            <span><strong className="text-foreground">{stats.checkpoints}</strong> checkpoints</span>
            <Badge variant="outline" className={cn("text-xs", CHECKPOINT_STATUS_STYLES[stats.state.status])}>
              {CHECKPOINT_STATUS_LABELS[stats.state.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline"><SlidersHorizontal className="mr-2 h-3.5 w-3.5" />Filtros{(from || to || channel !== "todos" || kind !== "todos") ? " · ativos" : ""}</Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="grid gap-3 grid-cols-2">
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
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="checkpoint">Checkpoint quinzenal</SelectItem>
                <SelectItem value="contato">Contato</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

                <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setFrom(""); setTo(""); setChannel("todos"); setKind("todos"); }}>Limpar filtros</Button>
              </PopoverContent>
            </Popover>
            <Button size="sm" variant="ghost" onClick={handleExport} disabled={data.length === 0} title="Exportar CSV" aria-label="Exportar CSV">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-6 text-center">
            Não foi possível carregar o relatório: {(error as Error).message}
          </p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhum registro nesse período/canal.
          </p>
        ) : (
          <ClientHistoryTimeline entries={pg.items.map((r) => ({
            id: r.id,
            at: r.happened_at,
            title: getKindLabel(r.kind),
            detail: [getChannelLabel(r.channel), r.initiated_by === "cliente" ? "Cliente iniciou o contato" : "Consultor iniciou o contato", r.consultant_name, r.source === "ai_whatsapp" ? "Resumo automático · RoyZapp CS" : "Registro manual"].filter(Boolean).join(" · "),
            text: r.summary,
            icon: r.kind === "checkpoint" ? ClipboardCheck : MessageCircle,
          }))} />
        )}
        {data.length > 0 && <PagerFor state={pg} itemLabel="registros" />}
      </DialogContent>
    </Dialog>
  );
}
