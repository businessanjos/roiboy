import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteSocialProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string | undefined;
  entityLabel?: string; // "perfil" | "canal"
  isDeleting?: boolean;
  onConfirm: () => void;
}

export function DeleteSocialProfileDialog({
  open,
  onOpenChange,
  username,
  entityLabel = 'perfil',
  isDeleting,
  onConfirm,
}: DeleteSocialProfileDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {entityLabel} @{username}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é permanente. Todos os posts, métricas e dados vinculados a
            este {entityLabel} serão removidos. Não é possível desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Excluindo...' : 'Excluir definitivamente'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
