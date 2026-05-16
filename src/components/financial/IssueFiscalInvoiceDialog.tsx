import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Lock, AlertTriangle } from "lucide-react";

type Props = {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: {
    nf_number?: string | null;
    nf_series?: string | null;
    nf_status?: string | null;
    nf_issued_at?: string | null;
    nf_url?: string | null;
  } | null;
};

export function IssueFiscalInvoiceDialog({ invoiceId, open, onOpenChange, existing }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [nfNumber, setNfNumber] = useState("");
  const [nfSeries, setNfSeries] = useState("");
  const [nfUrl, setNfUrl] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const isIssued = existing?.nf_status === "issued" && !!existing?.nf_number;

  const issueMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceId) throw new Error("Fatura inválida");
      const { error } = await supabase.rpc("issue_fiscal_invoice", {
        p_invoice_id: invoiceId,
        p_nf_number: nfNumber,
        p_nf_series: nfSeries || null,
        p_nf_url: nfUrl || null,
        p_issued_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-installments"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "NF emitida e fatura travada" });
      setNfNumber("");
      setNfSeries("");
      setNfUrl("");
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Erro ao emitir NF", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceId) throw new Error("Fatura inválida");
      const { error } = await supabase.rpc("cancel_fiscal_invoice", {
        p_invoice_id: invoiceId,
        p_reason: cancelReason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-installments"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "NF cancelada" });
      setCancelReason("");
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Erro ao cancelar NF", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Faturamento Fiscal (NF)
          </DialogTitle>
          <DialogDescription>
            Após emitir a NF a fatura fica <strong>travada</strong>: número, valor, cliente e
            divisão serviço/produto não podem ser alterados.
          </DialogDescription>
        </DialogHeader>

        {isIssued ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Número da NF</span>
                <Badge variant="default" className="font-mono">
                  {existing?.nf_series ? `${existing.nf_series}-` : ""}
                  {existing?.nf_number}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Emitida em</span>
                <span className="text-sm">
                  {existing?.nf_issued_at &&
                    new Date(existing.nf_issued_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <Lock className="h-3 w-3" />
                Fatura travada por emissão fiscal
              </div>
              {existing?.nf_url && (
                <a
                  href={existing.nf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Abrir PDF da NF →
                </a>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-3 w-3" />
                Cancelar NF (admin)
              </Label>
              <Textarea
                placeholder="Motivo do cancelamento (mín. 5 caracteres)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Só é possível cancelar se nenhuma parcela tiver sido paga.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelReason.trim().length < 5 || cancelMutation.isPending}
              >
                {cancelMutation.isPending ? "Cancelando..." : "Cancelar NF"}
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              issueMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Número da NF *</Label>
                <Input
                  value={nfNumber}
                  onChange={(e) => setNfNumber(e.target.value)}
                  placeholder="Ex: 12345"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Série</Label>
                <Input
                  value={nfSeries}
                  onChange={(e) => setNfSeries(e.target.value)}
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <Label>Link do PDF</Label>
                <Input
                  value={nfUrl}
                  onChange={(e) => setNfUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!nfNumber.trim() || issueMutation.isPending}>
                <Lock className="h-4 w-4 mr-2" />
                {issueMutation.isPending ? "Faturando..." : "Faturar e travar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default IssueFiscalInvoiceDialog;
