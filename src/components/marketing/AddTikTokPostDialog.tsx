import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Link2, Eye, Heart, MessageCircle, Share2, Bookmark, Clock, Users, Music, Hash, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TikTokPostFormData } from '@/hooks/useTikTokData';

interface AddTikTokPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TikTokPostFormData) => void;
  isLoading: boolean;
}

export function AddTikTokPostDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: AddTikTokPostDialogProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [postedAt, setPostedAt] = useState<Date | undefined>(new Date());
  const [durationSeconds, setDurationSeconds] = useState('');
  const [views, setViews] = useState('');
  const [likes, setLikes] = useState('');
  const [comments, setComments] = useState('');
  const [shares, setShares] = useState('');
  const [saves, setSaves] = useState('');
  const [avgWatchTime, setAvgWatchTime] = useState('');
  const [completionRate, setCompletionRate] = useState('');
  const [followersGained, setFollowersGained] = useState('');
  const [isViral, setIsViral] = useState(false);
  const [soundName, setSoundName] = useState('');
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [objective, setObjective] = useState<'growth' | 'connection' | 'authority' | 'sales'>('growth');
  const [category, setCategory] = useState('');

  const resetForm = () => {
    setVideoUrl('');
    setCaption('');
    setPostedAt(new Date());
    setDurationSeconds('');
    setViews('');
    setLikes('');
    setComments('');
    setShares('');
    setSaves('');
    setAvgWatchTime('');
    setCompletionRate('');
    setFollowersGained('');
    setIsViral(false);
    setSoundName('');
    setHashtagsInput('');
    setObjective('growth');
    setCategory('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const hashtags = hashtagsInput
      .split(/[,\s]+/)
      .map(tag => tag.replace('#', '').trim())
      .filter(Boolean);

    onSubmit({
      video_url: videoUrl || undefined,
      caption: caption || undefined,
      posted_at: postedAt,
      duration_seconds: durationSeconds ? parseInt(durationSeconds) : undefined,
      views: views ? parseInt(views) : undefined,
      likes: likes ? parseInt(likes) : undefined,
      comments: comments ? parseInt(comments) : undefined,
      shares: shares ? parseInt(shares) : undefined,
      saves: saves ? parseInt(saves) : undefined,
      avg_watch_time: avgWatchTime ? parseFloat(avgWatchTime) : undefined,
      completion_rate: completionRate ? parseFloat(completionRate) : undefined,
      followers_gained: followersGained ? parseInt(followersGained) : undefined,
      is_viral: isViral,
      sound_name: soundName || undefined,
      hashtags: hashtags.length > 0 ? hashtags : undefined,
      ai_objective: objective,
      category: category || undefined,
    });

    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Adicionar Vídeo do TikTok</DialogTitle>
          <DialogDescription>
            Preencha as informações do vídeo para análise de métricas.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="video-url" className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  URL do Vídeo
                </Label>
                <Input
                  id="video-url"
                  placeholder="https://tiktok.com/@usuario/video/..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="caption">Legenda</Label>
                <Textarea
                  id="caption"
                  placeholder="Legenda do vídeo..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Publicação</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !postedAt && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {postedAt ? format(postedAt, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={postedAt}
                        onSelect={setPostedAt}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="objective">Objetivo</Label>
                  <Select value={objective} onValueChange={(v) => setObjective(v as typeof objective)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="growth">🚀 Crescimento</SelectItem>
                      <SelectItem value="connection">💜 Conexão</SelectItem>
                      <SelectItem value="authority">👑 Autoridade</SelectItem>
                      <SelectItem value="sales">💰 Vendas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Métricas de Desempenho</h4>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="views" className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Views
                  </Label>
                  <Input
                    id="views"
                    type="number"
                    placeholder="0"
                    value={views}
                    onChange={(e) => setViews(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="likes" className="flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5" />
                    Curtidas
                  </Label>
                  <Input
                    id="likes"
                    type="number"
                    placeholder="0"
                    value={likes}
                    onChange={(e) => setLikes(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comments" className="flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Comentários
                  </Label>
                  <Input
                    id="comments"
                    type="number"
                    placeholder="0"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shares" className="flex items-center gap-1.5">
                    <Share2 className="h-3.5 w-3.5" />
                    Compartilhamentos
                  </Label>
                  <Input
                    id="shares"
                    type="number"
                    placeholder="0"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="saves" className="flex items-center gap-1.5">
                    <Bookmark className="h-3.5 w-3.5" />
                    Salvos
                  </Label>
                  <Input
                    id="saves"
                    type="number"
                    placeholder="0"
                    value={saves}
                    onChange={(e) => setSaves(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="followers-gained" className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Seguidores Ganhos
                  </Label>
                  <Input
                    id="followers-gained"
                    type="number"
                    placeholder="0"
                    value={followersGained}
                    onChange={(e) => setFollowersGained(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Video Metrics */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Métricas de Vídeo</h4>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration" className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Duração (seg)
                  </Label>
                  <Input
                    id="duration"
                    type="number"
                    placeholder="0"
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avg-watch-time">Tempo Médio (seg)</Label>
                  <Input
                    id="avg-watch-time"
                    type="number"
                    step="0.1"
                    placeholder="0"
                    value={avgWatchTime}
                    onChange={(e) => setAvgWatchTime(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="completion-rate">Taxa Conclusão (%)</Label>
                  <Input
                    id="completion-rate"
                    type="number"
                    step="0.1"
                    placeholder="0"
                    max="100"
                    value={completionRate}
                    onChange={(e) => setCompletionRate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Informações Adicionais</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sound-name" className="flex items-center gap-1.5">
                    <Music className="h-3.5 w-3.5" />
                    Nome do Som
                  </Label>
                  <Input
                    id="sound-name"
                    placeholder="Som original ou nome do áudio"
                    value={soundName}
                    onChange={(e) => setSoundName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trends">📈 Trends</SelectItem>
                      <SelectItem value="tutorial">📚 Tutorial</SelectItem>
                      <SelectItem value="comedy">😂 Comédia</SelectItem>
                      <SelectItem value="lifestyle">🌴 Lifestyle</SelectItem>
                      <SelectItem value="business">💼 Negócios</SelectItem>
                      <SelectItem value="story">📖 Storytelling</SelectItem>
                      <SelectItem value="review">⭐ Review</SelectItem>
                      <SelectItem value="duet">🎭 Dueto/React</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hashtags" className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  Hashtags
                </Label>
                <Input
                  id="hashtags"
                  placeholder="#viral #fyp #trending (separadas por espaço ou vírgula)"
                  value={hashtagsInput}
                  onChange={(e) => setHashtagsInput(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <Label htmlFor="is-viral" className="cursor-pointer">Marcar como Viral</Label>
                </div>
                <Switch
                  id="is-viral"
                  checked={isViral}
                  onCheckedChange={setIsViral}
                />
              </div>
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Salvando...' : 'Adicionar Vídeo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
