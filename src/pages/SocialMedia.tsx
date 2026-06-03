import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, LayoutDashboard, Instagram, Music2, Youtube, CalendarDays } from 'lucide-react';
import { SocialMediaTab } from '@/components/marketing/SocialMediaTab';
import { SocialMediaDashboard } from '@/components/marketing/SocialMediaDashboard';
import { TikTokTab } from '@/components/marketing/TikTokTab';
import { TikTokDashboard } from '@/components/marketing/TikTokDashboard';
import { YouTubeTab } from '@/components/marketing/YouTubeTab';
import { YouTubeDashboard } from '@/components/marketing/YouTubeDashboard';
import { ContentCalendarView } from '@/components/marketing/ContentCalendarView';

export default function SocialMedia() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPlatform = searchParams.get('platform') as 'instagram' | 'tiktok' | 'youtube' | 'calendar' | null;
  const urlPostId = searchParams.get('postId');

  const [platform, setPlatform] = useState<'instagram' | 'tiktok' | 'youtube' | 'calendar'>(urlPlatform || 'instagram');
  const [activeTab, setActiveTab] = useState('profiles');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  useEffect(() => {
    if (urlPlatform && urlPlatform !== platform) {
      setPlatform(urlPlatform);
    }
  }, [urlPlatform]);

  const handlePostOpened = () => {
    if (urlPostId) {
      searchParams.delete('postId');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const platformLabels = {
    instagram: 'Gerencie e analise seus perfis do Instagram',
    tiktok: 'Gerencie e analise seus perfis do TikTok',
    youtube: 'Gerencie e analise seus canais do YouTube',
    calendar: 'Visualize os posts publicados nas redes sociais',
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Social Media</h1>
        <p className="text-muted-foreground">{platformLabels[platform]}</p>
      </div>

      <Tabs value={platform} onValueChange={(v) => setPlatform(v as typeof platform)} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="instagram" className="gap-2">
            <Instagram className="h-4 w-4" />
            Instagram
          </TabsTrigger>
          <TabsTrigger value="tiktok" className="gap-2">
            <Music2 className="h-4 w-4" />
            TikTok
          </TabsTrigger>
          <TabsTrigger value="youtube" className="gap-2">
            <Youtube className="h-4 w-4" />
            YouTube
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendário
          </TabsTrigger>
        </TabsList>

        {/* Instagram Content */}
        <TabsContent value="instagram" className="mt-0 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="profiles" className="gap-2"><Users className="h-4 w-4" />Perfis</TabsTrigger>
              <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="h-4 w-4" />Dashboard</TabsTrigger>
            </TabsList>
            <TabsContent value="profiles" className="mt-0">
              <SocialMediaTab initialPostId={platform === 'instagram' ? urlPostId : null} onPostOpened={handlePostOpened} />
            </TabsContent>
            <TabsContent value="dashboard" className="mt-0"><SocialMediaDashboard /></TabsContent>
          </Tabs>
        </TabsContent>

        {/* TikTok Content */}
        <TabsContent value="tiktok" className="mt-0 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="profiles" className="gap-2"><Users className="h-4 w-4" />Perfis</TabsTrigger>
              <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="h-4 w-4" />Dashboard</TabsTrigger>
            </TabsList>
            <TabsContent value="profiles" className="mt-0">
              <TikTokTab initialPostId={platform === 'tiktok' ? urlPostId : null} onPostOpened={handlePostOpened} />
            </TabsContent>
            <TabsContent value="dashboard" className="mt-0"><TikTokDashboard /></TabsContent>
          </Tabs>
        </TabsContent>

        {/* YouTube Content */}
        <TabsContent value="youtube" className="mt-0 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="profiles" className="gap-2"><Users className="h-4 w-4" />Canais</TabsTrigger>
              <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="h-4 w-4" />Dashboard</TabsTrigger>
            </TabsList>
            <TabsContent value="profiles" className="mt-0">
              <YouTubeTab initialPostId={platform === 'youtube' ? urlPostId : null} onPostOpened={handlePostOpened} />
            </TabsContent>
            <TabsContent value="dashboard" className="mt-0"><YouTubeDashboard /></TabsContent>
          </Tabs>
        </TabsContent>

        {/* Content Calendar */}
        <TabsContent value="calendar" className="mt-0">
          <ContentCalendarView currentMonth={calendarMonth} onMonthChange={setCalendarMonth} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
