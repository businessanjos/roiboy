import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InstallmentTimeline } from "./InstallmentTimeline";
import { PaymentStatusSelect, PaymentStatusBadge } from "./PaymentStatusSelect";
import { RenegotiateInstallmentDialog } from "./RenegotiateInstallmentDialog";

type Props = {
  installmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
};

export function InstallmentTimelineDialog({
  installmentId,
  open,
  onOpenChange,
  title = "Histórico da parcela",
  subtitle = "Todas as movimentações da régua de cobrança e renegociações.",
}: Props) {
  const qc = useQueryClient();
  const [data, setData] = useState<any>(null);
  const [reneg, setReneg] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open || !installmentId) {
      setData(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("installments")
        .select("id, number, status, payment_status, payment_method, amount")
        .eq("id", installmentId)
        .maybeSingle();
      setData(data);
    })();
  }, [open, installmentId, reloadKey]);

  const refresh = () => {
    setReloadKey((k) => k + 1);
    qc.invalidateQueries({ queryKey: ["financial-installments"] });
    qc.invalidateQueries({ queryKey: ["installment-timeline", installmentId] });
  };

  const isLocked = data?.status === "renegotiated" || data?.status === "paid";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{subtitle}</DialogDescription>
          </DialogHeader>

          {data && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-3">
              <span className="text-sm font-medium">Parcela #{data.number}</span>
              <PaymentStatusBadge value={data.payment_status} />
              <div className="ml-auto flex items-center gap-2">
                {!isLocked && (
                  <PaymentStatusSelect
                    installmentId={data.id}
                    value={data.payment_status}
                    onChange={refresh}
                  />
                )}
                {!isLocked && (
                  <Button size="sm" variant="outline" onClick={() => setReneg(true)}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Renegociar
                  </Button>
                )}
              </div>
            </div>
          )}

          <ScrollArea className="max-h-[60vh] pr-4">
            {installmentId ? (
              <InstallmentTimeline installmentId={installmentId} />
            ) : (
              <p className="text-sm text-muted-foreground">Selecione uma parcela.</p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <RenegotiateInstallmentDialog
        installmentId={installmentId}
        open={reneg}
        onOpenChange={setReneg}
        onRenegotiated={refresh}
      />
    </>
  );
}

export default InstallmentTimelineDialog;
