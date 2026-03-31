import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';

export interface YouTubeChannel {
  id: string;
  account_id: string;
  channel_id: string | null;
  username: string;
  display_name: string | null;
  profile_picture_url: string | null;
  subscribers_count: number;
  subscribers_previous_count: number;
  videos_count: number;
  total_views: number;
  bio: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface YouTubeVideo {
  id: string;
  account_id: string;
  channel_id: string;
  youtube_id: string | null;
  video_url: string | null;
  title: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  posted_at: string | null;
  duration_seconds: number | null;
  video_type: string;
  views: number;
  likes: number;
  dislikes: number;
  comments: number;
  shares: number;
  saves: number;
  avg_watch_time: number | null;
  completion_rate: number | null;
  engagement_rate: number | null;
  followers_gained: number;
  is_viral: boolean;
  hashtags: string[] | null;
  ai_objective: 'growth' | 'connection' | 'authority' | 'sales' | null;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface YouTubeKPIs {
  totalSubscribers: number;
  subscribersGrowth: number;
  avgEngagement: number;
  totalViews: number;
  aiInsight: string;
}

export interface YouTubeVideoFormData {
  video_url?: string;
  title?: string;
  caption?: string;
  thumbnail_url?: string;
  posted_at?: Date;
  duration_seconds?: number;
  video_type?: string;
  views?: number;
  likes?: number;
  dislikes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  avg_watch_time?: number;
  completion_rate?: number;
  followers_gained?: number;
  is_viral?: boolean;
  hashtags?: string[];
  ai_objective?: 'growth' | 'connection' | 'authority' | 'sales';
  category?: string;
  notes?: string;
}

const MOCK_CHANNELS: YouTubeChannel[] = [
  {
    id: 'mock-yt-1',
    account_id: 'mock-account',
    channel_id: null,
    username: 'exemplo_youtube',
    display_name: 'Exemplo YouTube',
    profile_picture_url: null,
    subscribers_count: 25000,
    subscribers_previous_count: 23500,
    videos_count: 120,
    total_views: 1500000,
    bio: 'Canal de exemplo para YouTube',
    is_active: true,
    last_synced_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const MOCK_VIDEOS: YouTubeVideo[] = [
  {
    id: 'mock-yt-video-1',
    account_id: 'mock-account',
    channel_id: 'mock-yt-1',
    youtube_id: null,
    video_url: 'https://youtube.com/watch?v=example',
    title: 'Vídeo de exemplo #trending',
    caption: 'Descrição do vídeo de exemplo',
    thumbnail_url: null,
    posted_at: new Date().toISOString(),
    duration_seconds: 600,
    video_type: 'video',
    views: 85000,
    likes: 4200,
    dislikes: 50,
    comments: 320,
    shares: 180,
    saves: 420,
    avg_watch_time: 240,
    completion_rate: 40,
    engagement_rate: 5.5,
    followers_gained: 350,
    is_viral: false,
    hashtags: ['trending', 'tutorial'],
    ai_objective: 'growth',
    category: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function useYouTubeData() {
  const { currentUser: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(true);

  const { data: channels = [], isLoading: isLoadingChannels } = useQuery({
    queryKey: ['youtube-channels', user?.account_id],
    queryFn: async () => {
      if (!user?.account_id) return [];
      const { data, error } = await supabase
        .from('youtube_channels')
        .select('*')
        .eq('account_id', user.account_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) {
        setUseMockData(true);
        return MOCK_CHANNELS;
      }
      setUseMockData(false);
      return data as YouTubeChannel[];
    },
    enabled: !!user?.account_id,
  });

  const currentChannel = useMemo(() => {
    if (selectedChannelId) {
      return channels.find(c => c.id === selectedChannelId) || channels[0];
    }
    return channels[0];
  }, [channels, selectedChannelId]);

  const { data: videos = [], isLoading: isLoadingVideos } = useQuery({
    queryKey: ['youtube-videos', currentChannel?.id, useMockData],
    queryFn: async () => {
      if (!currentChannel) return [];
      if (useMockData) {
        return MOCK_VIDEOS.filter(v => v.channel_id === currentChannel.id);
      }
      const { data, error } = await supabase
        .from('youtube_videos')
        .select('*')
        .eq('channel_id', currentChannel.id)
        .order('posted_at', { ascending: false });
      if (error) throw error;
      return (data || []) as YouTubeVideo[];
    },
    enabled: !!currentChannel?.id,
  });

  const kpis = useMemo<YouTubeKPIs>(() => {
    if (!currentChannel) {
      return { totalSubscribers: 0, subscribersGrowth: 0, avgEngagement: 0, totalViews: 0, aiInsight: 'Conecte um canal do YouTube para ver insights.' };
    }
    const totalSubscribers = currentChannel.subscribers_count || 0;
    const previous = currentChannel.subscribers_previous_count || totalSubscribers;
    const subscribersGrowth = previous > 0 ? ((totalSubscribers - previous) / previous) * 100 : 0;
    const totalEngagement = videos.reduce((sum, v) => sum + (v.likes || 0) + (v.comments || 0) + (v.shares || 0) + (v.saves || 0), 0);
    const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
    const avgEngagement = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

    let aiInsight = 'Adicione vídeos para receber insights de IA.';
    if (videos.length > 0) {
      const avgCompletion = videos.reduce((sum, v) => sum + (v.completion_rate || 0), 0) / videos.length;
      if (avgCompletion > 50) aiInsight = 'Excelente! Seus vídeos têm boa retenção. Continue com esse formato!';
      else if (avgCompletion > 30) aiInsight = 'Boa retenção! Trabalhe nos primeiros 30 segundos para melhorar.';
      else aiInsight = 'Foque em intros impactantes para aumentar a retenção dos vídeos.';
    }
    return { totalSubscribers, subscribersGrowth: parseFloat(subscribersGrowth.toFixed(1)), avgEngagement: parseFloat(avgEngagement.toFixed(1)), totalViews, aiInsight };
  }, [currentChannel, videos]);

  const createChannel = useMutation({
    mutationFn: async (data: { username: string; subscribers_count?: number; videos_count?: number; total_views?: number; bio?: string }) => {
      if (!user?.account_id) throw new Error('Usuário não autenticado');
      const { data: channel, error } = await supabase
        .from('youtube_channels')
        .insert({ account_id: user.account_id, username: data.username.replace('@', ''), display_name: data.username, subscribers_count: data.subscribers_count || 0, videos_count: data.videos_count || 0, total_views: data.total_views || 0, bio: data.bio })
        .select()
        .single();
      if (error) throw error;
      return channel;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['youtube-channels'] }); toast.success('Canal do YouTube conectado!'); },
    onError: (error) => { toast.error('Erro ao conectar canal: ' + error.message); },
  });

  const createVideo = useMutation({
    mutationFn: async (data: YouTubeVideoFormData) => {
      if (!user?.account_id || !currentChannel) throw new Error('Canal não selecionado');
      const engagementRate = data.views && data.views > 0 ? (((data.likes || 0) + (data.comments || 0) + (data.shares || 0) + (data.saves || 0)) / data.views) * 100 : 0;
      const { data: video, error } = await supabase
        .from('youtube_videos')
        .insert({
          account_id: user.account_id, channel_id: currentChannel.id,
          video_url: data.video_url, title: data.title, caption: data.caption, thumbnail_url: data.thumbnail_url,
          posted_at: data.posted_at?.toISOString(), duration_seconds: data.duration_seconds,
          video_type: data.video_type || 'video',
          views: data.views || 0, likes: data.likes || 0, dislikes: data.dislikes || 0,
          comments: data.comments || 0, shares: data.shares || 0, saves: data.saves || 0,
          avg_watch_time: data.avg_watch_time, completion_rate: data.completion_rate,
          engagement_rate: engagementRate, followers_gained: data.followers_gained || 0,
          is_viral: data.is_viral || false, hashtags: data.hashtags,
          ai_objective: data.ai_objective, category: data.category, notes: data.notes,
        })
        .select().single();
      if (error) throw error;
      return video;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['youtube-videos'] }); toast.success('Vídeo adicionado com sucesso!'); },
    onError: (error) => { toast.error('Erro ao adicionar vídeo: ' + error.message); },
  });

  const updateVideo = useMutation({
    mutationFn: async ({ videoId, data }: { videoId: string; data: Partial<YouTubeVideoFormData> }) => {
      const updateData: Record<string, unknown> = {};
      if (data.video_url !== undefined) updateData.video_url = data.video_url;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.caption !== undefined) updateData.caption = data.caption;
      if (data.thumbnail_url !== undefined) updateData.thumbnail_url = data.thumbnail_url;
      if (data.posted_at !== undefined) updateData.posted_at = data.posted_at.toISOString();
      if (data.duration_seconds !== undefined) updateData.duration_seconds = data.duration_seconds;
      if (data.video_type !== undefined) updateData.video_type = data.video_type;
      if (data.views !== undefined) updateData.views = data.views;
      if (data.likes !== undefined) updateData.likes = data.likes;
      if (data.dislikes !== undefined) updateData.dislikes = data.dislikes;
      if (data.comments !== undefined) updateData.comments = data.comments;
      if (data.shares !== undefined) updateData.shares = data.shares;
      if (data.saves !== undefined) updateData.saves = data.saves;
      if (data.avg_watch_time !== undefined) updateData.avg_watch_time = data.avg_watch_time;
      if (data.completion_rate !== undefined) updateData.completion_rate = data.completion_rate;
      if (data.followers_gained !== undefined) updateData.followers_gained = data.followers_gained;
      if (data.is_viral !== undefined) updateData.is_viral = data.is_viral;
      if (data.hashtags !== undefined) updateData.hashtags = data.hashtags;
      if (data.ai_objective !== undefined) updateData.ai_objective = data.ai_objective;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.views && data.views > 0) {
        updateData.engagement_rate = (((data.likes || 0) + (data.comments || 0) + (data.shares || 0) + (data.saves || 0)) / data.views) * 100;
      }
      const { error } = await supabase.from('youtube_videos').update(updateData).eq('id', videoId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['youtube-videos'] }); toast.success('Vídeo atualizado!'); },
    onError: (error) => { toast.error('Erro ao atualizar: ' + error.message); },
  });

  const deleteVideo = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase.from('youtube_videos').delete().eq('id', videoId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['youtube-videos'] }); toast.success('Vídeo excluído!'); },
    onError: (error) => { toast.error('Erro ao excluir: ' + error.message); },
  });

  const updateChannelPicture = useMutation({
    mutationFn: async ({ channelId, avatarUrl }: { channelId: string; avatarUrl: string | null }) => {
      const { error } = await supabase.from('youtube_channels').update({ profile_picture_url: avatarUrl }).eq('id', channelId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['youtube-channels'] }); toast.success('Foto atualizada!'); },
    onError: (error) => { toast.error('Erro ao atualizar foto: ' + error.message); },
  });

  const refetchData = () => {
    queryClient.invalidateQueries({ queryKey: ['youtube-channels'] });
    queryClient.invalidateQueries({ queryKey: ['youtube-videos'] });
  };

  return {
    channels, currentChannel, videos, kpis,
    isLoading: isLoadingChannels || isLoadingVideos,
    useMockData, selectedChannelId, setSelectedChannelId,
    createChannel, createVideo, updateVideo, deleteVideo,
    refetchData, updateChannelPicture,
  };
}
