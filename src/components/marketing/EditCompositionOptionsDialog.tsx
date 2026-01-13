import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PostOption {
  id?: string;
  value: string;
  isDefault?: boolean;
}

interface EditCompositionOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: PostOption[];
  onDeleteOption: (id: string) => void;
  isLoading?: boolean;
}

export function EditCompositionOptionsDialog({
  open,
  onOpenChange,
  options,
  onDeleteOption,
  isLoading = false,
}: EditCompositionOptionsDialogProps) {
  const handleClose = () => {
    onOpenChange(false);
  };

  // Separate default and custom options
  const defaultOptions = options.filter((opt) => opt.isDefault);
  const customOptions = options.filter((opt) => !opt.isDefault);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Gerenciar Opções de Composição</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <ScrollArea className="h-[300px] rounded-md border p-3">
            <div className="space-y-3">
              {/* Custom options first */}
              {customOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Personalizadas
                  </p>
                  {customOptions.map((option, index) => (
                    <div
                      key={option.id || `custom-${index}`}
                      className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <span className="text-sm">{option.value}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => option.id && onDeleteOption(option.id)}
                        disabled={isLoading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Default options */}
              {defaultOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Padrão (não removíveis)
                  </p>
                  {defaultOptions.map((option, index) => (
                    <div
                      key={option.id || `default-${index}`}
                      className="flex items-center justify-between py-2 px-3 rounded-md bg-background border"
                    >
                      <span className="text-sm">{option.value}</span>
                      <Badge variant="secondary" className="text-xs">
                        Padrão
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {options.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma opção disponível.
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
