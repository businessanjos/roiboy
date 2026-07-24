import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Info, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  job: {
    title: string;
    seniority?: string | null;
    contract_type?: string | null;
    work_model?: string | null;
    department?: string | null;
    benefits?: string[] | null;
    salary_min?: number | null;
    salary_max?: number | null;
  };
  city?: string | null;
  state?: string | null;
}

interface BenchmarkResult {
  headline?: string;
  currency?: string;
  market_range?: { p25?: number | null; p50?: number | null; p75?: number | null };
  period?: string;
  sample_note?: string;
  typical_benefits?: string[];
  missing_benefits?: string[];
  extra_benefits?: string[];
  notes?: string;
  sources?: { title?: string; url: string }[];
}

const fmtBRL = (n?: number | null) =>
  typeof n === "number" && !isNaN(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : "—";

function comparePositioning(offered: { min?: number | null; max?: number | null }, market?: BenchmarkResult["market_range"]) {
  if (!market || (!market.p25 && !market.p50 && !market.p75)) return null;
  const mid = offered.min && offered.max ? (offered.min + offered.max) / 2 : offered.min || offered.max || null;
  if (!mid) return null;
  const p25 = market.p25 ?? undefined;
  const p50 = market.p50 ?? undefined;
  const p75 = market.p75 ?? undefined;
  if (p75 && mid > p75) return { tone: "emerald", label: "Acima do mercado (>P75)", icon: TrendingUp };
  if (p50 && mid >= p50) return { tone: "emerald", label: "Alinhado ao topo (P50–P75)", icon: CheckCircle2 };
  if (p25 && mid >= p25) return { tone: "amber", label: "Dentro da faixa (P25–P50)", icon: Info };
  return { tone: "red", label: "Abaixo do mercado (<P25)", icon: AlertTriangle };
}

function computeAttractiveness(params: {
  offered: { min?: number | null; max?: number | null };
  market?: BenchmarkResult["market_range"];
  offeredBenefits: string[];
  typicalBenefits: string[];
  missingBenefits: string[];
  extraBenefits: string[];
  workModel?: string | null;
  city?: string | null;
  state?: string | null;
}) {
  const { offered, market, offeredBenefits, typicalBenefits, missingBenefits, extraBenefits, workModel, city } = params;

  // 1) Salário (0-55 pts)
  let salaryScore = 25;
  let salaryReason = "Faixa não informada — candidatos costumam ignorar vagas sem salário.";
  const mid = offered.min && offered.max ? (offered.min + offered.max) / 2 : offered.min || offered.max || null;
  if (mid && market) {
    const { p25, p50, p75 } = market;
    if (p75 && mid > p75) { salaryScore = 55; salaryReason = `Acima do P75 (${fmtBRL(p75)}) — muito atrativo.`; }
    else if (p50 && mid >= p50) { salaryScore = 45; salaryReason = `Entre P50 e P75 — competitivo no topo do mercado.`; }
    else if (p25 && mid >= p25) { salaryScore = 30; salaryReason = `Entre P25 e P50 — mediano; talentos top podem pular.`; }
    else if (p25 && mid < p25) { salaryScore = 12; salaryReason = `Abaixo do P25 (${fmtBRL(p25)}) — baixa conversão esperada.`; }
  } else if (!mid) {
    salaryScore = 20;
  }

  // 2) Benefícios (0-30 pts)
  const typicalCount = typicalBenefits.length || 1;
  const covered = typicalBenefits.filter(t => offeredBenefits.some(o => o.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(o.toLowerCase()))).length;
  const coverageRatio = Math.min(1, covered / typicalCount);
  let benefitsScore = Math.round(coverageRatio * 22);
  benefitsScore += Math.min(8, (extraBenefits?.length || 0) * 2);
  benefitsScore = Math.min(30, benefitsScore);
  const benefitsReason = `${covered}/${typicalCount} benefícios padrão cobertos${extraBenefits?.length ? ` · +${extraBenefits.length} diferenciais` : ""}${missingBenefits?.length ? ` · faltam ${missingBenefits.length}` : ""}.`;

  // 3) Modelo/Localização (0-15 pts)
  let locScore = 8;
  let locReason = city ? `Presencial em ${city}` : "Local não definido";
  if (workModel === "remote") { locScore = 15; locReason = "Remoto — alcance nacional."; }
  else if (workModel === "hybrid") { locScore = 11; locReason = `Híbrido${city ? ` em ${city}` : ""} — bom equilíbrio.`; }
  else if (workModel === "onsite") {
    const bigCities = ["são paulo", "sao paulo", "rio de janeiro", "belo horizonte", "curitiba", "porto alegre", "brasília", "brasilia", "florianópolis", "florianopolis"];
    if (city && bigCities.some(c => city.toLowerCase().includes(c))) { locScore = 10; locReason = `Presencial em ${city} — bom pool local.`; }
    else if (city) { locScore = 6; locReason = `Presencial em ${city} — pool local restrito.`; }
    else { locScore = 5; locReason = "Presencial sem cidade definida."; }
  }

  const total = Math.min(100, salaryScore + benefitsScore + locScore);
  let tier: { label: string; tone: "emerald" | "amber" | "red" | "blue"; hire: string };
  if (total >= 80) tier = { label: "Excelente", tone: "emerald", hire: "Muito alta — deve atrair top talents rapidamente." };
  else if (total >= 60) tier = { label: "Boa", tone: "blue", hire: "Boa — expectativa de bons candidatos qualificados." };
  else if (total >= 40) tier = { label: "Média", tone: "amber", hire: "Moderada — pode exigir mais esforço de busca ativa." };
  else tier = { label: "Baixa", tone: "red", hire: "Baixa — considere revisar salário/benefícios antes de publicar." };

  return {
    total,
    tier,
    breakdown: [
      { label: "Salário", score: salaryScore, max: 55, reason: salaryReason },
      { label: "Benefícios", score: benefitsScore, max: 30, reason: benefitsReason },
      { label: "Modelo & Local", score: locScore, max: 15, reason: locReason },
    ],
  };

export function SalaryBenchmarkCard({ job, city, state }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [ranAt, setRanAt] = useState<Date | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("rh-salary-benchmark", {
        body: {
          title: job.title,
          seniority: job.seniority,
          contract_type: job.contract_type,
          work_model: job.work_model,
          department: job.department,
          benefits: job.benefits ?? [],
          salary_min: job.salary_min ?? null,
          salary_max: job.salary_max ?? null,
          city,
          state,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult((data as any).benchmark as BenchmarkResult);
      setRanAt(new Date());
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao consultar mercado");
    } finally {
      setLoading(false);
    }
  };

  const positioning = result ? comparePositioning({ min: job.salary_min, max: job.salary_max }, result.market_range) : null;
  const range = result?.market_range;
  const period = result?.period === "hora" ? "/hora" : result?.period === "anual" ? "/ano" : "/mês";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Benchmark de mercado (IA)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Faixa salarial e benefícios típicos para {job.title}
            {job.seniority ? ` (${job.seniority})` : ""}
            {city && state ? ` em ${city}/${state}` : ""}
            . Fontes citadas ao final.
          </p>
        </div>
        <Button size="sm" variant={result ? "outline" : "default"} onClick={run} disabled={loading}>
          {loading ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> : result ? <RefreshCw className="h-3.5 w-3.5 mr-2" /> : <Sparkles className="h-3.5 w-3.5 mr-2" />}
          {result ? "Atualizar" : "Consultar mercado"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !result && (
          <div className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" />
            </div>
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {!loading && !result && (
          <p className="text-sm text-muted-foreground">
            Clique em <strong>Consultar mercado</strong> para gerar um benchmark salarial e de benefícios em tempo real usando IA + busca web (Glassdoor, Love Mondays, Vagas, Catho, Robert Half etc.).
          </p>
        )}

        {result && (
          <>
            {result.headline && <p className="text-sm font-medium">{result.headline}</p>}

            <div className="grid grid-cols-3 gap-3">
              {(["p25", "p50", "p75"] as const).map((k) => {
                const label = k === "p25" ? "P25 (baixo)" : k === "p50" ? "Mediana" : "P75 (alto)";
                return (
                  <div key={k} className="rounded-lg border p-3 bg-muted/30">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="text-base font-semibold mt-0.5">
                      {fmtBRL(range?.[k] ?? null)}
                      <span className="text-xs font-normal text-muted-foreground ml-1">{period}</span>
                    </p>
                  </div>
                );
              })}
            </div>

            {(job.salary_min || job.salary_max) && (
              <div className="rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sua faixa</p>
                  <p className="text-sm font-medium">
                    {fmtBRL(job.salary_min)} — {fmtBRL(job.salary_max)}
                  </p>
                </div>
                {positioning && (
                  <Badge
                    variant="outline"
                    className={
                      positioning.tone === "emerald"
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                        : positioning.tone === "amber"
                        ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                        : "bg-red-500/10 text-red-700 border-red-500/30"
                    }
                  >
                    <positioning.icon className="h-3 w-3 mr-1" />
                    {positioning.label}
                  </Badge>
                )}
              </div>
            )}

            {result.sample_note && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                {result.sample_note}
              </p>
            )}

            {(result.typical_benefits?.length || result.missing_benefits?.length || result.extra_benefits?.length) ? (
              <>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {result.typical_benefits && result.typical_benefits.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1.5">Padrão no mercado</p>
                      <div className="flex flex-wrap gap-1">
                        {result.typical_benefits.map((b, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{b}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.missing_benefits && result.missing_benefits.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1.5 text-amber-700">Você NÃO oferece</p>
                      <div className="flex flex-wrap gap-1">
                        {result.missing_benefits.map((b, i) => (
                          <Badge key={i} variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-[10px]">{b}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.extra_benefits && result.extra_benefits.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1.5 text-emerald-700">Diferenciais seus</p>
                      <div className="flex flex-wrap gap-1">
                        {result.extra_benefits.map((b, i) => (
                          <Badge key={i} variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px]">{b}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {result.notes && (
              <>
                <Separator />
                <p className="text-xs text-muted-foreground whitespace-pre-line">{result.notes}</p>
              </>
            )}

            {result.sources && result.sources.length > 0 && (
              <div className="pt-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Fontes</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.sources.map((s, i) => (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] rounded-md border px-2 py-1 hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {s.title || new URL(s.url).hostname.replace("www.", "")}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {ranAt && (
              <p className="text-[10px] text-muted-foreground text-right">
                Gerado em {ranAt.toLocaleString("pt-BR")} · IA pode conter imprecisões — valide antes de usar.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
