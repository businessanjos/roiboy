import { useState } from 'react';
import { Save, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface SavePresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
  isLoading: boolean;
  composition: string[];
  specialistVersion?: string;
  postType?: string;
  objective?: string;
}

export function SavePresetDialog({
  open,
  onOpenChange,
  onSave,
  isLoading,
  composition,
  specialistVersion,
  postType,
  objective,
}: SavePresetDialogProps) {
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (name.trim()) {
      onSave(name.trim());
      setName('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) {
      handleSubmit();
    }
  };

  const handleClose = () => {
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" />
            Salvar Preset
          </DialogTitle>
          <DialogDescription>
            Salve esta combinação para reutilizar em posts futuros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="preset-name">Nome do Preset *</Label>
            <Input
              id="preset-name"
              placeholder="Ex: Meu padrão de Reels"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">O que será salvo:</Label>
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              {/* Composition Items */}
              {composition.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Composição ({composition.length} itens)
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {composition.slice(0, 5).map((item, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {item}
                      </Badge>
                    ))}
                    {composition.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{composition.length - 5}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {specialistVersion && (
                  <span>Versão: {specialistVersion}</span>
                )}
                {postType && <span>Formato: {postType}</span>}
                {objective && <span>Objetivo: {objective}</span>}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || isLoading}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isLoading ? 'Salvando...' : 'Salvar Preset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
