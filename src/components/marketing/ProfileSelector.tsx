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
    return <div className="h-16 w-80 max-w-full rounded-lg bg-muted animate-pulse" />;
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
      <SelectTrigger aria-label="Perfil de marca" className="h-auto min-h-16 w-full min-w-0 gap-3 rounded-lg border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/30 sm:w-80 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:line-clamp-none [&>svg]:shrink-0">
        <SelectValue>
          {selectedProfile && (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-9 w-9 shrink-0 border border-border">
                <AvatarImage src={selectedProfile.avatar_url ?? undefined} alt="" draggable={false} className="select-none" />
                <AvatarFallback className="bg-primary/10 text-sm text-primary">
                  {(selectedProfile.display_name ?? selectedProfile.username ?? '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-0.5">
                <span className="block whitespace-normal break-words text-sm font-semibold leading-5">{selectedProfile.display_name ?? selectedProfile.username}</span>
                <span className="flex items-center gap-1.5 text-xs leading-4 text-muted-foreground">
                  {(() => { const Icon = platformIcon[selectedProfile.platform]; return <Icon className="h-3 w-3 shrink-0" />; })()}
                  <span className="truncate">@{selectedProfile.username}</span>
                </span>
              </div>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-w-[calc(100vw-2rem)] rounded-lg" sideOffset={6}>
        {profiles.map((p) => {
          const Icon = platformIcon[p.platform];
          return (
            <SelectItem key={p.id} value={p.id} textValue={p.display_name ?? p.username} className="my-0.5 cursor-pointer rounded-md py-3 pr-4 [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1 data-[state=checked]:bg-primary/5">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9 shrink-0 border border-border">
                  <AvatarImage src={p.avatar_url ?? undefined} alt="" draggable={false} className="select-none" />
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {(p.display_name ?? p.username ?? '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <span className="block whitespace-normal break-words font-medium leading-5">{p.display_name ?? p.username}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">@{p.username}</span>
                  </span>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
