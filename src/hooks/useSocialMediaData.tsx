import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { toast } from 'sonner';

export interface InstagramProfile {
  id: string;
  account_id: string;
  username: string;
  display_name: string | null;
  profile_picture_url: string | null;
  followers_count: number;
  followers_previous_count: number;
  following_count: number;
  posts_count: number;
  bio: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstagramPost {
  id: string;
  profile_id: string;
  instagram_id: string | null;
  post_type: 'reels' | 'carousel' | 'static';
  theme: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  posted_at: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  link_clicks: number;
  views: number;
  followers_gained: number;
  reposts: number;
  profile_visits: number;
  engagement_rate: number;
  virality_rate: number;
  ai_objective: 'growth' | 'connection' | 'authority' | 'sales' | null;
  ai_objective_confidence: number | null;
  is_trending: boolean;
  specialist_version: string | null;
  composition: string[] | null;
  created_at: string;
  updated_at: string;
}

// Empty arrays - no mock data
const MOCK_PROFILES: InstagramProfile[] = [];
const MOCK_POSTS: InstagramPost[] = [];

export function useSocialMediaData() {
  const { currentUser: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(true);

  // Fetch profiles
  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['instagram-profiles', user?.account_id],
    queryFn: async () => {
      if (!user?.account_id) return [];
      
      const { data, error } = await supabase
        .from('instagram_profiles')
        .select('*')
        .eq('account_id', user.account_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // If no real profiles, return mock data
      if (!data || data.length === 0) {
        setUseMockData(true);
        return MOCK_PROFILES;
      }
      
      setUseMockData(false);
      return data as InstagramProfile[];
    },
    enabled: !!user?.account_id,
  });

  // Set initial selected profile
  const currentProfile = useMemo(() => {
    if (selectedProfileId) {
      return profiles.find(p => p.id === selectedProfileId) || profiles[0];
    }
    return profiles[0];
  }, [profiles, selectedProfileId]);

  // Fetch posts for selected profile
  // Query key simplified to avoid volatile state issues with cache invalidation
  const { data: posts = [], isLoading: isLoadingPosts } = useQuery({
    queryKey: ['instagram-posts', currentProfile?.id],
    queryFn: async () => {
      if (!currentProfile) return [];
      
      if (useMockData) {
        return MOCK_POSTS.filter(p => p.profile_id === currentProfile.id);
      }
      
      const { data, error } = await supabase
        .from('instagram_posts')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .order('posted_at', { ascending: false });

      if (error) throw error;
      return data as InstagramPost[];
    },
    enabled: !!currentProfile,
    staleTime: 120000, // OPTIMIZED: 2 minutes (up from 30 seconds)
    refetchOnWindowFocus: false,
  });

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!currentProfile) {
      return {
        totalFollowers: 0,
        followersGrowth: 0,
        avgEngagement: 0,
        aiInsight: '',
      };
    }

    const followersGrowth = currentProfile.followers_previous_count > 0
      ? ((currentProfile.followers_count - currentProfile.followers_previous_count) / currentProfile.followers_previous_count) * 100
      : 0;

    const avgEngagement = posts.length > 0
      ? posts.reduce((acc, post) => acc + post.engagement_rate, 0) / posts.length
      : 0;

    // Generate AI insight based on data
    const reelsPosts = posts.filter(p => p.post_type === 'reels');
    const growthPosts = posts.filter(p => p.ai_objective === 'growth');
    const avgReelsEngagement = reelsPosts.length > 0
      ? reelsPosts.reduce((acc, p) => acc + p.engagement_rate, 0) / reelsPosts.length
      : 0;
    const avgStaticEngagement = posts.filter(p => p.post_type === 'static').length > 0
      ? posts.filter(p => p.post_type === 'static').reduce((acc, p) => acc + p.engagement_rate, 0) / posts.filter(p => p.post_type === 'static').length
      : 0;

    let aiInsight = '';
    if (avgReelsEngagement > avgStaticEngagement && avgStaticEngagement > 0) {
      const diff = Math.round(((avgReelsEngagement - avgStaticEngagement) / avgStaticEngagement) * 100);
      aiInsight = `Seus Reels performam ${diff}% melhor que posts estáticos. Continue investindo nesse formato!`;
    } else if (growthPosts.filter(p => p.is_trending).length > 0) {
      aiInsight = `${growthPosts.filter(p => p.is_trending).length} posts de "Crescimento" estão em tendência. Esse objetivo está funcionando bem!`;
    } else {
      aiInsight = 'Continue postando regularmente para gerar mais insights sobre seu conteúdo.';
    }

