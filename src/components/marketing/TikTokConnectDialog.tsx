import { useState, useEffect } from 'react';
import { Music2, ExternalLink, Loader2 } from 'lucide-react';
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

interface TikTokConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (data: { username: string }) => void;
  isLoading: boolean;
}

function extractUsernameFromUrl(url: string): string | null {
  if (!url) return null;
  
  // Already just a username
  if (!url.includes('/') && !url.includes('.')) {
    return url.replace('@', '');
  }
  
  // TikTok URL patterns
  const patterns = [
    /tiktok\.com\/@([^/?]+)/i,
    /tiktok\.com\/([^/?@]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

export function TikTokConnectDialog({
  open,
  onOpenChange,
  onConnect,
  isLoading,
}: TikTokConnectDialogProps) {
  const [profileInput, setProfileInput] = useState('');
  const [extractedUsername, setExtractedUsername] = useState<string | null>(null);

  useEffect(() => {
    const username = extractUsernameFromUrl(profileInput);
    setExtractedUsername(username);
  }, [profileInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const username = extractedUsername || profileInput.replace('@', '');
    if (!username) return;

    // Only send username - all data will be fetched automatically
    onConnect({ username });
  };

  const handleClose = () => {
    setProfileInput('');
    setExtractedUsername(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music2 className="h-5 w-5" />
            Conectar Perfil do TikTok
          </DialogTitle>
          <DialogDescription>
            Adicione o link ou username do perfil do TikTok que deseja gerenciar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-link">Link ou Username do Perfil</Label>
            <div className="flex gap-2">
              <Input
                id="profile-link"
                placeholder="https://tiktok.com/@username ou @username"
                value={profileInput}
                onChange={(e) => setProfileInput(e.target.value)}
                className="flex-1"
                autoFocus
              />
              {extractedUsername && (
                <a
                  href={`https://tiktok.com/@${extractedUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center px-3 border rounded-md hover:bg-muted transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            {extractedUsername && (
              <p className="text-sm text-muted-foreground">
                Perfil detectado: <span className="font-medium text-foreground">@{extractedUsername}</span>
              </p>
            )}
          </div>

          <Alert className="bg-primary/5 border-primary/20">
            <AlertDescription className="text-sm">
              ✨ Os dados do perfil (seguidores, curtidas, vídeos) serão buscados <strong>automaticamente</strong> do TikTok.
            </AlertDescription>
          </Alert>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!extractedUsername && !profileInput || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                'Conectar Perfil'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}