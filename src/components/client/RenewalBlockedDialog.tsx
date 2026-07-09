import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { formatBRL } from "@/lib/financial-format";

interface Props {
  open: boolean;
  onClose: () => void;
  clientName: string;
  overdueCount: number;
  overdueAmount: number;
  maxDaysOverdue: number;
  onOverrideAsAdmin?: () => void;
  canOverride?: boolean;
}

/**
 * Dialog que aparece quando CS/comercial tenta renovar contrato de cliente
 * inadimplente. Admin pode fazer override.
 */
export function RenewalBlockedDialog({
  open,
  onClose,
  clientName,
  overdueCount,
  overdueAmount,
  maxDaysOverdue,
  onOverrideAsAdmin,
  canOverride,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Renovação bloqueada — Cliente inadimplente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2">
              <p>
                <strong>{clientName}</strong> está com pagamentos em atraso e
                precisa regularizar antes de renovar.
              </p>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-red-700">Parcelas em atraso</span>
                  <strong className="text-red-900">{overdueCount}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-700">Valor total</span>
                  <strong className="text-red-900">
                    {formatBRL(overdueAmount)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-700">Maior atraso</span>
                  <strong className="text-red-900">
                    {maxDaysOverdue} dias
                  </strong>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Após a quitação (ou baixa manual das parcelas), a renovação será
                liberada automaticamente.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Entendi</AlertDialogCancel>
          {canOverride && onOverrideAsAdmin && (
            <AlertDialogAction
              onClick={onOverrideAsAdmin}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Ignorar e renovar (admin)
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
