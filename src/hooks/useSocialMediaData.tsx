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

// Mock data for prototype
const MOCK_PROFILES: InstagramProfile[] = [
  {
    id: 'mock-profile-1',
    account_id: 'mock-account',
    username: 'joaoferrari',
    display_name: 'João Ferrari | Marketing Digital',
    profile_picture_url: null,
    followers_count: 23500,
    followers_previous_count: 22550,
    following_count: 890,
    posts_count: 342,
    bio: '🚀 Marketing Digital Expert | Ajudo empresas a crescer nas redes',
    is_active: true,
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'mock-profile-2',
    account_id: 'mock-account',
    username: 'mariadigital',
    display_name: 'Maria Silva | Social Media',
    profile_picture_url: null,
    followers_count: 15200,
    followers_previous_count: 14800,
    following_count: 520,
    posts_count: 215,
    bio: '📱 Especialista em Social Media',
    is_active: true,
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const MOCK_POSTS: InstagramPost[] = [
  {
    id: 'post-1',
    profile_id: 'mock-profile-1',
    instagram_id: 'CxYZ123',
    post_type: 'reels',
    caption: '5 estratégias que triplicaram meu engajamento em 30 dias! 🚀 #marketingdigital #crescimento',
    thumbnail_url: null,
    permalink: 'https://instagram.com/p/CxYZ123',
    posted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    reach: 45000,
    likes: 3200,
    comments: 456,
    shares: 890,
    saves: 1200,
    engagement_rate: 12.8,
    virality_rate: 1.98,
    ai_objective: 'growth',
    ai_objective_confidence: 92,
    is_trending: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'post-2',
    profile_id: 'mock-profile-1',
    instagram_id: 'CxABC456',
    post_type: 'carousel',
    caption: 'Bastidores do meu dia a dia como empreendedor digital 📸',
    thumbnail_url: null,
    permalink: 'https://instagram.com/p/CxABC456',
    posted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    reach: 18500,
    likes: 1850,
    comments: 234,
    shares: 120,
    saves: 340,
    engagement_rate: 13.7,
    virality_rate: 0.65,
    ai_objective: 'connection',
    ai_objective_confidence: 88,
    is_trending: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'post-3',
    profile_id: 'mock-profile-1',
    instagram_id: 'CxDEF789',
    post_type: 'static',
    caption: 'O segredo por trás de conteúdos que viralizam 🔥 Arrasta pro lado para ver a análise completa!',
    thumbnail_url: null,
    permalink: 'https://instagram.com/p/CxDEF789',
    posted_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    reach: 12300,
    likes: 980,
    comments: 145,
    shares: 67,
    saves: 289,
    engagement_rate: 12.0,
    virality_rate: 0.54,
    ai_objective: 'authority',
    ai_objective_confidence: 85,
    is_trending: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'post-4',
    profile_id: 'mock-profile-1',
    instagram_id: 'CxGHI012',
    post_type: 'reels',
    caption: 'MENTORIA DE MARKETING DIGITAL 🎯 Vagas limitadas! Link na bio para garantir a sua.',
    thumbnail_url: null,
    permalink: 'https://instagram.com/p/CxGHI012',
    posted_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    reach: 28000,
    likes: 1560,
    comments: 289,
    shares: 156,
    saves: 567,
    engagement_rate: 9.2,
    virality_rate: 0.56,
    ai_objective: 'sales',
    ai_objective_confidence: 95,
    is_trending: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'post-5',
    profile_id: 'mock-profile-1',
    instagram_id: 'CxJKL345',
    post_type: 'reels',
    caption: 'Como consegui 10k seguidores em 7 dias usando essa técnica simples! 📈',
    thumbnail_url: null,
    permalink: 'https://instagram.com/p/CxJKL345',
    posted_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    reach: 67000,
    likes: 5400,
    comments: 678,
    shares: 1450,
    saves: 2100,
    engagement_rate: 14.4,
    virality_rate: 2.16,
    ai_objective: 'growth',
    ai_objective_confidence: 97,
    is_trending: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'post-6',
    profile_id: 'mock-profile-1',
    instagram_id: 'CxMNO678',
    post_type: 'carousel',
    caption: '7 ferramentas GRATUITAS que todo criador de conteúdo precisa conhecer 🛠️',
    thumbnail_url: null,
    permalink: 'https://instagram.com/p/CxMNO678',
    posted_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    reach: 22000,
    likes: 2100,
    comments: 312,
    shares: 445,
    saves: 890,
    engagement_rate: 17.0,
    virality_rate: 2.02,
    ai_objective: 'authority',
    ai_objective_confidence: 91,
    is_trending: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'post-7',
    profile_id: 'mock-profile-1',
    instagram_id: 'CxPQR901',
    post_type: 'static',
    caption: 'Reflexão do dia: "Consistência supera talento quando talento não é consistente" 💭',
    thumbnail_url: null,
    permalink: 'https://instagram.com/p/CxPQR901',
    posted_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    reach: 9500,
    likes: 890,
    comments: 67,
    shares: 45,
    saves: 123,
    engagement_rate: 11.8,
    virality_rate: 0.47,
    ai_objective: 'connection',
    ai_objective_confidence: 82,
    is_trending: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'post-8',
    profile_id: 'mock-profile-1',
    instagram_id: 'CxSTU234',
    post_type: 'reels',
    caption: 'POV: Você descobriu o algoritmo do Instagram em 2025 📲',
    thumbnail_url: null,
    permalink: 'https://instagram.com/p/CxSTU234',
    posted_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    reach: 38000,
    likes: 2800,
    comments: 389,
    shares: 720,
    saves: 950,
    engagement_rate: 12.8,
    virality_rate: 1.89,
    ai_objective: 'growth',
    ai_objective_confidence: 94,
    is_trending: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'post-9',
    profile_id: 'mock-profile-2',
    instagram_id: 'CyAAA111',
    post_type: 'reels',
    caption: 'Tutorial: Como criar Reels virais em menos de 10 minutos! 🎬',
    thumbnail_url: null,
    permalink: 'https://instagram.com/p/CyAAA111',
    posted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    reach: 32000,
    likes: 2400,
    comments: 345,
    shares: 560,
    saves: 780,
    engagement_rate: 12.8,
    virality_rate: 1.75,
    ai_objective: 'growth',
    ai_objective_confidence: 90,
    is_trending: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

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
    mutationFn: async (data: { username: string; accessToken: string }) => {
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

      // Store credentials
      const { error: credError } = await supabase
        .from('instagram_credentials')
        .insert({
          profile_id: profile.id,
          access_token: data.accessToken,
        });

      if (credError) throw credError;

      return profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-profiles'] });
      toast.success('Perfil conectado com sucesso!');
      setUseMockData(false);
    },
    onError: (error) => {
      toast.error('Erro ao conectar perfil: ' + error.message);
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
