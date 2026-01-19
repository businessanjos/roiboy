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
import type { TikTokPost } from '@/hooks/useTikTokData';

interface DeleteTikTokPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (postId: string) => void;
  isLoading: boolean;
  post: TikTokPost | null;
}

export function DeleteTikTokPostDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  post,
}: DeleteTikTokPostDialogProps) {
  const handleConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    if (post) {
      onConfirm(post.id);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Vídeo</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir este vídeo? Esta ação não pode ser desfeita.
            {post?.caption && (
              <span className="block mt-2 p-2 bg-muted rounded text-sm">
                "{post.caption.slice(0, 100)}{post.caption.length > 100 ? '...' : ''}"
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
