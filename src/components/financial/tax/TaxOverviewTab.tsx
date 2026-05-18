import { useQuery } from "@tanstack/react-query";
import { Scale, Calendar, Users, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FinancialKpiCard } from "@/components/financial/_shared/FinancialKpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRLCompact } from "@/lib/financial-format";

const REGIME_LABEL: Record<string, string> = {
  mei: "MEI",
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
};

const REGIME_CEILING: Record<string, number> = {
  mei: 81_000,
  simples_nacional: 4_800_000,
};

export function TaxOverviewTab({
  omieSettingsId,
  onGoToAlerts,
}: {
  omieSettingsId: string;
  onGoToAlerts: () => void;
}) {
  const { data: profile } = useQuery({
    queryKey: ["tax-profile", omieSettingsId],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_tax_profile")
        .select("regime, simples_annex, opcao_regime_em")
        .eq("omie_settings_id", omieSettingsId)
        .maybeSingle();
      return data;
    },
  });

  const { data: openAlerts } = useQuery({
    queryKey: ["tax-alerts-count", omieSettingsId],
    queryFn: async () => {
      const { count } = await supabase
        .from("financial_tax_alerts")
        .select("id", { count: "exact", head: true })
        .eq("omie_settings_id", omieSettingsId)
        .eq("status", "open");
      return count ?? 0;
    },
  });

  const { data: lastRun } = useQuery({
    queryKey: ["tax-ai-runs", omieSettingsId],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_tax_ai_runs")
        .select("created_at, model, alerts_created")
        .eq("omie_settings_id", omieSettingsId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const ceiling = profile?.regime ? REGIME_CEILING[profile.regime] : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FinancialKpiCard
          icon={Scale}
          label="Regime atual"
          value={profile?.regime ? REGIME_LABEL[profile.regime] : "—"}
          hint={profile?.simples_annex ? `Anexo ${profile.simples_annex}` : "Configure em Regime & Empresa"}
          tone="info"
        />
        <FinancialKpiCard
          icon={Calendar}
          label="Teto do regime"
          value={ceiling ? formatBRLCompact(ceiling) : "—"}
          hint={ceiling ? "Limite anual de faturamento" : "Não aplicável"}
        />
        <FinancialKpiCard
          icon={AlertCircle}
          label="Alertas abertos"
          value={openAlerts ?? 0}
          hint="Ver lista completa"
          tone={openAlerts && openAlerts > 0 ? "warning" : "default"}
          onClick={onGoToAlerts}
        />
        <FinancialKpiCard
          icon={Users}
          label="Última análise IA"
          value={lastRun ? new Date(lastRun.created_at).toLocaleDateString("pt-BR") : "—"}
          hint={lastRun ? `${lastRun.alerts_created} alerta(s) gerados` : "Rode a primeira análise"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximas obrigações</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Em breve: DAS, DCTF, ECF e demais obrigações acessórias acompanhadas automaticamente. Por ora, registre observações em <em>Contador</em>.
        </CardContent>
      </Card>
    </div>
  );
}
