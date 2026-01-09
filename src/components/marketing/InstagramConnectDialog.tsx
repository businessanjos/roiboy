import { useState, useEffect } from 'react';
import { Instagram, ExternalLink, Key, Link2, Users, UserPlus, Grid3X3 } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';

interface InstagramConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (data: { 
    username: string; 
    accessToken?: string;
    followers_count?: number;
    following_count?: number;
    posts_count?: number;
    bio?: string;
  }) => void;
  isLoading?: boolean;
}

// Extract username from Instagram URL
function extractUsernameFromUrl(url: string): string | null {
  const trimmed = url.trim();
  
  // If it's already a username (starts with @ or no slashes)
  if (trimmed.startsWith('@')) {
    return trimmed.slice(1);
  }
  if (!trimmed.includes('/') && !trimmed.includes('.')) {
    return trimmed;
  }
  
  // Extract from URL patterns
  const patterns = [
    /instagram\.com\/([^/?#]+)/i,
    /instagr\.am\/([^/?#]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1] && !['p', 'reel', 'stories', 'explore'].includes(match[1].toLowerCase())) {
      return match[1];
    }
  }
  
  return null;
}

export function InstagramConnectDialog({
  open,
  onOpenChange,
  onConnect,
  isLoading,
}: InstagramConnectDialogProps) {
  const [profileInput, setProfileInput] = useState('');
  const [extractedUsername, setExtractedUsername] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState('');
  
  // Manual metrics
  const [followersCount, setFollowersCount] = useState('');
  const [followingCount, setFollowingCount] = useState('');
  const [postsCount, setPostsCount] = useState('');
  const [bio, setBio] = useState('');

  // Auto-extract username when input changes
  useEffect(() => {
    if (profileInput.trim()) {
      const username = extractUsernameFromUrl(profileInput);
      setExtractedUsername(username);
    } else {
      setExtractedUsername(null);
    }
  }, [profileInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extractedUsername) return;
    
    onConnect({
      username: extractedUsername,
      accessToken: accessToken.trim() || undefined,
      followers_count: followersCount ? parseInt(followersCount, 10) : undefined,
      following_count: followingCount ? parseInt(followingCount, 10) : undefined,
      posts_count: postsCount ? parseInt(postsCount, 10) : undefined,
      bio: bio.trim() || undefined,
    });
  };

  const handleClose = () => {
    setProfileInput('');
    setExtractedUsername(null);
    setAccessToken('');
    setFollowersCount('');
    setFollowingCount('');
    setPostsCount('');
    setBio('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-500" />
            Adicionar Perfil do Instagram
          </DialogTitle>
          <DialogDescription>
            Cole o link do perfil ou digite o nome de usuário para acompanhar as métricas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profileInput" className="flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              Link ou @ do Perfil
            </Label>
            <Input
              id="profileInput"
              placeholder="https://instagram.com/seuperfil ou @seuperfil"
              value={profileInput}
              onChange={(e) => setProfileInput(e.target.value)}
              className="bg-background"
            />
            {profileInput && (
              <div className="text-xs">
                {extractedUsername ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <Instagram className="h-3 w-3" />
                    Perfil detectado: <strong>@{extractedUsername}</strong>
                  </span>
                ) : (
                  <span className="text-amber-600">
                    Digite um link ou nome de usuário válido
                  </span>
                )}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-sm font-medium">Métricas do Perfil</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Preencha com os dados atuais do perfil (veja no Instagram)
            </p>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="followers" className="text-xs flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Seguidores
                </Label>
                <Input
                  id="followers"
                  type="number"
                  placeholder="0"
                  value={followersCount}
                  onChange={(e) => setFollowersCount(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="following" className="text-xs flex items-center gap-1">
                  <UserPlus className="h-3 w-3" />
                  Seguindo
                </Label>
                <Input
                  id="following"
                  type="number"
                  placeholder="0"
                  value={followingCount}
                  onChange={(e) => setFollowingCount(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="posts" className="text-xs flex items-center gap-1">
                  <Grid3X3 className="h-3 w-3" />
                  Posts
                </Label>
                <Input
                  id="posts"
                  type="number"
                  placeholder="0"
                  value={postsCount}
                  onChange={(e) => setPostsCount(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio" className="text-xs">Bio (opcional)</Label>
              <Input
                id="bio"
                placeholder="Bio do perfil..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="token" className="flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" />
              Access Token <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="token"
              type="password"
              placeholder="Para sincronização automática futura"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="bg-background"
            />
          </div>

          <Alert className="bg-muted/50">
            <AlertDescription className="text-xs">
              As métricas do perfil são opcionais. Você pode atualizá-las depois clicando no perfil.
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
              disabled={!extractedUsername || isLoading}
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
