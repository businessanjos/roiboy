import { useState } from 'react';
import { Music2, Users, UserPlus, Video, Heart, ExternalLink, Camera, RefreshCw, Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TikTokProfile } from '@/hooks/useTikTokData';
import { TikTokProfileAvatarUpload } from './TikTokProfileAvatarUpload';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TikTokProfileHeaderProps {
  profile: TikTokProfile | undefined;
  isLoading: boolean;
  onProfilePictureChange?: (url: string | null) => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

export function TikTokProfileHeader({ 
  profile, 
  isLoading,
  onProfilePictureChange,
  onSync,
  isSyncing,
}: TikTokProfileHeaderProps) {
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace('.0', '') + 'K';
    }
    return num.toLocaleString('pt-BR');
  };

  const formatLastSynced = (date: string | null): string => {
    if (!date) return 'Nunca sincronizado';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
    } catch {
      return 'Data inválida';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="flex-1 space-y-4 text-center sm:text-left">
            <Skeleton className="h-6 w-40 mx-auto sm:mx-0" />
            <div className="flex justify-center sm:justify-start gap-8">
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-20" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <div className="flex items-center gap-4 text-muted-foreground">
          <Music2 className="h-12 w-12" />
          <div>
            <p className="font-medium">Nenhum perfil selecionado</p>
            <p className="text-sm">Conecte um perfil do TikTok para começar</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-6">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Profile Picture with TikTok Gradient Border */}
        <div className="relative group">
          <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-gradient-to-br from-cyan-400 to-pink-500 p-[3px]">
            <Avatar className="h-full w-full border-2 border-card">
              <AvatarImage 
                src={profile.profile_picture_url || undefined} 
                alt={profile.username}
                className="object-cover"
              />
              <AvatarFallback className="text-2xl font-semibold bg-muted">
                {profile.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          {/* Edit photo button overlay */}
          {onProfilePictureChange && (
            <button
              onClick={() => setAvatarDialogOpen(true)}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            >
              <Camera className="h-6 w-6 text-white" />
            </button>
          )}
        </div>

        {/* Avatar Upload Dialog */}
        {profile && onProfilePictureChange && (
          <TikTokProfileAvatarUpload
            profileId={profile.id}
            username={profile.username}
            currentAvatarUrl={profile.profile_picture_url}
            onAvatarChange={onProfilePictureChange}
            open={avatarDialogOpen}
            onOpenChange={setAvatarDialogOpen}
          />
        )}

        {/* Profile Info */}
        <div className="flex-1 text-center sm:text-left space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Music2 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">@{profile.username}</h2>
            </div>
            {profile.display_name && (
              <span className="text-muted-foreground">({profile.display_name})</span>
            )}
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <a
                href={`https://tiktok.com/@${profile.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Ver perfil
              </a>
              
              {/* Sync Button */}
              {onSync && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={onSync}
                        disabled={isSyncing}
                      >
                        <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Atualizar dados do perfil</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Last Synced Indicator */}
          {profile.last_synced_at && (
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Atualizado {formatLastSynced(profile.last_synced_at)}</span>
            </div>
          )}

          {profile.bio && (
            <p className="text-sm text-muted-foreground max-w-md">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="flex justify-center sm:justify-start gap-8">
            <div className="text-center">
              <div className="flex items-center gap-1.5 text-2xl font-bold">
                <Users className="h-5 w-5 text-muted-foreground" />
                {formatNumber(profile.followers_count)}
              </div>
              <p className="text-xs text-muted-foreground">Seguidores</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1.5 text-2xl font-bold">
                <UserPlus className="h-5 w-5 text-muted-foreground" />
                {formatNumber(profile.following_count)}
              </div>
              <p className="text-xs text-muted-foreground">Seguindo</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1.5 text-2xl font-bold">
                <Video className="h-5 w-5 text-muted-foreground" />
                {formatNumber(profile.videos_count)}
              </div>
              <p className="text-xs text-muted-foreground">Vídeos</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1.5 text-2xl font-bold">
                <Heart className="h-5 w-5 text-muted-foreground" />
                {formatNumber(profile.likes_count)}
              </div>
              <p className="text-xs text-muted-foreground">Curtidas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
