import { useState, useEffect } from 'react';
import { Youtube, ExternalLink, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface YouTubeConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (data: { username: string }) => void;
  isLoading: boolean;
}

function extractChannelFromUrl(url: string): string | null {
  if (!url) return null;
  if (!url.includes('/') && !url.includes('.')) return url.replace('@', '');
  const patterns = [
    /youtube\.com\/@([^/?]+)/i,
    /youtube\.com\/channel\/([^/?]+)/i,
    /youtube\.com\/c\/([^/?]+)/i,
    /youtube\.com\/user\/([^/?]+)/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function YouTubeConnectDialog({ open, onOpenChange, onConnect, isLoading }: YouTubeConnectDialogProps) {
  const [profileInput, setProfileInput] = useState('');
  const [extractedChannel, setExtractedChannel] = useState<string | null>(null);

  useEffect(() => { setExtractedChannel(extractChannelFromUrl(profileInput)); }, [profileInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const username = extractedChannel || profileInput.replace('@', '');
    if (!username) return;
    onConnect({ username });
  };

  const handleClose = () => { setProfileInput(''); setExtractedChannel(null); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-600" />
            Conectar Canal do YouTube
          </DialogTitle>
          <DialogDescription>
            Adicione o link ou nome do canal do YouTube que deseja gerenciar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-link">Link ou Nome do Canal</Label>
            <div className="flex gap-2">
              <Input id="channel-link" placeholder="https://youtube.com/@canal ou @canal" value={profileInput} onChange={(e) => setProfileInput(e.target.value)} className="flex-1" autoFocus />
              {extractedChannel && (
                <a href={`https://youtube.com/@${extractedChannel}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center px-3 border rounded-md hover:bg-muted transition-colors">
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            {extractedChannel && <p className="text-sm text-muted-foreground">Canal detectado: <span className="font-medium text-foreground">@{extractedChannel}</span></p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={!extractedChannel && !profileInput || isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Conectando...</> : 'Conectar Canal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
