import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { OperationBriefingForm, OperationBriefingData } from "./OperationBriefingForm";

interface OperationBriefingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId?: string | null;
  clientId?: string | null;
  dealTitle?: string;
  /** Chamado quando o briefing é salvo com sucesso e está completo */
  onCompleted?: () => void;
}

export function OperationBriefingModal({
  open,
  onOpenChange,
  dealId,
  clientId,
  dealTitle,
  onCompleted,
}: OperationBriefingModalProps) {
  const handleSaved = (data: OperationBriefingData) => {
    if (data.is_complete) {
      onOpenChange(false);
      onCompleted?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Briefing para Operação</DialogTitle>
          <DialogDescription>
            {dealTitle
              ? `Preencha as informações estruturadas para Ganhar o negócio "${dealTitle}".`
              : "Preencha as informações estruturadas antes de Ganhar este negócio."}
          </DialogDescription>
        </DialogHeader>
        <OperationBriefingForm
          dealId={dealId}
          clientId={clientId}
          onSaved={handleSaved}
        />
      </DialogContent>
    </Dialog>
  );
}
