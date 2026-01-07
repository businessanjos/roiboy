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
  onConnect: (data: { username: string; accessToken: string }) => void;
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
    if (!username.trim() || !accessToken.trim()) return;
    
    onConnect({
      username: username.trim(),
      accessToken: accessToken.trim(),
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
            Conectar Perfil do Instagram
          </DialogTitle>
          <DialogDescription>
            Conecte sua conta do Instagram para acompanhar métricas e insights em tempo real.
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
              Access Token
            </Label>
            <Input
              id="token"
              type="password"
              placeholder="Seu token de acesso da API"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="bg-background"
            />
          </div>

          <Alert className="bg-muted/50">
            <AlertDescription className="text-xs">
              <p className="mb-2">
                Para obter o Access Token, você precisa de uma conta de desenvolvedor Meta.
              </p>
              <a
                href="https://developers.facebook.com/docs/instagram-basic-display-api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Saiba como obter
                <ExternalLink className="h-3 w-3" />
              </a>
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
              disabled={!username.trim() || !accessToken.trim() || isLoading}
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading ? 'Conectando...' : 'Conectar Perfil'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
