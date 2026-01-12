import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Link2, Pencil } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { InstagramPost } from '@/hooks/useSocialMediaData';
import { OptionSelectWithAdd } from './OptionSelectWithAdd';
import { useInstagramPostOptions } from '@/hooks/useInstagramPostOptions';

interface EditPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (postId: string, data: EditPostFormData) => void;
  isLoading: boolean;
  post: InstagramPost | null;
}

export interface EditPostFormData {
  permalink: string;
  post_type: 'reels' | 'carousel' | 'static';
  theme?: string;
  ai_objective: 'growth' | 'connection' | 'authority' | 'sales';
  posted_at: Date;
  caption: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
  specialist_version?: string;
  composition?: string[];
}

const isValidInstagramUrl = (url: string): boolean => {
  return /instagram\.com\/(?:p|reel|reels)\/[A-Za-z0-9_-]+/.test(url);
};

export function EditPostDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  post,
}: EditPostDialogProps) {
  const { specialistVersionOptions, compositionOptions, addOption, isLoading: isLoadingOptions } = useInstagramPostOptions();
  
  const [permalink, setPermalink] = useState('');
  const [postType, setPostType] = useState<'reels' | 'carousel' | 'static'>('reels');
  const [theme, setTheme] = useState('');
  const [objective, setObjective] = useState<'growth' | 'connection' | 'authority' | 'sales'>('growth');
  const [postedAt, setPostedAt] = useState<Date | undefined>(new Date());
  const [caption, setCaption] = useState('');
  const [reach, setReach] = useState('');
  const [likes, setLikes] = useState('');
  const [comments, setComments] = useState('');
  const [shares, setShares] = useState('');
  const [saves, setSaves] = useState('');
  const [views, setViews] = useState('');
  const [specialistVersion, setSpecialistVersion] = useState('');
  const [composition, setComposition] = useState<string[]>([]);

  // Populate form when post changes
  useEffect(() => {
    if (post) {
      setPermalink(post.permalink || '');
      setPostType(post.post_type);
      setTheme(post.theme || '');
      setObjective(post.ai_objective || 'growth');
      setPostedAt(new Date(post.posted_at));
      setCaption(post.caption || '');
      setReach(post.reach.toString());
      setLikes(post.likes.toString());
      setComments(post.comments.toString());
      setShares(post.shares.toString());
      setSaves(post.saves.toString());
      setViews((post.views || 0).toString());
      setSpecialistVersion(post.specialist_version || '');
      setComposition(post.composition || []);
    }
  }, [post]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (!post) return;
    if (!isValidInstagramUrl(permalink)) return;
    if (!postedAt) return;

    const reachNum = parseInt(reach) || 0;
    const likesNum = parseInt(likes) || 0;
    const commentsNum = parseInt(comments) || 0;
    const sharesNum = parseInt(shares) || 0;
    const savesNum = parseInt(saves) || 0;
    const viewsNum = parseInt(views) || 0;

    onSubmit(post.id, {
      permalink,
      post_type: postType,
      theme: theme || undefined,
      ai_objective: objective,
      posted_at: postedAt,
      caption,
      reach: reachNum,
      likes: likesNum,
      comments: commentsNum,
      shares: sharesNum,
      saves: savesNum,
      views: viewsNum,
      specialist_version: specialistVersion || undefined,
      composition: composition.length > 0 ? composition : undefined,
    });
  };

  const isValid =
    isValidInstagramUrl(permalink) &&
    postedAt &&
    postedAt <= new Date() &&
    (parseInt(reach) || 0) > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Post
          </DialogTitle>
          <DialogDescription>
            Atualize as métricas e informações do post.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Link do Post */}
          <div className="space-y-2">
            <Label htmlFor="edit-permalink">Link do Post *</Label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="edit-permalink"
                placeholder="https://instagram.com/p/ABC123..."
                value={permalink}
                onChange={(e) => setPermalink(e.target.value)}
                className="pl-10"
              />
            </div>
            {permalink && !isValidInstagramUrl(permalink) && (
              <p className="text-sm text-destructive">
                URL inválida. Use o link de um post ou reel do Instagram.
              </p>
            )}
          </div>

          {/* Formato, Tema e Objetivo */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Formato *</Label>
              <Select value={postType} onValueChange={(v) => setPostType(v as typeof postType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reels">🎬 Reels</SelectItem>
                  <SelectItem value="carousel">📸 Carrossel</SelectItem>
                  <SelectItem value="static">🖼️ Estático</SelectItem>
                </SelectContent>
              </Select>
            </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dump">📷 Dump</SelectItem>
                  <SelectItem value="frase">💭 Frase</SelectItem>
                  <SelectItem value="reels_curto">⚡ Reels Curto</SelectItem>
                  <SelectItem value="carrossel_lifestyle">🌴 Carrossel Lifestyle</SelectItem>
                  <SelectItem value="carrossel_reflexivo">🧘 Carrossel Reflexivo</SelectItem>
                  <SelectItem value="trends">📈 Trends</SelectItem>
                  <SelectItem value="reacts">🎭 Reacts</SelectItem>
                  <SelectItem value="fato_novo">📰 Fato Novo</SelectItem>
                  <SelectItem value="prova_social">⭐ Prova Social</SelectItem>
                  <SelectItem value="assunto_alta">🔥 Assunto em Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Objetivo *</Label>
              <Select value={objective} onValueChange={(v) => setObjective(v as typeof objective)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="growth">📈 Crescimento</SelectItem>
                  <SelectItem value="connection">💬 Conexão</SelectItem>
                  <SelectItem value="authority">🎓 Autoridade</SelectItem>
                  <SelectItem value="sales">💰 Vendas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data de Publicação */}
          <div className="space-y-2">
            <Label>Data de Publicação *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !postedAt && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {postedAt ? format(postedAt, 'PPP', { locale: ptBR }) : 'Selecione uma data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={postedAt}
                  onSelect={setPostedAt}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Métricas */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Métricas</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-reach" className="text-xs text-muted-foreground">
                  Alcance *
                </Label>
                <Input
                  id="edit-reach"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={reach}
                  onChange={(e) => setReach(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-likes" className="text-xs text-muted-foreground">
                  Curtidas
                </Label>
                <Input
                  id="edit-likes"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={likes}
                  onChange={(e) => setLikes(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-comments" className="text-xs text-muted-foreground">
                  Comentários
                </Label>
                <Input
                  id="edit-comments"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-shares" className="text-xs text-muted-foreground">
                  Compartilhamentos
                </Label>
                <Input
                  id="edit-shares"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-saves" className="text-xs text-muted-foreground">
                  Salvamentos
                </Label>
                <Input
                  id="edit-saves"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={saves}
                  onChange={(e) => setSaves(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-views" className="text-xs text-muted-foreground">
                  Views
                </Label>
                <Input
                  id="edit-views"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={views}
                  onChange={(e) => setViews(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Legenda */}
          <div className="space-y-2">
            <Label htmlFor="edit-caption">Legenda (opcional)</Label>
            <Textarea
              id="edit-caption"
              placeholder="Copie a legenda do post aqui..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
            />
          </div>

          {/* Versão do Especialista */}
          <OptionSelectWithAdd
            label="Versão do Especialista"
            placeholder="Selecione uma versão..."
            options={specialistVersionOptions}
            value={specialistVersion}
            onChange={(v) => setSpecialistVersion(v as string)}
            onAddOption={(v) => addOption.mutate({ optionType: 'specialist_version', value: v })}
            isLoading={isLoadingOptions || addOption.isPending}
          />

          {/* Composição */}
          <OptionSelectWithAdd
            label="Composição"
            placeholder="Selecione..."
            options={compositionOptions}
            value={composition}
            onChange={(v) => setComposition(v as string[])}
            onAddOption={(v) => addOption.mutate({ optionType: 'composition', value: v })}
            isMultiple
            isLoading={isLoadingOptions || addOption.isPending}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isLoading}>
            {isLoading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
