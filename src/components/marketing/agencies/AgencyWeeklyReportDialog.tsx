import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock, Unlock, Sparkles, TrendingUp, AlertTriangle, Settings2, Lightbulb, CheckCircle2, Trophy } from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AgencyWeeklyReport } from "@/hooks/useAgencyWeeklyReports";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agencyId: string;
  report?: AgencyWeeklyReport | null;
  onSave: (values: any) => Promise<void> | void;
  saving?: boolean;
}

type Num = number | null;

const toNum = (v: string): Num => {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function FieldShell({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MoneyInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <FieldShell label={label} hint={hint}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
        <Input inputMode="decimal" className="pl-9" placeholder="0,00" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </FieldShell>
  );
}

function IntInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <FieldShell label={label} hint={hint}>
      <Input
        inputMode="numeric"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
      />
    </FieldShell>
  );
}

/** Campo percentual/derivado: calculado automaticamente, com opção de sobrescrever. */
function DerivedInput({
  label,
  computed,
  format: fmt,
  override,
  onOverride,
  suffix,
  formula,
}: {
  label: string;
  computed: Num;
  format: (n: number) => string;
  override: string | null;
  onOverride: (v: string | null) => void;
  suffix?: string;
  formula: string;
}) {
  const isManual = override !== null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onOverride(isManual ? null : computed != null ? String(computed).replace(".", ",") : "")}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                {isManual ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {isManual ? "manual" : "auto"}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{formula}</p>
              <p className="text-xs text-muted-foreground">Clique para {isManual ? "voltar ao cálculo automático" : "informar manualmente"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {isManual ? (
        <div className="relative">
          <Input inputMode="decimal" value={override} onChange={(e) => onOverride(e.target.value)} placeholder="0,00" />
          {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
        </div>
      ) : (
        <div className="flex h-10 items-center rounded-md border border-dashed bg-muted/40 px-3 text-sm">
          {computed == null ? <span className="text-muted-foreground">—</span> : <span className="font-medium">{fmt(computed)}</span>}
          <Sparkles className="ml-auto h-3.5 w-3.5 text-primary/60" />
        </div>
      )}
    </div>
  );
}

function TextBlock({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: any;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Label>
      <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function AgencyWeeklyReportDialog({ open, onOpenChange, agencyId, report, onSave, saving }: Props) {
  const lastWeek = subWeeks(new Date(), 1);
  const defStart = format(startOfWeek(lastWeek, { weekStartsOn: 0 }), "yyyy-MM-dd");
  const defEnd = format(endOfWeek(lastWeek, { weekStartsOn: 0 }), "yyyy-MM-dd");

  const [weekStart, setWeekStart] = useState(defStart);
  const [weekEnd, setWeekEnd] = useState(defEnd);
  const [spend, setSpend] = useState("");
  const [impressions, setImpressions] = useState("");
  const [linkClicks, setLinkClicks] = useState("");
  const [pageViews, setPageViews] = useState("");
  const [leadsTotal, setLeadsTotal] = useState("");
  const [leadsMql, setLeadsMql] = useState("");
  const [ov, setOv] = useState<Record<string, string | null>>({
    ctr: null, connect_rate: null, mql_rate: null, lp_conversion_rate: null, cpl: null, cost_per_mql: null, cpm: null,
  });
  const [creativeName, setCreativeName] = useState("");
  const [creativeSpend, setCreativeSpend] = useState("");
  const [creativeMqls, setCreativeMqls] = useState("");
  const [creativeUrl, setCreativeUrl] = useState("");
  const [creativeNotes, setCreativeNotes] = useState("");
  const [creativeCpaOv, setCreativeCpaOv] = useState<string | null>(null);
  const [comparison, setComparison] = useState("");
  const [evolution, setEvolution] = useState("");
  const [bottleneck, setBottleneck] = useState("");
  const [actions, setActions] = useState("");
  const [dependencies, setDependencies] = useState("");
  const [summary, setSummary] = useState("");

  const s = (v: any) => (v == null ? "" : String(v).replace(".", ","));

  useEffect(() => {
    if (!open) return;
    if (report) {
      setWeekStart(report.week_start);
      setWeekEnd(report.week_end);
      setSpend(s(report.spend));
      setImpressions(s(report.impressions));
      setLinkClicks(s(report.link_clicks));
      setPageViews(s(report.page_views));
      setLeadsTotal(s(report.leads_total));
      setLeadsMql(s(report.leads_mql));
      setCreativeName(report.best_creative_name ?? "");
      setCreativeSpend(s(report.best_creative_spend));
      setCreativeMqls(s(report.best_creative_mqls));
      setCreativeUrl(report.best_creative_url ?? "");
      setCreativeNotes(report.best_creative_notes ?? "");
      setComparison(report.comparison_notes ?? "");
      setEvolution(report.evolution_notes ?? "");
      setBottleneck(report.bottleneck_notes ?? "");
      setActions(report.team_actions ?? "");
      setDependencies(report.client_dependencies ?? "");
      setSummary(report.summary ?? "");
      setOv({ ctr: null, connect_rate: null, mql_rate: null, lp_conversion_rate: null, cpl: null, cost_per_mql: null, cpm: null });
      setCreativeCpaOv(null);
    } else {
      setWeekStart(defStart);
      setWeekEnd(defEnd);
      [setSpend, setImpressions, setLinkClicks, setPageViews, setLeadsTotal, setLeadsMql, setCreativeName, setCreativeSpend, setCreativeMqls, setCreativeUrl, setCreativeNotes, setComparison, setEvolution, setBottleneck, setActions, setDependencies, setSummary].forEach((f) => f(""));
      setOv({ ctr: null, connect_rate: null, mql_rate: null, lp_conversion_rate: null, cpl: null, cost_per_mql: null, cpm: null });
      setCreativeCpaOv(null);
    }
  }, [open, report?.id]);

  const n = {
    spend: toNum(spend) ?? 0,
    impressions: toNum(impressions) ?? 0,
    clicks: toNum(linkClicks) ?? 0,
    pageViews: toNum(pageViews) ?? 0,
    leads: toNum(leadsTotal) ?? 0,
    mql: toNum(leadsMql) ?? 0,
  };

  const derived = useMemo(() => {
    const div = (a: number, b: number) => (b > 0 ? a / b : null);
    return {
      ctr: div(n.clicks * 100, n.impressions),
      connect_rate: div(n.pageViews * 100, n.clicks),
      mql_rate: div(n.mql * 100, n.leads),
      lp_conversion_rate: div(n.leads * 100, n.pageViews),
      cpl: div(n.spend, n.leads),
      cost_per_mql: div(n.spend, n.mql),
      cpm: div(n.spend * 1000, n.impressions),
    };
  }, [n.clicks, n.impressions, n.pageViews, n.mql, n.leads, n.spend]);

  const creativeCpa = useMemo(() => {
    const sp = toNum(creativeSpend);
    const mq = toNum(creativeMqls);
    return sp != null && mq != null && mq > 0 ? sp / mq : null;
  }, [creativeSpend, creativeMqls]);

  const val = (key: keyof typeof derived) => (ov[key] !== null ? toNum(ov[key] as string) : derived[key]);

  const handleSubmit = async () => {
    await onSave({
      ...(report?.id ? { id: report.id } : {}),
      agency_id: agencyId,
      week_start: weekStart,
      week_end: weekEnd,
      spend: n.spend,
      impressions: n.impressions,
      link_clicks: n.clicks,
      page_views: n.pageViews,
      leads_total: n.leads,
      leads_mql: n.mql,
      ctr: val("ctr"),
      connect_rate: val("connect_rate"),
      mql_rate: val("mql_rate"),
      lp_conversion_rate: val("lp_conversion_rate"),
      cpl: val("cpl"),
      cost_per_mql: val("cost_per_mql"),
      cpm: val("cpm"),
      best_creative_name: creativeName || null,
      best_creative_spend: toNum(creativeSpend),
      best_creative_mqls: toNum(creativeMqls),
      best_creative_cpa: creativeCpaOv !== null ? toNum(creativeCpaOv) : creativeCpa,
      best_creative_url: creativeUrl || null,
      best_creative_notes: creativeNotes || null,
      comparison_notes: comparison || null,
      evolution_notes: evolution || null,
      bottleneck_notes: bottleneck || null,
      team_actions: actions || null,
      client_dependencies: dependencies || null,
      summary: summary || null,
    });
  };

  const periodLabel = (() => {
    try {
      return `${format(parseISO(weekStart), "dd/MM", { locale: ptBR })} – ${format(parseISO(weekEnd), "dd/MM", { locale: ptBR })}`;
    } catch {
      return "";
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{report ? "Editar relatório semanal" : "Novo relatório semanal"}</DialogTitle>
          <DialogDescription>
            Preencha os números absolutos — as taxas e custos são calculados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Período */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <FieldShell label="Semana de">
              <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            </FieldShell>
            <FieldShell label="Até">
              <Input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} />
            </FieldShell>
            <div className="pb-2">
              <Badge variant="secondary">{periodLabel}</Badge>
            </div>
          </div>

          <Separator />

          {/* Panorama */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Panorama</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MoneyInput label="Investimento" value={spend} onChange={setSpend} />
              <IntInput label="Impressões" value={impressions} onChange={setImpressions} />
              <IntInput label="Cliques no link" value={linkClicks} onChange={setLinkClicks} />
              <IntInput label="Visualizações de página" value={pageViews} onChange={setPageViews} />
              <IntInput label="Leads gerais (Typeform)" value={leadsTotal} onChange={setLeadsTotal} />
              <IntInput label="Leads MQL" value={leadsMql} onChange={setLeadsMql} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Métricas calculadas</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DerivedInput label="CTR" computed={derived.ctr} format={fmtPct} override={ov.ctr} onOverride={(v) => setOv((p) => ({ ...p, ctr: v }))} suffix="%" formula="Cliques ÷ Impressões" />
              <DerivedInput label="Connect Rate" computed={derived.connect_rate} format={fmtPct} override={ov.connect_rate} onOverride={(v) => setOv((p) => ({ ...p, connect_rate: v }))} suffix="%" formula="Visualizações de página ÷ Cliques" />
              <DerivedInput label="Taxa de MQL" computed={derived.mql_rate} format={fmtPct} override={ov.mql_rate} onOverride={(v) => setOv((p) => ({ ...p, mql_rate: v }))} suffix="%" formula="MQL ÷ Leads gerais" />
              <DerivedInput label="Conversão LP → Lead" computed={derived.lp_conversion_rate} format={fmtPct} override={ov.lp_conversion_rate} onOverride={(v) => setOv((p) => ({ ...p, lp_conversion_rate: v }))} suffix="%" formula="Leads gerais ÷ Visualizações de página" />
              <DerivedInput label="CPL (lead geral)" computed={derived.cpl} format={fmtBRL} override={ov.cpl} onOverride={(v) => setOv((p) => ({ ...p, cpl: v }))} formula="Investimento ÷ Leads gerais" />
              <DerivedInput label="Custo por MQL" computed={derived.cost_per_mql} format={fmtBRL} override={ov.cost_per_mql} onOverride={(v) => setOv((p) => ({ ...p, cost_per_mql: v }))} formula="Investimento ÷ MQL" />
              <DerivedInput label="CPM" computed={derived.cpm} format={fmtBRL} override={ov.cpm} onOverride={(v) => setOv((p) => ({ ...p, cpm: v }))} formula="(Investimento ÷ Impressões) × 1.000" />
            </div>
          </div>

          {/* Melhor criativo */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold">
              <Trophy className="h-4 w-4 text-warning" /> Melhor criativo da semana
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FieldShell label="Nome do criativo">
                <Input value={creativeName} onChange={(e) => setCreativeName(e.target.value)} placeholder="CAPT_VID_AD002_..." />
              </FieldShell>
              <FieldShell label="Link do criativo">
                <Input value={creativeUrl} onChange={(e) => setCreativeUrl(e.target.value)} placeholder="https://fb.me/..." />
              </FieldShell>
              <MoneyInput label="Investimento do criativo" value={creativeSpend} onChange={setCreativeSpend} />
              <IntInput label="MQLs do criativo" value={creativeMqls} onChange={setCreativeMqls} />
              <DerivedInput label="CPA do criativo" computed={creativeCpa} format={fmtBRL} override={creativeCpaOv} onOverride={setCreativeCpaOv} formula="Investimento do criativo ÷ MQLs" />
            </div>
            <TextBlock icon={Trophy} label="Observações sobre o criativo" value={creativeNotes} onChange={setCreativeNotes} placeholder="O criativo foi responsável por 2 dos 3 MQLs da semana..." />
          </div>

          <Separator />

          {/* Análises */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Análise da semana</h4>
            <TextBlock icon={TrendingUp} label="Comparação com a semana anterior" value={comparison} onChange={setComparison} placeholder="O investimento foi reduzido em relação à semana anterior..." />
            <TextBlock icon={TrendingUp} label="Evolução" value={evolution} onChange={setEvolution} placeholder="Nesta semana iniciamos a veiculação..." />
            <TextBlock icon={AlertTriangle} label="Gargalo" value={bottleneck} onChange={setBottleneck} placeholder="O principal ponto de atenção é..." />
            <TextBlock icon={Settings2} label="Ações do time" value={actions} onChange={setActions} placeholder="Acompanhamento diário das campanhas..." />
            <TextBlock icon={Lightbulb} label="Dependências do cliente" value={dependencies} onChange={setDependencies} placeholder="Feedback do time comercial sobre os MQLs..." />
            <TextBlock icon={CheckCircle2} label="Resumo" value={summary} onChange={setSummary} placeholder="Esta foi uma semana de transição..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Salvando..." : "Salvar relatório"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
