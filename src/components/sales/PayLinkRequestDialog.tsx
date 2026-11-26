import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { notifyPayLink, orphanKey, usePayOrphans } from "@/hooks/usePayOrphans";
import { PayOrphanList } from "@/components/sales/PayOrphanList";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  onRequested: () => void;
}

/** The seller asks the manager to link a payment made by someone else; the win stays locked meanwhile. */
export function PayLinkRequestDialog({ open, onOpenChange, dealId, onRequested }: Props) {
  const query = usePayOrphans(open);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const orphan = query.data?.orphans.find((o) => orphanKey(o) === selected);
    setSending(true);
    const { data: requestId, error } = await supabase.rpc("request_pay_link", {
      _deal_id: dealId,
      _source: orphan?.source ?? null,
      _external_id: orphan?.id ?? null,
      _label: orphan ? orphan.payerName : null,
      _note: note.trim() || null,
    });
    setSending(false);
    if (error) return toast.error(error.message || "Não foi possível enviar a solicitação.");
    if (requestId) void notifyPayLink("notify", requestId);
    toast.success("Solicitação enviada ao gestor.");
    setSelected(null);
    setNote("");
    onRequested();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Solicitar ao gestor</DialogTitle>
          <DialogDescription>
            Quando outra pessoa pagou (sócio, marido/esposa, cartão da empresa), o gestor vincula a venda a este negócio.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            <Label>Qual destas vendas é a sua? (opcional)</Label>
            <PayOrphanList
              orphans={query.data?.orphans}
              loading={query.isPending}
              error={query.isError ? query.error.message : null}
              partial={query.data?.partial}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-link-note">Observação para o gestor</Label>
            <Textarea
              id="pay-link-note"
              rows={3}
              maxLength={1000}
              placeholder="Ex.: quem pagou foi a esposa, no cartão dela."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button type="button" onClick={send} disabled={sending || (!selected && !note.trim())}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar ao gestor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
