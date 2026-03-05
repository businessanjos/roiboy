import MarketingInsightsTab from '@/components/marketing/MarketingInsightsTab';

export default function MarketingInsights() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Insights Marketing</h1>
        <p className="text-muted-foreground">Painéis e visuais de marketing</p>
      </div>
      <MarketingInsightsTab />
    </div>
  );
}
