import { useState } from 'react';
import { Instagram, ExternalLink, Key, AtSign } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface InstagramConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (data: { username: string; accessToken?: string }) => void;
  isLoading?: boolean;
}

export function InstagramConnectDialog({
  open,
  onOpenChange,
  onConnect,
  isLoading,
}: InstagramConnectDialogProps) {
  const [username, setUsername] = useState('');
  const [accessToken, setAccessToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    onConnect({
      username: username.trim(),
      accessToken: accessToken.trim() || undefined,
    });
  };

  const handleClose = () => {
    setUsername('');
    setAccessToken('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-500" />
            Adicionar Perfil do Instagram
          </DialogTitle>
          <DialogDescription>
            Adicione seu perfil para acompanhar métricas. O token é opcional — sem ele, você preenche os dados manualmente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="flex items-center gap-1.5">
              <AtSign className="h-3.5 w-3.5" />
              Nome de usuário
            </Label>
            <Input
              id="username"
              placeholder="@seuperfil"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="token" className="flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" />
              Access Token <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="token"
              type="password"
              placeholder="Deixe vazio para modo manual"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="bg-background"
            />
          </div>

          <Alert className="bg-muted/50">
            <AlertDescription className="text-xs space-y-2">
              <p>
                <strong>Modo Manual:</strong> Sem token, você preenche as métricas dos posts manualmente.
              </p>
              <p>
                <strong>Modo API:</strong> Com token, futuramente poderemos sincronizar dados automaticamente.{' '}
                <a
                  href="https://developers.facebook.com/docs/instagram-basic-display-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Como obter
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </AlertDescription>
          </Alert>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!username.trim() || isLoading}
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading ? 'Adicionando...' : 'Adicionar Perfil'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
