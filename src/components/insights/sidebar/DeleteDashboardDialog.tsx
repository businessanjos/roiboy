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
import { InsightsDashboard } from "@/hooks/useInsightsDashboards";

interface DeleteDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboard: InsightsDashboard;
  onDelete: (id: string) => Promise<void>;
}

export function DeleteDashboardDialog({
  open,
  onOpenChange,
  dashboard,
  onDelete,
}: DeleteDashboardDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(dashboard.id);
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir painel</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o painel "{dashboard.name}"? 
            Todos os visuais associados também serão excluídos. 
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
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
