import MarketingInsightsTab from '@/components/marketing/MarketingInsightsTab';
import { InsightsChannelOverview } from '@/components/marketing/InsightsChannelOverview';

export default function MarketingInsights() {
  return (
    <div className="container mx-auto space-y-8 py-6">
      <div>
        <h1 className="text-2xl font-bold">Insights Marketing</h1>
        <p className="text-muted-foreground">Canais, perfis do Instagram e painéis de marketing</p>
      </div>
      <InsightsChannelOverview />
      <div className="space-y-3 border-t pt-6">
        <h2 className="text-lg font-semibold">Painéis personalizados</h2>
        <MarketingInsightsTab />
      </div>
    </div>
  );
}
