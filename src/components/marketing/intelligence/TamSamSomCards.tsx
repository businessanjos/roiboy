import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  RefreshCw,
  Sparkles,
  Globe2,
  Target,
  Crosshair,
  ChevronRight,
  Settings2,
  Plus,
  Trash2,
  RotateCcw,
  BookOpen,
  ListChecks,
  Ban,
  ExternalLink,
} from "lucide-react";
import { extractHeadline } from "./marketBenchmarks";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";
import { MarketResearchAnswer } from "./MarketResearchAnswer";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Citation = { index?: number; url: string; title?: string | null };
type Row = { id: string; query: string; answer: string; created_at: string; citations: Citation[] | null };

type Band = { label: string; min: number; max: number };

type Scenario = {
  id: string;
  name: string;
  bands: Band[];
  geo: string;      // ex.: "Brasil (nacional)", "Sudeste", "SP capital"
  category: string; // ex.: "Todos", "Injetáveis", "HOF", "Laser + tecnologias"
  channel: string;  // ex.: "Todos", "Digital direto", "Indicação", "Eventos"
};

const DEFAULT_BANDS: Band[] = [
  { label: "Entrada", min: 997, max: 5000 },
  { label: "Intermediário", min: 5000, max: 40000 },
  { label: "Premium", min: 40000, max: 200000 },
  { label: "Conselho / High-ticket", min: 200000, max: 500000 },
];

const DEFAULT_GEO = "Brasil (nacional)";
const DEFAULT_CATEGORY = "Todos os procedimentos";
const DEFAULT_CHANNEL = "Todos os canais";

const LEGACY_BANDS_KEY = "mi_tsm_bands_v1";
const SCENARIOS_KEY = "mi_tsm_scenarios_v1";
const ACTIVE_SCENARIO_KEY = "mi_tsm_active_scenario_v1";

