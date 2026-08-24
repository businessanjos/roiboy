import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Plus, Sparkles, ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientCheckins } from "@/hooks/useClientCheckins";
import { ClientCheckinDialog } from "./ClientCheckinDialog";
import {
  CHECKPOINT_STATUS_LABELS,
  CHECKPOINT_STATUS_STYLES,
  getChannelLabel,
  getCheckpointState,
} from "@/lib/cs/checkins";

interface Props {
  clientId: string;
  clientName?: string;
  onSaved?: () => void;
}

export function ClientCheckinsCard({ clientId, clientName, onSaved }: Props) {
  const { data: checkins = [], isLoading, refetch } = useClientCheckins(clientId);
  const [open, setOpen] = useState(false);

  const lastCheckpoint = useMemo(
    () => checkins.find((c) => c.kind === "checkpoint")?.happened_at ?? null,
    [checkins]
  );
  const state = getCheckpointState(lastCheckpoint);

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Checkpoints e contatos
            </CardTitle>
            <CardDescription>
              Checkpoint a cada 15 dias · registros aparecem na timeline
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-xs", CHECKPOINT_STATUS_STYLES[state.status])}>
              {CHECKPOINT_STATUS_LABELS[state.status]}
            </Badge>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Registrar contato
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <Info label="Último checkpoint" value={lastCheckpoint ? format(new Date(lastCheckpoint), "dd/MM/yyyy", { locale: ptBR }) : "—"} />
          <Info label="Próximo previsto" value={state.nextDueAt ? format(new Date(state.nextDueAt), "dd/MM/yyyy", { locale: ptBR }) : "—"} />
          <Info label="Situação" value={state.label} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : checkins.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Nenhum contato registrado ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {checkins.slice(0, 6).map((c) => {
              const fromClient = c.initiated_by === "cliente";
              return (
                <div key={c.id} className="flex gap-3 rounded-lg border border-border/60 p-3">
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                      fromClient ? "bg-info/10 text-info" : "bg-primary/10 text-primary"
                    )}
                  >
                    {fromClient ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {fromClient ? "Cliente procurou" : "Consultor procurou"}
                      </span>
                      <span>·</span>
                      <span>{getChannelLabel(c.channel)}</span>
                      <span>·</span>
                      <span>{format(new Date(c.happened_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      {c.kind === "checkpoint" && (
                        <Badge variant="outline" className="text-[10px] h-4">Checkpoint</Badge>
                      )}
                      {c.source === "ai_whatsapp" && (
                        <Badge variant="outline" className="text-[10px] h-4 gap-1">
                          <Sparkles className="h-2.5 w-2.5" /> IA
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm mt-1 break-words">{c.summary}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <ClientCheckinDialog
        open={open}
        onOpenChange={setOpen}
        clientId={clientId}
        clientName={clientName}
        onSaved={() => {
          refetch();
          onSaved?.();
        }}
      />
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
