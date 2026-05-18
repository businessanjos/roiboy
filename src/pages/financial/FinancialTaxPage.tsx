import { useState } from "react";
import { Scale, Sparkles, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useFinancialCompany } from "@/contexts/FinancialCompanyContext";
import { FinancialPageHeader } from "@/components/financial/_shared/FinancialPageHeader";
import { FinancialEmptyState } from "@/components/financial/_shared/FinancialEmptyState";
import { TaxOverviewTab } from "@/components/financial/tax/TaxOverviewTab";
import { TaxRegimeForm } from "@/components/financial/tax/TaxRegimeForm";
import { AccountantTab } from "@/components/financial/tax/AccountantTab";
import { TaxAlertsTab } from "@/components/financial/tax/TaxAlertsTab";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

export default function FinancialTaxPage() {
  const { selected, loading } = useFinancialCompany();
  const [tab, setTab] = useState("overview");
  const [analyzing, setAnalyzing] = useState(false);
  const qc = useQueryClient();

  const runAnalysis = async () => {
    if (!selected) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("financial-tax-ai-analyze", {
        body: { omie_settings_id: selected.id },
      });
      if (error) throw error;
      const created = (data as any)?.alerts_created ?? 0;
      toast({
        title: "Análise concluída",
        description: created
          ? `${created} alerta(s) gerado(s) pela IA.`
          : "Nenhum alerta novo desta vez.",
      });
      qc.invalidateQueries({ queryKey: ["tax-alerts", selected.id] });
      qc.invalidateQueries({ queryKey: ["tax-ai-runs", selected.id] });
      setTab("alerts");
    } catch (e: any) {
      toast({
        title: "Falha na análise",
        description: e?.message ?? "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <FinancialPageHeader
        icon={Scale}
        title="Tributário & Contador"
        description="Regime, CNAEs, contador da empresa e recomendações de IA sobre a saúde fiscal."
        actions={
          selected ? (
            <Button onClick={runAnalysis} disabled={analyzing} size="sm">
              {analyzing ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1.5" />
              )}
              Rodar análise de IA
            </Button>
          ) : null
        }
      />

      {!loading && !selected ? (
        <FinancialEmptyState
          icon={Scale}
          title="Selecione uma empresa"
          description="Use o seletor de empresa no topo para configurar o perfil tributário."
        />
      ) : selected ? (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="regime">Regime & Empresa</TabsTrigger>
            <TabsTrigger value="accountant">Contador</TabsTrigger>
            <TabsTrigger value="alerts">Alertas & IA</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <TaxOverviewTab omieSettingsId={selected.id} onGoToAlerts={() => setTab("alerts")} />
          </TabsContent>
          <TabsContent value="regime">
            <TaxRegimeForm omieSettingsId={selected.id} />
          </TabsContent>
          <TabsContent value="accountant">
            <AccountantTab omieSettingsId={selected.id} />
          </TabsContent>
          <TabsContent value="alerts">
            <TaxAlertsTab
              omieSettingsId={selected.id}
              onRunAnalysis={runAnalysis}
              analyzing={analyzing}
            />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
