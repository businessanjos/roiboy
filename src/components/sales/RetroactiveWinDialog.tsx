import { useEffect, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isRetroactiveWinDay, saoPauloDay } from "@/lib/sales/retroactiveWin";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealTitle: string;
  onConfirm: (day: string) => Promise<void>;
}

export function RetroactiveWinDialog({ open, onOpenChange, dealTitle, onConfirm }: Props) {
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setDay(""); }, [open]);
  const valid = isRetroactiveWinDay(day);
  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" />Ganho retroativo</DialogTitle>
          <DialogDescription className="break-words">{dealTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-3">
          <Label htmlFor="retroactive-win-day">Data do ganho</Label>
          <Input id="retroactive-win-day" aria-label="Data do ganho" type="date" value={day} max={saoPauloDay()} required onChange={event => setDay(event.target.value)} className="h-11" />
          {day && !valid && <p role="alert" className="text-sm text-destructive">Escolha uma data anterior a hoje.</p>}
          <p className="text-sm text-muted-foreground">As validações do ganho continuam obrigatórias. A data de início do contrato não será alterada.</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!valid || busy} onClick={async () => {
            if (!valid || busy) return;
            setBusy(true);
            try { await onConfirm(day); onOpenChange(false); } finally { setBusy(false); }
          }}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}