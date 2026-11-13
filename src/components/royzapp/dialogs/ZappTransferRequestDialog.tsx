import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  request: { assignmentId: string; ownerName: string } | null;
  onClose: () => void;
}

/** Vendedor pede ao gestor uma conversa que está com outro atendente (só setor Vendas). */
export function ZappTransferRequestDialog({ request, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!request) return;
    setBusy(true);
    const { data: id, error } = await (supabase as any).rpc("request_zapp_conversation_transfer", {
      _assignment_id: request.assignmentId,
      _reason: reason || null,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message || "Não foi possível enviar o pedido");
      return;
    }
    await supabase.functions.invoke("zapp-transfer-whatsapp", { body: { action: "notify", request_id: id } }).catch(() => null);
    setBusy(false);
    toast.success("Pedido enviado ao gestor. Você será avisado quando ele decidir.");
    setReason("");
    onClose();
  };

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar transferência da conversa</DialogTitle>
          <DialogDescription>
            {request?.ownerName === "Fila / Triagem" ? <>Essa conversa está na <strong>fila / triagem</strong>.</> : <>Essa conversa está com <strong>{request?.ownerName}</strong>.</>} O gestor recebe o pedido no ROY e no WhatsApp para aprovar.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Motivo (opcional). Ex.: a cliente já vinha falando comigo"
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={send} disabled={busy}>Enviar pedido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
