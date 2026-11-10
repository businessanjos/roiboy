import { InsightsChannelOverview } from '@/components/marketing/InsightsChannelOverview';
import MarketingInsightsTab from '@/components/marketing/MarketingInsightsTab';

export default function MarketingInsights() {
  return (
    <div className="container mx-auto space-y-8 py-6">
      <div>
        <h1 className="text-2xl font-bold">Insights Marketing</h1>
        <p className="text-muted-foreground">Canais, perfis, painéis e análises de marketing</p>
      </div>
      <InsightsChannelOverview />
      <section className="space-y-4 border-t pt-6">
        <div>
          <h2 className="text-lg font-semibold">Painéis personalizados</h2>
          <p className="text-sm text-muted-foreground">Suas análises e visualizações salvas</p>
        </div>
        <MarketingInsightsTab />
      </section>
    </div>
  );
}
