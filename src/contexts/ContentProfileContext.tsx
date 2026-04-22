import { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export type ProfilePlatform = 'instagram' | 'tiktok' | 'youtube';

export interface ContentProfile {
  id: string;
  platform: ProfilePlatform;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface ContentProfileContextValue {
  profiles: ContentProfile[];
  isLoading: boolean;
  selectedProfileId: string | null;
  setSelectedProfileId: (id: string | null) => void;
  selectedProfile: ContentProfile | null;
}

const ContentProfileContext = createContext<ContentProfileContextValue | undefined>(undefined);

export function ContentProfileProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useCurrentUser();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['content-profiles-all', currentUser?.account_id],
    queryFn: async (): Promise<ContentProfile[]> => {
      if (!currentUser?.account_id) return [];

      const [ig, tt, yt] = await Promise.all([
        supabase.from('instagram_profiles').select('id, username, display_name, profile_picture_url').eq('account_id', currentUser.account_id),
        supabase.from('tiktok_profiles').select('id, username, display_name, profile_picture_url').eq('account_id', currentUser.account_id),
        supabase.from('youtube_channels').select('id, username, display_name, profile_picture_url').eq('account_id', currentUser.account_id),
      ]);

      if (ig.error) console.error('[ContentProfiles] instagram error:', ig.error);
      if (tt.error) console.error('[ContentProfiles] tiktok error:', tt.error);
      if (yt.error) console.error('[ContentProfiles] youtube error:', yt.error);

      const result: ContentProfile[] = [];
      (ig.data ?? []).forEach((p: any) => result.push({ id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.profile_picture_url, platform: 'instagram' }));
      (tt.data ?? []).forEach((p: any) => result.push({ id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.profile_picture_url, platform: 'tiktok' }));
      (yt.data ?? []).forEach((p: any) => result.push({ id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.profile_picture_url, platform: 'youtube' }));
      return result;
    },
    enabled: !!currentUser?.account_id,
  });

  const selectedProfile = useMemo(() => {
    if (!profiles.length) return null;
    if (selectedProfileId) return profiles.find(p => p.id === selectedProfileId) ?? profiles[0];
    return profiles[0];
  }, [profiles, selectedProfileId]);

  return (
    <ContentProfileContext.Provider
      value={{ profiles, isLoading, selectedProfileId, setSelectedProfileId, selectedProfile }}
    >
      {children}
    </ContentProfileContext.Provider>
  );
}

export function useContentProfile() {
  const ctx = useContext(ContentProfileContext);
  if (!ctx) throw new Error('useContentProfile must be used within ContentProfileProvider');
  return ctx;
}
