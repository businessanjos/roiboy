import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Link2, Eye, Heart, MessageCircle, Share2, Clock, Users, Hash, Flame, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { YouTubeVideo, YouTubeVideoFormData } from '@/hooks/useYouTubeData';

interface EditYouTubeVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (videoId: string, data: Partial<YouTubeVideoFormData>) => void;
  isLoading: boolean;
  video: YouTubeVideo | null;
}

export function EditYouTubeVideoDialog({ open, onOpenChange, onSubmit, isLoading, video }: EditYouTubeVideoDialogProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [postedAt, setPostedAt] = useState<Date | undefined>(new Date());
  const [durationSeconds, setDurationSeconds] = useState('');
  const [videoType, setVideoType] = useState('video');
  const [views, setViews] = useState('');
  const [likes, setLikes] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [comments, setComments] = useState('');
  const [shares, setShares] = useState('');
  const [saves, setSaves] = useState('');
  const [avgWatchTime, setAvgWatchTime] = useState('');
  const [completionRate, setCompletionRate] = useState('');
  const [followersGained, setFollowersGained] = useState('');
  const [isViral, setIsViral] = useState(false);
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [objective, setObjective] = useState<'growth' | 'connection' | 'authority' | 'sales'>('growth');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (video) {
      setVideoUrl(video.video_url || ''); setTitle(video.title || ''); setCaption(video.caption || '');
      setPostedAt(video.posted_at ? new Date(video.posted_at) : new Date());
      setDurationSeconds(video.duration_seconds?.toString() || ''); setVideoType(video.video_type || 'video');
      setViews(video.views?.toString() || ''); setLikes(video.likes?.toString() || '');
      setDislikes(video.dislikes?.toString() || '');
      setComments(video.comments?.toString() || ''); setShares(video.shares?.toString() || '');
      setSaves(video.saves?.toString() || ''); setAvgWatchTime(video.avg_watch_time?.toString() || '');
      setCompletionRate(video.completion_rate?.toString() || '');
      setFollowersGained(video.followers_gained?.toString() || '');
      setIsViral(video.is_viral || false); setHashtagsInput(video.hashtags?.join(', ') || '');
      setObjective(video.ai_objective || 'growth'); setCategory(video.category || '');
      setNotes(video.notes || '');
    }
  }, [video]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!video) return;
    const hashtags = hashtagsInput.split(/[,\s]+/).map(t => t.replace('#', '').trim()).filter(Boolean);
    onSubmit(video.id, {
      video_url: videoUrl || undefined, title: title || undefined, caption: caption || undefined,
      posted_at: postedAt, duration_seconds: durationSeconds ? parseInt(durationSeconds) : undefined,
      video_type: videoType, views: views ? parseInt(views) : undefined,
      likes: likes ? parseInt(likes) : undefined, dislikes: dislikes ? parseInt(dislikes) : undefined,
      comments: comments ? parseInt(comments) : undefined, shares: shares ? parseInt(shares) : undefined,
      saves: saves ? parseInt(saves) : undefined, avg_watch_time: avgWatchTime ? parseFloat(avgWatchTime) : undefined,
      completion_rate: completionRate ? parseFloat(completionRate) : undefined,
      followers_gained: followersGained ? parseInt(followersGained) : undefined,
      is_viral: isViral, hashtags: hashtags.length > 0 ? hashtags : undefined,
      ai_objective: objective, category: category || undefined, notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar Vídeo do YouTube</DialogTitle>
          <DialogDescription>Atualize as métricas e informações do vídeo.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2"><Label className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" />URL</Label><Input placeholder="https://youtube.com/watch?v=..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} /></div>
              <div className="space-y-2"><Label>Título</Label><Input placeholder="Título do vídeo" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea placeholder="Descrição..." value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !postedAt && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{postedAt ? format(postedAt, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={postedAt} onSelect={setPostedAt} initialFocus locale={ptBR} /></PopoverContent></Popover>
                </div>
                <div className="space-y-2"><Label>Tipo</Label><Select value={videoType} onValueChange={setVideoType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="video">📹 Vídeo</SelectItem><SelectItem value="short">⚡ Short</SelectItem><SelectItem value="live">🔴 Live</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Objetivo</Label><Select value={objective} onValueChange={(v) => setObjective(v as typeof objective)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="growth">🚀 Crescimento</SelectItem><SelectItem value="connection">💜 Conexão</SelectItem><SelectItem value="authority">👑 Autoridade</SelectItem><SelectItem value="sales">💰 Vendas</SelectItem></SelectContent></Select></div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Métricas</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" />Views</Label><Input type="number" value={views} onChange={(e) => setViews(e.target.value)} /></div>
                <div className="space-y-2"><Label className="flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" />Curtidas</Label><Input type="number" value={likes} onChange={(e) => setLikes(e.target.value)} /></div>
                <div className="space-y-2"><Label className="flex items-center gap-1.5"><ThumbsDown className="h-3.5 w-3.5" />Dislikes</Label><Input type="number" value={dislikes} onChange={(e) => setDislikes(e.target.value)} /></div>
                <div className="space-y-2"><Label className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />Comentários</Label><Input type="number" value={comments} onChange={(e) => setComments(e.target.value)} /></div>
                <div className="space-y-2"><Label className="flex items-center gap-1.5"><Share2 className="h-3.5 w-3.5" />Compartilhamentos</Label><Input type="number" value={shares} onChange={(e) => setShares(e.target.value)} /></div>
                <div className="space-y-2"><Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Inscritos Ganhos</Label><Input type="number" value={followersGained} onChange={(e) => setFollowersGained(e.target.value)} /></div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Métricas de Vídeo</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Duração (seg)</Label><Input type="number" value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value)} /></div>
                <div className="space-y-2"><Label>Tempo Médio (seg)</Label><Input type="number" step="0.1" value={avgWatchTime} onChange={(e) => setAvgWatchTime(e.target.value)} /></div>
                <div className="space-y-2"><Label>Retenção (%)</Label><Input type="number" step="0.1" max="100" value={completionRate} onChange={(e) => setCompletionRate(e.target.value)} /></div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2"><Label className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" />Tags</Label><Input placeholder="#tutorial #dicas" value={hashtagsInput} onChange={(e) => setHashtagsInput(e.target.value)} /></div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"><div className="flex items-center gap-2"><Flame className="h-4 w-4 text-orange-500" /><Label htmlFor="edit-is-viral-yt" className="cursor-pointer">Marcar como Viral</Label></div><Switch id="edit-is-viral-yt" checked={isViral} onCheckedChange={setIsViral} /></div>
              <div className="space-y-2"><Label>Observações</Label><Textarea placeholder="Anotações..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
            </div>
          </form>
        </ScrollArea>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>{isLoading ? 'Salvando...' : 'Salvar Alterações'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
