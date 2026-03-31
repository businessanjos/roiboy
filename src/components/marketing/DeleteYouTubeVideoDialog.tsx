import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { YouTubeVideo } from '@/hooks/useYouTubeData';

interface DeleteYouTubeVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (videoId: string) => void;
  isLoading: boolean;
  video: YouTubeVideo | null;
}

export function DeleteYouTubeVideoDialog({ open, onOpenChange, onConfirm, isLoading, video }: DeleteYouTubeVideoDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Vídeo</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir este vídeo? Esta ação não pode ser desfeita.
            {video?.title && <span className="block mt-2 p-2 bg-muted rounded text-sm">"{video.title.slice(0, 100)}{video.title.length > 100 ? '...' : ''}"</span>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); if (video) onConfirm(video.id); }} disabled={isLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {isLoading ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
