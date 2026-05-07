import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InstallmentTimeline } from "./InstallmentTimeline";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          {installmentId ? (
            <InstallmentTimeline installmentId={installmentId} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Selecione uma parcela.
            </p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default InstallmentTimelineDialog;