function newId() {
  return `sc_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

function makeDefaultScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: newId(),
    name: "Padrão — Brasil, todos os canais",
    bands: DEFAULT_BANDS,
    geo: DEFAULT_GEO,
    category: DEFAULT_CATEGORY,
    channel: DEFAULT_CHANNEL,
    ...overrides,
  };
}

const EXCLUSAO =
  "IMPORTANTE: considere APENAS profissionais e clínicas de ESTÉTICA AVANÇADA/MÉDICA (procedimentos estéticos, injetáveis, laser, tecnologias, harmonização facial/corporal, dermato, HOF). EXCLUA salões de beleza, barbearias, cabeleireiros, manicure/pedicure, depilação simples, estética capilar, SPAs de relaxamento e centros de bem-estar sem procedimentos estéticos.";

function recorteBlock(s: Scenario): string {
  return `RECORTE DESTE CENÁRIO (aplique de forma consistente em todos os cálculos e fontes):
- Geografia: ${s.geo}
- Categoria/nicho: ${s.category}
- Canal de aquisição avaliado: ${s.channel}
Se o recorte reduzir o universo, ajuste TODOS os números (profissionais, clínicas, R$) proporcionalmente e diga explicitamente o fator de recorte usado.`;
}

function fmtBRL(n: number): string {
  if (n >= 1000) return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return `R$ ${n.toLocaleString("pt-BR")}`;
}

function bandsBlock(bands: Band[]) {
  const lines = bands.map((b) => `   - ${b.label}: ${fmtBRL(b.min)} – ${fmtBRL(b.max)}/ano`).join("\n");
  const minTicket = Math.min(...bands.map((b) => b.min));
  const maxTicket = Math.max(...bands.map((b) => b.max));
  return { lines, minTicket, maxTicket };
}

function buildPortfolio(bands: Band[]): string {
  const { minTicket, maxTicket } = bandsBlock(bands);
  return `Portfolio Eternum: produtos vão de ${fmtBRL(minTicket)} (entrada) até ${fmtBRL(maxTicket)} (high-ticket). Qualquer profissional de estética avançada/médica com capacidade de investir a partir de ${fmtBRL(minTicket)}/ano faz parte do TAM — não filtre só por high-ticket.`;
}

type Tier = {
  key: "tam" | "sam" | "som";
  label: string;
  short: string;
  icon: typeof Globe2;
  gradient: string;
  ring: string;
  text: string;
  bg: string;
  helper: string;
  buildQuery: (scenario: Scenario) => string;
};

const tiers: Tier[] = [
  {
    key: "tam",
    label: "TAM — Mercado total endereçável",
    short: "TAM",
    icon: Globe2,
    gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
    ring: "ring-purple-500/20",
    text: "text-purple-600",
    bg: "bg-purple-500/10",
    helper: "Universo TOTAL de profissionais da estética avançada no Brasil, sem nenhum filtro além de estarem no setor.",
    buildQuery: (scenario) => {
      const { lines } = bandsBlock(scenario.bands);
      return `Calcule o TAM (Total Addressable Market) do universo de ESTÉTICA AVANÇADA/MÉDICA no Brasil considerando TODOS os profissionais e clínicas do setor, sem filtro por ticket ou faturamento.

${EXCLUSAO}

${recorteBlock(scenario)}

${buildPortfolio(scenario.bands)}

Faixas de ticket a considerar na análise:
${lines}

Traga:
1. **Número total** de profissionais + clínicas do setor DENTRO DO RECORTE (soma consolidada, com fonte).
2. **Faturamento anual estimado do setor no recorte** (R$, com CAGR dos últimos 3 anos).
3. **Composição** dentro do recorte: quantos médicos (dermato + outras), dentistas com HOF, biomédicos, esteticistas com formação avançada, clínicas PJ.
4. **TAM em R$** = faturamento potencial se 100% do universo do recorte consumisse produtos de educação/mentoria/comunidade dentro das faixas acima (média ponderada realista).

Cite fontes oficiais (SBD, CFM, CFO, CFBM, ABIHPEC, Sebrae, IBGE, Euromonitor, ABEDV).`;
    },
  },
  {
    key: "sam",
    label: "SAM — Mercado que Eternum atende",
    short: "SAM",
    icon: Target,
    gradient: "from-blue-500/10 via-blue-500/5 to-transparent",
    ring: "ring-blue-500/20",
    text: "text-blue-600",
    bg: "bg-blue-500/10",
    helper: "Fatia do TAM que efetivamente entra no perfil dos produtos Eternum.",
    buildQuery: (scenario) => {
      const { lines, minTicket } = bandsBlock(scenario.bands);
      return `Calcule o SAM (Serviceable Addressable Market) para a Eternum Mentoring Club no Brasil.

${EXCLUSAO}

${recorteBlock(scenario)}

${buildPortfolio(scenario.bands)}

Perfil Eternum: profissional de estética avançada JÁ EM OPERAÇÃO (não iniciante puro), buscando escalar clínica/autoridade/faturamento.

Traga:
1. **Número de profissionais + clínicas** que se encaixam nesse perfil DENTRO DO RECORTE (excluir estudantes, aposentados, quem faturou menos que o suficiente para investir ${fmtBRL(minTicket)}/ano em educação).
2. **Segmentação por capacidade de investimento anual em educação/mentoria** (use EXATAMENTE estas faixas — quantidade estimada em cada uma dentro do recorte):
${lines}
3. **SAM em R$** = soma do potencial anual dessas faixas (nº de profissionais × ticket médio da faixa).
4. Fontes (Sebrae — perfil do empreendedor de estética, associações do setor, pesquisas de mercado brasileiro de educação executiva).`;
    },
  },
  {
    key: "som",
    label: "SOM — Mercado capturável em 12 meses",
    short: "SOM",
    icon: Crosshair,
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    ring: "ring-emerald-500/20",
    text: "text-emerald-600",
    bg: "bg-emerald-500/10",
    helper: "Recorte realista que a Eternum consegue converter nos próximos 12 meses com a operação atual.",
    buildQuery: (scenario) => {
      const { lines } = bandsBlock(scenario.bands);
      return `Calcule o SOM (Serviceable Obtainable Market) da Eternum Mentoring Club para os PRÓXIMOS 12 MESES no Brasil.

${EXCLUSAO}

${recorteBlock(scenario)}

${buildPortfolio(scenario.bands)}

Faixas de ticket definidas pelo usuário:
${lines}

Considere benchmarks de conversão realistas para negócios de educação/mentoria B2P no Brasil:
- Penetração típica de líderes de nicho em mercados fragmentados: 0,5% a 3% do SAM em 12 meses.
- High-ticket (>R$ 40k/ano) exige alta autoridade e tráfego qualificado — normalmente <0,3% do SAM/ano.
- Produtos de entrada escalam mais rápido — 1% a 5% do SAM/ano é plausível para marca consolidada.
- Ajuste as taxas em função do CANAL do recorte (ex.: eventos → CAC mais alto, conversão maior; digital direto → escala maior, conversão menor).

Traga:
1. **Número de clientes capturáveis em 12 meses**, quebrado por CADA faixa acima e considerando o recorte de geografia/categoria/canal.
2. **Receita capturável em 12 meses (R$)** — soma das faixas.
3. **Premissas explícitas** por faixa (% conversão sobre SAM, CAC assumido para o canal do recorte, comparativos com players como Fernando Kimura, Mentoria Kaizen, iCEV, Faculdade Inspirar, Instituto BWS).
4. **Pontos cegos** — faixas SUBEXPLORADAS neste recorte específico e quanto de receita a Eternum está deixando na mesa por não ter produto/canal para elas.`;
    },
  },
];

interface Props {
  onOpenDetail?: (query: string) => void;
  currentMetrics?: {
    activeClients: number;
    avgTicket: number;
    annualRevenue: number;
    churnRate?: number;
  };
}

// Extrai a primeira magnitude em R$ associada explicitamente ao tier
// (ex.: "TAM em R$", "SAM em R$", "Receita capturável em 12 meses (R$)").
function parseBRL(text: string | undefined, tierKey: "tam" | "sam" | "som"): number | null {
  if (!text) return null;
  const anchors: Record<typeof tierKey, RegExp[]> = {
    tam: [/TAM\s+em\s+R\$[^R]*?R\$\s*([\d.,]+)\s*(bilh[õo]es|bi|milh[õo]es|mi|mil|k)?/i, /TAM[^\n]{0,120}?R\$\s*([\d.,]+)\s*(bilh[õo]es|bi|milh[õo]es|mi|mil|k)?/i],
    sam: [/SAM\s+em\s+R\$[^R]*?R\$\s*([\d.,]+)\s*(bilh[õo]es|bi|milh[õo]es|mi|mil|k)?/i, /SAM[^\n]{0,120}?R\$\s*([\d.,]+)\s*(bilh[õo]es|bi|milh[õo]es|mi|mil|k)?/i],
    som: [/Receita\s+capt[^R]*?R\$\s*([\d.,]+)\s*(bilh[õo]es|bi|milh[õo]es|mi|mil|k)?/i, /SOM[^\n]{0,120}?R\$\s*([\d.,]+)\s*(bilh[õo]es|bi|milh[õo]es|mi|mil|k)?/i],
  } as any;
  for (const re of anchors[tierKey]) {
    const m = text.match(re);
    if (m) {
      const raw = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      if (isNaN(raw)) continue;
      const u = (m[2] || "").toLowerCase();
      if (/bi|bilh/.test(u)) return raw * 1e9;
      if (/mi(?!l)|milh/.test(u)) return raw * 1e6;
      if (/mil|k/.test(u)) return raw * 1e3;
      return raw;
    }
  }
  return null;
}

// Extrai número de profissionais/clientes do primeiro trecho útil.
function parsePeople(text: string | undefined, tierKey: "tam" | "sam" | "som"): number | null {
  if (!text) return null;
  const keyword = tierKey === "som"
    ? /clientes?\s+capt[^\n]{0,80}?([\d.,]+)\s*(mil|milh[õo]es|k)?/i
    : /(profissionais|cl[íi]nicas|total)[^\n]{0,80}?([\d.,]+)\s*(mil|milh[õo]es|k)?/i;
  const m = text.match(keyword);
  if (!m) return null;
  const numStr = tierKey === "som" ? m[1] : m[2];
  const unit = ((tierKey === "som" ? m[2] : m[3]) || "").toLowerCase();
  const raw = parseFloat(numStr.replace(/\./g, "").replace(",", "."));
  if (isNaN(raw)) return null;
  if (/milh/.test(unit)) return raw * 1e6;
  if (/mil|k/.test(unit)) return raw * 1e3;
  return raw;
}

function fmtBigBRL(n: number): string {
  if (n >= 1e9) return `R$ ${(n / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} bi`;
  if (n >= 1e6) return `R$ ${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 1e3) return `R$ ${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function fmtBigNum(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return n.toLocaleString("pt-BR");
}

function fmtPct(n: number): string {
  if (n < 0.001) return `${(n * 100).toFixed(4)}%`;
  if (n < 0.01) return `${(n * 100).toFixed(3)}%`;
  if (n < 1) return `${(n * 100).toFixed(2)}%`;
  return `${n.toFixed(1)}%`;
}

function loadBands(): Band[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BANDS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((b) => typeof b?.min === "number" && typeof b?.max === "number")) {
      return parsed as Band[];
    }
  } catch {
    /* noop */
  }
  return DEFAULT_BANDS;
}

export function TamSamSomCards({ onOpenDetail, currentMetrics }: Props) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [running, setRunning] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [bands, setBands] = useState<Band[]>(() => loadBands());
  const [detail, setDetail] = useState<{ tier: Tier; query: string; row: Row } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bands));
    } catch {
      /* noop */
    }
  }, [bands]);

  const queries = useMemo(() => tiers.map((t) => ({ tier: t, query: t.buildQuery(bands) })), [bands]);

  const { data, isLoading } = useQuery({
    queryKey: ["mi-tsm-cards", currentUser?.account_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mi_market_research")
        .select("id, query, answer, created_at, citations")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    enabled: !!currentUser?.account_id,
  });

  const latestByQuery = useMemo(() => {
    const map = new Map<string, Row>();
    (data ?? []).forEach((r) => {
      if (!map.has(r.query)) map.set(r.query, r);
    });
    return map;
  }, [data]);

  async function runOne(tier: Tier, query: string) {
    setRunning(tier.key);
    try {
      const { data, error } = await supabase.functions.invoke("mi-market-research", {
        body: { query, focus: "tam", recency: "year", model: "sonar-pro" },
      });
      if (error) throw new Error(await extractEdgeFunctionError(error, "Falha na pesquisa"));
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`✓ ${tier.short} atualizado`);
      qc.invalidateQueries({ queryKey: ["mi-tsm-cards", currentUser?.account_id] });
      qc.invalidateQueries({ queryKey: ["mi-market-research", currentUser?.account_id] });
    } catch (e: any) {
      toast.error(`${tier.short}: ${e?.message || "erro"}`);
    } finally {
      setRunning(null);
    }
  }

  async function runAllMissing() {
    for (const { tier, query } of queries) {
      if (latestByQuery.has(query)) continue;
      await runOne(tier, query);
    }
  }

  async function recalcAll() {
    for (const { tier, query } of queries) {
      await runOne(tier, query);
    }
  }

  function updateBand(idx: number, patch: Partial<Band>) {
    setBands((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  function removeBand(idx: number) {
    setBands((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function addBand() {
    setBands((prev) => {
      const last = prev[prev.length - 1];
      const newMin = last ? last.max : 1000;
      return [...prev, { label: `Faixa ${prev.length + 1}`, min: newMin, max: newMin * 2 }];
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" /> TAM · SAM · SOM
          </h2>
          <p className="text-xs text-muted-foreground">
            Ajuste as faixas de ticket e recalcule para revelar seus pontos cegos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowConfig((s) => !s)}>
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            {showConfig ? "Fechar faixas" : "Configurar faixas"}
          </Button>
          <Button size="sm" variant="outline" onClick={runAllMissing} disabled={!!running}>
            {running ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-2" />}
            Preencher faltantes
          </Button>
          <Button size="sm" onClick={recalcAll} disabled={!!running}>
            {running ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
            Recalcular tudo
          </Button>
        </div>
      </div>

      {showConfig && (
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Faixas de ticket (R$/ano)</p>
                <p className="text-xs text-muted-foreground">
                  Essas faixas alimentam os prompts de TAM, SAM e SOM. Salvo automaticamente neste navegador.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setBands(DEFAULT_BANDS)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Padrão
                </Button>
                <Button size="sm" variant="outline" onClick={addBand}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar faixa
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {bands.map((b, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    {idx === 0 && <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Rótulo</Label>}
                    <Input
                      value={b.label}
                      onChange={(e) => updateBand(idx, { label: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    {idx === 0 && <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Mín (R$)</Label>}
                    <Input
                      type="number"
                      min={0}
                      value={b.min}
                      onChange={(e) => updateBand(idx, { min: Number(e.target.value) || 0 })}
                      className="h-8 text-sm tabular-nums"
                    />
                  </div>
                  <div className="col-span-3">
                    {idx === 0 && <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Máx (R$)</Label>}
                    <Input
                      type="number"
                      min={0}
                      value={b.max}
                      onChange={(e) => updateBand(idx, { max: Number(e.target.value) || 0 })}
                      className="h-8 text-sm tabular-nums"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeBand(idx)}
                      disabled={bands.length <= 1}
                      className="h-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground">
              Após ajustar, clique em <strong>Recalcular tudo</strong> — as respostas ficam vinculadas às faixas atuais.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {queries.map(({ tier, query }) => {
          const Icon = tier.icon;
          const latest = latestByQuery.get(query);
          const { value, snippet } = extractHeadline(latest?.answer);
          const isRunning = running === tier.key;

          return (
            <Card
              key={tier.key}
              className={`relative overflow-hidden ring-1 ${tier.ring} bg-gradient-to-br ${tier.gradient} hover:shadow-lg transition-shadow`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${tier.bg}`}>
                      <Icon className={`h-5 w-5 ${tier.text}`} />
                    </div>
                    <div>
                      <p className={`text-[11px] font-bold tracking-widest uppercase ${tier.text}`}>{tier.short}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {tier.label.replace(`${tier.short} — `, "")}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => runOne(tier, query)}
                    disabled={isRunning || !!running}
                    title={latest ? "Atualizar" : "Calcular"}
                  >
                    {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                <div className="min-h-[3rem]">
                  {isLoading ? (
                    <div className="h-8 w-32 rounded bg-muted animate-pulse" />
                  ) : value ? (
                    <p className={`text-3xl font-bold tabular-nums leading-tight ${tier.text}`}>{value}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Sem cálculo para as faixas atuais</p>
                  )}
                </div>

                {snippet ? (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-3 leading-relaxed">{snippet}</p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-3 leading-relaxed">{tier.helper}</p>
                )}

                <div className="mt-3 flex items-center justify-between gap-2">
                  {latest ? (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true, locale: ptBR })}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Recalcule para estas faixas</span>
                  )}
                  {latest && (
                    <button
                      type="button"
                      onClick={() => setDetail({ tier, query, row: latest })}
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Ver análise <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CurrentVsMarketPanel
        currentMetrics={currentMetrics}
        latestByQuery={latestByQuery}
        queries={queries}
      />



      <DetailSheet
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        detail={detail}
        bands={bands}
        onOpenExternal={onOpenDetail}
      />
    </div>
  );
}

