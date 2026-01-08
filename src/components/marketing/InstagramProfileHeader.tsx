import { Instagram, ExternalLink, Settings, Pencil } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { InstagramProfile } from '@/hooks/useSocialMediaData';

interface InstagramProfileHeaderProps {
  profile: InstagramProfile | undefined;
  isLoading?: boolean;
  onEditProfile?: () => void;
}

export function InstagramProfileHeader({ 
  profile, 
  isLoading,
  onEditProfile 
}: InstagramProfileHeaderProps) {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace('.0', '') + 'K';
    }
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
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-20" />
            </div>
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-card rounded-xl border p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 p-[3px]">
            <div className="h-full w-full rounded-full bg-card flex items-center justify-center">
              <Instagram className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">Nenhum perfil conectado</h3>
            <p className="text-sm text-muted-foreground">
              Conecte seu perfil do Instagram para começar a acompanhar suas métricas.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-6">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Profile Picture with Instagram Gradient Border */}
        <div className="relative group">
          <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 p-[3px]">
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
          {/* Edit button overlay */}
          {onEditProfile && (
            <button
              onClick={onEditProfile}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <Pencil className="h-5 w-5 text-white" />
            </button>
          )}
        </div>

        {/* Profile Info */}
        <div className="flex-1 text-center sm:text-left space-y-4">
          {/* Username and Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">@{profile.username}</h2>
              {profile.display_name && profile.display_name !== profile.username && (
                <Badge variant="secondary" className="font-normal">
                  {profile.display_name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`https://instagram.com/${profile.username}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver no Instagram
                </Button>
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-center sm:justify-start gap-8">
            <div className="text-center sm:text-left">
              <span className="font-bold text-lg">{formatNumber(profile.posts_count)}</span>
              <p className="text-sm text-muted-foreground">publicações</p>
            </div>
            <div className="text-center sm:text-left">
              <span className="font-bold text-lg">{formatNumber(profile.followers_count)}</span>
              <p className="text-sm text-muted-foreground">seguidores</p>
            </div>
            <div className="text-center sm:text-left">
              <span className="font-bold text-lg">{formatNumber(profile.following_count)}</span>
              <p className="text-sm text-muted-foreground">seguindo</p>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-muted-foreground max-w-lg whitespace-pre-wrap">
              {profile.bio}
            </p>
          )}

          {/* Last Sync */}
          {profile.last_synced_at && (
            <p className="text-xs text-muted-foreground">
              Última sincronização: {new Date(profile.last_synced_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
