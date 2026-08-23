import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, BarChart3, Trophy } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, subDays, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agency-report-portal`;

type Form = Record<string, string>;

const emptyForm = (): Form => {
  const ref = subDays(new Date(), 7);
  return {
    week_start: format(startOfWeek(ref, { weekStartsOn: 0 }), "yyyy-MM-dd"),
    week_end: format(endOfWeek(ref, { weekStartsOn: 0 }), "yyyy-MM-dd"),
    submitted_by_name: "",
    spend: "",
    impressions: "",
    link_clicks: "",
    page_views: "",
    leads_total: "",
    leads_mql: "",
    ctr: "",
    connect_rate: "",
    mql_rate: "",
    lp_conversion_rate: "",
    cpl: "",
    cost_per_mql: "",
    cpm: "",
    best_creative_name: "",
    best_creative_spend: "",
    best_creative_mqls: "",
    best_creative_cpa: "",
    best_creative_url: "",
    best_creative_notes: "",
    comparison_notes: "",
    evolution_notes: "",
    bottleneck_notes: "",
    team_actions: "",
    client_dependencies: "",
    summary: "",
  };
};

const n = (v: string) => {
  if (!v?.trim()) return null;
  const parsed = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const pct = (a: number | null, b: number | null) =>
  a != null && b != null && b > 0 ? ((a / b) * 100).toFixed(2) : "";
const div = (a: number | null, b: number | null) =>
  a != null && b != null && b > 0 ? (a / b).toFixed(2) : "";

function Field({
  label, hint, value, onChange, prefix, suffix, type = "text", placeholder,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>
        )}
        <Input
          type={type}
          inputMode={type === "text" ? "decimal" : undefined}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${prefix ? "pl-10" : ""} ${suffix ? "pr-8" : ""}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TextField({
  label, value, onChange, placeholder, rows = 4,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Textarea value={value} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function PublicAgencyWeeklyReport() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agency, setAgency] = useState<{ name: string; color: string } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [form, setForm] = useState<Form>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?action=get&token=${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Link inválido");
        setAgency(data.agency);
        setHistory(data.reports ?? []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Métricas derivadas sugeridas automaticamente
  const derived = useMemo(() => {
    const spend = n(form.spend);
    const impressions = n(form.impressions);
    const clicks = n(form.link_clicks);
    const views = n(form.page_views);
    const leads = n(form.leads_total);
    const mql = n(form.leads_mql);
    return {
      ctr: pct(clicks, impressions),
      connect_rate: pct(views, clicks),
      mql_rate: pct(mql, leads),
      lp_conversion_rate: pct(leads, views),
      cpl: div(spend, leads),
      cost_per_mql: div(spend, mql),
      cpm: impressions && spend != null && impressions > 0 ? ((spend / impressions) * 1000).toFixed(2) : "",
    } as Record<string, string>;
  }, [form.spend, form.impressions, form.link_clicks, form.page_views, form.leads_total, form.leads_mql]);

  const valueOr = (k: string) => (form[k]?.trim() ? form[k] : derived[k] ?? "");

  const submit = async () => {
    if (!form.week_start || !form.week_end) {
      toast.error("Informe o período da semana");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ...form };
      ["ctr", "connect_rate", "mql_rate", "lp_conversion_rate", "cpl", "cost_per_mql", "cpm"].forEach((k) => {
        body[k] = n(valueOr(k));
      });
      ["spend", "impressions", "link_clicks", "page_views", "leads_total", "leads_mql",
        "best_creative_spend", "best_creative_mqls", "best_creative_cpa"].forEach((k) => {
        body[k] = n(form[k]);
      });

      const res = await fetch(`${FN_URL}?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar");
      setDone(true);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="py-10 text-center">
            <p className="font-medium">{error}</p>
            <p className="mt-2 text-sm text-muted-foreground">Solicite um novo link ao time de marketing.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <h1 className="text-lg font-semibold">Relatório enviado</h1>
            <p className="text-sm text-muted-foreground">
              O relatório da semana de {format(parseISO(form.week_start), "dd/MM", { locale: ptBR })} a{" "}
              {format(parseISO(form.week_end), "dd/MM/yyyy", { locale: ptBR })} já está disponível na plataforma.
            </p>
            <Button variant="outline" size="sm" onClick={() => { setForm(emptyForm()); setDone(false); }}>
              Enviar outra semana
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4">
        <div className="flex items-center gap-3">
          <span className="inline-block h-4 w-4 rounded-full" style={{ background: agency?.color }} />
          <div>
            <h1 className="text-xl font-bold">Relatório semanal de tráfego pago</h1>
            <p className="text-sm text-muted-foreground">{agency?.name}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Período</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Field label="Início da semana" type="date" value={form.week_start} onChange={set("week_start")} />
            <Field label="Fim da semana" type="date" value={form.week_end} onChange={set("week_end")} />
            <Field label="Quem está enviando" type="text" placeholder="Nome do responsável" value={form.submitted_by_name} onChange={set("submitted_by_name")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4" /> Panorama</CardTitle>
            <p className="text-xs text-muted-foreground">Preencha os números absolutos — os percentuais e custos são calculados automaticamente.</p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Field label="Investimento" prefix="R$" value={form.spend} onChange={set("spend")} placeholder="1.769,51" />
            <Field label="Impressões" value={form.impressions} onChange={set("impressions")} placeholder="20794" />
            <Field label="Cliques no link" value={form.link_clicks} onChange={set("link_clicks")} placeholder="163" />
            <Field label="Visualizações de página" value={form.page_views} onChange={set("page_views")} placeholder="61" />
            <Field label="Leads gerais" value={form.leads_total} onChange={set("leads_total")} placeholder="3" />
            <Field label="Leads MQL" value={form.leads_mql} onChange={set("leads_mql")} placeholder="3" />

            <Separator className="md:col-span-3" />

            <Field label="CTR" suffix="%" value={valueOr("ctr")} onChange={set("ctr")} hint="Cliques ÷ impressões" />
            <Field label="Connect Rate" suffix="%" value={valueOr("connect_rate")} onChange={set("connect_rate")} hint="Visualizações ÷ cliques" />
            <Field label="Taxa de MQL" suffix="%" value={valueOr("mql_rate")} onChange={set("mql_rate")} hint="MQL ÷ leads gerais" />
            <Field label="Conversão LP → Lead" suffix="%" value={valueOr("lp_conversion_rate")} onChange={set("lp_conversion_rate")} hint="Leads ÷ visualizações" />
            <Field label="CPL (lead geral)" prefix="R$" value={valueOr("cpl")} onChange={set("cpl")} hint="Investimento ÷ leads" />
            <Field label="Custo por MQL" prefix="R$" value={valueOr("cost_per_mql")} onChange={set("cost_per_mql")} hint="Investimento ÷ MQL" />
            <Field label="CPM" prefix="R$" value={valueOr("cpm")} onChange={set("cpm")} hint="Investimento ÷ mil impressões" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4" /> Melhor criativo da semana</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Nome do criativo" type="text" value={form.best_creative_name} onChange={set("best_creative_name")} />
            <Field label="Link do criativo" type="text" value={form.best_creative_url} onChange={set("best_creative_url")} placeholder="https://" />
            <Field label="Investimento" prefix="R$" value={form.best_creative_spend} onChange={set("best_creative_spend")} />
            <Field label="MQLs gerados" value={form.best_creative_mqls} onChange={set("best_creative_mqls")} />
            <Field label="CPA" prefix="R$" value={form.best_creative_cpa} onChange={set("best_creative_cpa")} />
            <div className="md:col-span-2">
              <TextField label="Observações do criativo" rows={3} value={form.best_creative_notes} onChange={set("best_creative_notes")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Análise da semana</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TextField label="Comparação com a semana anterior" value={form.comparison_notes} onChange={set("comparison_notes")} />
            <TextField label="Evolução" value={form.evolution_notes} onChange={set("evolution_notes")} />
            <TextField label="Gargalo" value={form.bottleneck_notes} onChange={set("bottleneck_notes")} />
            <TextField label="Ações do time" value={form.team_actions} onChange={set("team_actions")} />
            <TextField label="Dependências do cliente" value={form.client_dependencies} onChange={set("client_dependencies")} />
            <TextField label="Resumo" value={form.summary} onChange={set("summary")} />
          </CardContent>
        </Card>

        {history.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Semanas já enviadas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {history.map((h) => (
                <Badge key={h.id} variant="secondary">
                  {format(parseISO(h.week_start), "dd/MM", { locale: ptBR })} – {format(parseISO(h.week_end), "dd/MM", { locale: ptBR })}
                </Badge>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur">
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar relatório
          </Button>
        </div>
      </div>
    </div>
  );
}
