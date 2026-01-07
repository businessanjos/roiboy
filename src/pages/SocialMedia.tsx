import { SocialMediaTab } from '@/components/marketing/SocialMediaTab';

export default function SocialMedia() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Social Media</h1>
        <p className="text-muted-foreground">Gerencie e analise seus perfis do Instagram</p>
      </div>
      
      <SocialMediaTab />
    </div>
  );
}
