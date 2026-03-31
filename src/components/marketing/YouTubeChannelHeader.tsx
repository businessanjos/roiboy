import { Youtube, Users, Video, Eye, ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import type { YouTubeChannel } from '@/hooks/useYouTubeData';

interface YouTubeChannelHeaderProps {
  channel: YouTubeChannel | undefined;
  isLoading: boolean;
}

export function YouTubeChannelHeader({ channel, isLoading }: YouTubeChannelHeaderProps) {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace('.0', '') + 'K';
    return num.toLocaleString('pt-BR');
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="flex-1 space-y-4 text-center sm:text-left">
            <Skeleton className="h-6 w-40 mx-auto sm:mx-0" />
            <div className="flex justify-center sm:justify-start gap-8">
              <Skeleton className="h-10 w-16" /><Skeleton className="h-10 w-20" /><Skeleton className="h-10 w-20" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <div className="flex items-center gap-4 text-muted-foreground">
          <Youtube className="h-12 w-12 text-red-600" />
          <div>
            <p className="font-medium">Nenhum canal selecionado</p>
            <p className="text-sm">Conecte um canal do YouTube para começar</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-6">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-gradient-to-br from-red-500 to-red-700 p-[3px]">
          <Avatar className="h-full w-full border-2 border-card">
            <AvatarImage src={channel.profile_picture_url || undefined} alt={channel.username} className="object-cover" />
            <AvatarFallback className="text-2xl font-semibold bg-muted">{channel.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 text-center sm:text-left space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Youtube className="h-5 w-5 text-red-600" />
              <h2 className="text-xl font-bold">@{channel.username}</h2>
            </div>
            {channel.display_name && <span className="text-muted-foreground">({channel.display_name})</span>}
            <a href={`https://youtube.com/@${channel.username}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
              <ExternalLink className="h-4 w-4" />Ver canal
            </a>
          </div>
          {channel.bio && <p className="text-sm text-muted-foreground max-w-md">{channel.bio}</p>}
          <div className="flex justify-center sm:justify-start gap-8">
            <div className="text-center">
              <div className="flex items-center gap-1.5 text-2xl font-bold"><Users className="h-5 w-5 text-muted-foreground" />{formatNumber(channel.subscribers_count)}</div>
              <p className="text-xs text-muted-foreground">Inscritos</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1.5 text-2xl font-bold"><Video className="h-5 w-5 text-muted-foreground" />{formatNumber(channel.videos_count)}</div>
              <p className="text-xs text-muted-foreground">Vídeos</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1.5 text-2xl font-bold"><Eye className="h-5 w-5 text-muted-foreground" />{formatNumber(channel.total_views)}</div>
              <p className="text-xs text-muted-foreground">Views Totais</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
