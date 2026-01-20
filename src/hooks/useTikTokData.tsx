import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';

export interface TikTokProfile {
  id: string;
  account_id: string;
  username: string;
  display_name: string | null;
  profile_picture_url: string | null;
  followers_count: number;
  followers_previous_count: number;
  following_count: number;
  videos_count: number;
  likes_count: number;
  bio: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TikTokPost {
  id: string;
  account_id: string;
  profile_id: string;
  tiktok_id: string | null;
  video_url: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  posted_at: string | null;
  duration_seconds: number | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  avg_watch_time: number | null;
  completion_rate: number | null;
  engagement_rate: number | null;
  followers_gained: number;
  is_viral: boolean;
  sound_name: string | null;
  hashtags: string[] | null;
  ai_objective: 'growth' | 'connection' | 'authority' | 'sales' | null;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TikTokKPIs {
  totalFollowers: number;
  followersGrowth: number;
  avgEngagement: number;
  totalViews: number;
  aiInsight: string;
}

export interface TikTokPostFormData {
  video_url?: string;
  caption?: string;
  thumbnail_url?: string;
  posted_at?: Date;
  duration_seconds?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  avg_watch_time?: number;
  completion_rate?: number;
  followers_gained?: number;
  is_viral?: boolean;
  sound_name?: string;
  hashtags?: string[];
  ai_objective?: 'growth' | 'connection' | 'authority' | 'sales';
  category?: string;
  notes?: string;
}

// Mock data for initial state
const MOCK_PROFILES: TikTokProfile[] = [
  {
    id: 'mock-tiktok-1',
    account_id: 'mock-account',
    username: 'exemplo_tiktok',
    display_name: 'Exemplo TikTok',
    profile_picture_url: null,
    followers_count: 15000,
    followers_previous_count: 14200,
    following_count: 250,
    videos_count: 85,
    likes_count: 245000,
    bio: 'Perfil de exemplo para TikTok',
    is_active: true,
    last_synced_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const MOCK_POSTS: TikTokPost[] = [
  {
    id: 'mock-post-1',
    account_id: 'mock-account',
    profile_id: 'mock-tiktok-1',
    tiktok_id: null,
    video_url: 'https://www.tiktok.com/@exemplo',
    caption: 'Vídeo de exemplo #viral #trending',
    thumbnail_url: null,
    posted_at: new Date().toISOString(),
    duration_seconds: 45,
    views: 50000,
    likes: 5200,
    comments: 320,
    shares: 180,
    saves: 420,
    avg_watch_time: 32,
    completion_rate: 71,
    engagement_rate: 11.4,
    followers_gained: 250,
    is_viral: true,
    sound_name: 'Som Original',
    hashtags: ['viral', 'trending', 'fyp'],
    ai_objective: 'growth',
    category: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function useTikTokData() {
  const { currentUser: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(true);

  // Fetch profiles
  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['tiktok-profiles', user?.account_id],
    queryFn: async () => {
      if (!user?.account_id) return [];
      
      const { data, error } = await supabase
        .from('tiktok_profiles')
        .select('*')
        .eq('account_id', user.account_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (!data || data.length === 0) {
        setUseMockData(true);
        return MOCK_PROFILES;
      }
      
      setUseMockData(false);
      return data as TikTokProfile[];
    },
    enabled: !!user?.account_id,
  });

  // Set current profile
  const currentProfile = useMemo(() => {
    if (selectedProfileId) {
      return profiles.find(p => p.id === selectedProfileId) || profiles[0];
    }
    return profiles[0];
  }, [profiles, selectedProfileId]);

  // Fetch posts for selected profile
  const { data: posts = [], isLoading: isLoadingPosts } = useQuery({
    queryKey: ['tiktok-posts', currentProfile?.id, useMockData],
    queryFn: async () => {
      if (!currentProfile) return [];
      
      if (useMockData) {
        return MOCK_POSTS.filter(p => p.profile_id === currentProfile.id);
      }
      
      const { data, error } = await supabase
        .from('tiktok_posts')
        .select('*')
        .eq('profile_id', currentProfile.id)
        .order('posted_at', { ascending: false });

      if (error) throw error;
      return (data || []) as TikTokPost[];
    },
    enabled: !!currentProfile?.id,
  });

  // Calculate KPIs
  const kpis = useMemo<TikTokKPIs>(() => {
    if (!currentProfile) {
      return {
        totalFollowers: 0,
        followersGrowth: 0,
        avgEngagement: 0,
        totalViews: 0,
        aiInsight: 'Conecte um perfil do TikTok para ver insights.',
      };
    }

    const totalFollowers = currentProfile.followers_count || 0;
    const previousFollowers = currentProfile.followers_previous_count || totalFollowers;
    const followersGrowth = previousFollowers > 0
      ? ((totalFollowers - previousFollowers) / previousFollowers) * 100
      : 0;

    const totalEngagement = posts.reduce((sum, post) => {
      return sum + (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0);
    }, 0);
    
    const totalViews = posts.reduce((sum, post) => sum + (post.views || 0), 0);
    const avgEngagement = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

    let aiInsight = 'Adicione vídeos para receber insights de IA.';
    if (posts.length > 0) {
      const avgCompletion = posts.reduce((sum, p) => sum + (p.completion_rate || 0), 0) / posts.length;
      if (avgCompletion > 70) {
        aiInsight = 'Excelente! Seus vídeos têm alta taxa de conclusão. Continue com esse formato!';
      } else if (avgCompletion > 50) {
        aiInsight = 'Boa retenção! Tente hooks mais fortes nos primeiros 3 segundos para melhorar.';
      } else {
        aiInsight = 'Foque em hooks impactantes no início do vídeo para aumentar a retenção.';
      }
    }

    return {
      totalFollowers,
      followersGrowth: parseFloat(followersGrowth.toFixed(1)),
      avgEngagement: parseFloat(avgEngagement.toFixed(1)),
      totalViews,
      aiInsight,
    };
  }, [currentProfile, posts]);

  // Create profile mutation - NOW USES EDGE FUNCTION FOR AUTO-FETCH
  const createProfile = useMutation({
    mutationFn: async (data: { username: string }) => {
      if (!user?.account_id) throw new Error('Usuário não autenticado');

      // Call Edge Function to fetch and create profile with real data - NO MANUAL METRICS
      const { data: result, error } = await supabase.functions.invoke('fetch-tiktok-profile', {
        body: {
          profileInput: data.username,
          accountId: user.account_id,
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Erro ao buscar perfil do TikTok');
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Erro ao conectar perfil');
      }

      return { profile: result.profile, needsSync: result.needsSync };
    },
    onSuccess: async (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-profiles'] });
      
      // If data wasn't fetched automatically, trigger sync immediately
      if (result.needsSync && result.profile?.id) {
        toast.info('Sincronizando dados do TikTok...');
        // Wait a bit and trigger sync
        setTimeout(() => {
          syncProfile.mutate(result.profile.id);
        }, 500);
      } else {
        toast.success(`Perfil @${variables.username.replace('@', '')} conectado com dados atualizados!`);
      }
    },
    onError: (error) => {
      toast.error('Erro ao conectar perfil: ' + error.message);
    },
  });

  // Sync profile mutation - UPDATES PROFILE WITH FRESH DATA
  const syncProfile = useMutation({
    mutationFn: async (profileId?: string) => {
      if (!user?.account_id) throw new Error('Usuário não autenticado');

      const { data: result, error } = await supabase.functions.invoke('sync-tiktok-profiles', {
        body: {
          accountId: user.account_id,
          profileId: profileId || currentProfile?.id
        }
      });

      if (error) {
        console.error('Sync error:', error);
        throw new Error(error.message || 'Erro ao sincronizar perfil');
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Erro na sincronização');
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['tiktok-posts'] });
      
      if (result.synced > 0) {
        toast.success(result.message || 'Perfil sincronizado com sucesso!');
      } else {
        toast.info('Nenhum dado novo disponível');
      }
    },
    onError: (error) => {
      toast.error('Erro ao sincronizar: ' + error.message);
    },
  });

  // Create post mutation
  const createPost = useMutation({
    mutationFn: async (data: TikTokPostFormData) => {
      if (!user?.account_id || !currentProfile) throw new Error('Profile not selected');

      const engagementRate = data.views && data.views > 0
        ? (((data.likes || 0) + (data.comments || 0) + (data.shares || 0) + (data.saves || 0)) / data.views) * 100
        : 0;

      const { data: post, error } = await supabase
        .from('tiktok_posts')
        .insert({
          account_id: user.account_id,
          profile_id: currentProfile.id,
          video_url: data.video_url,
          caption: data.caption,
          thumbnail_url: data.thumbnail_url,
          posted_at: data.posted_at?.toISOString(),
          duration_seconds: data.duration_seconds,
          views: data.views || 0,
          likes: data.likes || 0,
          comments: data.comments || 0,
          shares: data.shares || 0,
          saves: data.saves || 0,
          avg_watch_time: data.avg_watch_time,
          completion_rate: data.completion_rate,
          engagement_rate: engagementRate,
          followers_gained: data.followers_gained || 0,
          is_viral: data.is_viral || false,
          sound_name: data.sound_name,
          hashtags: data.hashtags,
          ai_objective: data.ai_objective,
          category: data.category,
          notes: data.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return post;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-posts'] });
      toast.success('Vídeo adicionado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar vídeo: ' + error.message);
    },
  });

  // Update post mutation
  const updatePost = useMutation({
    mutationFn: async ({ postId, data }: { postId: string; data: Partial<TikTokPostFormData> }) => {
      // Build update object manually to avoid Date serialization issues
      const updateData: Record<string, unknown> = {};

      if (data.video_url !== undefined) updateData.video_url = data.video_url;
      if (data.caption !== undefined) updateData.caption = data.caption;
      if (data.thumbnail_url !== undefined) updateData.thumbnail_url = data.thumbnail_url;
      if (data.posted_at !== undefined) updateData.posted_at = data.posted_at.toISOString();
      if (data.duration_seconds !== undefined) updateData.duration_seconds = data.duration_seconds;
      if (data.views !== undefined) updateData.views = data.views;
      if (data.likes !== undefined) updateData.likes = data.likes;
      if (data.comments !== undefined) updateData.comments = data.comments;
      if (data.shares !== undefined) updateData.shares = data.shares;
      if (data.saves !== undefined) updateData.saves = data.saves;
      if (data.avg_watch_time !== undefined) updateData.avg_watch_time = data.avg_watch_time;
      if (data.completion_rate !== undefined) updateData.completion_rate = data.completion_rate;
      if (data.followers_gained !== undefined) updateData.followers_gained = data.followers_gained;
      if (data.is_viral !== undefined) updateData.is_viral = data.is_viral;
      if (data.sound_name !== undefined) updateData.sound_name = data.sound_name;
      if (data.hashtags !== undefined) updateData.hashtags = data.hashtags;
      if (data.ai_objective !== undefined) updateData.ai_objective = data.ai_objective;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.notes !== undefined) updateData.notes = data.notes;

      // Calculate and add engagement_rate if views are provided
      if (data.views && data.views > 0) {
        const engagementRate = (((data.likes || 0) + (data.comments || 0) + (data.shares || 0) + (data.saves || 0)) / data.views) * 100;
        updateData.engagement_rate = engagementRate;
      }

      const { error } = await supabase
        .from('tiktok_posts')
        .update(updateData)
        .eq('id', postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-posts'] });
      toast.success('Vídeo atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar vídeo: ' + error.message);
    },
  });

  // Delete post mutation
  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from('tiktok_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-posts'] });
      toast.success('Vídeo excluído com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir vídeo: ' + error.message);
    },
  });

  // Update profile picture
  const updateProfilePicture = useMutation({
    mutationFn: async ({ profileId, avatarUrl }: { profileId: string; avatarUrl: string | null }) => {
      const { error } = await supabase
        .from('tiktok_profiles')
        .update({ profile_picture_url: avatarUrl })
        .eq('id', profileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-profiles'] });
      toast.success('Foto de perfil atualizada!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar foto: ' + error.message);
    },
  });

  const refetchData = () => {
    queryClient.invalidateQueries({ queryKey: ['tiktok-profiles'] });
    queryClient.invalidateQueries({ queryKey: ['tiktok-posts'] });
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
    syncProfile, // NEW: Sync profile with fresh data
    createPost,
    updatePost,
    deletePost,
    refetchData,
    updateProfilePicture,
  };
}
