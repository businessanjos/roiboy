import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Zap, Sparkles, History } from "lucide-react";
import { useQuotasIncentives } from "@/hooks/useQuotasIncentives";
import { RouletteSpinsPanel, CustomSpinsPanel } from "@/components/sales/quotas/SpiffsSection";
import { PaymentMethodSpiffPanel } from "@/components/sales/quotas/PaymentMethodSpiffPanel";
import { SpiffSpinsHistory } from "@/components/sales/quotas/SpiffSpinsHistory";
import { SpiffSpinsCompactMonth } from "@/components/sales/quotas/SpiffSpinsCompactMonth";

const isExpired = (endDate: string) => new Date(endDate) < new Date();

export default function SpiffsTracking() {
  const now = new Date();
  const { spiffs } = useQuotasIncentives(now.getFullYear(), now.getMonth() + 1);
  const isLoading = false;
  const [tab, setTab] = useState<"active" | "all">("active");
  const [view, setView] = useState<"tracking" | "history">("tracking");

  const visibleSpiffs = (spiffs ?? []).filter((s) =>
    tab === "active" ? s.is_active && !isExpired(s.end_date) : true
  );

  const rouletteSpiffs = visibleSpiffs.filter((s: any) => s.prize_type === "roulette");
  const customSpiffs = visibleSpiffs.filter((s: any) => s.prize_type === "custom");
  const paymentSpiffs = visibleSpiffs.filter((s: any) => s.prize_type === "payment_method");

  const total = rouletteSpiffs.length + customSpiffs.length + paymentSpiffs.length;

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            Acompanhamento de SPIFFs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe em tempo real o progresso das campanhas e o histórico de prêmios sorteados.
          </p>
        </div>

          <Tabs value={view} onValueChange={(v) => setView(v as "tracking" | "history")} className="space-y-4">
            <TabsList>
              <TabsTrigger value="tracking" className="gap-1.5">
                <Zap className="h-4 w-4" />
                Acompanhamento
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5">
                <History className="h-4 w-4" />
                Histórico de Roletas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tracking" className="space-y-4">
              <div className="flex justify-end">
                <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "all")}>
                  <TabsList>
                    <TabsTrigger value="active" className="gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Ativos
                    </TabsTrigger>
                    <TabsTrigger value="all">Todos</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : total === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Nenhum SPIFF para exibir</CardTitle>
                    <CardDescription>
                      {tab === "active"
                        ? "Nenhuma campanha SPIFF ativa no momento. Crie uma em Gestão → Metas & Incentivos."
                        : "Nenhum SPIFF cadastrado ainda."}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="space-y-4">
                  {rouletteSpiffs.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          Cash Collect — Roleta por Captação
                        </h2>
                        <Badge variant="outline" className="text-[10px]">{rouletteSpiffs.length}</Badge>
                      </div>
                      {rouletteSpiffs.map((spiff: any) => (
                        <RouletteSpinsPanel key={spiff.id} spiff={spiff} />
                      ))}
                    </section>
                  )}

                  {customSpiffs.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          Roleta Custom — Vendas em Janela
                        </h2>
                        <Badge variant="outline" className="text-[10px]">{customSpiffs.length}</Badge>
                      </div>
                      {customSpiffs.map((spiff: any) => (
                        <CustomSpinsPanel key={spiff.id} spiff={spiff} />
                      ))}
                    </section>
                  )}

                  {paymentSpiffs.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          SPIFF Forma de Pagamento
                        </h2>
                        <Badge variant="outline" className="text-[10px]">{paymentSpiffs.length}</Badge>
                      </div>
                      {paymentSpiffs.map((spiff: any) => (
                        <PaymentMethodSpiffPanel key={spiff.id} spiff={spiff as any} />
                      ))}
                    </section>
                  )}
                </div>
              )}

              <SpiffSpinsCompactMonth />
            </TabsContent>

            <TabsContent value="history">
              <SpiffSpinsHistory />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}
