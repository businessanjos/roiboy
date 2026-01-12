import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Link2, Plus, AtSign, Bookmark } from 'lucide-react';
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
import { OptionSelectWithAdd } from './OptionSelectWithAdd';
import { useInstagramPostOptions } from '@/hooks/useInstagramPostOptions';
import { useCompositionTemplates } from '@/hooks/useCompositionTemplates';
import { PostQualityScore } from './PostQualityScore';
import { PostPreviewCard } from './PostPreviewCard';
import { CompositionTemplateSelector } from './CompositionTemplateSelector';
import { SavePresetDialog } from './SavePresetDialog';

interface AddPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PostFormData) => void;
  isLoading: boolean;
}

export interface PostFormData {
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
  link_clicks: number;
  views: number;
  followers_gained: number;
  collaborator: string;
  specialist_version?: string;
  composition?: string[];
}

const extractInstagramId = (url: string): string | null => {
  // Matches patterns like /p/ABC123/ or /reel/ABC123/
  const match = url.match(/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
};

const isValidInstagramUrl = (url: string): boolean => {
  return /instagram\.com\/(?:p|reel|reels)\/[A-Za-z0-9_-]+/.test(url);
};

export function AddPostDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: AddPostDialogProps) {
  const { specialistVersionOptions, compositionOptions, addOption, isLoading: isLoadingOptions } = useInstagramPostOptions();
  const { templates, presets, createPreset, deletePreset, isLoading: isLoadingTemplates } = useCompositionTemplates();
  
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
  const [linkClicks, setLinkClicks] = useState('');
  const [views, setViews] = useState('');
  const [followersGained, setFollowersGained] = useState('');
  const [collaborator, setCollaborator] = useState('');
  const [specialistVersion, setSpecialistVersion] = useState('');
  const [composition, setComposition] = useState<string[]>([]);
  const [savePresetOpen, setSavePresetOpen] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      handleReset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleReset = () => {
    setPermalink('');
    setPostType('reels');
    setTheme('');
    setObjective('growth');
    setPostedAt(new Date());
    setCaption('');
    setReach('');
    setLikes('');
    setComments('');
    setShares('');
    setSaves('');
    setLinkClicks('');
    setViews('');
    setFollowersGained('');
    setCollaborator('');
    setSpecialistVersion('');
    setComposition([]);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (!isValidInstagramUrl(permalink)) {
      return;
    }

    if (!postedAt) {
      return;
    }

    const reachNum = parseInt(reach) || 0;
    const likesNum = parseInt(likes) || 0;
    const commentsNum = parseInt(comments) || 0;
    const sharesNum = parseInt(shares) || 0;
    const savesNum = parseInt(saves) || 0;
    const linkClicksNum = parseInt(linkClicks) || 0;
    const viewsNum = parseInt(views) || 0;
    const followersGainedNum = parseInt(followersGained) || 0;

    onSubmit({
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
      link_clicks: linkClicksNum,
      views: viewsNum,
      followers_gained: followersGainedNum,
      collaborator: collaborator.trim(),
      specialist_version: specialistVersion || undefined,
      composition: composition.length > 0 ? composition : undefined,
    });
  };

  const handleApplyTemplate = (items: string[], sv?: string) => {
    setComposition(items);
    if (sv) setSpecialistVersion(sv);
  };

  const handleSavePreset = (name: string) => {
    createPreset.mutate({
      name,
      composition_items: composition,
      specialist_version: specialistVersion || undefined,
      post_type: postType,
      objective: objective,
    });
    setSavePresetOpen(false);
  };

  const isValid =
    isValidInstagramUrl(permalink) &&
    postedAt &&
    postedAt <= new Date() &&
    (parseInt(reach) || 0) > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Adicionar Post
            </DialogTitle>
            <DialogDescription>
              Adicione um post manualmente com as métricas do Instagram Insights.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto max-h-[calc(90vh-180px)] py-4 pr-2">
            {/* Left Column - Form */}
            <div className="space-y-4">
              {/* Link do Post */}
              <div className="space-y-2">
                <Label htmlFor="permalink">Link do Post *</Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="permalink"
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

              {/* Colaborador */}
              <div className="space-y-2">
                <Label htmlFor="collaborator">Colaborador (opcional)</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="collaborator"
                    placeholder="username_colaborador"
                    value={collaborator}
                    onChange={(e) => setCollaborator(e.target.value.replace('@', ''))}
                    className="pl-10"
                  />
                </div>
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

              {/* Templates */}
              <div className="space-y-2">
                <Label>Templates Rápidos</Label>
                <CompositionTemplateSelector
                  templates={templates}
                  presets={presets}
                  postType={postType}
                  objective={objective}
                  onApply={handleApplyTemplate}
                  onDeletePreset={(id) => deletePreset.mutate(id)}
                  isLoading={isLoadingTemplates}
                />
              </div>

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
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="reach" className="text-xs text-muted-foreground">
                      Alcance *
                    </Label>
                    <Input
                      id="reach"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={reach}
                      onChange={(e) => setReach(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="likes" className="text-xs text-muted-foreground">
                      Curtidas
                    </Label>
                    <Input
                      id="likes"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={likes}
                      onChange={(e) => setLikes(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="comments" className="text-xs text-muted-foreground">
                      Comentários
                    </Label>
                    <Input
                      id="comments"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="shares" className="text-xs text-muted-foreground">
                      Compartilhamentos
                    </Label>
                    <Input
                      id="shares"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={shares}
                      onChange={(e) => setShares(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="saves" className="text-xs text-muted-foreground">
                      Salvamentos
                    </Label>
                    <Input
                      id="saves"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={saves}
                      onChange={(e) => setSaves(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="linkClicks" className="text-xs text-muted-foreground">
                      Cliques no Link
                    </Label>
                    <Input
                      id="linkClicks"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={linkClicks}
                      onChange={(e) => setLinkClicks(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="views" className="text-xs text-muted-foreground">
                      Views
                    </Label>
                    <Input
                      id="views"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={views}
                      onChange={(e) => setViews(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="followersGained" className="text-xs text-muted-foreground">
                      Seg. Ganhos
                    </Label>
                    <Input
                      id="followersGained"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={followersGained}
                      onChange={(e) => setFollowersGained(e.target.value)}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>

              {/* Legenda */}
              <div className="space-y-2">
                <Label htmlFor="caption">Legenda (opcional)</Label>
                <Textarea
                  id="caption"
                  placeholder="Copie a legenda do post aqui..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {/* Right Column - Preview & Score */}
            <div className="space-y-4">
              {/* Quality Score */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <PostQualityScore
                  composition={composition}
                  objective={objective}
                  postType={postType}
                  specialistVersion={specialistVersion}
                  caption={caption}
                />
              </div>

              {/* Preview Card */}
              <PostPreviewCard
                postType={postType}
                theme={theme}
                objective={objective}
                composition={composition}
                specialistVersion={specialistVersion}
                collaborator={collaborator}
              />

              {/* Save as Preset Button */}
              {composition.length > 0 && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setSavePresetOpen(true)}
                >
                  <Bookmark className="h-4 w-4" />
                  Salvar como Preset
                </Button>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!isValid || isLoading}>
              {isLoading ? 'Adicionando...' : 'Adicionar Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SavePresetDialog
        open={savePresetOpen}
        onOpenChange={setSavePresetOpen}
        onSave={handleSavePreset}
        isLoading={createPreset.isPending}
        composition={composition}
        specialistVersion={specialistVersion}
        postType={postType}
        objective={objective}
      />
    </>
  );
}