function DetailSheet({
  open,
  onOpenChange,
  detail,
  bands,
  onOpenExternal,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  detail: { tier: Tier; query: string; row: Row } | null;
  bands: Band[];
  onOpenExternal?: (query: string) => void;
}) {
  if (!detail) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent />
      </Sheet>
    );
  }

  const { tier, query, row } = detail;
  const Icon = tier.icon;
  const citations = Array.isArray(row.citations) ? row.citations : [];

  // Extrai o bloco "Traga:" do prompt como critérios pedidos ao modelo
  const criteriosMatch = query.match(/Traga:\s*([\s\S]+?)(?=\n\nCite|$)/);
  const criterios = criteriosMatch ? criteriosMatch[1].trim() : "";

  // Fontes oficiais mencionadas no prompt
  const fontesMatch = query.match(/Cite fontes[^.]*\(([^)]+)\)/i) || query.match(/Fontes[^(]*\(([^)]+)\)/i);
  const fontesOficiaisSugeridas = fontesMatch ? fontesMatch[1].split(/,\s*/) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${tier.bg}`}>
              <Icon className={`h-5 w-5 ${tier.text}`} />
            </div>
            <div>
              <p className={`text-[11px] font-bold tracking-widest uppercase ${tier.text}`}>{tier.short}</p>
              <SheetTitle className="text-base leading-tight">{tier.label}</SheetTitle>
            </div>
          </div>
          <SheetDescription className="text-xs">
            Calculado em {format(new Date(row.created_at), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })} ·
            {" "}última execução via Perplexity (sonar-pro)
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Faixas usadas */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <ListChecks className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold">Faixas de ticket usadas neste cálculo</h3>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              {bands.map((b, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{b.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {fmtBRL(b.min)} – {fmtBRL(b.max)}/ano
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Ajuste em "Configurar faixas" e clique em Recalcular para atualizar.
            </p>
          </section>

          {/* Critérios de recorte */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Ban className="h-4 w-4 text-red-600" />
              <h3 className="text-sm font-semibold">Critério de recorte (exclusões obrigatórias)</h3>
            </div>
            <div className="rounded-md border bg-red-500/5 border-red-500/20 p-3 text-xs leading-relaxed text-muted-foreground">
              Considera <strong>apenas</strong> profissionais e clínicas de estética avançada/médica —
              procedimentos estéticos, injetáveis, laser, tecnologias, harmonização facial/corporal, dermato, HOF.
              <br />
              <br />
              <strong className="text-red-600">Exclui:</strong> salões de beleza, barbearias, cabeleireiros,
              manicure/pedicure, depilação simples, estética capilar, SPAs de relaxamento e centros de bem-estar
              sem procedimentos estéticos.
            </div>
          </section>

          {/* Suposições / pedido ao modelo */}
          {criterios && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-purple-600" />
                <h3 className="text-sm font-semibold">O que foi pedido ao modelo</h3>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                {criterios}
              </div>
            </section>
          )}

          {/* Fontes oficiais sugeridas no prompt */}
          {fontesOficiaisSugeridas.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-2">Fontes oficiais orientadas ao modelo</h3>
              <div className="flex flex-wrap gap-1.5">
                {fontesOficiaisSugeridas.map((f, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                    {f.trim()}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          <Separator />

          {/* Resposta */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Análise completa</h3>
            <MarketResearchAnswer answer={row.answer} />
          </section>

          {/* Citações reais retornadas */}
          <section>
            <h3 className="text-sm font-semibold mb-2">
              Fontes citadas pelo modelo{" "}
              <span className="text-xs font-normal text-muted-foreground">({citations.length})</span>
            </h3>
            {citations.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma citação foi retornada nesta execução.</p>
            ) : (
              <ol className="space-y-1.5">
                {citations.map((c, i) => (
                  <li key={i} className="text-xs">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary hover:underline inline-flex items-start gap-1"
                    >
                      <span className="tabular-nums text-muted-foreground min-w-[1.5rem]">
                        [{c.index ?? i + 1}]
                      </span>
                      <span className="flex-1">
                        {c.title || c.url}
                        <ExternalLink className="inline h-3 w-3 ml-1 opacity-60" />
                      </span>
                    </a>
                    {c.title && <div className="text-[10px] text-muted-foreground pl-7 truncate">{c.url}</div>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {onOpenExternal && (
            <div className="pt-2 border-t">
              <Button size="sm" variant="ghost" onClick={() => onOpenExternal(query)}>
                Abrir na aba Pesquisa de Mercado <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────
// Comparativo visual: TAM/SAM/SOM vs meus dados atuais
// ─────────────────────────────────────────────────────────────
function CurrentVsMarketPanel({
  currentMetrics,
  latestByQuery,
  queries,
}: {
  currentMetrics?: Props["currentMetrics"];
  latestByQuery: Map<string, Row>;
  queries: { tier: Tier; query: string }[];
}) {
  if (!currentMetrics) return null;

  const parsed = queries.map(({ tier, query }) => {
    const row = latestByQuery.get(query);
    return {
      tier,
      revenue: parseBRL(row?.answer, tier.key),
      people: parsePeople(row?.answer, tier.key),
    };
  });

  const hasAny = parsed.some((p) => p.revenue || p.people);
  const { activeClients, avgTicket, annualRevenue, churnRate } = currentMetrics;

  if (!hasAny) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-5 text-center text-sm text-muted-foreground">
          Calcule TAM, SAM e SOM acima para desbloquear o comparativo com sua operação atual.
        </CardContent>
      </Card>
    );
  }

  const tamRev = parsed.find((p) => p.tier.key === "tam")?.revenue ?? null;
  const samRev = parsed.find((p) => p.tier.key === "sam")?.revenue ?? null;
  const somRev = parsed.find((p) => p.tier.key === "som")?.revenue ?? null;

  const tamPpl = parsed.find((p) => p.tier.key === "tam")?.people ?? null;
  const samPpl = parsed.find((p) => p.tier.key === "sam")?.people ?? null;
  const somPpl = parsed.find((p) => p.tier.key === "som")?.people ?? null;

  const maxRev = Math.max(tamRev ?? 0, samRev ?? 0, somRev ?? 0, annualRevenue);
  const maxPpl = Math.max(tamPpl ?? 0, samPpl ?? 0, somPpl ?? 0, activeClients);

  const revenueBars = [
    { label: "TAM", value: tamRev, color: "bg-purple-500", text: "text-purple-700" },
    { label: "SAM", value: samRev, color: "bg-blue-500", text: "text-blue-700" },
    { label: "SOM (12m)", value: somRev, color: "bg-emerald-500", text: "text-emerald-700" },
    { label: "Você (anualizado)", value: annualRevenue, color: "bg-amber-500", text: "text-amber-700", isSelf: true },
  ];

  const peopleBars = [
    { label: "TAM", value: tamPpl, color: "bg-purple-500", text: "text-purple-700" },
    { label: "SAM", value: samPpl, color: "bg-blue-500", text: "text-blue-700" },
    { label: "SOM (12m)", value: somPpl, color: "bg-emerald-500", text: "text-emerald-700" },
    { label: "Você (clientes ativos)", value: activeClients, color: "bg-amber-500", text: "text-amber-700", isSelf: true },
  ];

  // Penetração da operação em cada tier
  const penR = {
    tam: tamRev ? annualRevenue / tamRev : null,
    sam: samRev ? annualRevenue / samRev : null,
    som: somRev ? annualRevenue / somRev : null,
  };
  const penP = {
    tam: tamPpl ? activeClients / tamPpl : null,
    sam: samPpl ? activeClients / samPpl : null,
    som: somPpl ? activeClients / somPpl : null,
  };

  const gapSomRev = somRev ? somRev - annualRevenue : null;
  const gapSomPpl = somPpl ? somPpl - activeClients : null;

  return (
    <Card className="ring-1 ring-amber-500/20 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent">
      <CardContent className="p-5 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Crosshair className="h-4 w-4 text-amber-600" />
              Você × Mercado — onde estão seus pontos cegos
            </h3>
            <p className="text-xs text-muted-foreground">
              Sua operação atual comparada ao TAM/SAM/SOM calculados acima.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <MetricPill label="Clientes ativos" value={activeClients.toLocaleString("pt-BR")} />
            <MetricPill label="Ticket médio" value={fmtBigBRL(avgTicket)} />
            <MetricPill label="Receita anualizada" value={fmtBigBRL(annualRevenue)} />
            {typeof churnRate === "number" && (
              <MetricPill label="Churn" value={`${(churnRate * 100).toFixed(1)}%`} />
            )}
          </div>
        </div>

        {/* Receita R$ */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Receita anual (R$)
            </p>
            {penR.som !== null && (
              <span className="text-[11px] text-muted-foreground">
                Penetração SOM: <strong className="text-amber-700">{fmtPct(penR.som)}</strong>
                {penR.sam !== null && <> · SAM: <strong>{fmtPct(penR.sam)}</strong></>}
                {penR.tam !== null && <> · TAM: <strong>{fmtPct(penR.tam)}</strong></>}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {revenueBars.map((b) => (
              <BarRow
                key={b.label}
                label={b.label}
                value={b.value}
                max={maxRev}
                color={b.color}
                text={b.text}
                isSelf={b.isSelf}
                format={fmtBigBRL}
              />
            ))}
          </div>
          {gapSomRev !== null && gapSomRev > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              💡 Gap para atingir o SOM em 12 meses:{" "}
              <strong className="text-emerald-700">{fmtBigBRL(gapSomRev)}</strong> — equivalente a{" "}
              {avgTicket > 0 ? Math.ceil(gapSomRev / avgTicket).toLocaleString("pt-BR") : "?"} contratos
              no seu ticket médio atual.
            </p>
          )}
        </div>

        {/* Clientes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Clientes / profissionais
            </p>
            {penP.som !== null && (
              <span className="text-[11px] text-muted-foreground">
                Penetração SOM: <strong className="text-amber-700">{fmtPct(penP.som)}</strong>
                {penP.sam !== null && <> · SAM: <strong>{fmtPct(penP.sam)}</strong></>}
                {penP.tam !== null && <> · TAM: <strong>{fmtPct(penP.tam)}</strong></>}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {peopleBars.map((b) => (
              <BarRow
                key={b.label}
                label={b.label}
                value={b.value}
                max={maxPpl}
                color={b.color}
                text={b.text}
                isSelf={b.isSelf}
                format={fmtBigNum}
              />
            ))}
          </div>
          {gapSomPpl !== null && gapSomPpl > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              💡 Faltam <strong className="text-emerald-700">{fmtBigNum(gapSomPpl)}</strong>{" "}
              clientes para capturar todo o SOM projetado.
            </p>
          )}
        </div>

        <div className="rounded-md border bg-background/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Como ler:</strong> se sua penetração no SOM já passa de
          10%, o teto de curto prazo está próximo — o próximo salto vem de expandir SAM (novas faixas
          de ticket ou novo perfil). Se está abaixo de 1%, existe espaço enorme para escalar sem
          mudar produto. Ajuste as faixas no topo e recalcule para testar cenários.
        </div>
      </CardContent>
    </Card>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background px-2.5 py-1">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground leading-none">{label}</p>
      <p className="text-sm font-semibold tabular-nums leading-tight">{value}</p>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  color,
  text,
  isSelf,
  format,
}: {
  label: string;
  value: number | null;
  max: number;
  color: string;
  text: string;
  isSelf?: boolean;
  format: (n: number) => string;
}) {
  const pct = value && max > 0 ? Math.max(1, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className={`font-medium ${isSelf ? text : "text-foreground"}`}>
          {isSelf && "▸ "}{label}
        </span>
        <span className={`tabular-nums font-semibold ${isSelf ? text : "text-muted-foreground"}`}>
          {value ? format(value) : "—"}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        {value ? (
          <div
            className={`h-full ${color} ${isSelf ? "ring-2 ring-amber-500/40" : ""} transition-all`}
            style={{ width: `${pct}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}
