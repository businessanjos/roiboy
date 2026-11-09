import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, Info, ChevronDown } from "lucide-react";
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
  const [open, setOpen] = useState(false);
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
    <Collapsible open={open} onOpenChange={setOpen} className="border-y border-border">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-between gap-3 rounded-none px-2 py-3 hover:bg-muted/40" aria-label={open ? "Recolher confiabilidade dos dados" : "Expandir confiabilidade dos dados"}>
          <span className="flex min-w-0 items-center gap-2 text-left text-sm font-semibold">
            {warnCount > 0 ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            ) : (
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
            )}
            Confiabilidade dos dados
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary" className={warnCount > 0 ? "bg-warning/10 text-warning-strong text-xs" : "text-xs text-muted-foreground"}>
              {warnCount > 0 ? `${warnCount} ${warnCount === 1 ? 'atenção' : 'atenções'}` : "Sem alertas"}
            </Badge>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-2 pb-3 data-[state=open]:animate-accordion-down motion-reduce:animate-none">

        {issues.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todos os leads do período estão com canal e qualificação preenchidos.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {issues.map((i, idx) => (
              <li key={idx} className="flex items-start gap-2 py-2 text-xs leading-relaxed text-muted-foreground">
                {i.level === "warn" ? (
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
                ) : (
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 break-words">{i.text}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-muted-foreground border-t pt-2">
          Fonte: leads e MQL vêm dos negócios do CRM criados no período (campos "MQL" e "Canal");
          investimento vem das campanhas sincronizadas do Meta Ads; conteúdo vem dos posts
          publicados no período.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
