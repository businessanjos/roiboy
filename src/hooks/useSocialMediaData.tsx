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
  caption: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  posted_at: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_rate: number;
  virality_rate: number;
  ai_objective: 'growth' | 'connection' | 'authority' | 'sales' | null;
  ai_objective_confidence: number | null;
  is_trending: boolean;
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
  const { data: posts = [], isLoading: isLoadingPosts } = useQuery({
    queryKey: ['instagram-posts', currentProfile?.id, useMockData],
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

  // Create profile mutation
  const createProfile = useMutation({
    mutationFn: async (data: { username: string; accessToken?: string }) => {
      if (!user?.account_id) throw new Error('User not authenticated');

      const { data: profile, error: profileError } = await supabase
        .from('instagram_profiles')
        .insert({
          account_id: user.account_id,
          username: data.username.replace('@', ''),
          display_name: data.username,
          followers_count: 0,
          followers_previous_count: 0,
          following_count: 0,
          posts_count: 0,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      // Store credentials only if token was provided
      if (data.accessToken) {
        const { error: credError } = await supabase
          .from('instagram_credentials')
          .insert({
            profile_id: profile.id,
            access_token: data.accessToken,
          });

        if (credError) throw credError;
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
      ai_objective: 'growth' | 'connection' | 'authority' | 'sales';
      posted_at: Date;
      caption: string;
      reach: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
    }) => {
      if (!currentProfile) throw new Error('Nenhum perfil selecionado');

      // Extract Instagram ID from permalink
      const instagramIdMatch = data.permalink.match(/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
      const instagramId = instagramIdMatch ? instagramIdMatch[1] : null;

      // Calculate engagement and virality rates
      const totalEngagement = data.likes + data.comments + data.shares + data.saves;
      const engagementRate = data.reach > 0 ? (totalEngagement / data.reach) * 100 : 0;
      const viralityRate = data.reach > 0 ? (data.shares / data.reach) * 100 : 0;

      const { data: post, error } = await supabase
        .from('instagram_posts')
        .insert({
          profile_id: currentProfile.id,
          instagram_id: instagramId,
          permalink: data.permalink,
          post_type: data.post_type,
          ai_objective: data.ai_objective,
          ai_objective_confidence: 100, // Manual = 100% confidence
          posted_at: data.posted_at.toISOString(),
          caption: data.caption || null,
          reach: data.reach,
          likes: data.likes,
          comments: data.comments,
          shares: data.shares,
          saves: data.saves,
          engagement_rate: Math.round(engagementRate * 100) / 100,
          virality_rate: Math.round(viralityRate * 100) / 100,
          is_trending: engagementRate >= 12 || viralityRate >= 1.5,
        })
        .select()
        .single();

      if (error) throw error;
      return post;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-posts'] });
      toast.success('Post adicionado com sucesso!');
    },
    onError: (error) => {
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
        ai_objective: 'growth' | 'connection' | 'authority' | 'sales';
        posted_at: Date;
        caption: string;
        reach: number;
        likes: number;
        comments: number;
        shares: number;
        saves: number;
      };
    }) => {
      // Extract Instagram ID from permalink
      const instagramIdMatch = data.permalink.match(/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
      const instagramId = instagramIdMatch ? instagramIdMatch[1] : null;

      // Calculate engagement and virality rates
      const totalEngagement = data.likes + data.comments + data.shares + data.saves;
      const engagementRate = data.reach > 0 ? (totalEngagement / data.reach) * 100 : 0;
      const viralityRate = data.reach > 0 ? (data.shares / data.reach) * 100 : 0;

      const { data: post, error } = await supabase
        .from('instagram_posts')
        .update({
          instagram_id: instagramId,
          permalink: data.permalink,
          post_type: data.post_type,
          ai_objective: data.ai_objective,
          ai_objective_confidence: 100,
          posted_at: data.posted_at.toISOString(),
          caption: data.caption || null,
          reach: data.reach,
          likes: data.likes,
          comments: data.comments,
          shares: data.shares,
          saves: data.saves,
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
      queryClient.invalidateQueries({ queryKey: ['instagram-posts'] });
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
    createPost,
    updatePost,
    deletePost,
  };
}
