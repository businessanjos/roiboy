import { useState } from 'react';
import { X, Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  onUpdateOption: (id: string, value: string) => void;
  onDeleteOption: (id: string) => void;
  isLoading?: boolean;
}

export function EditCompositionOptionsDialog({
  open,
  onOpenChange,
  options,
  onUpdateOption,
  onDeleteOption,
  isLoading = false,
}: EditCompositionOptionsDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleClose = () => {
    setEditingId(null);
    setEditValue('');
    onOpenChange(false);
  };

  const handleStartEdit = (option: PostOption) => {
    if (option.id) {
      setEditingId(option.id);
      setEditValue(option.value);
    }
  };

  const handleConfirmEdit = () => {
    if (editingId && editValue.trim()) {
      onUpdateOption(editingId, editValue.trim());
      setEditingId(null);
      setEditValue('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Gerenciar Opções de Composição</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <ScrollArea className="h-[400px] rounded-md border p-3">
            <div className="space-y-2">
              {options.map((option, index) => (
                <div
                  key={option.id || `option-${index}`}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                >
                  {editingId === option.id ? (
                    // Edit mode
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="flex-1 h-8"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600 hover:text-green-700"
                        onClick={handleConfirmEdit}
                        disabled={!editValue.trim() || isLoading}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <span className="text-sm flex-1">{option.value}</span>
                      <div className="flex items-center gap-1">
                        {option.id && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleStartEdit(option)}
                              disabled={isLoading}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
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
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}

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
