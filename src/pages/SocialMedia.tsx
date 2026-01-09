import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, LayoutDashboard } from 'lucide-react';
import { SocialMediaTab } from '@/components/marketing/SocialMediaTab';
import { SocialMediaDashboard } from '@/components/marketing/SocialMediaDashboard';

export default function SocialMedia() {
  const [activeTab, setActiveTab] = useState('profiles');

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Social Media</h1>
        <p className="text-muted-foreground">Gerencie e analise seus perfis do Instagram</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="profiles" className="gap-2">
            <Users className="h-4 w-4" />
            Perfis
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="mt-0">
          <SocialMediaTab />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-0">
          <SocialMediaDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
