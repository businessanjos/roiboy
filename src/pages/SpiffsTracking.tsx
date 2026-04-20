import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Zap, Sparkles } from "lucide-react";
import { useQuotasIncentives } from "@/hooks/useQuotasIncentives";
import { RouletteSpinsPanel, CustomSpinsPanel } from "@/components/sales/quotas/SpiffsSection";
import { PaymentMethodSpiffPanel } from "@/components/sales/quotas/PaymentMethodSpiffPanel";

const isExpired = (endDate: string) => new Date(endDate) < new Date();

export default function SpiffsTracking() {
  const now = new Date();
  const { spiffs, isLoading } = useQuotasIncentives(now.getFullYear(), now.getMonth() + 1);
  const [tab, setTab] = useState<"active" | "all">("active");

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
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Zap className="h-6 w-6 text-amber-500" />
              Acompanhamento de SPIFFs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhe em tempo real o progresso das campanhas de incentivo dos closers.
            </p>
          </div>
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
      </div>
    </TooltipProvider>
  );
}
