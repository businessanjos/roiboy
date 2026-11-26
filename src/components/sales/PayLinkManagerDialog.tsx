import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { approvePayLink, notifyPayLink, orphanKey, usePayOrphans } from "@/hooks/usePayOrphans";
import { PayOrphanList } from "@/components/sales/PayOrphanList";
import { PAY_RELATIONSHIP_LABEL, type PayRelationship } from "@/lib/rykaPay";

const RELATIONSHIPS = Object.keys(PAY_RELATIONSHIP_LABEL) as PayRelationship[];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  onLinked: () => void;
}

/** The manager links an ownerless sale straight from the win: full list, no request to himself. */
export function PayLinkManagerDialog({ open, onOpenChange, dealId, onLinked }: Props) {
  const qc = useQueryClient();
  const query = usePayOrphans(open);
  const [selected, setSelected] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<PayRelationship | null>(null);
  const [other, setOther] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const picked = query.data?.orphans.find((o) => orphanKey(o) === selected) ?? null;
  const canLink = Boolean(picked && relationship && (relationship !== "other" || other.trim()));

  const link = async () => {
    if (!picked || !relationship) return;
    setBusy(true);
    try {
      const { data: requestId, error } = await supabase.rpc("open_pay_link_as_manager", { _deal_id: dealId });
      if (error || !requestId) throw new Error(error?.message || "Não foi possível vincular.");
      await approvePayLink({ requestId, orphan: picked, relationship, relationshipOther: other, payerDocument: document, payerEmail: email });
      void notifyPayLink("decided", requestId);
      toast.success("Pagamento vinculado ao negócio.");
      qc.invalidateQueries({ queryKey: ["pay-link-requests"] });
      qc.invalidateQueries({ queryKey: ["pay-orphans"] });
      setSelected(null); setRelationship(null); setOther(""); setDocument(""); setEmail("");
      onLinked();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível vincular.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Vincular pagamento</DialogTitle>
          <DialogDescription>
            Escolha a venda paga por outra pessoa (sócio, marido/esposa, cartão da empresa) que pertence a este negócio.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            <Label>Qual venda pertence a este negócio?</Label>
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
            <Label>Quem pagou é o quê do cliente?</Label>
            <div role="radiogroup" aria-label="Relação de quem pagou" className="grid grid-cols-2 gap-2">
              {RELATIONSHIPS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={relationship === value}
                  variant={relationship === value ? "default" : "outline"}
                  className="min-h-11"
                  onClick={() => setRelationship(value)}
                >
                  {PAY_RELATIONSHIP_LABEL[value]}
                </Button>
              ))}
            </div>
            {relationship === "other" && (
              <Input value={other} maxLength={120} placeholder="Escreva a relação (ex.: mãe)" aria-label="Outra relação" onChange={(e) => setOther(e.target.value)} />
            )}
          </div>
          {picked?.source === "rykapay" && (
            <div className="space-y-2">
              <Label>CPF/CNPJ ou e-mail de quem pagou (opcional)</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={document} autoComplete="off" inputMode="numeric" maxLength={18} placeholder="CPF ou CNPJ" aria-label="CPF ou CNPJ de quem pagou" onChange={(e) => setDocument(e.target.value)} />
                <Input value={email} type="email" maxLength={254} placeholder="E-mail" aria-label="E-mail de quem pagou" onChange={(e) => setEmail(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">Com isso, as próximas vendas desse pagador são reconhecidas sozinhas.</p>
            </div>
          )}
        </div>
        <DialogFooter className="border-t border-border px-6 py-4">
          <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" className="min-h-11" disabled={busy || !canLink} onClick={link}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Vincular ao negócio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
