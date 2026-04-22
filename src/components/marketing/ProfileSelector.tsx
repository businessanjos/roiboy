import { Instagram, Music2, Youtube, Globe } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useContentProfile, ProfilePlatform } from '@/contexts/ContentProfileContext';

const platformIcon: Record<ProfilePlatform, typeof Instagram> = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
};

export function ProfileSelector() {
  const { profiles, isLoading, selectedProfile, setSelectedProfileId } = useContentProfile();

  if (isLoading) {
    return <div className="h-10 w-64 rounded-md bg-muted animate-pulse" />;
  }

  if (!profiles.length) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground border rounded-md px-3 py-2">
        <Globe className="h-4 w-4" />
        Nenhum perfil conectado
      </div>
    );
  }

  return (
    <Select
      value={selectedProfile?.id ?? ''}
      onValueChange={(v) => setSelectedProfileId(v)}
    >
      <SelectTrigger className="w-72">
        <SelectValue>
          {selectedProfile && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={selectedProfile.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">
                  {(selectedProfile.display_name ?? selectedProfile.username ?? '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{selectedProfile.display_name ?? selectedProfile.username}</span>
              <span className="text-xs text-muted-foreground">@{selectedProfile.username}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {profiles.map((p) => {
          const Icon = platformIcon[p.platform];
          return (
            <SelectItem key={p.id} value={p.id}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <Avatar className="h-5 w-5">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {(p.display_name ?? p.username ?? '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{p.display_name ?? p.username}</span>
                <span className="text-xs text-muted-foreground">@{p.username}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
