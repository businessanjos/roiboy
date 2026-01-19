import { useState, useEffect } from 'react';
import { Music2, ExternalLink, Users, UserPlus, Video } from 'lucide-react';
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

interface TikTokConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (data: { 
    username: string; 
    followers_count?: number;
    following_count?: number;
    videos_count?: number;
    bio?: string;
  }) => void;
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
  const [followersCount, setFollowersCount] = useState('');
  const [followingCount, setFollowingCount] = useState('');
  const [videosCount, setVideosCount] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    const username = extractUsernameFromUrl(profileInput);
    setExtractedUsername(username);
  }, [profileInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const username = extractedUsername || profileInput.replace('@', '');
    if (!username) return;

    onConnect({
      username,
      followers_count: followersCount ? parseInt(followersCount) : undefined,
      following_count: followingCount ? parseInt(followingCount) : undefined,
      videos_count: videosCount ? parseInt(videosCount) : undefined,
      bio: bio || undefined,
    });
  };

  const handleClose = () => {
    setProfileInput('');
    setExtractedUsername(null);
    setFollowersCount('');
    setFollowingCount('');
    setVideosCount('');
    setBio('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
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
                Perfil detectado: <span className="font-medium">@{extractedUsername}</span>
              </p>
            )}
          </div>

          <Alert className="bg-muted/50">
            <AlertDescription className="text-sm">
              💡 Para melhor análise, preencha as métricas abaixo manualmente (opcional).
            </AlertDescription>
          </Alert>

          <Separator />

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="followers" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Seguidores
              </Label>
              <Input
                id="followers"
                type="number"
                placeholder="0"
                value={followersCount}
                onChange={(e) => setFollowersCount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="following" className="flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                Seguindo
              </Label>
              <Input
                id="following"
                type="number"
                placeholder="0"
                value={followingCount}
                onChange={(e) => setFollowingCount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="videos" className="flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5" />
                Vídeos
              </Label>
              <Input
                id="videos"
                type="number"
                placeholder="0"
                value={videosCount}
                onChange={(e) => setVideosCount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio (opcional)</Label>
            <Input
              id="bio"
              placeholder="Descrição do perfil"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!extractedUsername && !profileInput || isLoading}
            >
              {isLoading ? 'Conectando...' : 'Conectar Perfil'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
