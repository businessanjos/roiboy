import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { Download, Loader2, ArrowDownLeft, ArrowUpRight, Sparkles } from "lucide-react";
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relatório de checkpoints — {clientName}</DialogTitle>
          <DialogDescription>
            Todos os checkpoints e resumos da timeline registrados para este cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-4">
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

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span><strong>{stats.total}</strong> registros</span>
            <span><strong>{stats.checkpoints}</strong> checkpoints</span>
            <span><strong>{stats.byClient}</strong> iniciados pelo cliente</span>
            <Badge variant="outline" className={cn("text-xs", CHECKPOINT_STATUS_STYLES[stats.state.status])}>
              {CHECKPOINT_STATUS_LABELS[stats.state.status]}
            </Badge>
          </div>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={data.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
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
          <div className="space-y-3">
            {data.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {format(new Date(r.happened_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{getKindLabel(r.kind)}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{getChannelLabel(r.channel)}</Badge>
                  <span className="inline-flex items-center gap-1">
                    {r.initiated_by === "cliente" ? (
                      <><ArrowDownLeft className="h-3 w-3" /> Cliente procurou</>
                    ) : (
                      <><ArrowUpRight className="h-3 w-3" /> Consultor procurou</>
                    )}
                  </span>
                  {r.source === "ai_whatsapp" && (
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Resumo automático
                    </span>
                  )}
                  {r.consultant_name && <span>· {r.consultant_name}</span>}
                </div>
                <p className="text-sm mt-2">{r.summary}</p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
