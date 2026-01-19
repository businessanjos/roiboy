import { Music2, Users, UserPlus, Video, Heart, ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import type { TikTokProfile } from '@/hooks/useTikTokData';

interface TikTokProfileHeaderProps {
  profile: TikTokProfile | undefined;
  isLoading: boolean;
}

export function TikTokProfileHeader({ 
  profile, 
  isLoading,
  onProfilePictureChange
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

  const handleAvatarSave = (url: string | null) => {
    onProfilePictureChange?.(url);
    setAvatarDialogOpen(false);
  };

  return (
    <div className="bg-card rounded-xl border p-6">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Profile Picture */}
        <div className="relative group">
          <Avatar className="h-24 w-24 ring-4 ring-background shadow-lg">
            <AvatarImage src={profile.profile_picture_url || undefined} alt={profile.username} />
            <AvatarFallback className="text-2xl bg-gradient-to-br from-cyan-400 to-pink-500 text-white">
              {profile.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {onProfilePictureChange && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
              onClick={() => setAvatarDialogOpen(true)}
            >
              <Camera className="h-4 w-4" />
            </Button>
          )}
        </div>

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
            <a
              href={`https://tiktok.com/@${profile.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Ver perfil
            </a>
          </div>

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

      {onProfilePictureChange && (
        <ImageCropDialog
          open={avatarDialogOpen}
          onOpenChange={setAvatarDialogOpen}
          onSave={handleAvatarSave}
          currentImage={profile.profile_picture_url}
          title="Editar Foto de Perfil"
          aspectRatio={1}
        />
      )}
    </div>
  );
}
