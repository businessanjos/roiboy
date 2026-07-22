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
} from "lucide-react";
import { extractHeadline } from "./marketBenchmarks";
import { extractEdgeFunctionError } from "@/lib/edgeFunctionError";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Row = { id: string; query: string; answer: string; created_at: string };

type Band = { label: string; min: number; max: number };

const DEFAULT_BANDS: Band[] = [
  { label: "Entrada", min: 997, max: 5000 },
  { label: "Intermediário", min: 5000, max: 40000 },
  { label: "Premium", min: 40000, max: 200000 },
  { label: "Conselho / High-ticket", min: 200000, max: 500000 },
];

const STORAGE_KEY = "mi_tsm_bands_v1";

const EXCLUSAO =
  "IMPORTANTE: considere APENAS profissionais e clínicas de ESTÉTICA AVANÇADA/MÉDICA (procedimentos estéticos, injetáveis, laser, tecnologias, harmonização facial/corporal, dermato, HOF). EXCLUA salões de beleza, barbearias, cabeleireiros, manicure/pedicure, depilação simples, estética capilar, SPAs de relaxamento e centros de bem-estar sem procedimentos estéticos.";

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
  buildQuery: (bands: Band[]) => string;
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
    buildQuery: (bands) => {
      const { lines } = bandsBlock(bands);
      return `Calcule o TAM (Total Addressable Market) do universo de ESTÉTICA AVANÇADA/MÉDICA no Brasil considerando TODOS os profissionais e clínicas do setor, sem filtro por ticket ou faturamento.

${EXCLUSAO}

${buildPortfolio(bands)}

Faixas de ticket a considerar na análise:
${lines}

Traga:
1. **Número total** de profissionais + clínicas do setor no Brasil (soma consolidada, com fonte).
2. **Faturamento anual estimado do setor** (R$ bilhões, com CAGR dos últimos 3 anos).
3. **Composição**: quantos são médicos (dermato + outras especialidades), quantos dentistas com HOF, quantos biomédicos estetas, quantos esteticistas com formação avançada, quantas clínicas PJ.
4. **TAM em R$** = faturamento potencial se 100% do universo consumisse produtos de educação/mentoria/comunidade dentro das faixas acima (estime uma média ponderada realista distribuindo o universo pelas faixas).

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
    buildQuery: (bands) => {
      const { lines, minTicket } = bandsBlock(bands);
      return `Calcule o SAM (Serviceable Addressable Market) para a Eternum Mentoring Club no Brasil.

${EXCLUSAO}

${buildPortfolio(bands)}

Perfil Eternum: profissional de estética avançada JÁ EM OPERAÇÃO (não iniciante puro), buscando escalar clínica/autoridade/faturamento.

Traga:
1. **Número de profissionais + clínicas** que se encaixam nesse perfil (excluir estudantes, aposentados, quem faturou menos que o suficiente para investir ${fmtBRL(minTicket)}/ano em educação).
2. **Segmentação por capacidade de investimento anual em educação/mentoria** (use EXATAMENTE estas faixas — quantidade estimada em cada uma):
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
    buildQuery: (bands) => {
      const { lines } = bandsBlock(bands);
      return `Calcule o SOM (Serviceable Obtainable Market) da Eternum Mentoring Club para os PRÓXIMOS 12 MESES no Brasil.

${EXCLUSAO}

${buildPortfolio(bands)}

Faixas de ticket definidas pelo usuário:
${lines}

Considere benchmarks de conversão realistas para negócios de educação/mentoria B2P no Brasil:
- Penetração típica de líderes de nicho em mercados fragmentados: 0,5% a 3% do SAM em 12 meses.
- High-ticket (>R$ 40k/ano) exige alta autoridade e tráfego qualificado — normalmente <0,3% do SAM/ano.
- Produtos de entrada escalam mais rápido — 1% a 5% do SAM/ano é plausível para marca consolidada.

Traga:
1. **Número de clientes capturáveis em 12 meses**, quebrado por CADA faixa acima.
2. **Receita capturável em 12 meses (R$)** — soma das faixas.
3. **Premissas explícitas** por faixa (% conversão sobre SAM, CAC assumido, comparativos com players como Fernando Kimura, Mentoria Kaizen, iCEV, Faculdade Inspirar, Instituto BWS).
4. **Pontos cegos** — quais faixas estão SUBEXPLORADAS ou não atendidas hoje pela operação, e quanto de receita a Eternum está deixando na mesa por não ter produto/canal para elas.`;
    },
  },
];

interface Props {
  onOpenDetail?: (query: string) => void;
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

export function TamSamSomCards({ onOpenDetail }: Props) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [running, setRunning] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [bands, setBands] = useState<Band[]>(() => loadBands());

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
        .select("id, query, answer, created_at")
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
                  {latest && onOpenDetail && (
                    <button
                      type="button"
                      onClick={() => onOpenDetail(query)}
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Ver memória de cálculo <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
