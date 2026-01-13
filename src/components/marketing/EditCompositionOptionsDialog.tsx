import { useState } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  onAddOption: (value: string) => void;
  onDeleteOption: (id: string) => void;
  isLoading?: boolean;
}

export function EditCompositionOptionsDialog({
  open,
  onOpenChange,
  options,
  onAddOption,
  onDeleteOption,
  isLoading = false,
}: EditCompositionOptionsDialogProps) {
  const [newOption, setNewOption] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (newOption.trim()) {
      onAddOption(newOption.trim());
      setNewOption('');
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      setNewOption('');
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setNewOption('');
    setIsAdding(false);
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
          <DialogDescription>
            Visualize, adicione ou remova opções de composição personalizadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Add new option */}
          {isAdding ? (
            <div className="flex gap-2">
              <Input
                placeholder="Nova opção de composição..."
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleAdd}
                disabled={!newOption.trim() || isLoading}
              >
                <Check className="h-4 w-4 text-green-500" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setNewOption('');
                  setIsAdding(false);
                }}
              >
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Nova Opção
            </Button>
          )}

          {/* Options list */}
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
