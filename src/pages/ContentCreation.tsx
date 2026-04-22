import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Bot, Target, Lightbulb, CalendarRange, Flame, Zap, ImageIcon, Wand2, Sun } from 'lucide-react';
import { ContentProfileProvider } from '@/contexts/ContentProfileContext';
import { ProfileSelector } from '@/components/marketing/ProfileSelector';
import { DailyContentPanel } from '@/components/marketing/DailyContentPanel';
import { CopilotTab } from '@/components/marketing/copilot/CopilotTab';
import { MarketingPersonaTab } from '@/components/marketing/persona/MarketingPersonaTab';
import { MarketingIdeasTab } from '@/components/marketing/ideas/MarketingIdeasTab';
import { EditorialCalendarTab } from '@/components/marketing/calendar/EditorialCalendarTab';
import { TrendsRadarTab } from '@/components/marketing/trends/TrendsRadarTab';
import { HooksTab } from '@/components/marketing/hooks/HooksTab';
import { CopyStudioTab } from '@/components/marketing/copy/CopyStudioTab';
import { MarketingReferencesTab } from '@/components/marketing/references/MarketingReferencesTab';
import { BrandVoiceTab } from '@/components/marketing/brand/BrandVoiceTab';

export default function ContentCreation() {
  const [activeTab, setActiveTab] = useState('today');

  return (
    <ContentProfileProvider>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Criação
            </h1>
            <p className="text-muted-foreground">
              O que postar hoje? Trends, ideias, hooks e copy IA num só lugar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Perfil ativo:</span>
            <ProfileSelector />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="today" className="gap-2"><Sun className="h-4 w-4" />Hoje</TabsTrigger>
            <TabsTrigger value="copilot" className="gap-2"><Bot className="h-4 w-4" />Copilot</TabsTrigger>
            <TabsTrigger value="persona" className="gap-2"><Target className="h-4 w-4" />Persona</TabsTrigger>
            <TabsTrigger value="ideas" className="gap-2"><Lightbulb className="h-4 w-4" />Ideias</TabsTrigger>
            <TabsTrigger value="editorial" className="gap-2"><CalendarRange className="h-4 w-4" />Editorial</TabsTrigger>
            <TabsTrigger value="trends" className="gap-2"><Flame className="h-4 w-4" />Trends</TabsTrigger>
            <TabsTrigger value="hooks" className="gap-2"><Zap className="h-4 w-4" />Hooks</TabsTrigger>
            <TabsTrigger value="copy" className="gap-2"><Sparkles className="h-4 w-4" />Copy IA</TabsTrigger>
            <TabsTrigger value="references" className="gap-2"><ImageIcon className="h-4 w-4" />Referências</TabsTrigger>
            <TabsTrigger value="brand" className="gap-2"><Wand2 className="h-4 w-4" />Tom de Voz</TabsTrigger>
          </TabsList>

          <TabsContent value="today"><DailyContentPanel /></TabsContent>
          <TabsContent value="copilot"><CopilotTab /></TabsContent>
          <TabsContent value="persona"><MarketingPersonaTab /></TabsContent>
          <TabsContent value="ideas"><MarketingIdeasTab /></TabsContent>
          <TabsContent value="editorial"><EditorialCalendarTab /></TabsContent>
          <TabsContent value="trends"><TrendsRadarTab /></TabsContent>
          <TabsContent value="hooks"><HooksTab /></TabsContent>
          <TabsContent value="copy"><CopyStudioTab /></TabsContent>
          <TabsContent value="references"><MarketingReferencesTab /></TabsContent>
          <TabsContent value="brand"><BrandVoiceTab /></TabsContent>
        </Tabs>
      </div>
    </ContentProfileProvider>
  );
}
