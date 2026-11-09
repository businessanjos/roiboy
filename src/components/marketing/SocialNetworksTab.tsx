import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, LayoutDashboard, Instagram, Music2, Youtube } from 'lucide-react';
import { SocialMediaTab } from '@/components/marketing/SocialMediaTab';
import { SocialMediaDashboard } from '@/components/marketing/SocialMediaDashboard';
import { TikTokTab } from '@/components/marketing/TikTokTab';
import { TikTokDashboard } from '@/components/marketing/TikTokDashboard';
import { YouTubeTab } from '@/components/marketing/YouTubeTab';
import { YouTubeDashboard } from '@/components/marketing/YouTubeDashboard';

type Platform = 'instagram' | 'tiktok' | 'youtube';

const PLATFORM_DESCRIPTIONS: Record<Platform, string> = {
  instagram: 'Gerencie e analise seus perfis do Instagram',
  tiktok: 'Gerencie e analise seus perfis do TikTok',
  youtube: 'Gerencie e analise seus canais do YouTube',
};

/** Rótulo da primeira aba interna de cada rede (perfis x canais). */
const SECTION_LABELS: Record<Platform, string> = {
  instagram: 'Perfis',
  tiktok: 'Perfis',
  youtube: 'Canais',
};

/**
 * Abas de redes sociais (Instagram / TikTok / YouTube) usadas dentro do hub de Conteúdo.
 * A rede ativa é sincronizada em `?platform=` para manter os links antigos de /social-media.
 * A rede e a seção interna (perfis/canais x dashboard) dividem a mesma linha do topo,
 * para não empilhar duas barras de pílulas uma abaixo da outra.
 */
export function SocialNetworksTab() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPlatform = searchParams.get('platform') as Platform | null;
  const urlPostId = searchParams.get('postId');

  const [platform, setPlatform] = useState<Platform>(
    urlPlatform && urlPlatform in PLATFORM_DESCRIPTIONS ? urlPlatform : 'instagram'
  );
  const [activeTab, setActiveTab] = useState('profiles');

  useEffect(() => {
    if (urlPlatform && urlPlatform in PLATFORM_DESCRIPTIONS && urlPlatform !== platform) {
      setPlatform(urlPlatform);
    }
  }, [urlPlatform]);

  const handlePlatformChange = (value: string) => {
    setPlatform(value as Platform);
    const next = new URLSearchParams(searchParams);
    next.set('platform', value);
    setSearchParams(next, { replace: true });
  };

  const handlePostOpened = () => {
    if (urlPostId) {
      const next = new URLSearchParams(searchParams);
      next.delete('postId');
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Redes sociais</h1>
        <p className="text-muted-foreground">{PLATFORM_DESCRIPTIONS[platform]}</p>
      </div>

      <Tabs value={platform} onValueChange={handlePlatformChange} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="bg-muted/50 h-auto">
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
          </TabsList>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-muted/50 h-auto">
              <TabsTrigger value="profiles" className="gap-2">
                <Users className="h-4 w-4" />
                {SECTION_LABELS[platform]}
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <TabsContent value="instagram" className="mt-0">
          {activeTab === 'profiles' ? (
            <SocialMediaTab initialPostId={platform === 'instagram' ? urlPostId : null} onPostOpened={handlePostOpened} />
          ) : (
            <SocialMediaDashboard />
          )}
        </TabsContent>

        <TabsContent value="tiktok" className="mt-0">
          {activeTab === 'profiles' ? (
            <TikTokTab initialPostId={platform === 'tiktok' ? urlPostId : null} onPostOpened={handlePostOpened} />
          ) : (
            <TikTokDashboard />
          )}
        </TabsContent>

        <TabsContent value="youtube" className="mt-0">
          {activeTab === 'profiles' ? (
            <YouTubeTab initialPostId={platform === 'youtube' ? urlPostId : null} onPostOpened={handlePostOpened} />
          ) : (
            <YouTubeDashboard />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SocialNetworksTab;
