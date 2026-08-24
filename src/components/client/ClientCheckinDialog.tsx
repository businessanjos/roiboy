import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { useCreateCheckin } from "@/hooks/useClientCheckins";
import {
  CHECKIN_CHANNELS,
  CHECKIN_INITIATED_BY,
  type CheckinChannel,
  type CheckinInitiatedBy,
  type CheckinKind,
} from "@/lib/cs/checkins";

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientName?: string;
  defaultKind?: CheckinKind;
  onSaved?: () => void;
}

export function ClientCheckinDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  defaultKind = "checkpoint",
  onSaved,
}: Props) {
  const create = useCreateCheckin();
  const [kind, setKind] = useState<CheckinKind>(defaultKind);
  const [initiatedBy, setInitiatedBy] = useState<CheckinInitiatedBy>("consultor");
  const [channel, setChannel] = useState<CheckinChannel>("whatsapp");
  const [happenedAt, setHappenedAt] = useState(() => toLocalInputValue(new Date()));
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setKind(defaultKind);
      setInitiatedBy(defaultKind === "checkpoint" ? "consultor" : "cliente");
      setChannel("whatsapp");
      setHappenedAt(toLocalInputValue(new Date()));
      setSummary("");
      setError(null);
    }
  }, [open, defaultKind]);

  const handleSave = async () => {
    const clean = summary.trim();
    if (clean.length < 5) {
      setError("Escreva ao menos uma frase resumindo o contato.");
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({
        clientId,
        happenedAt: new Date(happenedAt).toISOString(),
        initiatedBy,
        channel,
        kind,
        summary: clean,
      });
      toast.success(
        kind === "checkpoint" ? "Checkpoint registrado na timeline" : "Contato registrado na timeline"
      );
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao registrar contato");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle>Registrar contato</DialogTitle>
              <DialogDescription>
                {clientName ? `${clientName} · ` : ""}fica salvo na timeline do cliente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as CheckinKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checkpoint">Checkpoint quinzenal</SelectItem>
                  <SelectItem value="contato">Contato avulso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data e hora</Label>
              <Input
                type="datetime-local"
                value={happenedAt}
                onChange={(e) => setHappenedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quem procurou</Label>
              <Select
                value={initiatedBy}
                onValueChange={(v) => setInitiatedBy(v as CheckinInitiatedBy)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHECKIN_INITIATED_BY.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as CheckinChannel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHECKIN_CHANNELS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Resumo em uma frase</Label>
            <Textarea
              rows={3}
              maxLength={300}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Ex.: Pediu ajuda para ajustar a agenda da equipe e travar o script de avaliação."
            />
            <div className="flex justify-between">
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Objetivo: o que foi pedido ou conversado.
                </p>
              )}
              <span className="text-xs text-muted-foreground">{summary.length}/300</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
