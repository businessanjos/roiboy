import { useState } from 'react';
import { Youtube, Users, Video, Eye, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import type { YouTubeChannel } from '@/hooks/useYouTubeData';

function ChannelBio({ bio }: { bio: string }) {
  const [open, setOpen] = useState(false);
  const blocks = bio.split(/\s*(?:--\s*){2,}\s*/).map(s => s.trim()).filter(Boolean);
  const urlRe = /(https?:\/\/\S+|@[\w.]+)/g;
  const render = (text: string) => text.split(urlRe).map((part, i) => {
    if (/^https?:\/\//.test(part)) return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-primary hover:underline">{part.replace(/^https?:\/\//, '')}</a>;
    if (/^@[\w.]+$/.test(part)) return <span key={i} className="mx-0.5 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{part}</span>;
    return <span key={i}>{part}</span>;
  });
  return (
    <div className="max-w-2xl rounded-lg border bg-muted/30 p-3 text-left">
      <div className={cn('space-y-2 text-sm leading-relaxed text-muted-foreground', !open && 'line-clamp-2')}>
        {blocks.map((b, i) => <p key={i}>{render(b)}</p>)}
      </div>
      <button type="button" onClick={() => setOpen(o => !o)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        {open ? <>Mostrar menos <ChevronUp className="h-3.5 w-3.5" /></> : <>Ver descrição completa <ChevronDown className="h-3.5 w-3.5" /></>}
      </button>
    </div>
  );
}

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
          <Youtube className="h-12 w-12 text-danger" />
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
        <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-gradient-to-br from-danger to-danger p-[3px]">
          <Avatar className="h-full w-full border-2 border-card">
            <AvatarImage src={channel.profile_picture_url || undefined} alt={channel.username} className="object-cover" />
            <AvatarFallback className="text-2xl font-semibold bg-muted">{channel.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 text-center sm:text-left space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Youtube className="h-5 w-5 text-danger" />
              <h2 className="text-xl font-bold">@{channel.username}</h2>
            </div>
            {channel.display_name && <span className="text-muted-foreground">({channel.display_name})</span>}
            <a href={`https://youtube.com/@${channel.username}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
              <ExternalLink className="h-4 w-4" />Ver canal
            </a>
          </div>
          {channel.bio && <ChannelBio bio={channel.bio} />}
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
