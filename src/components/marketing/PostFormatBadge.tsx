import { Video, Images, Image } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type PostFormat = 'reels' | 'carousel' | 'static';

interface PostFormatBadgeProps {
  format: string | null | undefined;
  className?: string;
}

const formatAliases: Record<string, PostFormat> = {
  reels: 'reels',
  reel: 'reels',
  video: 'reels',
  carousel: 'carousel',
  carousel_album: 'carousel',
  album: 'carousel',
  static: 'static',
  image: 'static',
  photo: 'static',
};

const formatConfig: Record<PostFormat, {
  label: string;
  icon: typeof Video;
  className: string;
}> = {
  reels: {
    label: 'Reels',
    icon: Video,
    className: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-900',
  },
  carousel: {
    label: 'Carrossel',
    icon: Images,
    className: 'bg-info-soft text-info-strong border-info dark:bg-info/30 dark:text-info dark:border-info',
  },
  static: {
    label: 'Estático',
    icon: Image,
    className: 'bg-muted text-foreground border-border dark:bg-gray-800/50 dark:text-muted-foreground dark:border-border',
  },
};

export function PostFormatBadge({ format, className }: PostFormatBadgeProps) {
  const normalized = format ? formatAliases[format.toLowerCase()] ?? 'static' : 'static';
  const config = formatConfig[normalized];
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'gap-1 font-medium',
        config.className,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
