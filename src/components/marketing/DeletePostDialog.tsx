import { Trash2 } from 'lucide-react';
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
import type { InstagramPost } from '@/hooks/useSocialMediaData';

interface DeletePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (postId: string) => void;
  isLoading: boolean;
  post: InstagramPost | null;
}

export function DeletePostDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  post,
}: DeletePostDialogProps) {
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
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Excluir Post
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir este post? Esta ação não pode ser desfeita.
            {post?.caption && (
              <span className="block mt-2 text-sm text-muted-foreground italic line-clamp-2">
                "{post.caption}"
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