    return {
      totalFollowers: currentProfile.followers_count,
      followersGrowth: Math.round(followersGrowth * 10) / 10,
      avgEngagement: Math.round(avgEngagement * 10) / 10,
      aiInsight,
    };
  }, [currentProfile, posts]);

  // Create profile mutation - uses edge function to bypass RLS and fetch public data
  const createProfile = useMutation({
    mutationFn: async (data: { 
      username: string; 
      accessToken?: string;
      followers_count?: number;
      following_count?: number;
      posts_count?: number;
      bio?: string;
    }) => {
      if (!user?.account_id) throw new Error('User not authenticated');

      // Call edge function to fetch public profile data and create profile
      const { data: result, error } = await supabase.functions.invoke('fetch-instagram-profile', {
        body: {
          profileInput: data.username,
          accountId: user.account_id,
          // Pass manual metrics if provided
          manualMetrics: {
            followers_count: data.followers_count,
            following_count: data.following_count,
            posts_count: data.posts_count,
            bio: data.bio,
          },
        },
      });

      if (error) throw new Error(error.message);
      if (!result?.success) throw new Error(result?.error || 'Erro ao adicionar perfil');

      const profile = result.profile;

      // Store credentials only if token was provided
      if (data.accessToken && profile?.id) {
        const { error: credError } = await supabase
          .from('instagram_credentials')
          .insert({
            profile_id: profile.id,
            access_token: data.accessToken,
          });

        if (credError) {
          console.warn('Could not store credentials:', credError);
        }
      }

      return profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-profiles'] });
      toast.success('Perfil adicionado com sucesso!');
      setUseMockData(false);
    },
    onError: (error) => {
      toast.error('Erro ao adicionar perfil: ' + error.message);
    },
  });

  // Create post mutation
  const createPost = useMutation({
    mutationFn: async (data: {
      permalink: string;
      post_type: 'reels' | 'carousel' | 'static';
      theme?: string;
      ai_objective: 'growth' | 'connection' | 'authority' | 'sales';
      posted_at: Date;
      caption: string;
      reach: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      link_clicks: number;
      views: number;
      followers_gained: number;
      reposts: number;
      collaborator: string;
      specialist_version?: string;
      composition?: string[];
    }) => {
      if (!currentProfile) throw new Error('Nenhum perfil selecionado');

      // Extract Instagram ID from permalink
      const instagramIdMatch = data.permalink.match(/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
      const instagramId = instagramIdMatch ? instagramIdMatch[1] : null;

      // Pre-check: post already exists for this profile?
      if (instagramId) {
        const { data: existing } = await supabase
          .from('instagram_posts')
          .select('id')
          .eq('profile_id', currentProfile.id)
          .eq('instagram_id', instagramId)
          .maybeSingle();
        if (existing) {
          const err: any = new Error('DUPLICATE_POST');
          err.existingId = existing.id;
          throw err;
        }
      }

      // Calculate engagement and virality rates
      const totalEngagement = data.likes + data.comments + data.shares + data.saves;
      const rawEngagementRate = data.reach > 0 ? (totalEngagement / data.reach) * 100 : 0;
      const rawViralityRate = data.reach > 0 ? (data.shares / data.reach) * 100 : 0;
      
      // Cap rates at 999.99 to prevent numeric(5,2) overflow in database
      const engagementRate = Math.min(rawEngagementRate, 999.99);
      const viralityRate = Math.min(rawViralityRate, 999.99);

      const { data: post, error } = await supabase
        .from('instagram_posts')
        .insert({
          profile_id: currentProfile.id,
          instagram_id: instagramId,
          permalink: data.permalink,
          post_type: data.post_type,
          theme: data.theme || null,
          ai_objective: data.ai_objective,
          ai_objective_confidence: 100, // Manual = 100% confidence
          posted_at: data.posted_at.toISOString(),
          caption: data.caption || null,
          reach: data.reach,
          likes: data.likes,
          comments: data.comments,
          shares: data.shares,
          saves: data.saves,
          link_clicks: data.link_clicks,
          views: data.views,
          followers_gained: data.followers_gained,
          reposts: data.reposts,
          collaborator: data.collaborator || null,
          specialist_version: data.specialist_version || null,
          composition: data.composition || [],
          engagement_rate: Math.round(engagementRate * 100) / 100,
          virality_rate: Math.round(viralityRate * 100) / 100,
          is_trending: engagementRate >= 12 || viralityRate >= 1.5,
        })
        .select()
        .single();

      if (error) {
        if ((error as any).code === '23505') {
          throw new Error('DUPLICATE_POST');
        }
        throw error;
      }
      return post;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-posts'] });
      toast.success('Post adicionado com sucesso!');
    },
    onError: (error: any) => {
      if (error?.message === 'DUPLICATE_POST') {
        toast.error('Esse post já foi adicionado para este perfil. Edite o existente em vez de criar um novo.');
        return;
      }
      toast.error('Erro ao adicionar post: ' + error.message);
    },
  });

  // Update post mutation
  const updatePost = useMutation({
    mutationFn: async ({
      postId,
      data,
    }: {
      postId: string;
      data: {
        permalink: string;
        post_type: 'reels' | 'carousel' | 'static';
        theme?: string;
        ai_objective: 'growth' | 'connection' | 'authority' | 'sales';
        posted_at: Date;
        caption: string;
        reach: number;
        likes: number;
        comments: number;
        shares: number;
        saves: number;
        link_clicks: number;
        views: number;
        reposts: number;
        followers_gained: number;
        profile_visits: number;
        specialist_version?: string;
        composition?: string[];
      };
    }) => {
      // Extract Instagram ID from permalink
      const instagramIdMatch = data.permalink.match(/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
      const instagramId = instagramIdMatch ? instagramIdMatch[1] : null;

      // Calculate engagement and virality rates
      const totalEngagement = data.likes + data.comments + data.shares + data.saves;
      const rawEngagementRate = data.reach > 0 ? (totalEngagement / data.reach) * 100 : 0;
      const rawViralityRate = data.reach > 0 ? (data.shares / data.reach) * 100 : 0;
      
      // Cap rates at 999.99 to prevent numeric(5,2) overflow in database
      const engagementRate = Math.min(rawEngagementRate, 999.99);
      const viralityRate = Math.min(rawViralityRate, 999.99);

      const { data: post, error } = await supabase
        .from('instagram_posts')
        .update({
          instagram_id: instagramId,
          permalink: data.permalink,
          post_type: data.post_type,
          theme: data.theme || null,
          ai_objective: data.ai_objective,
          ai_objective_confidence: 100,
          posted_at: data.posted_at.toISOString(),
          caption: data.caption || null,
          reach: data.reach,
          likes: data.likes,
          comments: data.comments,
          shares: data.shares,
          saves: data.saves,
          link_clicks: data.link_clicks || 0,
          views: data.views,
          reposts: data.reposts,
          followers_gained: data.followers_gained,
          profile_visits: data.profile_visits || 0,
          specialist_version: data.specialist_version || null,
          composition: data.composition || [],
          engagement_rate: Math.round(engagementRate * 100) / 100,
          virality_rate: Math.round(viralityRate * 100) / 100,
          is_trending: engagementRate >= 12 || viralityRate >= 1.5,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;
      return post;
    },
    onSuccess: () => {
      // Aggressive cache invalidation to ensure data refresh for all users
      queryClient.invalidateQueries({ 
        queryKey: ['instagram-posts'],
        exact: false,
        refetchType: 'all'
      });
      // Also invalidate dashboard that may use this data
      queryClient.invalidateQueries({ queryKey: ['instagram-dashboard'] });
      toast.success('Post atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar post: ' + error.message);
    },
  });

  // Delete post mutation
  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      // Check if it's a mock post (mock IDs are not valid UUIDs)
      const isMockPost = postId.startsWith('post-') || postId.startsWith('mock-');
      
      if (isMockPost) {
        // For mock data, we can't actually delete from the database
        // Just return success - the UI will handle the visual removal
        throw new Error('Posts de demonstração não podem ser excluídos. Conecte um perfil real para gerenciar posts.');
      }

      const { error } = await supabase
        .from('instagram_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-posts'] });
      toast.success('Post excluído com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir post: ' + error.message);
    },
  });

  const syncProfiles = useMutation({
    mutationFn: async () => {
      if (!user?.account_id) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase.functions.invoke('sync-instagram-profiles', {
        body: { accountId: user.account_id },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao sincronizar');
      
      return data;
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['instagram-profiles'] }),
        queryClient.refetchQueries({ queryKey: ['instagram-posts'] }),
        queryClient.refetchQueries({ queryKey: ['instagram-dashboard'] }),
      ]);
      toast.success(data.message || 'Perfis sincronizados!');
    },
    onError: (error) => {
      toast.error('Erro ao sincronizar: ' + error.message);
    },
  });

  // Update profile picture mutation
  const updateProfilePicture = useMutation({
    mutationFn: async ({ profileId, avatarUrl }: { profileId: string; avatarUrl: string | null }) => {
      const { error } = await supabase
        .from('instagram_profiles')
        .update({ profile_picture_url: avatarUrl })
        .eq('id', profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-profiles'] });
      toast.success('Foto de perfil atualizada!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar foto: ' + error.message);
    },
  });

  // Delete profile mutation (cascades to posts)
  const deleteProfile = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from('instagram_profiles')
        .delete()
        .eq('id', profileId);
      if (error) throw error;
      return profileId;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['instagram-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['instagram-posts'] });
      queryClient.invalidateQueries({ queryKey: ['instagram-dashboard'] });
      if (selectedProfileId === deletedId) {
        setSelectedProfileId(null);
      }
      toast.success('Perfil excluído com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao excluir perfil: ' + error.message);
    },
  });

  const refetchData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['instagram-profiles'] }),
      queryClient.invalidateQueries({ queryKey: ['instagram-posts'] }),
      queryClient.invalidateQueries({ queryKey: ['instagram-dashboard'] }),
    ]);
    toast.success('Dados atualizados!');
  };

  return {
    profiles,
    currentProfile,
    posts,
    kpis,
    isLoading: isLoadingProfiles || isLoadingPosts,
    useMockData,
    selectedProfileId,
    setSelectedProfileId,
    createProfile,
    deleteProfile,
    createPost,
    updatePost,
    deletePost,
    refetchData,
    syncProfiles,
    updateProfilePicture,
  };
}
