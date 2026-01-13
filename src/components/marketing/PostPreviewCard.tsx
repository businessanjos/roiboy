import { Film, Image, Images, Target, Tag, User, AtSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface PostPreviewCardProps {
  postType?: 'reels' | 'carousel' | 'static';
  theme?: string;
  objective?: 'growth' | 'connection' | 'authority' | 'sales';
  composition: string[];
  specialistVersion?: string;
  collaborator?: string;
  className?: string;
}

const formatLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  reels: { label: 'Reels', icon: <Film className="h-4 w-4" />, color: 'bg-pink-500/10 text-pink-600' },
  carousel: { label: 'Carrossel', icon: <Images className="h-4 w-4" />, color: 'bg-blue-500/10 text-blue-600' },
  static: { label: 'Estático', icon: <Image className="h-4 w-4" />, color: 'bg-purple-500/10 text-purple-600' },
};

const objectiveLabels: Record<string, { label: string; color: string }> = {
  growth: { label: 'Crescimento', color: 'bg-green-500/10 text-green-600' },
  connection: { label: 'Conexão', color: 'bg-blue-500/10 text-blue-600' },
  authority: { label: 'Autoridade', color: 'bg-amber-500/10 text-amber-600' },
  sales: { label: 'Vendas', color: 'bg-emerald-500/10 text-emerald-600' },
};

const themeLabels: Record<string, string> = {
  dump: '📷 Dump',
  frase: '💭 Frase',
  reels_curto: '⚡ Reels Curto',
  carrossel_lifestyle: '🌴 Carrossel Lifestyle',
  carrossel_reflexivo: '🧘 Carrossel Reflexivo',
  trends: '📈 Trends',
  reacts: '🎭 Reacts',
  fato_novo: '📰 Fato Novo',
  prova_social: '⭐ Prova Social',
  assunto_alta: '🔥 Assunto em Alta',
  vlog: '🎥 Vlog',
  corte_podcast_convidado: '🎙️ Corte Podcast Convidado',
  corte_vida_ryka_podcast: '🎧 Corte Vida Ryka Podcast',
};

export function PostPreviewCard({
  postType,
  theme,
  objective,
  composition,
  specialistVersion,
  collaborator,
  className,
}: PostPreviewCardProps) {
  const format = postType ? formatLabels[postType] : null;
  const obj = objective ? objectiveLabels[objective] : null;

  const isEmpty = !postType && !objective && composition.length === 0;

  if (isEmpty) {
    return (
      <div
        className={cn(
          'rounded-lg border-2 border-dashed border-muted-foreground/20 p-6 flex flex-col items-center justify-center text-center min-h-[200px]',
          className
        )}
      >
        <Target className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">
          Configure o post para ver o preview
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 space-y-4',
        className
      )}
    >
      {/* Header with format badge */}
      <div className="flex items-center gap-2 flex-wrap">
        {format && (
          <Badge variant="secondary" className={cn('gap-1', format.color)}>
            {format.icon}
            {format.label}
          </Badge>
        )}
        {obj && (
          <Badge variant="secondary" className={cn('gap-1', obj.color)}>
            <Target className="h-3 w-3" />
            {obj.label}
          </Badge>
        )}
        {theme && themeLabels[theme] && (
          <Badge variant="outline" className="gap-1">
            <Tag className="h-3 w-3" />
            {themeLabels[theme]}
          </Badge>
        )}
      </div>

      {/* Specialist Version */}
      {specialistVersion && (
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Versão:</span>
          <span className="font-medium">{specialistVersion}</span>
        </div>
      )}

      {/* Collaborator */}
      {collaborator && (
        <div className="flex items-center gap-2 text-sm">
          <AtSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Collab:</span>
          <span className="font-medium">@{collaborator}</span>
        </div>
      )}

      {/* Composition Items */}
      {composition.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Composição ({composition.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {composition.map((item, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="text-xs font-normal"
              >
                {item}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
