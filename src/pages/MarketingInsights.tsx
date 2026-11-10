import MarketingInsightsTab from '@/components/marketing/MarketingInsightsTab';

export default function MarketingInsights() {
  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">Insights Marketing</h1>
        <p className="text-muted-foreground">Painéis e análises de marketing</p>
      </div>
      <MarketingInsightsTab />
    </div>
  );
}
