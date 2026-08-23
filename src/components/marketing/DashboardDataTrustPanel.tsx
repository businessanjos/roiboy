import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, Info } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MarketingDashboardMetrics } from "@/hooks/useMarketingDashboardMetrics";

interface Props {
  data: MarketingDashboardMetrics;
}

/**
 * Painel de confiabilidade: mostra de onde vem cada número e o que pode
 * distorcer a leitura, para que decisões sejam tomadas com contexto.
 */
export function DashboardDataTrustPanel({ data }: Props) {
  const q = data.dataQuality;
  const totalLeads = data.leadsThisMonth || 0;
  const pct = (n: number) => (totalLeads > 0 ? Math.round((n / totalLeads) * 100) : 0);

  const issues: { level: "warn" | "info"; text: string }[] = [];

  if (q.leadsWithoutChannel > 0) {
    issues.push({
      level: pct(q.leadsWithoutChannel) >= 20 ? "warn" : "info",
      text: `${q.leadsWithoutChannel} leads (${pct(q.leadsWithoutChannel)}%) sem canal de origem preenchido — a distribuição por canal está subestimada.`,
    });
  }
  if (q.leadsWithoutMqlAnswer > 0) {
    issues.push({
      level: pct(q.leadsWithoutMqlAnswer) >= 20 ? "warn" : "info",
      text: `${q.leadsWithoutMqlAnswer} leads (${pct(q.leadsWithoutMqlAnswer)}%) sem qualificação MQL respondida — o volume de MQL é piso, não total.`,
    });
  }
  if (q.mqlUnknownValues.length > 0) {
    issues.push({
      level: "warn",
      text: `Respostas de MQL não reconhecidas pelo cálculo: ${q.mqlUnknownValues.join(", ")}. Padronize as opções do campo.`,
    });
  }
  if (q.deletedExcluded > 0) {
    issues.push({
      level: "info",
      text: `${q.deletedExcluded} negócios excluídos (lixeira) foram removidos da contagem do período.`,
    });
  }
  if (q.adsIsCumulative) {
    issues.push({
      level: "info",
      text: data.adsLastSync
        ? `Investimento e CPL vêm da última sincronização do Meta Ads (${format(new Date(data.adsLastSync), "dd/MM/yyyy HH:mm", { locale: ptBR })}) e são acumulados por campanha — não recortam o período selecionado.`
        : "Nenhuma campanha do Meta Ads sincronizada: investimento, CPL e ROAS ficam zerados.",
    });
  }

  // ===== Alertas de sincronização do Meta Ads =====
  const h = data.adsSyncHealth;
  const fmtDay = (iso: string) => format(new Date(`${iso}T12:00:00`), "dd/MM", { locale: ptBR });

  if (h) {
    if (h.staleHours !== null && h.staleHours >= 24) {
      issues.push({
        level: h.staleHours >= 48 ? "warn" : "info",
        text: `Meta Ads sem sincronizar há ${Math.floor(h.staleHours / 24)} dia(s) (última: ${
          h.lastSync ? format(new Date(h.lastSync), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"
        }). Investimento, CPL, CAC e ROAS podem estar desatualizados.`,
      });
    }
    if (h.lagDays !== null && h.lagDays >= 2) {
      issues.push({
        level: "warn",
        text: `O último dia com dados de anúncios é ${fmtDay(h.lastStatDate!)} — ${h.lagDays} dias de atraso. Os últimos dias do período estão sem investimento contabilizado.`,
      });
    }
    if (!q.adsIsCumulative && h.missingDays > 0) {
      issues.push({
        level: h.expectedDays > 0 && h.missingDays / h.expectedDays >= 0.2 ? "warn" : "info",
        text: `Lacuna na série diária do Meta Ads: ${h.missingDays} de ${h.expectedDays} dias do período sem snapshot${
          h.missingDayLabels.length > 0 ? ` (ex.: ${h.missingDayLabels.map(fmtDay).join(", ")})` : ""
        }. Rode "Sincronizar" em Tráfego Pago para completar o histórico.`,
      });
    }
  }



  const warnCount = issues.filter((i) => i.level === "warn").length;

  return (
    <Card className={warnCount > 0 ? "border-warning/40" : "border-success/30"}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {warnCount > 0 ? (
              <AlertTriangle className="h-4 w-4 text-warning" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-success" />
            )}
            Confiabilidade dos dados
          </div>
          <Badge variant={warnCount > 0 ? "outline" : "secondary"} className="text-xs">
            {warnCount > 0 ? `${warnCount} ponto(s) de atenção` : "Sem lacunas críticas"}
          </Badge>
        </div>

        {issues.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todos os leads do período estão com canal e qualificação preenchidos.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {issues.map((i, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                {i.level === "warn" ? (
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
                ) : (
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                )}
                <span>{i.text}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-muted-foreground border-t pt-2">
          Fonte: leads e MQL vêm dos negócios do CRM criados no período (campos "MQL" e "Canal");
          investimento vem das campanhas sincronizadas do Meta Ads; conteúdo vem dos posts
          publicados no período.
        </p>
      </CardContent>
    </Card>
  );
}
