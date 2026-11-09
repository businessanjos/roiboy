import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { fetchContentArchive } from '../../supabase/functions/_shared/contentArchive';

export function useContentArchive() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  return useQuery({
    queryKey: ['content-archive', accountId], enabled: !!accountId, staleTime: 60000,
    queryFn: () => accountId ? fetchContentArchive(supabase, accountId) : Promise.resolve([]),
  });
}