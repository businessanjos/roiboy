import { useState } from "react";
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
import { InsightsPanel } from "@/hooks/useInsightsPanels";

interface DeletePanelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: InsightsPanel;
  onDelete: (id: string) => Promise<void>;
}

export function DeletePanelDialog({
  open,
  onOpenChange,
  panel,
  onDelete,
}: DeletePanelDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(panel.id);
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const typeLabel = panel.type === "dashboard" ? "painel" : "relatório";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {typeLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            Você tem certeza que deseja excluir o {typeLabel} "{panel.name}"?
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
